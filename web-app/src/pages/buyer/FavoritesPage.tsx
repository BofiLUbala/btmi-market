import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/Feedback'
import { formatMoney, initials, formatDate } from '@/lib/format'
import { useFavorites } from '@/store/favorites'
import { useI18n } from '@/store/i18n'

export default function FavoritesPage() {
  const { items, remove, clear } = useFavorites()
  const { t } = useI18n()

  if (items.length === 0) {
    return (
      <EmptyState
        icon="❤️"
        title={t('favorites.title')}
        description={t('favorites.empty.description')}
        action={
          <Link to="/search" className="btn btn-primary">
            {t('favorites.browse')}
          </Link>
        }
      />
    )
  }

  return (
    <div className="fade-in">
      <div className="row-between" style={{ marginBottom: 12 }}>
        <h1>{t('nav.favorites')}</h1>
        <Button variant="ghost" size="sm" onClick={clear}>
          {t('favorites.clearAll')}
        </Button>
      </div>
      <p className="pay-note" style={{ marginTop: -8, marginBottom: 12 }}>
        {t('favorites.localNote')}
      </p>
      <div className="card stack">
        {items.map((i) => (
          <div key={i.productId} className="cart-line">
            <div
              className="cart-line-thumb"
              style={{ background: `hsl(${i.productId.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 32%, 26%)` }}
            >
              {initials(i.name)}
            </div>
            <div className="stack" style={{ gap: 2, flex: 1 }}>
              <Link to={`/products/${i.productId}`} className="bold small">
                {i.name}
              </Link>
              <div className="small muted">
                {i.shopName} · {t('favorites.savedAt', { date: formatDate(i.addedAt) })}
              </div>
              <div className="bold">{formatMoney(i.price, i.currency)}</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => remove(i.productId)}>
              {t('common.remove')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}