import { useEffect, useState } from 'react'
import { adminDirectionApi } from '@/api/admin'
import { useT } from '@/store/i18n'

interface AuthFailure {
  id: number
  email: string
  role: string
  error_code: string
  ip_address: string
  user_agent: string
  created_at: string
}

const ERROR_LABELS: Record<string, string> = {
  INVALID_CREDENTIALS: 'Invalid credentials',
  ACCOUNT_SUSPENDED: 'Account suspended',
  EMAIL_NOT_VERIFIED: 'Email not verified',
  RATE_LIMITED: 'Rate limited',
  UNKNOWN_ACCOUNT: 'Unknown account',
  WRONG_PASSWORD: 'Wrong password'
}

export default function AuthFailuresTab() {
  const t = useT()
  const [failures, setFailures] = useState<AuthFailure[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    const fetchFailures = async () => {
      try {
        setLoading(true)
        setError(null)
        // TODO: Replace with actual API call when endpoint is added
        // const data = await adminDirectionApi.getAuthFailures({ role: roleFilter, limit: 100 })
        // setFailures(data)
        setFailures([]) // Placeholder
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load auth failures')
      } finally {
        setLoading(false)
      }
    }

    fetchFailures()

    // Auto-refresh every 10 seconds
    const interval = autoRefresh ? setInterval(fetchFailures, 10000) : undefined
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [roleFilter, autoRefresh])

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <h2 className='text-lg font-semibold'>🔴 Auth Failures</h2>
        <div className='flex items-center gap-2'>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className='px-3 py-2 border rounded-lg bg-white'
          >
            <option value=''>All roles</option>
            <option value='admin'>Admin</option>
            <option value='seller'>Seller</option>
            <option value='courier'>Courier</option>
            <option value='buyer'>Buyer</option>
          </select>
          <label className='flex items-center gap-2'>
            <input
              type='checkbox'
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span className='text-sm'>Auto-refresh</span>
          </label>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && <div className='text-center py-8 text-gray-500'>Loading...</div>}
      {error && <div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded'>{error}</div>}

      {/* Failures Table */}
      {!loading && !error && failures.length === 0 && (
        <div className='text-center py-8 text-gray-500'>No auth failures in this period</div>
      )}

      {!loading && !error && failures.length > 0 && (
        <div className='overflow-x-auto border rounded-lg'>
          <table className='w-full text-sm'>
            <thead className='bg-gray-50 border-b'>
              <tr>
                <th className='px-4 py-2 text-left font-semibold'>Time</th>
                <th className='px-4 py-2 text-left font-semibold'>Email</th>
                <th className='px-4 py-2 text-left font-semibold'>Role</th>
                <th className='px-4 py-2 text-left font-semibold'>Error</th>
                <th className='px-4 py-2 text-left font-semibold'>IP Address</th>
                <th className='px-4 py-2 text-left font-semibold'>User Agent</th>
              </tr>
            </thead>
            <tbody>
              {failures.map((failure) => (
                <tr key={failure.id} className='border-b hover:bg-gray-50'>
                  <td className='px-4 py-2 text-xs'>
                    {new Date(failure.created_at).toLocaleString()}
                  </td>
                  <td className='px-4 py-2 font-mono text-xs'>{failure.email}</td>
                  <td className='px-4 py-2'>
                    <span className='inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded'>
                      {failure.role}
                    </span>
                  </td>
                  <td className='px-4 py-2'>
                    <span className='inline-block px-2 py-1 bg-red-100 text-red-800 text-xs rounded'>
                      {ERROR_LABELS[failure.error_code] || failure.error_code}
                    </span>
                  </td>
                  <td className='px-4 py-2 font-mono text-xs'>{failure.ip_address}</td>
                  <td className='px-4 py-2 text-xs truncate max-w-xs' title={failure.user_agent}>
                    {failure.user_agent.substring(0, 40)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
