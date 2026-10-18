import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../src/api'
import { AccountShell } from '../src/components/AccountShell'
import { Button } from '../src/components/ui'
import { confirmAction } from '../src/lib/confirmAction'
import { useAuth } from '../src/store/auth'
import { useI18n } from '../src/store/i18n'
import { useColors } from '../src/store/theme'
import { fonts, radius, spacing, type Colors } from '../src/theme'

/**
 * Delete my account (App Store rule 5.1.1(v)). The password is asked again so a
 * borrowed, unlocked phone cannot erase the account. On success the session is
 * cleared exactly like a sign-out.
 */
function DeleteAccountScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const logout = useAuth((s) => s.logout)
  const [password, setPassword] = useState('')

  const erase = useMutation({
    mutationFn: () => authApi.deleteAccount(password),
    onSuccess: async () => {
      await logout()
      confirmAction(t('account.deleteDone'))
      router.replace('/auth/login')
    },
  })

  const ask = () => confirmAction(t('account.deleteConfirmTitle'), t('account.deleteConfirmBody'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('account.deleteAccount'), style: 'destructive', onPress: () => erase.mutate() },
  ])

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={styles.h1}>{t('account.deleteTitle')}</Text>
      <View style={styles.card}>
        <Text style={styles.body}>{t('account.deleteWarning')}</Text>
        <Text style={styles.muted}>{t('account.deleteBlockedHint')}</Text>
        <Text style={styles.label}>{t('account.deletePasswordLabel')}</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          accessibilityLabel={t('account.deletePasswordLabel')}
        />
        {erase.isError ? <Text style={styles.error}>{erase.error instanceof Error ? erase.error.message : t('common.error')}</Text> : null}
        <Button title={t('account.deleteConfirm')} loading={erase.isPending} disabled={!password || erase.isPending} onPress={ask} />
      </View>
    </ScrollView>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: 12, paddingBottom: spacing.xl, backgroundColor: c.cream, flexGrow: 1 },
  h1: { fontFamily: fonts.display, fontWeight: '700', fontSize: 21, color: c.ink },
  card: { backgroundColor: c.white, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: spacing.md, gap: 12 },
  body: { color: c.ink, fontSize: 14, lineHeight: 21 },
  muted: { color: c.muted, fontSize: 13 },
  label: { color: c.muted, fontSize: 13, fontWeight: '600' },
  input: { minHeight: 46, borderRadius: radius.sm, backgroundColor: c.surface2, paddingHorizontal: 12, fontSize: 15, color: c.ink },
  error: { color: c.danger, fontSize: 13 },
})

export default function DeleteAccountRoute() {
  return <AccountShell><DeleteAccountScreen /></AccountShell>
}
