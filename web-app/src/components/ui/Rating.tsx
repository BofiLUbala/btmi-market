export function Rating({
  value,
  count,
  size = 'md'
}: {
  value: number
  count?: number
  size?: 'sm' | 'md' | 'lg'
}) {
  const full = Math.round(value)
  const stars = [1, 2, 3, 4, 5]
  return (
    <span className="rating" style={{ fontSize: size === 'lg' ? '1.25rem' : size === 'sm' ? '0.85rem' : undefined }} aria-label={`${value} out of 5 stars`}>
      {stars.map((s) => (
        <span key={s} className={s <= full ? '' : 'empty'}>
          ★
        </span>
      ))}
      {count !== undefined && <span className="rating-count">({count})</span>}
    </span>
  )
}