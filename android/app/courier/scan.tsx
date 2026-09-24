import { useCallback, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useLocalSearchParams, useRouter } from 'expo-router'
import NetInfo from '@react-native-community/netinfo'
import { useQueryClient } from '@tanstack/react-query'
import { courierApi, qrApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { useColors } from '../../src/store/theme'
import { useI18n, type TranslationKey } from '../../src/store/i18n'
import { statusLabel } from '../../src/lib/statusLabels'
import { formatMoney } from '../../src/lib/money'
import { invalidateCourierMission, productVerificationBody } from '../../src/lib/courier'
import type { HandoverVerificationResult, OrderItemQRResolution, QRScanResponse } from '../../src/types'

/**
 * PICKUP / DELIVERY scan the package QR; PRODUCT checks a product label at the
 * door; ITEM reads the per-order-item QR. ITEM is a read: it identifies one
 * ordered line and changes no order state, so it carries no idempotency key and
 * never replaces the pickup or handover scans above.
 */
type ScanType = 'PICKUP' | 'DELIVERY' | 'PRODUCT' | 'ITEM'

/** What the courier is shown. `pending` is the offline state: captured, not yet confirmed. */
type Outcome =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'pending'; token: string; message: string }
  | { kind: 'done'; response: QRScanResponse }
  | { kind: 'verified'; result: HandoverVerificationResult }
  | { kind: 'resolved'; result: OrderItemQRResolution }
  | { kind: 'error'; message: string }

/**
 * Courier QR handover scanner.
 *
 * Two rules drive this screen:
 *  - Nothing is reported as complete until the backend acknowledges it. A scan taken with
 *    no connectivity shows "waiting for network", never a success.
 *  - Every attempt carries a stable idempotency key, so the retry that follows a timeout
 *    cannot produce a second pickup or delivery event.
 */
