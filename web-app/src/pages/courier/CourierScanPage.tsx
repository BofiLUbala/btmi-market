import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import jsQR from 'jsqr'
import { courierApi } from '@/api/courier'
import { useI18n } from '@/store/i18n'

type Detector = { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> }
type DetectorCtor = (new (o: { formats: string[] }) => Detector) & { getSupportedFormats?: () => Promise<string[]> }

// A package token is `tbk.d.<uuid>.<signature>`. Pulling it out of whatever the
// camera read tolerates QR codes that wrap it in a link or stray whitespace.
const TOKEN_RE = /tbk\.[a-z]\.[0-9a-fA-F-]{36}\.[A-Za-z0-9_-]+/
const extractToken = (raw: string) => raw.match(TOKEN_RE)?.[0] ?? raw.trim()

// Downscaled frame for the JS decoder: fast enough on phones, still reads a
// QR that fills a reasonable part of the viewfinder.
const MAX_FRAME = 720
const SCAN_INTERVAL_MS = 200
// A code that just failed is ignored this long so it does not loop on the error.
const REJECT_COOLDOWN_MS = 2500

/**
 * Courier package scanner. BarcodeDetector is used where the browser has it;
 * elsewhere (iPhone Safari, Chrome on Windows, Firefox) frames are decoded with
 * jsQR, so the camera works on every phone the couriers carry.
 */
