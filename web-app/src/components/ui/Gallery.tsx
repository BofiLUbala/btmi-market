import { useRef, useState, type MouseEvent } from 'react'
import { initials } from '@/lib/format'

export interface ProductImage {
  url: string
  alt?: string
}

/**
 * Product gallery. The backend currently exposes no product/variant image
 * fields (see docs/BUYER_PRODUCT_MEDIA_GAP.md), so `images` is normally
 * empty and a deterministic initials placeholder is shown instead.
 * When the API gains media support, pass real URLs — no other change needed.
 */
export function Gallery({
  name,
  images = [],
  badge
}: {
  name: string
  images?: ProductImage[]
  badge?: React.ReactNode
}) {
  const [active, setActive] = useState(0)
  const [broken, setBroken] = useState<Record<number, boolean>>({})
  const mainRef = useRef<HTMLDivElement>(null)
  const usable = images.filter((_, i) => !broken[i])
  const current = usable[active] ?? usable[0]
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360

  function moveZoom(event: MouseEvent<HTMLDivElement>) {
    const frame = mainRef.current
    const image = frame?.querySelector('img')
    if (!frame || !image) return
    const rect = frame.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100
    image.style.transformOrigin = `${x}% ${y}%`
  }

  function setZoom(activeZoom: boolean) {
    mainRef.current?.classList.toggle('is-zooming', activeZoom)
  }

  return (
    <div className="pd-gallery">
      <div
        ref={mainRef}
        className="pd-thumb pd-main"
        style={{ background: `hsl(${hue}, 32%, 26%)` }}
        onMouseEnter={() => setZoom(true)}
        onMouseMove={moveZoom}
        onMouseLeave={() => setZoom(false)}
      >
        {current ? (
          <img
            src={current.url}
            alt={current.alt ?? name}
            loading="eager"
            onError={() => setBroken((b) => ({ ...b, [active]: true }))}
          />
        ) : (
          <span aria-hidden>{initials(name)}</span>
        )}
        {badge}
      </div>
      {usable.length > 1 && (
        <div className="pd-thumbs" role="tablist" aria-label="Product images">
          {usable.map((img, i) => (
            <button
              key={img.url + i}
              role="tab"
              aria-selected={i === active}
              aria-label={img.alt ?? `${name} image ${i + 1}`}
              className={`pd-thumb-btn ${i === active ? 'selected' : ''}`}
              onClick={() => setActive(i)}
            >
              <img src={img.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