export default function CourierScanScreen() {
  const c = useColors()
  const { t } = useI18n()
  const styles = useMemo(() => makeStyles(c), [c])
  const router = useRouter()
  const params = useLocalSearchParams<{ type?: string; order_id?: string }>()
  const scanType: ScanType =
    params.type === 'DELIVERY' ? 'DELIVERY'
      : params.type === 'PRODUCT' ? 'PRODUCT'
        : params.type === 'ITEM' ? 'ITEM'
          : 'PICKUP'
  const queryClient = useQueryClient()
  // Typed fallback when the camera cannot read the label: same endpoints, same checks.
  const [manualCode, setManualCode] = useState('')

  const [permission, requestPermission] = useCameraPermissions()
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' })
  // Guards against the camera firing the same code many times per second while in flight.
  const busy = useRef(false)
  // One key per captured code, so a retry of THAT scan stays the same logical attempt.
  const idempotencyKey = useRef('')

  const submit = useCallback(
    async (token: string, key: string) => {
      setOutcome({ kind: 'sending' })
      try {
        if (scanType === 'ITEM') {
          // The token is opaque. It is posted exactly as scanned and never decoded
          // here: the backend authenticates the courier, resolves their role and
          // returns only the fields a courier may see.
          const result = await qrApi.resolve(token)
          setOutcome({ kind: 'resolved', result })
          return
        }
        if (scanType === 'PRODUCT') {
          if (!params.order_id) throw new ApiError(400, 'QR_INVALID', t('courier.scan.invalid'))
          const result = await courierApi.verifyProduct(params.order_id, productVerificationBody(token))
          invalidateCourierMission(queryClient, params.order_id)
          // A mismatch is a verdict, not a transport error: show which kind it was.
          if (result.result === 'VALID' || result.result === 'ALREADY_USED') setOutcome({ kind: 'verified', result })
          else setOutcome({ kind: 'error', message: t(`courier.verdict.${result.result}` as TranslationKey) })
          return
        }
        const scan = scanType === 'PICKUP' ? courierApi.scanPickup : courierApi.scanDelivery
        const response = await scan({
          token,
          order_id: params.order_id || undefined,
          idempotency_key: key,
          device_metadata: { scan_type: scanType },
        })
        setOutcome({ kind: 'done', response })
        invalidateCourierMission(queryClient, params.order_id || response.order_id)
      } catch (e) {
        // A transport failure is NOT a rejection: the scan may or may not have landed.
        // Say so honestly and let the courier retry under the same idempotency key.
        const online = (await NetInfo.fetch()).isConnected
        if (!online) {
          setOutcome({ kind: 'pending', token, message: t('courier.scan.offline') })
          return
        }
        const code = e instanceof ApiError ? e.code : ''
        if (scanType === 'ITEM') {
          // parse() is kind-bound server-side, so a package token scanned here comes
          // back QR_INVALID rather than resolving into the wrong flow.
          setOutcome({
            kind: 'error',
            message: t(
              code === 'QR_INVALID' ? 'itemQr.error.wrongKind'
                : code === 'QR_FORBIDDEN' || code === 'QR_WRONG_COURIER' ? 'itemQr.error.forbidden'
                  : code === 'QR_NOT_READY' ? 'itemQr.error.notFound'
                    : 'itemQr.error.generic'
            ),
          })
          return
        }
        const message = code === 'QR_WRONG_COURIER'
          ? t('courier.scan.wrongCourier')
          : code === 'QR_NOT_OPERATIONAL'
            ? t('courier.scan.wrongStatus')
            : code === 'QR_INVALID'
              ? t('courier.scan.invalid')
              : t('courier.scan.rejected')
        setOutcome({ kind: 'error', message })
        invalidateCourierMission(queryClient, params.order_id)
      } finally {
        busy.current = false
      }
    },
    [params.order_id, queryClient, scanType, t]
  )

  const onScanned = useCallback(
    ({ data }: { data: string }) => {
      if (busy.current || !data) return
      busy.current = true
      idempotencyKey.current = scanType + ':' + data + ':' + Date.now()
      void submit(data, idempotencyKey.current)
    },
    [scanType, submit]
  )

  function submitManual() {
    const code = manualCode.trim()
    if (busy.current || !code) return
    busy.current = true
    idempotencyKey.current = scanType + ':' + code + ':' + Date.now()
    setManualCode('')
    void submit(code, idempotencyKey.current)
  }

  function reset() {
    busy.current = false
    idempotencyKey.current = ''
    setOutcome({ kind: 'idle' })
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.green} />
      </View>
    )
  }

  const scanning = outcome.kind === 'idle'

  // Typing the printed code is the fallback when the camera cannot be used, so it
  // must stay reachable when camera access is refused, not only once it is granted.
  const manualEntry = (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.manual}>
      <Text style={styles.body}>{t(scanType === 'PRODUCT' ? 'courier.manualCode' : 'courier.scan.manualLabel')}</Text>
      <TextInput
        value={manualCode}
        onChangeText={setManualCode}
        autoCapitalize={scanType === 'PRODUCT' ? 'characters' : 'none'}
        autoCorrect={false}
        placeholder={scanType === 'PRODUCT' ? 'PRD-… / VAR-…' : 'tbk.…'}
        placeholderTextColor={c.muted}
        style={styles.input}
        onSubmitEditing={submitManual}
        returnKeyType="done"
      />
      <Pressable style={[styles.primary, !manualCode.trim() && styles.disabled]} disabled={!manualCode.trim()} onPress={submitManual}>
        <Text style={styles.primaryText}>{t('courier.verifyCode')}</Text>
      </Pressable>
    </KeyboardAvoidingView>
  )

  if (!permission.granted && scanning) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{t('courier.scan.cameraRequired')}</Text>
        <Text style={styles.body}>{t('courier.scan.cameraBody')}</Text>
        <Pressable style={styles.primary} onPress={() => void requestPermission()}>
          <Text style={styles.primaryText}>{t('courier.scan.allowCamera')}</Text>
        </Pressable>
        {manualEntry}
      </View>
    )
  }

  return (
    <View style={styles.fill}>
      {scanning && permission.granted && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          // Gallery uploads are deliberately not accepted: a handover must be scanned live.
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onScanned}
        />
      )}

      <View style={styles.overlay} pointerEvents="box-none">
        <Text style={styles.heading}>
          {t(
            scanType === 'PICKUP' ? 'courier.scan.pickupTitle'
              : scanType === 'PRODUCT' ? 'courier.scan.productTitle'
                : scanType === 'ITEM' ? 'courier.scan.itemTitle'
                  : 'courier.scan.deliveryTitle'
          )}
        </Text>

        {scanning && <View style={styles.reticle} />}

        {scanning && manualEntry}

        {outcome.kind === 'sending' && (
          <View style={styles.panel}>
            <ActivityIndicator color={c.green} />
            <Text style={styles.body}>{t(scanType === 'ITEM' ? 'courier.scan.resolving' : 'courier.scan.verifying')}</Text>
          </View>
        )}

        {outcome.kind === 'pending' && (
          <View style={styles.panel}>
            <Text style={styles.pending}>{outcome.message}</Text>
            <Text style={styles.body}>{t('courier.scan.pendingBody')}</Text>
            <Pressable style={styles.primary} onPress={() => void submit(outcome.token, idempotencyKey.current)}>
              <Text style={styles.primaryText}>{t('courier.scan.retry')}</Text>
            </Pressable>
          </View>
        )}

        {outcome.kind === 'done' && (
          <View style={styles.panel}>
            <Text style={styles.success}>
              {t(outcome.response.result === 'DUPLICATE'
                ? 'courier.scan.duplicate'
                : scanType === 'PICKUP' ? 'courier.scan.pickupSuccess' : 'courier.scan.deliverySuccess')}
            </Text>
            <Text style={styles.body}>{t('common.status')}: {statusLabel(t, outcome.response.delivery_status)}</Text>
            {outcome.response.requires_buyer_confirmation && (
              <Text style={styles.body}>{t('courier.scan.waitingBuyer')}</Text>
            )}
            <Pressable style={styles.primary} onPress={() => router.back()}>
              <Text style={styles.primaryText}>{t('courier.scan.finish')}</Text>
            </Pressable>
          </View>
        )}

        {outcome.kind === 'verified' && (
          <View style={styles.panel}>
            <Text style={styles.success}>{t(`courier.verdict.${outcome.result.result}` as TranslationKey)}</Text>
            {outcome.result.product_name ? <Text style={styles.body}>{outcome.result.product_name}{outcome.result.variant_name ? ` · ${outcome.result.variant_name}` : ''}</Text> : null}
            <Pressable style={styles.primary} onPress={reset}>
              <Text style={styles.primaryText}>{t('courier.scan.scanAgain')}</Text>
            </Pressable>
            <Pressable style={styles.primary} onPress={() => router.back()}>
              <Text style={styles.primaryText}>{t('courier.scan.finish')}</Text>
            </Pressable>
          </View>
        )}

        {outcome.kind === 'resolved' && <ResolvedItemCard result={outcome.result} styles={styles} onScanAgain={reset} onFinish={() => router.back()} />}

        {outcome.kind === 'error' && (
          <View style={styles.panel}>
            <Text style={styles.error}>{outcome.message}</Text>
            <Pressable style={styles.primary} onPress={reset}>
              <Text style={styles.primaryText}>{t('courier.scan.scanAgain')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  )
}

/**
 * What a courier is shown after resolving an ORDER_ITEM QR.
 *
 * It renders the response and nothing else. Fields the backend withheld for this
 * role are simply absent and are never reconstructed from anything else on the
 * screen — in particular there is no unit price here, only the single figure the
 * server says is due at the door. `amount_to_collect` missing or zero means the
 * order is already paid: that reads "rien a encaisser", never "0".
 */
function ResolvedItemCard({
  result,
  styles,
  onScanAgain,
  onFinish,
}: {
  result: OrderItemQRResolution
  styles: ReturnType<typeof makeStyles>
  onScanAgain: () => void
  onFinish: () => void
}) {
  const { t } = useI18n()
  const address = result.delivery_address
  const collect = result.price?.amount_to_collect ?? 0
  const currency = result.price?.currency || ''
  const addressLine = [address?.street, address?.building_number, address?.commune, address?.city, address?.province]
    .filter(Boolean)
    .join(', ')
  const recipient = address?.recipient_name || result.buyer?.display_name || ''
  const recipientPhone = address?.recipient_phone || result.buyer?.phone || ''

  return (
    <View style={styles.panel}>
      <Text style={styles.success}>{t('courier.scan.itemResolved')}</Text>

      <Text style={styles.itemName}>
        {result.product.product_name}
        {result.product.variant_name ? ` · ${result.product.variant_name}` : ''}
      </Text>
      <Text style={styles.body}>
        {t('itemQr.labelQuantity')}: {result.product.quantity}
      </Text>
      <Text style={styles.body}>
        {t('itemQr.labelOrder')}: {result.order.order_number}
      </Text>
      <Text style={styles.body}>
        {t('itemQr.labelReference')}: {result.qr.reference}
      </Text>

      {recipient ? (
        <Text style={styles.body}>
          {t('itemQr.labelRecipient')}: {recipient}
          {recipientPhone ? ` · ${recipientPhone}` : ''}
        </Text>
      ) : null}
      {addressLine ? (
        <Text style={styles.body}>
          {t('itemQr.labelAddress')}: {addressLine}
        </Text>
      ) : null}
      {address?.delivery_instructions ? (
        <Text style={styles.body}>
          {t('itemQr.labelInstructions')}: {address.delivery_instructions}
        </Text>
      ) : null}

      {collect > 0 ? (
        <Text style={styles.collect}>
          {t('itemQr.amountToCollect')}: {formatMoney(collect, currency || undefined)}
        </Text>
      ) : (
        <Text style={styles.noCollect}>
          {t('itemQr.nothingToCollect')}
          {currency ? ` (${currency})` : ''}
        </Text>
      )}

      <Pressable style={styles.primary} onPress={onScanAgain}>
        <Text style={styles.primaryText}>{t('courier.scan.scanAgain')}</Text>
      </Pressable>
      <Pressable style={styles.primary} onPress={onFinish}>
        <Text style={styles.primaryText}>{t('courier.scan.finish')}</Text>
      </Pressable>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: '#000' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: c.cream, gap: 12 },
    overlay: { flex: 1, alignItems: 'center', justifyContent: 'space-between', padding: 24, paddingTop: 64 },
    heading: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
    reticle: { width: 240, height: 240, borderWidth: 3, borderColor: '#fff', borderRadius: 16 },
    panel: { width: '100%', backgroundColor: c.white, borderRadius: 14, padding: 20, gap: 10, alignItems: 'center' },
    title: { fontSize: 18, fontWeight: '700', color: c.ink, textAlign: 'center' },
    body: { fontSize: 14, color: c.muted, textAlign: 'center' },
    success: { fontSize: 17, fontWeight: '700', color: c.green, textAlign: 'center' },
    pending: { fontSize: 17, fontWeight: '700', color: c.gold, textAlign: 'center' },
    error: { fontSize: 16, fontWeight: '700', color: '#B3261E', textAlign: 'center' },
    itemName: { fontSize: 16, fontWeight: '700', color: c.ink, textAlign: 'center' },
    collect: { fontSize: 18, fontWeight: '800', color: c.ink, textAlign: 'center', marginTop: 4 },
    noCollect: { fontSize: 15, fontWeight: '700', color: c.muted, textAlign: 'center', marginTop: 4 },
    primary: { backgroundColor: c.green, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 10, marginTop: 4 },
    primaryText: { color: c.white, fontWeight: '700', fontSize: 15 },
    disabled: { opacity: 0.5 },
    manual: { width: '100%', backgroundColor: c.white, borderRadius: 14, padding: 14, gap: 8, alignItems: 'stretch' },
    input: { minHeight: 44, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 12, color: c.ink, backgroundColor: c.cream },
  })
}
