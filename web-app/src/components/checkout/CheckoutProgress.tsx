import { useI18n } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'

const STEPS = ['Cart', 'Delivery', 'Review', 'Order'] as const

const STEP_LABELS: Record<(typeof STEPS)[number], TranslationKey> = {
  Cart: 'checkout.step.cart',
  Delivery: 'checkout.step.delivery',
  Review: 'checkout.step.review',
  Order: 'checkout.step.order',
}

export function CheckoutProgress({ current }: { current: typeof STEPS[number] }) {
  const { t } = useI18n()
  const active = STEPS.indexOf(current)
  return <nav className="checkout-progress" aria-label={t('checkout.progress')}>
    {STEPS.map((step, index) => <div key={step} className={`${index === active ? 'current' : ''} ${index < active ? 'done' : ''}`} aria-current={index === active ? 'step' : undefined}>
      <span>{index < active ? '✓' : index + 1}</span><strong>{t(STEP_LABELS[step])}</strong>
    </div>)}
  </nav>
}