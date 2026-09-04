import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useAdminAuth } from '../../../src/store/adminAuth'

export default function MobileTechnicalScreen() {
  const router = useRouter()
  const { hasRole } = useAdminAuth()

  if (!hasRole(['TECHNICAL_ADMIN', 'SUPER_ADMIN'])) {
    return (
      <View style={styles.deniedContainer}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>🛡️</Text>
        <Text style={styles.deniedTitle}>Access Prohibited</Text>
        <Text style={styles.deniedSub}>Your role is not authorized to access Technical & Security.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/admin')}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Return to Direction</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>🛡️ Mobile Technical & Security</Text>
        <Text style={styles.bannerSub}>Infrastructure availability, component lights, and incident acknowledgment.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Component Health Lights</Text>
        <View style={styles.componentRow}>
          <Text style={styles.componentName}>Go REST API Engine</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.dot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.statusText}>ONLINE</Text>
          </View>
        </View>
        <View style={styles.componentRow}>
          <Text style={styles.componentName}>PostgreSQL Primary DB</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.dot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.statusText}>ONLINE</Text>
          </View>
        </View>
        <View style={styles.componentRow}>
          <Text style={styles.componentName}>Redis Cache & Ranking</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.dot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.statusText}>ONLINE</Text>
          </View>
        </View>
        <View style={styles.componentRow}>
          <Text style={styles.componentName}>Asynq Background Workers</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.dot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.statusText}>ONLINE</Text>
          </View>
        </View>
        <View style={styles.componentRow}>
          <Text style={styles.componentName}>Visual Search Python Service</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.dot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.statusText}>ONLINE</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.card} onPress={() => router.push('/admin/technical/config')}>
        <Text style={styles.cardTitle}>🚩 Feature Flags & Config →</Text>
        <Text style={{ color: '#94a3b8', fontSize: 12, lineHeight: 18 }}>
          Quick-toggle low-risk feature flags and review global configuration values shared with Web.
        </Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mapped Control Domains (Phase 4)</Text>
        <Text style={{ color: '#94a3b8', fontSize: 12, lineHeight: 18 }}>
          Live API monitoring, PostgreSQL pool status, Redis queue size, Asynq dead jobs, backup run status, database migration inspector, SMTP health, session revocation, admin user provisioning, and emergency maintenance toggle.
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  banner: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 14,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2dd4bf',
    marginBottom: 4,
  },
  bannerSub: {
    fontSize: 12,
    color: '#94a3b8',
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 12,
  },
  componentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#1e293b',
  },
  componentName: {
    fontSize: 13,
    color: '#f8fafc',
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#064e3b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#a7f3d0',
  },
  deniedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#090d16',
  },
  deniedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ef4444',
    marginBottom: 8,
  },
  deniedSub: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
  },
  backBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
})
