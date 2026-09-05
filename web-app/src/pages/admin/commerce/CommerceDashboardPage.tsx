import { useT } from '@/store/i18n'

export default function CommerceDashboardPage() {
  const t = useT()

  const domains = [
    { num: 9, name: t('admin.commerceDash.domain9Name'), desc: t('admin.commerceDash.domain9Desc') },
    { num: 10, name: t('admin.commerceDash.domain10Name'), desc: t('admin.commerceDash.domain10Desc') },
    { num: 11, name: t('admin.commerceDash.domain11Name'), desc: t('admin.commerceDash.domain11Desc') },
    { num: 12, name: t('admin.commerceDash.domain12Name'), desc: t('admin.commerceDash.domain12Desc') },
    { num: 13, name: t('admin.commerceDash.domain13Name'), desc: t('admin.commerceDash.domain13Desc') },
    { num: 14, name: t('admin.commerceDash.domain14Name'), desc: t('admin.commerceDash.domain14Desc') },
    { num: 15, name: t('admin.commerceDash.domain15Name'), desc: t('admin.commerceDash.domain15Desc') },
    { num: 16, name: t('admin.commerceDash.domain16Name'), desc: t('admin.commerceDash.domain16Desc') },
    { num: 17, name: t('admin.commerceDash.domain17Name'), desc: t('admin.commerceDash.domain17Desc') },
    { num: 18, name: t('admin.commerceDash.domain18Name'), desc: t('admin.commerceDash.domain18Desc') },
    { num: 19, name: t('admin.commerceDash.domain19Name'), desc: t('admin.commerceDash.domain19Desc') },
    { num: 20, name: t('admin.commerceDash.domain20Name'), desc: t('admin.commerceDash.domain20Desc') },
    { num: 21, name: t('admin.commerceDash.domain21Name'), desc: t('admin.commerceDash.domain21Desc') },
    { num: 22, name: t('admin.commerceDash.domain22Name'), desc: t('admin.commerceDash.domain22Desc') },
    { num: 23, name: t('admin.commerceDash.domain23Name'), desc: t('admin.commerceDash.domain23Desc') },
    { num: 24, name: t('admin.commerceDash.domain24Name'), desc: t('admin.commerceDash.domain24Desc') },
    { num: 25, name: t('admin.commerceDash.domain25Name'), desc: t('admin.commerceDash.domain25Desc') },
    { num: 26, name: t('admin.commerceDash.domain26Name'), desc: t('admin.commerceDash.domain26Desc') },
    { num: 27, name: t('admin.commerceDash.domain27Name'), desc: t('admin.commerceDash.domain27Desc') },
    { num: 28, name: t('admin.commerceDash.domain28Name'), desc: t('admin.commerceDash.domain28Desc') },
    { num: 29, name: t('admin.commerceDash.domain29Name'), desc: t('admin.commerceDash.domain29Desc') },
    { num: 30, name: t('admin.commerceDash.domain30Name'), desc: t('admin.commerceDash.domain30Desc') }
  ]

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>📦</span> {t('admin.commerceDash.title')}
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
          {t('admin.commerceDash.subtitle')}
        </p>
      </div>

      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🏗️</span>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: '#34d399' }}>{t('admin.commerceDash.bannerTitle')}</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
              {t('admin.commerceDash.bannerDesc')}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {domains.map((d) => (
          <div key={d.num} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#34d399', backgroundColor: '#064e3b', padding: '2px 8px', borderRadius: 6 }}>
                {t('admin.commerceDash.domainLabel', { num: d.num })}
              </span>
              <span style={{ fontSize: 11, color: '#64748b' }}>{t('admin.commerceDash.phase2')}</span>
            </div>
            <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 6px', color: '#f8fafc' }}>{d.name}</h4>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>{d.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