export default function CourierScanPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const type = params.get('type') === 'DELIVERY' ? 'DELIVERY' : 'PICKUP'
  const orderId = params.get('order_id') || ''

  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<number>()
  const busy = useRef(false)
  const done = useRef(false)
  const lastRejected = useRef<{ code: string; at: number } | null>(null)

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [sending, setSending] = useState(false)
  const [manual, setManual] = useState('')

  const stopCamera = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current)
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
  }, [])

  const submit = useCallback(
    async (raw: string) => {
      if (busy.current || done.current) return
      const token = extractToken(raw)
      busy.current = true
      setSending(true)
      setError('')
      try {
        await (type === 'PICKUP' ? courierApi.scanPickup(orderId, token) : courierApi.scanDelivery(orderId, token))
        done.current = true
        stopCamera()
        setMessage(t(type === 'PICKUP' ? 'courier.scan.pickupSuccess' : 'courier.scan.deliverySuccess'))
      } catch (e) {
        lastRejected.current = { code: token, at: Date.now() }
        const code = (e as { code?: string })?.code ?? (e instanceof Error ? e.message : '')
        setError(
          code === 'QR_WRONG_COURIER' ? t('courier.scan.wrongCourier')
            : code === 'QR_NOT_OPERATIONAL' ? t('courier.scan.wrongStatus')
              : t('courier.scan.invalid')
        )
      } finally {
        busy.current = false
        setSending(false)
      }
    },
    [orderId, stopCamera, t, type]
  )

  useEffect(() => {
    let stopped = false

    const readFrame = async (el: HTMLVideoElement, detector: Detector | null): Promise<string | null> => {
      if (detector) {
        const codes = await detector.detect(el)
        return codes[0]?.rawValue ?? null
      }
      const w = el.videoWidth
      const h = el.videoHeight
      if (!w || !h) return null
      const scale = Math.min(1, MAX_FRAME / Math.max(w, h))
      const cw = Math.round(w * scale)
      const ch = Math.round(h * scale)
      const c = (canvas.current ??= document.createElement('canvas'))
      c.width = cw
      c.height = ch
      const ctx = c.getContext('2d', { willReadFrequently: true })
      if (!ctx) return null
      ctx.drawImage(el, 0, 0, cw, ch)
      const img = ctx.getImageData(0, 0, cw, ch)
      return jsQR(img.data, cw, ch, { inversionAttempts: 'attemptBoth' })?.data ?? null
    }

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('UNSUPPORTED')
        stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        const el = video.current
        if (!el || stopped) return stopCamera()
        el.srcObject = stream.current
        await el.play()

        let detector: Detector | null = null
        const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector
        if (Ctor) {
          try {
            const formats = Ctor.getSupportedFormats ? await Ctor.getSupportedFormats() : ['qr_code']
            if (formats.includes('qr_code')) detector = new Ctor({ formats: ['qr_code'] })
          } catch {
            detector = null
          }
        }

        const scan = async () => {
          if (stopped || done.current) return
          if (!busy.current && video.current) {
            try {
              const raw = await readFrame(video.current, detector)
              if (raw) {
                const recent = lastRejected.current
                const token = extractToken(raw)
                if (!(recent && recent.code === token && Date.now() - recent.at < REJECT_COOLDOWN_MS)) {
                  await submit(raw)
                }
              }
            } catch {
              // A frame the decoder could not read: try the next one.
            }
          }
          if (!stopped && !done.current) timer.current = window.setTimeout(scan, SCAN_INTERVAL_MS)
        }
        void scan()
      } catch (e) {
        setCameraError(e instanceof Error && e.message === 'UNSUPPORTED' ? t('courier.scan.webUnsupported') : t('courier.scan.cameraDenied'))
      }
    }

    void start()
    return () => {
      stopped = true
      stopCamera()
    }
  }, [stopCamera, submit, t])

  const status = sending ? t('courier.scan.verifying') : message || error || cameraError || t('courier.scan.aim')

  return (
    <main style={{ position: 'fixed', inset: 0, background: '#050505', display: 'grid', placeItems: 'center', color: '#fff', zIndex: 1000, overflowY: 'auto' }}>
      <video ref={video} playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'relative', width: 'min(88vw,360px)', textAlign: 'center', padding: '24px 0' }}>
        <h1 style={{ fontSize: 20 }}>{t(type === 'PICKUP' ? 'courier.scan.pickupTitle' : 'courier.scan.deliveryTitle')}</h1>
        {!message && !cameraError && (
          <div style={{ height: 280, border: `3px solid ${error ? '#f87171' : 'white'}`, borderRadius: 20, boxShadow: '0 0 0 9999px rgba(0,0,0,.35)' }} />
        )}
        <div role="status" style={{ marginTop: 20, padding: 16, borderRadius: 14, background: 'rgba(0,0,0,.75)', color: error || cameraError ? '#fecaca' : '#fff' }}>
          {status}
        </div>
        {error && !message && (
          <button
            type="button"
            onClick={() => { lastRejected.current = null; setError('') }}
            style={{ marginTop: 10, minHeight: 44, width: '100%', border: 0, borderRadius: 12, fontWeight: 800 }}
          >
            Réessayer
          </button>
        )}
        {/* No camera, a denied camera, or a handheld scanner that types the code: the same
            signed code can be entered here. The server verifies it exactly as it would a
            camera read, so this is not a weaker path. */}
        {!message && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const code = manual.trim()
              if (code) void submit(code)
            }}
            style={{ marginTop: 14, display: 'grid', gap: 8 }}
          >
            <label htmlFor="courier-manual-code" style={{ fontSize: 13 }}>Saisir le code du QR</label>
            <input
              id="courier-manual-code"
              name="qr_code"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              autoComplete="off"
              placeholder="tbk.d.…"
              style={{ minHeight: 44, borderRadius: 10, border: 0, padding: '0 12px' }}
            />
            <button type="submit" disabled={sending || !manual.trim()} style={{ minHeight: 44, border: 0, borderRadius: 12, fontWeight: 800 }}>
              Valider le code
            </button>
          </form>
        )}
        <button onClick={() => navigate('/courier/dashboard')} style={{ marginTop: 14, minHeight: 48, width: '100%', border: 0, borderRadius: 12, fontWeight: 800 }}>
          {t('courier.scan.finish')}
        </button>
      </div>
    </main>
  )
}
