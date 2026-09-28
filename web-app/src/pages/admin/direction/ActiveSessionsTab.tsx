import { useEffect, useState } from 'react'
import { adminDirectionApi } from '@/api/admin'
import { useT } from '@/store/i18n'

interface ActiveSession {
  id: number
  user_id: number
  email: string
  role: string
  ip_address: string
  user_agent: string
  login_at: string
  last_activity_at: string
  activity_type: string
  activity_count: number
  online_duration_seconds: number
}

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export default function ActiveSessionsTab() {
  const t = useT()
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true)
        setError(null)
        // TODO: Replace with actual API call when endpoint is added
        // const data = await adminDirectionApi.getActiveSessions({ role: roleFilter })
        // setSessions(data)
        setSessions([]) // Placeholder
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load active sessions')
      } finally {
        setLoading(false)
      }
    }

    fetchSessions()

    // Auto-refresh every 5 seconds for live updates
    const interval = autoRefresh ? setInterval(fetchSessions, 5000) : undefined
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [roleFilter, autoRefresh])

  const handleKickSession = async (sessionId: number, email: string) => {
    if (!confirm(`Kick user ${email} from all sessions?`)) return

    try {
      // TODO: Call admin API to kick session
      // await adminDirectionApi.kickSession(sessionId)
      alert('Session kicked')
    } catch (err) {
      alert('Failed to kick session: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-lg font-semibold'>🟢 Active Sessions</h2>
          <p className='text-sm text-gray-600'>
            {sessions.length} user{sessions.length !== 1 ? 's' : ''} online now
          </p>
        </div>
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
            <span className='text-sm'>Live</span>
          </label>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && <div className='text-center py-8 text-gray-500'>Loading...</div>}
      {error && <div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded'>{error}</div>}

      {/* Sessions Table */}
      {!loading && !error && sessions.length === 0 && (
        <div className='text-center py-8 text-gray-500'>No active sessions</div>
      )}

      {!loading && !error && sessions.length > 0 && (
        <div className='overflow-x-auto border rounded-lg'>
          <table className='w-full text-sm'>
            <thead className='bg-gray-50 border-b'>
              <tr>
                <th className='px-4 py-2 text-left font-semibold'>Email</th>
                <th className='px-4 py-2 text-left font-semibold'>Role</th>
                <th className='px-4 py-2 text-left font-semibold'>Online Time</th>
                <th className='px-4 py-2 text-left font-semibold'>Last Activity</th>
                <th className='px-4 py-2 text-left font-semibold'>Activity Type</th>
                <th className='px-4 py-2 text-left font-semibold'>Count</th>
                <th className='px-4 py-2 text-left font-semibold'>IP Address</th>
                <th className='px-4 py-2 text-left font-semibold'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id} className='border-b hover:bg-gray-50'>
                  <td className='px-4 py-2 font-mono text-xs'>{session.email}</td>
                  <td className='px-4 py-2'>
                    <span className='inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded'>
                      {session.role}
                    </span>
                  </td>
                  <td className='px-4 py-2 font-semibold'>
                    {formatDuration(session.online_duration_seconds)}
                  </td>
                  <td className='px-4 py-2 text-xs'>
                    {new Date(session.last_activity_at).toLocaleTimeString()}
                  </td>
                  <td className='px-4 py-2 text-xs'>
                    {session.activity_type || 'idle'}
                  </td>
                  <td className='px-4 py-2 text-center font-semibold'>
                    {session.activity_count}
                  </td>
                  <td className='px-4 py-2 font-mono text-xs'>{session.ip_address}</td>
                  <td className='px-4 py-2'>
                    <button
                      onClick={() => handleKickSession(session.id, session.email)}
                      className='text-red-600 hover:text-red-800 font-semibold text-xs'
                    >
                      Kick
                    </button>
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
