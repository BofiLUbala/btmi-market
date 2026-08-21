import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/Feedback'
import { formatMoney, initials, formatDate } from '@/lib/format'
import { useFavorites } from '@/store/favorites'

export default function FavoritesPage() {
  const { items, remove, clear } = useFavorites()

  if (items.length === 0) {
    return (
      <EmptyState
        icon="❤️"
        title="No favorites yet"
        description="Tap the heart on any product to save it here. Favorites are stored on this device only — the marketplace has no favorites service yet."
        action={
          <Link to="/search" className="btn btn-primary">
            Browse products
          </Link>
        }
      />
    )
  }

  return (
    <div className="fade-in">
      <div className="row-between" style={{ marginBottom: 12 }}>
        <h1>Favorites</h1>
        <Button variant="ghost" size="sm" onClick={clear}>
          Clear all
        </Button>
      </div>
      <p className="pay-note" style={{ marginTop: -8, marginBottom: 12 }}>
        Saved on this device. A server-side favorites service is not available yet.
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
                {i.shopName} · saved {formatDate(i.addedAt)}
              </div>
              <div className="bold">{formatMoney(i.price, i.currency)}</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => remove(i.productId)}>
              Remove
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}