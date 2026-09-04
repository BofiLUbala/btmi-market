import { Link } from 'react-router-dom'
import { useI18n } from '@/store/i18n'
import { SELLER_POLICY_ARTICLES, SELLER_POLICY_UPDATED_AT, SELLER_POLICY_VERSION } from '@/content/sellerPolicy'

export default function SellerPolicyPage() {
  const { t } = useI18n()

  return (
    <div className="fade-in seller-policy-page">
      <div className="seller-policy-head">
        <span className="seller-eyebrow">TBK Seller</span>
        <h1>{t('seller.policy.title')}</h1>
        <p className="muted">{t('seller.policy.intro')}</p>
        <p className="small muted seller-policy-meta">
          {t('seller.policy.version', { version: SELLER_POLICY_VERSION, date: SELLER_POLICY_UPDATED_AT })}
        </p>
      </div>

      <div className="card seller-policy-card">
        {SELLER_POLICY_ARTICLES.map((article) => (
          <section key={article.id} className="seller-policy-article">
            <h2>{article.title}</h2>
            {article.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {article.list && (
              <ul>
                {article.list.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <Link to="/seller" className="section-link seller-policy-back">
        {t('common.back')}
      </Link>
    </div>
  )
}
