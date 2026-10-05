import { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router, useLocalSearchParams } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../src/api'
import { Button, Card, ErrorState, Field, SectionTitle } from '../../src/components/ui'
import { KeyboardAwareScrollView } from '../../src/components/KeyboardAwareScrollView'
import { ResendEmailButton } from '../../src/components/AuthFormParts'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, spacing, type Colors } from '../../src/theme'

/** Same response time whether or not the account exists (no enumeration by timing). */
async function requestReset(identifier: string) {
  const startedAt = Date.now()
  try { return await authApi.forgotPassword(identifier) }
  finally {
    const remaining = 1200 - (Date.now() - startedAt)
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
  }
}

export default function ForgotPassword() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  // Pre-filled with what was typed on the sign-in screen.
  const params = useLocalSearchParams<{ identifier?: string }>()
  const [identifier, setIdentifier] = useState(typeof params.identifier === 'string' ? params.identifier : '')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const request = useMutation({
    mutationFn: (value: string) => requestReset(value),
    onSuccess: (_data, value) => setSentTo(value),
  })
  const send = () => { if (identifier.trim() && !request.isPending) request.mutate(identifier.trim()) }

  if (sentTo) {
    return <KeyboardAwareScrollView contentContainerStyle={styles.page}>
      <Card>
        <View style={styles.icon}><Ionicons name="mail-outline" size={26} color={colors.onGreen} /></View>
        <Text style={styles.sentTitle}>{t('auth.forgotSentTitle')}</Text>
        <Text style={[styles.muted, styles.center]}>{t('auth.forgotSentTo', { identifier: sentTo })}</Text>
        <Button title={t('auth.backToSignIn')} onPress={() => router.replace('/auth/login')} />
        <ResendEmailButton label={t('auth.forgotResend')} onResend={() => requestReset(sentTo)} />
        <Text style={[styles.link, styles.center]} onPress={() => { request.reset(); setSentTo(null) }}>{t('auth.useAnotherIdentifier')}</Text>
      </Card>
    </KeyboardAwareScrollView>
  }

  return <KeyboardAwareScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <SectionTitle title={t('auth.recoverAccount')} />
    <Text style={styles.muted}>{t('auth.recoverAccountBody')}</Text>
    <Card>
      <Field
        label={t('auth.identifier')}
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        autoFocus={!identifier}
        returnKeyType="send"
        onSubmitEditing={send}
        placeholder={t('auth.identifierPlaceholder')}
      />
      <Button title={t('auth.sendLink')} loading={request.isPending} disabled={!identifier.trim()} onPress={send} />
    </Card>
    {request.isError && <ErrorState message={t('auth.forgotFailed')} />}
    <Text style={[styles.link, styles.center]} onPress={() => router.back()}>{t('auth.backToSignIn')}</Text>
  </KeyboardAwareScrollView>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { flexGrow: 1, padding: spacing.md, gap: 12, backgroundColor: colors.cream },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  center: { textAlign: 'center' },
  link: { color: colors.green, fontWeight: '700', fontSize: 14, paddingVertical: 6 },
  icon: { alignSelf: 'center', width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  sentTitle: { color: colors.ink, fontSize: 22, fontWeight: '700', letterSpacing: -0.3, textAlign: 'center' },
})
