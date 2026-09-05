import { useState } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native'
import { adminCommerceApi } from '../../../../src/api/admin'
import { useI18n } from '../../../../src/store/i18n'

export default function MobileMarketplaceScreen() {
  const { t } = useI18n()
  const [productId, setProductId] = useState('')
  const [visibility, setVisibility] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const lookup = async () => {
    if (!productId.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await adminCommerceApi.getMarketplaceVisibility(productId.trim())
      setVisibility(res)
    } catch (err) {
      setError(t('admin.marketplace.failed'))
      setVisibility(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>{t('admin.marketplace.title')}</Text>
      <Text style={styles.subtitle}>{t('admin.marketplace.subtitle')}</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={t('admin.marketplace.placeholder')}
          placeholderTextColor="#64748b"
          value={productId}
          onChangeText={setProductId}
        />
        <TouchableOpacity style={[styles.lookupBtn, (!productId.trim() || loading) && styles.lookupBtnDisabled]}
          onPress={lookup} disabled={!productId.trim() || loading}>
          <Text style={styles.lookupBtnText}>{loading ? '...' : t('admin.marketplace.lookup')}</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : visibility && (
        <View style={[styles.resultBox, { borderColor: visibility.is_visible ? '#10b981' : '#dc2626', backgroundColor: visibility.is_visible ? '#064e3b20' : '#7f1d1d20' }]}>
          <Text style={styles.resultIcon}>{visibility.is_visible ? '✅' : '🚫'}</Text>
          <Text style={[styles.resultTitle, { color: visibility.is_visible ? '#34d399' : '#ef4444' }]}>
            {visibility.is_visible ? t('admin.marketplace.isVisible') : t('admin.marketplace.isNotVisible')}
          </Text>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{t('admin.marketplace.productStatus')}</Text>
            <Text style={styles.fieldValue}>{visibility.product_status}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{t('admin.marketplace.publication')}</Text>
            <Text style={styles.fieldValue}>{visibility.publication_status}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{t('admin.marketplace.shopVisible')}</Text>
            <Text style={styles.fieldValue}>{visibility.shop_visible ? t('admin.marketplace.yes') : t('admin.marketplace.no')}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{t('admin.marketplace.businessActive')}</Text>
            <Text style={styles.fieldValue}>{visibility.business_active ? t('admin.marketplace.yes') : t('admin.marketplace.no')}</Text>
          </View>

          {visibility.reasons_not_shown?.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.reasonsTitle}>{t('admin.marketplace.reasons')}</Text>
              {visibility.reasons_not_shown.map((r: string, i: number) => (
                <Text key={i} style={styles.reasonText}>• {r}</Text>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16' },
  title: { fontSize: 18, fontWeight: '800', color: '#f8fafc', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#94a3b8', marginBottom: 16 },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  input: { flex: 1, backgroundColor: '#1e293b', borderRadius: 8, padding: 12, color: '#f8fafc', fontSize: 14 },
  lookupBtn: { backgroundColor: '#10b981', paddingHorizontal: 20, borderRadius: 8, justifyContent: 'center' },
  lookupBtnDisabled: { opacity: 0.5 },
  lookupBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  errorBox: { backgroundColor: '#7f1d1d30', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#dc2626' },
  errorText: { color: '#fca5a5', fontSize: 13 },
  resultBox: { borderRadius: 10, padding: 16, borderWidth: 1 },
  resultIcon: { fontSize: 28, marginBottom: 8 },
  resultTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12 },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#1e293b' },
  fieldLabel: { fontSize: 13, color: '#94a3b8' },
  fieldValue: { fontSize: 13, fontWeight: '600', color: '#f8fafc' },
  reasonsTitle: { fontSize: 12, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  reasonText: { fontSize: 12, color: '#fca5a5', marginBottom: 2 },
})
