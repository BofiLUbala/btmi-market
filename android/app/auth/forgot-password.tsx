import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../src/api'
import { Button, Card, ErrorState, Field, SectionTitle } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { colors, spacing } from '../../src/theme'

export default function ForgotPassword() {
  const { t } = useI18n()
  const [identifier, setIdentifier] = useState('')
  const request = useMutation({ mutationFn: async () => {
    const startedAt = Date.now()
    try { return await authApi.forgotPassword(identifier.trim()) }
    finally {
      const remaining = 1200 - (Date.now() - startedAt)
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
    }
  } })
  return <View style={styles.page}><SectionTitle title={t('auth.recoverAccount')}/><Text style={styles.muted}>{t('auth.recoverAccountBody')}</Text><Card><Field label={t('auth.identifier')} value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoComplete="username" placeholder={t('auth.identifierPlaceholder')}/><Button title={t('auth.sendLink')} loading={request.isPending} disabled={!identifier.trim()} onPress={()=>request.mutate()}/></Card>{request.isError&&<ErrorState message={t('auth.forgotFailed')}/>}{request.isSuccess&&<Card><Text style={styles.success}>{t('auth.forgotSuccess')}</Text></Card>}</View>
}

const styles=StyleSheet.create({page:{padding:spacing.md,gap:spacing.md},muted:{color:colors.muted,lineHeight:21},success:{color:colors.success,fontWeight:'800',lineHeight:21}})