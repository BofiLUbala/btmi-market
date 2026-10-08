import { useEffect, useRef, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { Text, View, StyleSheet } from 'react-native'
import { authApi } from '../../src/api'
import { tokenStore } from '../../src/api/tokenStore'
import { ApiError } from '../../src/api/client'
import { Button, ErrorState, Loading, SectionTitle } from '../../src/components/ui'
import { useAuth } from '../../src/store/auth'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'

/**
 * The link in the activation email. It used to point at web-app, which the
 * site no longer serves at its root, so the mail arrived and led to
 * "Unmatched Route". The endpoint answers with a session, so activating also
 * signs the account in — a seller goes on to onboarding, everyone else to the
 * marketplace.
 */
export default function ActivateScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = makeStyles(colors)
  const { token = '', email = '' } = useLocalSearchParams<{ token?: string; email?: string }>()
  const [state, setState] = useState<'loading' | 'error'>('loading')
  const [message, setMessage] = useState('')
  // The effect runs twice under React's development double-invoke, and the
  // token is single-use: the second call would fail a just-succeeded
  // activation. Guard so it is spent exactly once.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (!token) {
      setState('error')
      setMessage(t('auth.reinitialize.invalidLink'))
      return
    }
    let alive = true
    authApi.activate(email, token).then(
      async (session) => {
        await tokenStore.set(session.access_token, session.refresh_token)
        await useAuth.getState().refresh()
        if (!alive) return
        const accountType = session.user?.account_type ?? useAuth.getState().user?.account_type
        router.replace(accountType === 'SELLER' ? '/seller/onboarding' : '/')
      },
      (err: unknown) => {
        if (!alive) return
        setState('error')
        setMessage(err instanceof ApiError ? err.message : t('auth.activate.failed'))
      }
    )
    return () => { alive = false }
  }, [token, email, t])

  if (state === 'loading') return <View style={styles.page}><Loading label={t('auth.activate.loading')} /></View>
  return (
    <View style={styles.page}>
      <SectionTitle title={t('auth.activate.failed')} />
      <ErrorState message={message} retry={() => router.replace('/auth/login')} actionLabel={t('common.signIn')} />
      <Text style={styles.hint}>{t('auth.reinitialize.didNotReceive')}</Text>
      <Button title={t('auth.reinitialize.resend')} variant="outline" onPress={() => router.push({ pathname: '/auth/registration-recovery', params: { mode: 'resend' } })} />
    </View>
  )
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: c.cream, padding: spacing.md, gap: spacing.sm, justifyContent: 'center' },
    hint: { color: c.muted, textAlign: 'center', marginTop: spacing.md },
  })
