const STEPS = ['Cart', 'Delivery', 'Review', 'Order'] as const

export function CheckoutProgress({ current }: { current: typeof STEPS[number] }) {
  const active = STEPS.indexOf(current)
  return <nav className="checkout-progress" aria-label="Checkout progress">
    {STEPS.map((step, index) => <div key={step} className={`${index === active ? 'current' : ''} ${index < active ? 'done' : ''}`} aria-current={index === active ? 'step' : undefined}>
      <span>{index < active ? '✓' : index + 1}</span><strong>{step}</strong>
    </div>)}
  </nav>
}
