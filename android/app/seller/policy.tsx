import { ScrollView, StyleSheet } from 'react-native'
import { SellerPolicyContent } from '../../src/components/SellerPolicyContent'
import { spacing } from '../../src/theme'

export default function SellerPolicyScreen() {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <SellerPolicyContent />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { padding: spacing.md, paddingBottom: spacing.xl },
})
