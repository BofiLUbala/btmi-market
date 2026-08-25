import { StyleSheet, Text, View } from 'react-native'
import { colors, spacing } from '../../src/theme'
export default function FavoritesScreen() { return <View style={styles.page}><Text style={styles.title}>Favorites</Text><Text style={styles.text}>Favorites synchronization requires the planned backend endpoint. Products will not be presented as synchronized until that source of truth exists.</Text></View> }
const styles = StyleSheet.create({ page: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.sm }, title: { fontSize: 24, fontWeight: '900', color: colors.ink, textAlign: 'center' }, text: { color: colors.muted, textAlign: 'center', lineHeight: 22 } })

