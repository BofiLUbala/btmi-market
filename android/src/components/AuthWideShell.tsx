import { useMemo, type ReactNode } from 'react'
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { KeyboardAwareScrollView } from './KeyboardAwareScrollView'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import { fonts, shadow, spacing, type Colors } from '../theme'

/** Width from which auth screens switch from the phone layout to the
 *  large-screen layout (web, tablets). */
export const AUTH_WIDE_BREAKPOINT = 900

export function useAuthWide() {
  return useWindowDimensions().width >= AUTH_WIDE_BREAKPOINT
}

const LOGO = require('../../assets/icon.png')

/**
 * Large-screen frame shared by every auth screen (sign in, sign up, password
 * recovery, WhatsApp code): plain page, the TBK logo centred above one small
 * white card holding the title, a short subtitle and the form. Phones never
 * render this (see useAuthWide); they keep their own layouts.
 */
export function AuthWideShell({ title, subtitle, children, width = 440, onBack }: {
  title?: string
  subtitle?: string
  children: ReactNode
  /** Back control target; defaults to the previous screen when there is one. */
  onBack?: () => void
  /** Card width; the multi-step sign-up uses a slightly wider card. */
  width?: number
}) {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return <View style={styles.root}>
    <KeyboardAwareScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      {onBack || router.canGoBack() ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('auth.whatsapp.back')} onPress={onBack ?? (() => router.back())} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
      ) : null}
      <View style={[styles.column, { width }]}>
        <View style={styles.logoTile}><Image source={LOGO} style={styles.logo} resizeMode="contain" /></View>
        <View style={styles.card}>
          {title || subtitle ? (
            <View style={styles.head}>
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          ) : null}
          {children}
        </View>
      </View>
    </KeyboardAwareScrollView>
  </View>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  page: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: 48 },
  back: { position: 'absolute', left: spacing.lg, top: spacing.lg, zIndex: 1, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  column: { maxWidth: '100%', alignItems: 'center', gap: 24 },
  logoTile: { width: 80, height: 80, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  logo: { width: 80, height: 80 },
  card: { alignSelf: 'stretch', backgroundColor: colors.white, borderRadius: 24, padding: 32, gap: 14, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  head: { gap: 6, marginBottom: 4 },
  title: { color: colors.ink, fontFamily: fonts.display, fontWeight: '700', fontSize: 24, lineHeight: 30, letterSpacing: -0.3, textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
})
