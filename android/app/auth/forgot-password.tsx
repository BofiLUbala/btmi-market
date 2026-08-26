import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../src/api'
import { Button, Card, ErrorState, Field, SectionTitle } from '../../src/components/ui'
import { colors, spacing } from '../../src/theme'

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState('')
  const request = useMutation({ mutationFn: async () => {
    const startedAt = Date.now()
    try { return await authApi.forgotPassword(identifier.trim()) }
    finally {
      const remaining = 1200 - (Date.now() - startedAt)
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
    }
  } })
  return <View style={styles.page}><SectionTitle title="Récupérer votre compte"/><Text style={styles.muted}>Saisissez l’e-mail ou le téléphone enregistré. Le lien sera envoyé à l’adresse e-mail associée au compte.</Text><Card><Field label="E-mail ou téléphone" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoComplete="username" placeholder="vous@exemple.com ou +243…"/><Button title="Envoyer le lien" loading={request.isPending} disabled={!identifier.trim()} onPress={()=>request.mutate()}/></Card>{request.isError&&<ErrorState message="La demande n’a pas pu être envoyée."/>}{request.isSuccess&&<Card><Text style={styles.success}>Si un compte correspondant existe, consultez l’adresse e-mail enregistrée, y compris le dossier spam.</Text></Card>}</View>
}

const styles=StyleSheet.create({page:{padding:spacing.md,gap:spacing.md},muted:{color:colors.muted,lineHeight:21},success:{color:colors.success,fontWeight:'800',lineHeight:21}})
