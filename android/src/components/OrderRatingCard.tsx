import { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { buyerApi } from '../api'
import { ApiError } from '../api/client'
import { Button, Card, Field } from './ui'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import type { Colors } from '../theme'

/**
 * web OrderRatingCard: the buyer rates a delivered order with five stars and a
 * written feedback. It is stored as the order's shop/service review, so the
 * same row stays editable - the card reopens with what the buyer wrote.
 */
export function OrderRatingCard({ orderId }: { orderId: string }) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const eligibility = useQuery({ queryKey: ['review-eligibility', orderId, 'service'], queryFn: () => buyerApi.reviewEligibility(orderId) })
  const reviewId = eligibility.data?.reason !== 'REVIEW_WITHDRAWN' ? eligibility.data?.existing_review_id : undefined
  const mine = useQuery({ queryKey: ['buyer-reviews'], queryFn: buyerApi.reviews, enabled: Boolean(reviewId) })
  const existing = mine.data?.reviews.find((r) => r.id === reviewId)

  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [editing, setEditing] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!existing) return
    setRating(existing.rating)
    setComment(existing.comment ?? '')
    setEditing(false)
  }, [existing])

  if (!eligibility.data?.eligible && !reviewId) return null

  async function submit() {
    if (rating < 1) { setError(t('orderRating.pickStars')); return }
    setBusy(true); setError(''); setSaved(false)
    try {
      if (reviewId) await buyerApi.updateReview(reviewId, rating, comment.trim())
      else await buyerApi.createServiceReview(orderId, rating, rating, rating, comment.trim())
      setSaved(true)
      setEditing(false)
      await queryClient.invalidateQueries({ queryKey: ['review-eligibility', orderId, 'service'] })
      await queryClient.invalidateQueries({ queryKey: ['buyer-reviews'] })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('orderRating.failed'))
    } finally {
      setBusy(false)
    }
  }

  return <Card>
    <Text style={styles.title}>{t('orderRating.title')}</Text>
    <Text style={styles.muted}>{reviewId ? t('orderRating.editableHint') : t('orderRating.subtitle')}</Text>
    <View style={styles.stars} accessibilityRole="radiogroup" accessibilityLabel={t('orderRating.title')}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          disabled={!editing || busy}
          onPress={() => setRating(n)}
          accessibilityRole="radio"
          accessibilityState={{ checked: n === rating, disabled: !editing || busy }}
          accessibilityLabel={t('orderRating.starsLabel', { count: n })}
          hitSlop={6}
        >
          <Text style={[styles.star, n <= rating && styles.starOn]}>★</Text>
        </Pressable>
      ))}
    </View>
    {editing
      ? <Field label={t('orderRating.feedbackLabel')} value={comment} onChangeText={setComment} placeholder={t('orderRating.placeholder')} multiline maxLength={1000} />
      : comment ? <Text style={styles.comment}>{comment}</Text> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {saved && !editing ? <Text style={styles.muted}>✓ {t('orderRating.saved')}</Text> : null}
    {editing
      ? <Button variant="gold" loading={busy} title={reviewId ? t('orderRating.update') : t('orderRating.submit')} onPress={() => void submit()} />
      : <Button variant="outline" title={t('orderRating.edit')} onPress={() => { setEditing(true); setSaved(false) }} />}
  </Card>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  title: { fontSize: 17, fontWeight: '900', color: colors.ink },
  muted: { color: colors.muted, marginBottom: 4 },
  stars: { flexDirection: 'row', gap: 8, marginVertical: 6 },
  star: { fontSize: 34, color: colors.border },
  starOn: { color: colors.gold },
  comment: { color: colors.ink, marginBottom: 6 },
  error: { color: colors.danger },
})
