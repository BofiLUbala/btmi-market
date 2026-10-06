import { router, useLocalSearchParams } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Image } from 'expo-image'
import Ionicons from '@expo/vector-icons/Ionicons'
import { buyerApi } from '../../src/api'
import { resolveMediaUrl } from '../../src/api/client'
import { Button, ErrorState } from '../../src/components/ui'
import { useI18n, useT, type TranslationKey } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { fonts, radius, shadow, spacing, type Colors } from '../../src/theme'

function Stars({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const t = useT()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return <View style={styles.starBlock}>
    <Text style={styles.starLabel}>{label}</Text>
    <View style={styles.stars}>{[1, 2, 3, 4, 5].map(n => <Pressable key={n} onPress={() => onChange(n)} accessibilityLabel={t('review.starsLabel', { count: n })} hitSlop={4}><Text style={[styles.star, n <= value && styles.on]}>★</Text></Pressable>)}</View>
    {value > 0 ? <Text style={styles.ratingWord}>{t(`review.rating${value}` as TranslationKey)}</Text> : null}
  </View>
}

export default function WriteReview() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const p = useLocalSearchParams<{ orderId: string; lineId?: string; reviewId?: string; type?: string; productName?: string; imageUrl?: string }>()
  const [rating, setRating] = useState(0), [delivery, setDelivery] = useState(0), [service, setService] = useState(0), [experience, setExperience] = useState(0), [comment, setComment] = useState('')
  const qc = useQueryClient()
  const isService = p.type === 'service'
  // Editing: start from the review the buyer already published.
  const mine = useQuery({ queryKey: ['buyer', 'reviews'], queryFn: buyerApi.reviews, enabled: Boolean(p.reviewId) })
  const existing = p.reviewId ? mine.data?.reviews?.find((r) => r.id === p.reviewId) : undefined
  const [prefilled, setPrefilled] = useState(false)
  useEffect(() => {
    if (!existing || prefilled) return
    setRating(existing.rating || 0)
    setComment(existing.comment || '')
    setPrefilled(true)
  }, [existing, prefilled])
  const mutation = useMutation({
    mutationFn: () => isService ? buyerApi.createServiceReview(p.orderId!, delivery, service, experience, comment) : p.reviewId ? buyerApi.updateReview(p.reviewId, rating, comment) : buyerApi.createReview(p.orderId!, p.lineId!, rating, comment),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['review-eligibility'] }); await qc.invalidateQueries({ queryKey: ['buyer', 'reviews'] }); await qc.invalidateQueries({ queryKey: ['marketplace', 'product'] }); router.back() },
  })
  const valid = isService ? [delivery, service, experience].every(Boolean) : rating > 0
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <Text style={styles.h1}>{isService ? t('review.orderExperience') : t('review.productReview')}</Text>
    {/* Product row card (reference 17) */}
    {p.productName ? <View style={[styles.card, styles.productRow]}>
      <View style={styles.thumb}>{p.imageUrl ? <Image source={resolveMediaUrl(p.imageUrl)} style={styles.thumbImg} contentFit="cover" /> : <Ionicons name={isService ? 'storefront-outline' : 'cube-outline'} size={22} color={colors.green} />}</View>
      <Text style={styles.productName} numberOfLines={2}>{p.productName}</Text>
    </View> : null}
    {/* Centered rating card */}
    <View style={[styles.card, styles.ratingCard]}>
      <Text style={styles.satisfied}>{t('review.satisfied')}</Text>
      {isService ? <>
        <Stars label={t('review.delivery')} value={delivery} onChange={setDelivery} />
        <Stars label={t('review.shopService')} value={service} onChange={setService} />
        <Stars label={t('review.overall')} value={experience} onChange={setExperience} />
      </> : <Stars label={t('review.productQuality')} value={rating} onChange={setRating} />}
    </View>
    {/* Comment textarea card */}
    <View style={styles.card}>
      <Text style={styles.label}>{t('review.comment')}</Text>
      <TextInput style={styles.input} multiline maxLength={1000} value={comment} onChangeText={setComment} placeholder={t('review.commentPlaceholder')} placeholderTextColor={colors.faint} textAlignVertical="top" />
    </View>
    {mutation.isError && <ErrorState message={t('review.failed')} />}
    <Button title={p.reviewId ? t('review.saveChanges') : t('review.publish')} disabled={!valid} loading={mutation.isPending} onPress={() => mutation.mutate()} />
  </ScrollView>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: 12, paddingBottom: spacing.xl, backgroundColor: colors.cream, flexGrow: 1 },
  h1: { fontFamily: fonts.display, fontWeight: '700', fontSize: 21, letterSpacing: -0.3, color: colors.ink, marginBottom: 2 },
  card: { backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadow.card },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  thumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  productName: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '700' },
  ratingCard: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  starBlock: { alignItems: 'center' },
  satisfied: { fontFamily: fonts.display, fontWeight: '700', fontSize: 16, color: colors.ink, textAlign: 'center' },
  ratingWord: { color: colors.green, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  starLabel: { fontWeight: '600', color: colors.muted, fontSize: 13, textAlign: 'center' },
  label: { fontWeight: '700', color: colors.ink, fontSize: 14 },
  stars: { flexDirection: 'row', gap: 10, marginVertical: 6 },
  star: { fontSize: 36, color: colors.starEmpty },
  on: { color: colors.star },
  input: { minHeight: 120, borderRadius: radius.sm, padding: 12, color: colors.ink, backgroundColor: colors.surface2, marginTop: 8, fontSize: 14 },
})
