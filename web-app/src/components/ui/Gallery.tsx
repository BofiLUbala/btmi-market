import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { initials } from '@/lib/format'

export interface ProductImage {
  url: string
  alt?: string
  /** Set when this image shows one specific variant (a colour/model). */
  variantId?: string
}

/**
 * Product gallery. Falls back to a deterministic initials placeholder when a
 * product has no images. Pass `focusUrl` to jump to the image that matches the
 * variant the buyer just selected.
 */
export function Gallery({
  name,
  images = [],
  badge,
  focusUrl
}: {
  name: string
  images?: ProductImage[]
  badge?: React.ReactNode
  focusUrl?: string
}) {
  const [active, setActive] = useState(0)
  const [broken, setBroken] = useState<Record<number, boolean>>({})
  const mainRef = useRef<HTMLDivElement>(null)
  const usable = images.filter((_, i) => !broken[i])

  // Follow the selected variant's image without trapping the buyer: they can
  // still click any thumbnail afterwards.
  useEffect(() => {
    if (!focusUrl) return
    const index = usable.findIndex((img) => img.url === focusUrl)
    if (index >= 0) setActive(index)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusUrl, images.length])

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
