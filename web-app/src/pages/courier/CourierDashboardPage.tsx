import { useState, useEffect, useCallback } from 'react'
import { API_BASE } from '@/api/client'

interface CourierProfile {
  id: string
  first_name: string
  last_name: string
  email: string
  status: string
  availability: string
  transport_type: string
  total_deliveries: number
  successful_deliveries: number
}

interface Mission {
  id: string
  order_id: string
  order_number: string
  status: string
  shop_name: string
  delivery_address: string
  delivery_notes?: string
  total_amount: number
  assigned_at: string
  items_count: number
  items_summary: string
}

export default function CourierDashboardPage() {
  const [profile, setProfile] = useState<CourierProfile | null>(null)
  const [missions, setMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'active' | 'available' | 'history'>('active')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [profileRes, missionsRes] = await Promise.all([
        fetch(`${API_BASE}/courier/profile`, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }),
        fetch(`${API_BASE}/courier/missions?status=assigned`, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } })
      ])
      
      if (profileRes.ok) {
        const profileData = await profileRes.json()
        setProfile(profileData.data?.courier || profileData.courier)
      }
      
      if (missionsRes.ok) {
        const missionsData = await missionsRes.json()
        setMissions(missionsData.data?.missions || missionsData.missions || [])
      }
    } catch (err) {
      console.error('Failed to load dashboard data', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleAccept = async (missionId: string) => {
    try {
      const res = await fetch(`${API_BASE}/courier/missions/${missionId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      })
      
      if (res.ok) {
        fetchData()
      }
    } catch (err) {
      console.error('Failed to accept mission', err)
    }
  }

  const handleReject = async (missionId: string) => {
    const reason = prompt('Reason for rejection:')
    if (!reason) return
    
    try {
      const res = await fetch(`${API_BASE}/courier/missions/${missionId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({ reason })
      })
      
      if (res.ok) {
        fetchData()
      }
    } catch (err) {
      console.error('Failed to reject mission', err)
    }
  }

  const handleStartDelivery = async (missionId: string) => {
    try {
      const res = await fetch(`${API_BASE}/courier/missions/${missionId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      })
      
      if (res.ok) {
        fetchData()
      }
    } catch (err) {
      console.error('Failed to start delivery', err)
    }
  }

  const handleArrived = async (missionId: string) => {
    try {
      const res = await fetch(`${API_BASE}/courier/missions/${missionId}/arrive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      })
      
      if (res.ok) {
        fetchData()
      }
    } catch (err) {
      console.error('Failed to mark arrival', err)
    }
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--background)'
      }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--background)',
      padding: 24
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Profile Header */}
        {profile && (
          <div style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, color: 'var(--text)' }}>
                  🛵 {profile.first_name} {profile.last_name}
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
                  {profile.transport_type} • {profile.email}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{
                  padding: '6px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  backgroundColor: profile.availability === 'AVAILABLE' ? 'var(--success-soft)' : profile.availability === 'BUSY' ? 'var(--warning-soft)' : 'var(--error-soft)',
                  color: profile.availability === 'AVAILABLE' ? 'var(--success)' : profile.availability === 'BUSY' ? 'var(--warning)' : 'var(--error)'
                }}>
                  {profile.availability}
                </span>
                <span style={{
                  padding: '6px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  backgroundColor: 'var(--surface-2)',
                  color: 'var(--text-muted)'
                }}>
                  {profile.total_deliveries} deliveries
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 24
        }}>
          {(['active', 'available', 'history'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                backgroundColor: tab === t ? 'var(--primary)' : 'var(--surface)',
                color: tab === t ? '#ffffff' : 'var(--text)',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {t === 'active' ? '📦 Active' : t === 'available' ? '📋 Available' : '📜 History'}
            </button>
          ))}
        </div>

        {/* Missions List */}
        <div style={{
          backgroundColor: 'var(--surface)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          overflow: 'hidden'
        }}>
          {missions.length === 0 ? (
            <div style={{
              padding: 48,
              textAlign: 'center',
              color: 'var(--text-muted)'
            }}>
              {tab === 'active' ? 'No active missions' : tab === 'available' ? 'No available missions' : 'No mission history'}
            </div>
          ) : (
            missions.map((mission) => (
              <div
                key={mission.id}
                style={{
                  padding: 16,
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 12
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                      Order #{mission.order_number || mission.order_id.slice(0, 8)}
                    </span>
                    <span style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 6,
                      backgroundColor: mission.status === 'ASSIGNED' ? 'var(--warning-soft)' : 'var(--success-soft)',
                      color: mission.status === 'ASSIGNED' ? 'var(--warning)' : 'var(--success)'
                    }}>
                      {mission.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                    🏪 {mission.shop_name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                    📍 {mission.delivery_address}
                  </div>
                  {mission.delivery_notes && (
                    <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>
                      Note: {mission.delivery_notes}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                    {mission.items_count} items • {mission.items_summary}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {mission.status === 'ASSIGNED' && (
                    <>
                      <button
                        onClick={() => handleAccept(mission.id)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 8,
                          backgroundColor: 'var(--success)',
                          color: '#ffffff',
                          border: 'none',
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: 'pointer'
                        }}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleReject(mission.id)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 8,
                          backgroundColor: 'var(--error-soft)',
                          color: 'var(--error)',
                          border: '1px solid var(--error-soft)',
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: 'pointer'
                        }}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {mission.status === 'ACCEPTED' && (
                    <button
                      onClick={() => handleStartDelivery(mission.id)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        backgroundColor: 'var(--primary)',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer'
                      }}
                    >
                      Start Delivery
                    </button>
                  )}
                  {mission.status === 'IN_TRANSIT' && (
                    <button
                      onClick={() => handleArrived(mission.id)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        backgroundColor: 'var(--success)',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer'
                      }}
                    >
                      Mark Arrived
                    </button>
                  )}
                  <span style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    backgroundColor: 'var(--surface-2)',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    ${mission.total_amount?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
