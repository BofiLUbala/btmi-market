import { useMemo, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { authApi, type WhatsAppChallenge } from '../src/api'
import { AccountShell } from '../src/components/AccountShell'
import { KeyboardAwareScrollView } from '../src/components/KeyboardAwareScrollView'
import { WhatsAppCodeForm, challengeFromError } from '../src/components/WhatsAppAuth'
import { Button } from '../src/components/ui'
import { confirmAction } from '../src/lib/confirmAction'
import { useAuth } from '../src/store/auth'
import { useI18n } from '../src/store/i18n'
import { useColors } from '../src/store/theme'
import { fonts, radius, spacing, type Colors } from '../src/theme'

/**
 * Delete my account (App Store rule 5.1.1(v)). Ownership has to be proved
 * again, so a borrowed, unlocked phone cannot erase the account -- but how
 * depends on the account: one registered from a phone number alone has no
 * password to re-type, only a number, so it is confirmed by a code sent
 * there. `has_password` on the signed-in user says which. It falls back to the
 * password when the field is missing (an older API), which is the safe way to
 * be wrong. On success the session is cleared exactly like a sign-out.
 */
function DeleteAccountScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const logout = useAuth((s) => s.logout)
  const user = useAuth((s) => s.user)
  const byCode = user?.has_password === false
  const [password, setPassword] = useState('')
  const [challenge, setChallenge] = useState<WhatsAppChallenge | null>(null)
  const [challengeError, setChallengeError] = useState('')

  async function finish() {
    await logout()
    confirmAction(t('account.deleteDone'))
    router.replace('/auth/login')
  }

  const erase = useMutation({
    mutationFn: () => authApi.deleteAccount({ password }),
    onSuccess: finish,
  })

  // The code is only asked for once the deletion has been accepted in
  // principle: the backend checks the blockers before sending it.
  const sendCode = useMutation({
    mutationFn: () => authApi.requestDeleteAccountCode(),
    onSuccess: (ch) => { setChallengeError(''); setChallenge(ch) },
    onError: (err) => {
      // A code that was stored but not delivered can still be resent.
      const pending = challengeFromError(err)
      if (pending) {
        setChallengeError(err instanceof Error ? err.message : t('common.error'))
        setChallenge(pending)
      }
    },
  })

  const ask = (onConfirm: () => void) =>
    confirmAction(t('account.deleteConfirmTitle'), t('account.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('account.deleteAccount'), style: 'destructive', onPress: onConfirm },
    ])

  if (challenge) {
    return (
      <KeyboardAwareScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.h1}>{t('account.deleteTitle')}</Text>
        <View style={styles.card}>
          <Text style={styles.body}>{t('account.deleteCodeWarning')}</Text>
          <WhatsAppCodeForm
            challenge={challenge}
            initialError={challengeError}
            onVerify={async (challenge_id, code) => {
              await authApi.deleteAccount({ challenge_id, code })
              await finish()
            }}
            onBack={() => { setChallenge(null); setChallengeError('') }}
          />
        </View>
      </KeyboardAwareScrollView>
    )
  }

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={styles.h1}>{t('account.deleteTitle')}</Text>
      <View style={styles.card}>
        <Text style={styles.body}>{t('account.deleteWarning')}</Text>
        <Text style={styles.muted}>{t('account.deleteBlockedHint')}</Text>
        {byCode ? (
          <>
            <Text style={styles.label}>{t('account.deleteCodeLabel')}</Text>
            <Text style={styles.muted}>{t('account.deleteCodeHint')}</Text>
            {sendCode.isError
              ? <Text style={styles.error}>{sendCode.error instanceof Error ? sendCode.error.message : t('common.error')}</Text>
              : null}
            <Button
              title={t('account.deleteSendCode')}
              loading={sendCode.isPending}
              disabled={sendCode.isPending}
              onPress={() => ask(() => sendCode.mutate())}
            />
          </>
        ) : (
          <>
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
            <Button
              title={t('account.deleteConfirm')}
              loading={erase.isPending}
              disabled={!password || erase.isPending}
              onPress={() => ask(() => erase.mutate())}
            />
          </>
        )}
      </View>
    </KeyboardAwareScrollView>
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
