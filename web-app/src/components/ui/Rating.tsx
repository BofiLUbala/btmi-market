import { useI18n } from '@/store/i18n'

export function Rating({
  value,
  count,
  size = 'md'
}: {
  value: number
  count?: number
  size?: 'sm' | 'md' | 'lg'
}) {
  const { t } = useI18n()
  const full = Math.round(value)
  const stars = [1, 2, 3, 4, 5]
  return (
    <span className="rating" style={{ fontSize: size === 'lg' ? '1.25rem' : size === 'sm' ? '0.85rem' : undefined }} aria-label={t('reviews.ratingOutOf5', { value })}>
      {stars.map((s) => (
        <span key={s} className={s <= full ? '' : 'empty'}>
          ★
        </span>
      ))}
      {count !== undefined && <span className="rating-count">({count})</span>}
    </span>
  )
}