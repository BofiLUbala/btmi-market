import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SELLER_POLICY_ARTICLES, SELLER_POLICY_UPDATED_AT, SELLER_POLICY_VERSION } from '../content/sellerPolicy'
import { useI18n } from '../store/i18n'
import { useColors } from '../store/theme'
import { spacing, type Colors } from '../theme'

/** Body of the seller policy, shared by the dedicated screen
 *  (app/seller/policy.tsx) and the read-before-signup modal on the
 *  registration form — both need the exact same text. */
export function SellerPolicyContent() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <View style={styles.wrap}>
      <Text style={styles.intro}>{t('seller.policy.intro')}</Text>
      <Text style={styles.meta}>{t('seller.policy.version', { version: SELLER_POLICY_VERSION, date: SELLER_POLICY_UPDATED_AT })}</Text>

      {SELLER_POLICY_ARTICLES.map((article) => (
        <View key={article.id} style={styles.article}>
          <Text style={styles.articleTitle}>{article.title}</Text>
          {article.paragraphs.map((p, i) => (
            <Text key={i} style={styles.paragraph}>{p}</Text>
          ))}
          {article.list?.map((item, i) => (
            <View key={i} style={styles.listRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    wrap: { gap: spacing.sm },
    intro: { color: colors.muted, lineHeight: 21, fontSize: 14 },
    meta: { color: colors.mutedLight, fontSize: 12, marginBottom: spacing.sm },
    article: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 6 },
    articleTitle: { fontSize: 16, fontWeight: '900', color: colors.ink, marginBottom: 2 },
    paragraph: { color: colors.ink, lineHeight: 21, fontSize: 14 },
    listRow: { flexDirection: 'row', gap: 8, paddingLeft: 2 },
    bullet: { color: colors.gold, fontWeight: '900' },
    listText: { flex: 1, color: colors.ink, lineHeight: 20, fontSize: 13.5 },
  })
