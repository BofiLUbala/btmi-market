import { useMemo, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../src/api'
import { Button, Card, ErrorState, Field, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { colors, spacing } from '../../src/theme'

export default function ResetPassword() {
  const { t } = useI18n()
  const { token = '' } = useLocalSearchParams<{ token?: string }>()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const rules = useMemo(() => [password.length >= 8, password.length <= 64, /[A-Z]/.test(password), /[a-z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)], [password])
  const matches = confirmation.length > 0 && password === confirmation
  const valid = Boolean(token) && rules.every(Boolean) && matches
  const ruleLabels = useMemo(() => [t('auth.ruleMinLength'), t('auth.ruleMaxLength'), t('auth.ruleUppercase'), t('auth.ruleLowercase'), t('auth.ruleNumber'), t('auth.ruleSpecial')], [t])
  const reset = useMutation({ mutationFn: () => authApi.resetPassword(token, password, confirmation) })
  return <View style={styles.page}><SectionTitle title={t('auth.createNewPassword')}/>{!token?<ErrorState message={t('auth.invalidToken')}/>:<><Card><Field label={t('auth.newPassword')} value={password} onChangeText={setPassword} secureTextEntry maxLength={64}/><View>{ruleLabels.map((label,index)=><Text key={label} style={[styles.rule,rules[index]&&styles.met]}>{rules[index]?'✓':'○'} {label}</Text>)}</View><Field label={t('auth.confirmPassword')} value={confirmation} onChangeText={setConfirmation} secureTextEntry maxLength={64}/>{confirmation.length>0&&<Text style={matches?styles.met:styles.error}>{matches?t('auth.passwordsMatch'):t('auth.passwordsMismatch')}</Text>}<Button title={t('auth.resetPassword')} loading={reset.isPending} disabled={!valid||reset.isSuccess} onPress={()=>reset.mutate()}/></Card>{reset.isError&&<ErrorState message={t('auth.resetFailed')}/>}{reset.isSuccess&&<Card><Text style={styles.met}>{t('auth.resetSuccess')}</Text><Button title={t('common.signIn')} onPress={()=>router.replace('/auth/login')}/></Card>}</>}</View>
}

const styles=StyleSheet.create({page:{padding:spacing.md,gap:spacing.md},rule:{color:colors.muted,lineHeight:23},met:{color:colors.success,fontWeight:'800'},error:{color:colors.danger,fontWeight:'800'}})