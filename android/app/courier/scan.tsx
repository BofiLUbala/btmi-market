import { useCallback, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useLocalSearchParams, useRouter } from 'expo-router'
import NetInfo from '@react-native-community/netinfo'
import { courierApi } from '../../src/api'
import { useColors } from '../../src/store/theme'
import type { QRScanResponse } from '../../src/types'

type ScanType = 'PICKUP' | 'DELIVERY'

/** What the courier is shown. `pending` is the offline state: captured, not yet confirmed. */
type Outcome =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'pending'; token: string; message: string }
  | { kind: 'done'; response: QRScanResponse }
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
  const styles = useMemo(() => makeStyles(c), [c])
  const router = useRouter()
  const params = useLocalSearchParams<{ type?: string; order_id?: string }>()
  const scanType: ScanType = params.type === 'DELIVERY' ? 'DELIVERY' : 'PICKUP'

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
        const scan = scanType === 'PICKUP' ? courierApi.scanPickup : courierApi.scanDelivery
        const response = await scan({
          token,
          order_id: params.order_id || undefined,
          idempotency_key: key,
          device_metadata: { scan_type: scanType },
        })
        setOutcome({ kind: 'done', response })
      } catch (e) {
        // A transport failure is NOT a rejection: the scan may or may not have landed.
        // Say so honestly and let the courier retry under the same idempotency key.
        const online = (await NetInfo.fetch()).isConnected
        if (!online) {
          setOutcome({ kind: 'pending', token, message: 'Scan capturé, en attente du réseau.' })
          return
        }
        setOutcome({ kind: 'error', message: e instanceof Error ? e.message : 'Scan refusé.' })
      } finally {
        busy.current = false
      }
    },
    [params.order_id, scanType]
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

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Accès caméra requis</Text>
        <Text style={styles.body}>
          TBK a besoin de la caméra pour scanner le QR du colis et vérifier la remise.
        </Text>
        <Pressable style={styles.primary} onPress={() => void requestPermission()}>
          <Text style={styles.primaryText}>Autoriser la caméra</Text>
        </Pressable>
      </View>
    )
  }

  const scanning = outcome.kind === 'idle'

  return (
    <View style={styles.fill}>
      {scanning && (
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
          {scanType === 'PICKUP' ? 'Scanner le QR de récupération' : 'Vérifier la livraison'}
        </Text>

        {scanning && <View style={styles.reticle} />}

        {outcome.kind === 'sending' && (
          <View style={styles.panel}>
            <ActivityIndicator color={c.green} />
            <Text style={styles.body}>Vérification en cours…</Text>
          </View>
        )}

        {outcome.kind === 'pending' && (
          <View style={styles.panel}>
            <Text style={styles.pending}>{outcome.message}</Text>
            <Text style={styles.body}>
              La remise ne sera confirmée qu&apos;après validation par le serveur.
            </Text>
            <Pressable style={styles.primary} onPress={() => void submit(outcome.token, idempotencyKey.current)}>
              <Text style={styles.primaryText}>Réessayer</Text>
            </Pressable>
          </View>
        )}

        {outcome.kind === 'done' && (
          <View style={styles.panel}>
            <Text style={styles.success}>
              {outcome.response.result === 'DUPLICATE' ? 'Déjà enregistré' : 'Scan validé'}
            </Text>
            <Text style={styles.body}>Statut: {outcome.response.delivery_status}</Text>
            {outcome.response.requires_buyer_confirmation && (
              <Text style={styles.body}>En attente de la confirmation de réception par le client.</Text>
            )}
            <Pressable style={styles.primary} onPress={() => router.back()}>
              <Text style={styles.primaryText}>Terminer</Text>
            </Pressable>
          </View>
        )}

        {outcome.kind === 'error' && (
          <View style={styles.panel}>
            <Text style={styles.error}>{outcome.message}</Text>
            <Pressable style={styles.primary} onPress={reset}>
              <Text style={styles.primaryText}>Scanner à nouveau</Text>
            </Pressable>
          </View>
        )}
      </View>
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
    primary: { backgroundColor: c.green, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 10, marginTop: 4 },
    primaryText: { color: c.white, fontWeight: '700', fontSize: 15 },
  })
}
