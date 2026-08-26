import { useMemo, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../src/api'
import { Button, Card, ErrorState, Field, SectionTitle } from '../../src/components/ui'
import { colors, spacing } from '../../src/theme'

export default function ResetPassword() {
  const { token = '' } = useLocalSearchParams<{ token?: string }>()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const rules = useMemo(() => [password.length >= 8, password.length <= 64, /[A-Z]/.test(password), /[a-z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)], [password])
  const matches = confirmation.length > 0 && password === confirmation
  const valid = Boolean(token) && rules.every(Boolean) && matches
  const reset = useMutation({ mutationFn: () => authApi.resetPassword(token, password, confirmation) })
  return <View style={styles.page}><SectionTitle title="Créer un nouveau mot de passe"/>{!token?<ErrorState message="Ce lien ne contient pas de token valide."/>:<><Card><Field label="Nouveau mot de passe" value={password} onChangeText={setPassword} secureTextEntry maxLength={64}/><View>{['8 caractères minimum','64 caractères maximum','Une majuscule','Une minuscule','Un chiffre','Un caractère spécial'].map((label,index)=><Text key={label} style={[styles.rule,rules[index]&&styles.met]}>{rules[index]?'✓':'○'} {label}</Text>)}</View><Field label="Confirmer le mot de passe" value={confirmation} onChangeText={setConfirmation} secureTextEntry maxLength={64}/>{confirmation.length>0&&<Text style={matches?styles.met:styles.error}>{matches?'✓ Les mots de passe correspondent.':'Les mots de passe ne correspondent pas.'}</Text>}<Button title="Réinitialiser le mot de passe" loading={reset.isPending} disabled={!valid||reset.isSuccess} onPress={()=>reset.mutate()}/></Card>{reset.isError&&<ErrorState message="Le lien est invalide, expiré, déjà utilisé, ou le mot de passe ne respecte pas les contraintes."/>}{reset.isSuccess&&<Card><Text style={styles.met}>Mot de passe modifié avec succès.</Text><Button title="Se connecter" onPress={()=>router.replace('/auth/login')}/></Card>}</>}</View>
}

const styles=StyleSheet.create({page:{padding:spacing.md,gap:spacing.md},rule:{color:colors.muted,lineHeight:23},met:{color:colors.success,fontWeight:'800'},error:{color:colors.danger,fontWeight:'800'}})
