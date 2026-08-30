import { useRef, useState } from 'react'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/types'
import { CameraIcon } from './Icons'
import { initials } from '@/lib/format'

const MAX_BYTES = 3 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

interface AvatarUploadProps {
  url?: string | null
  name: string
  size?: number
  onUploaded?: (url: string) => void
}

export function AvatarUpload({ url, name, size = 88, onUploaded }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please choose a JPG, PNG or WEBP image.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Image must be 3 MB or smaller.')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setBusy(true)
    try {
      const res = await authApi.uploadAvatar(file)
      onUploaded?.(res.avatar_url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload your photo. Try again.')
      setPreview(null)
    } finally {
      setBusy(false)
      URL.revokeObjectURL(objectUrl)
    }
  }

  const shown = preview || url

  return (
    <div className="avatar-upload">
      <button
        type="button"
        className="avatar-upload-circle"
        style={{ width: size, height: size, fontSize: size * 0.36 }}
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label="Change profile picture"
        title="Change profile picture"
      >
        {shown ? (
          <img src={shown} alt="" className="avatar-upload-img" />
        ) : (
          <span>{initials(name) || '?'}</span>
        )}
        <span className="avatar-upload-overlay" aria-hidden="true">
          {busy ? <span className="spinner" /> : <CameraIcon width={size * 0.24} height={size * 0.24} />}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onFileChange}
        style={{ display: 'none' }}
      />
      {error && <div className="avatar-upload-error small">{error}</div>}
    </div>
  )
}
