import { authenticatedBlob } from '@/api/client'
import type { QRIdentity } from '@/api/types'
import { useEffect, useState } from 'react'

/** A line printed on the label. Only non-sensitive identity data belongs here. */
export type LabelField = { label: string; value: string }

/**
 * Renders a TBK QR (product or package) with download and print actions.
 *
 * Printing opens an isolated label document rather than printing the surrounding page, so
 * what reaches the printer is exactly the label: TBK, the reference, the supplied identity
 * fields and the code. Buyer contact details are never passed in and never printed.
 */
export function QRPanel({
  qr,
  imagePath,
  title,
  fields = [],
}: {
  qr: QRIdentity
  imagePath: string
  title: string
  fields?: LabelField[]
}) {
  const [src, setSrc] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let url = ''
    let cancelled = false
    void authenticatedBlob(imagePath)
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setSrc(url)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'QR unavailable')
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [imagePath])

  function download() {
    if (!src) return
    const a = document.createElement('a')
    a.href = src
    a.download = `tbk-${qr.reference}.png`
    a.click()
  }

  function print() {
    if (!src) return
    const w = window.open('', '_blank', 'width=520,height=680')
    if (!w) {
      setError('Autorisez les fenêtres pop-up pour imprimer l’étiquette.')
      return
    }
    const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)
    const rows = fields
      .filter((f) => f.value)
      .map((f) => `<tr><th>${esc(f.label)}</th><td>${esc(f.value)}</td></tr>`)
      .join('')
    w.document.write(`<!doctype html><html><head><title>${esc(qr.reference)}</title><style>
      @page { size: 80mm 100mm; margin: 4mm }
      body { font-family: system-ui, sans-serif; margin: 0; text-align: center; color: #000 }
      .brand { font-size: 20px; font-weight: 800; letter-spacing: 3px }
      .title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px }
      img { width: 46mm; height: 46mm; image-rendering: pixelated }
      .ref { font-family: ui-monospace, monospace; font-size: 13px; font-weight: 700; margin-top: 4px }
      table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 6px }
      th { text-align: left; font-weight: 600; padding: 1px 4px 1px 0; white-space: nowrap }
      td { text-align: right; padding: 1px 0 }
    </style></head><body>
      <div class="brand">TBK</div>
      <div class="title">${esc(title)}</div>
      <img src="${src}" alt="${esc(qr.reference)}" />
      <div class="ref">${esc(qr.reference)}</div>
      <table>${rows}</table>
    </body></html>`)
    w.document.close()
    w.focus()
    // Give the browser a tick to lay the image out before the print dialog opens.
    w.onload = () => {
      w.print()
      w.close()
    }
  }

  return (
    <div className="card" style={{ marginTop: 16, textAlign: 'center' }}>
      <h3>{title}</h3>
      {src && <img src={src} alt={`${title} ${qr.reference}`} width={220} height={220} />}
      {error && (
        <p className="small" role="alert">
          {error}
        </p>
      )}
      <div>
        <strong>{qr.reference}</strong> · {qr.status}
      </div>
      {fields.filter((f) => f.value).length > 0 && (
        <div className="small muted" style={{ marginTop: 4 }}>
          {fields.filter((f) => f.value).map((f) => `${f.label}: ${f.value}`).join(' · ')}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10 }}>
        <button className="btn btn-outline" onClick={download} disabled={!src}>
          Download QR
        </button>
        <button className="btn btn-outline" onClick={print} disabled={!src}>
          Print QR
        </button>
      </div>
    </div>
  )
}
