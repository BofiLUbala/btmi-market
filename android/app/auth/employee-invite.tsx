import { useMemo, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { employeeAuthApi } from '../../src/api'
import { ApiError } from '../../src/api/client'
import { Button, Card, ErrorState, Field, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'

export default function EmployeeInviteAccept() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { token = '' } = useLocalSearchParams<{ token?: string }>()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const matches = confirmation.length > 0 && password === confirmation
  const valid = Boolean(token) && password.length >= 8 && matches

  const accept = useMutation({
    mutationFn: () => employeeAuthApi.acceptInvitation({ token, password, password_confirmation: confirmation }),
  })

  return <View style={styles.page}>
    <SectionTitle title={t('seller.employeeInvite.title')} />
    {!token ? <ErrorState message={t('seller.employeeInvite.invalidLink')} /> : accept.isSuccess ? <Card>
      <Text style={styles.success}>{t('seller.employeeInvite.activated')}</Text>
      <Button title={t('common.signIn')} onPress={() => router.replace('/auth/login')} />
    </Card> : <Card>
      <Text style={styles.muted}>{t('seller.employeeInvite.subtitle')}</Text>
      <Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry maxLength={64} />
      <Field label={t('auth.confirmPassword')} value={confirmation} onChangeText={setConfirmation} secureTextEntry maxLength={64} />
      {confirmation.length > 0 && <Text style={matches ? styles.success : styles.error}>{matches ? t('auth.passwordsMatch') : t('auth.passwordsMismatch')}</Text>}
      {accept.isError && <Text style={styles.error}>{accept.error instanceof ApiError ? accept.error.message : t('seller.employeeInvite.failed')}</Text>}
      <Button title={t('seller.employeeInvite.submit')} loading={accept.isPending} disabled={!valid} onPress={() => accept.mutate()} />
    </Card>}
  </View>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md },
  muted: { color: colors.muted },
  success: { color: colors.success, fontWeight: '800' },
  error: { color: colors.danger, fontWeight: '800' },
})
