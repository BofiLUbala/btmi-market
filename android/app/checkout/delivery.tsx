import { useEffect, useMemo, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import { buyerApi } from '../../src/api'
import { useAuth } from '../../src/store/auth'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../src/components/ui'
import { colors, radius, spacing } from '../../src/theme'
import type { DeliveryMethod } from '../../src/types'

const money = (value: number) => `${Math.round(value).toLocaleString('fr-FR')} FC`

const METHOD_LABEL: Record<string, string> = {
  PICKUP: 'Retrait en boutique',
  SHOP_DELIVERY: 'Livraison par la boutique',
  PARTNER: 'Livraison par un partenaire',
}
const METHOD_HINT: Record<string, string> = {
  PICKUP: 'Vous récupérez la commande directement à la boutique.',
  SHOP_DELIVERY: 'La boutique vous livre à l’adresse indiquée.',
  PARTNER: 'Un partenaire de livraison vous apporte la commande.',
}

export default function DeliveryScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>()
  const user = useAuth((state) => state.user)

  const [method, setMethod] = useState<DeliveryMethod>('PICKUP')
  const [usePoints, setUsePoints] = useState(false)
  const [previewFee, setPreviewFee] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [contact, setContact] = useState({
    contact_name: user ? `${user.first_name} ${user.last_name}`.trim() : '',
    phone: user?.phone ?? '',
    address: '',
    notes: '',
  })

  const options = useQuery({
    queryKey: ['checkout', 'delivery-options', orderId],
    queryFn: () => buyerApi.deliveryOptions(orderId!),
    enabled: Boolean(orderId),
  })

  // Start on whichever method the order already carries.
  useEffect(() => {
    const current = options.data?.options.find((o) => o.method === options.data?.current_method)
    if (current?.available) setMethod(current.method)
  }, [options.data])

  const selected = useMemo(
    () => options.data?.options.find((o) => o.method === method) ?? null,
    [options.data, method]
  )

  const needsAddress = method !== 'PICKUP'
  const formInvalid =
    needsAddress &&
    (!contact.contact_name.trim() || !contact.phone.trim() || !contact.address.trim())

  const pointsMutation = useMutation({
    mutationFn: (next: boolean) => buyerApi.deliveryPointsPreview(orderId!, next),
    onSuccess: (data) => setPreviewFee(data.fee_final),
    onError: () => setPreviewFee(null),
  })

  const selectMutation = useMutation({
    mutationFn: () =>
      buyerApi.selectDelivery(orderId!, {
        method,
        use_points_for_delivery: usePoints,
        contact_name: contact.contact_name.trim(),
        phone: contact.phone.trim(),
        address: contact.address.trim(),
        notes: contact.notes.trim(),
      }),
    onSuccess: () => router.push({ pathname: '/checkout/payment', params: { orderId } }),
    onError: () => setError('Le mode de livraison n’a pas pu être enregistré. Réessayez.'),
  })

  function togglePoints() {
    const next = !usePoints
    setUsePoints(next)
    if (orderId) pointsMutation.mutate(next)
  }

  function submit() {
    if (formInvalid) {
      setError('Renseignez le nom, le téléphone et l’adresse de livraison.')
      return
    }
    setError('')
    selectMutation.mutate()
  }

  if (!orderId) return <ErrorState message="Commande introuvable." retry={() => router.replace('/(buyer)/cart')} />
  if (options.isLoading) return <Loading label="Chargement des options de livraison…" />
  if (options.isError || !options.data) {
    return <ErrorState message="Impossible de charger les options de livraison." retry={() => options.refetch()} />
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.steps}>
          <Text style={styles.stepDone}>1 Panier</Text>
          <Text style={styles.stepActive}>2 Livraison</Text>
          <Text style={styles.stepNext}>3 Paiement</Text>
        </View>

        <SectionTitle title="Mode de livraison" />

        {options.data.options.map((option) => {
          const active = method === option.method
          return (
            <Card key={option.method} onPress={option.available ? () => setMethod(option.method) : undefined}>
              <View style={[styles.option, active && styles.optionActive, !option.available && styles.optionOff]}>
                <Ionicons
                  name={active ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={option.available ? colors.green : colors.muted}
                />
                <View style={styles.optionBody}>
                  <Text style={styles.optionTitle}>{METHOD_LABEL[option.method] ?? option.label}</Text>
                  <Text style={styles.muted}>{METHOD_HINT[option.method] ?? ''}</Text>
                  {option.provider ? <Text style={styles.muted}>Assurée par {option.provider}</Text> : null}
                </View>
                <Text style={option.available ? styles.fee : styles.muted}>
                  {option.available ? money(option.fee) : 'Indisponible'}
                </Text>
              </View>
            </Card>
          )
        })}

        {selected && selected.fee > 0 ? (
          <Card>
            <View style={styles.rowBetween}>
              <Text style={styles.optionTitle}>Payer la livraison en points</Text>
              <Button
                variant={usePoints ? 'primary' : 'outline'}
                title={usePoints ? 'Activé' : 'Activer'}
                onPress={togglePoints}
              />
            </View>
            {usePoints && previewFee !== null ? (
              <Text style={styles.pointsNote}>
                Frais de livraison : {money(selected.fee)} → {money(previewFee)}
              </Text>
            ) : (
              <Text style={styles.muted}>Utilisez vos points pour réduire les frais.</Text>
            )}
          </Card>
        ) : null}

        {needsAddress ? (
          <Card>
            <Text style={styles.optionTitle}>Coordonnées de livraison</Text>
            <Field
              label="Nom du contact"
              value={contact.contact_name}
              onChangeText={(v) => setContact({ ...contact, contact_name: v })}
            />
            <Field
              label="Téléphone"
              value={contact.phone}
              keyboardType="phone-pad"
              onChangeText={(v) => setContact({ ...contact, phone: v })}
            />
            <Field
              label="Adresse de livraison"
              value={contact.address}
              placeholder="Commune, avenue, numéro…"
              onChangeText={(v) => setContact({ ...contact, address: v })}
            />
            <Field
              label="Instructions (facultatif)"
              value={contact.notes}
              multiline
              onChangeText={(v) => setContact({ ...contact, notes: v })}
            />
          </Card>
        ) : (
          <Card>
            <Text style={styles.muted}>
              Vous récupérerez cette commande à la boutique. Aucune adresse n’est nécessaire.
            </Text>
          </Card>
        )}

        {error ? <ErrorState message={error} /> : null}

        <Button
          title="Continuer vers le paiement"
          loading={selectMutation.isPending}
          disabled={formInvalid}
          onPress={submit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  steps: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  stepDone: { color: colors.green, fontWeight: '800', fontSize: 12 },
  stepActive: { color: colors.ink, fontWeight: '900', fontSize: 12 },
  stepNext: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.sm },
  optionActive: {},
  optionOff: { opacity: 0.5 },
  optionBody: { flex: 1, gap: 2 },
  optionTitle: { color: colors.ink, fontWeight: '800', fontSize: 16 },
  muted: { color: colors.muted, fontSize: 13 },
  fee: { color: colors.green, fontWeight: '900' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  pointsNote: { color: colors.success, fontWeight: '700' },
})
