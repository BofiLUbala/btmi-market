import { StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { Button } from '../../src/components/ui'
import { colors, spacing } from '../../src/theme'

export default function FavoritesScreen() {
  return <View style={styles.page}>
    <View style={styles.icon}><Ionicons name="heart-outline" size={34} color={colors.green}/></View>
    <Text style={styles.title}>Gardez vos coups de cœur</Text>
    <Text style={styles.text}>Touchez le cœur d’un produit pour le retrouver facilement ici.</Text>
    <Button variant="outline" title="Découvrir les produits" onPress={() => router.push('/(buyer)')}/>
  </View>
}
const styles = StyleSheet.create({ page: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.md }, icon: { width: 74, height: 74, borderRadius: 37, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 23, fontWeight: '900', color: colors.ink, textAlign: 'center' }, text: { color: colors.muted, textAlign: 'center', lineHeight: 21, maxWidth: 300 } })
