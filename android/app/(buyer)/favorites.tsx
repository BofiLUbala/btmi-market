import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { Button } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'

export default function FavoritesScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return <View style={styles.page}>
    <View style={styles.icon}><Ionicons name="heart-outline" size={34} color={colors.green}/></View>
    <Text style={styles.title}>{t('favorites.title')}</Text>
    <Text style={styles.text}>{t('favorites.body')}</Text>
    <Button variant="outline" title={t('cart.discover')} onPress={() => router.push('/(buyer)')}/>
  </View>
}
const makeStyles = (colors: Colors) => StyleSheet.create({ page: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.md }, icon: { width: 74, height: 74, borderRadius: 37, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 23, fontWeight: '900', color: colors.ink, textAlign: 'center' }, text: { color: colors.muted, textAlign: 'center', lineHeight: 21, maxWidth: 300 } })