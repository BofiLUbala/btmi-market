import { describe, expect, it } from 'vitest'
import { getCourierWorkflow } from './courierWorkflow'

describe('courier workflow actions', () => {
  it.each([
    ['READY_FOR_PICKUP', 'PICKUP', 'Confirmer la récupération'],
    ['PICKED_UP', 'START_DELIVERY', 'Démarrer la livraison'],
    ['IN_TRANSIT', 'ARRIVE', 'Je suis arrivé'],
  ])('makes %s an actionable courier state', (status, actionType, buttonText) => {
    const workflow = getCourierWorkflow(status, 'READY', 'CASH_ON_DELIVERY')

    expect(workflow.actionType).toBe(actionType)
    expect(workflow.primaryButtonText).toBe(buttonText)
    expect(workflow.nextActionStep?.canAct).toBe(true)
  })

  it('offers the pickup when the seller was ready before the courier accepted', () => {
    // The server accepts a pickup from COURIER_ACCEPTED once the order is READY.
    const workflow = getCourierWorkflow('COURIER_ACCEPTED', 'READY', 'CASH_ON_DELIVERY')

    expect(workflow.actionType).toBe('PICKUP')
    expect(workflow.nextActionStep?.canAct).toBe(true)
  })

  it('waits for the seller while the order is not ready yet', () => {
    const workflow = getCourierWorkflow('COURIER_ACCEPTED', 'PREPARING', 'CASH_ON_DELIVERY')

    expect(workflow.actionType).toBe('WAIT_SELLER')
    expect(workflow.primaryButtonText).toBeUndefined()
  })
})
