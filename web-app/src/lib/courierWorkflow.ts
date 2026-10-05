import { translate } from '@/store/i18n'
import { adminLabel } from '@/lib/adminLabels'

export type DeliveryStatus =
  | 'PENDING_TBK_ASSIGNMENT'
  | 'COURIER_ASSIGNED'
  | 'COURIER_ACCEPTED'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'COURIER_ARRIVED'
  | 'PRODUCT_VERIFIED'
  | 'PAYMENT_VERIFIED'
  | 'DELIVERED'
  | 'RECEIVED'
  | 'COMPLETED'
  | 'COURIER_REJECTED'
  | 'FAILED'

export interface WorkflowStep {
  key: string
  label: string
  state: 'COMPLETED' | 'CURRENT_ACTION' | 'WAITING_FOR_OTHER' | 'LOCKED' | 'PENDING'
  responsibleActor: string
  reason?: string
  actionType?: 'ACCEPT_REJECT' | 'PICKUP' | 'START_DELIVERY' | 'ARRIVE' | 'VERIFY_PRODUCT' | 'CONFIRM_CASH' | 'WAIT_SELLER' | 'WAIT_PAYMENT' | 'WAIT_BUYER' | 'COMPLETED'
  primaryButtonText?: string
  secondaryButtonText?: string
  canAct: boolean
  prerequisites?: string[]
}

export interface CourierWorkflowState {
  currentStatus: DeliveryStatus
  orderStatus?: string
  paymentMethod?: string
  responsibleActor: string
  explanation: string
  actionType: WorkflowStep['actionType']
  primaryButtonText?: string
  secondaryButtonText?: string
  steps: WorkflowStep[]
  nextActionStep?: WorkflowStep
  stage: 'pre_handover' | 'handover' | 'completed'
  handoverFlags?: {
    allProductsVerified?: boolean
    allLinesAcknowledged?: boolean
    receiptConfirmed?: boolean
    paymentVerified?: boolean
    courierCanVerifyProduct?: boolean
    courierCanConfirmCash?: boolean
    buyerCanAcknowledge?: boolean
    buyerCanConfirmReceipt?: boolean
    blockedReason?: string
  }
}

/**
 * Central workflow resolver.
 * Single source of truth for:
 * - current status
 * - responsible actor
 * - next action
 * - required prerequisites
 * - waiting reason
 * - CTA
 *
 * Used by: Courier dashboard, Mission active, Mission detail, Handover panel
 */
export function getCourierWorkflow(
  rawDeliveryStatus: string,
  orderStatus?: string,
  paymentMethod?: string,
  handoverFlags?: CourierWorkflowState['handoverFlags']
): CourierWorkflowState {
  // The persisted delivery milestone alone authorizes courier actions. One case
  // needs the order too: when the seller marked the order ready before the
  // courier accepted, the mission stays COURIER_ACCEPTED yet the parcel is
  // waiting - the server allows the pickup, so the courier must be offered it.
  const deliveryStatus =
    rawDeliveryStatus === 'COURIER_ACCEPTED' && ['READY', 'READY_FOR_PICKUP'].includes(orderStatus || '')
      ? 'READY_FOR_PICKUP'
      : rawDeliveryStatus
  const isCash = paymentMethod === 'CASH_ON_DELIVERY'
  const flags = handoverFlags || {}
  const isTerminalMission = ['FAILED', 'COURIER_REJECTED'].includes(deliveryStatus)

  // Build step definitions in order
  const steps: WorkflowStep[] = [
    {
      key: 'assigned',
      label: translate('libCourierWorkflow.stepAssigned'),
      state: deliveryStatus === 'COURIER_ASSIGNED' ? 'CURRENT_ACTION' :
        ['COURIER_ACCEPTED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'COURIER_ARRIVED', 'DELIVERED', 'RECEIVED', 'COMPLETED'].includes(deliveryStatus) ? 'COMPLETED' : 'PENDING',
      responsibleActor: translate('libCourierWorkflow.actorAdminToCourier'),
      actionType: 'ACCEPT_REJECT',
      primaryButtonText: translate('libCourierWorkflow.acceptMission'),
      secondaryButtonText: translate('libCourierWorkflow.rejectMission'),
      canAct: deliveryStatus === 'COURIER_ASSIGNED',
      prerequisites: []
    },
    {
      key: 'accepted',
      label: translate('libCourierWorkflow.stepAccepted'),
      state: deliveryStatus === 'COURIER_ACCEPTED' ? 'CURRENT_ACTION' :
        ['READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'COURIER_ARRIVED', 'DELIVERED', 'RECEIVED', 'COMPLETED'].includes(deliveryStatus) ? 'COMPLETED' : 'PENDING',
      responsibleActor: translate('libCourierWorkflow.actorCourierYou'),
      actionType: 'WAIT_SELLER',
      canAct: false,
      prerequisites: ['assigned']
    },
    {
      key: 'ready_for_pickup',
      label: translate('libCourierWorkflow.stepReadyForPickup'),
      state: deliveryStatus === 'READY_FOR_PICKUP' ? 'CURRENT_ACTION' :
        ['PICKED_UP', 'IN_TRANSIT', 'COURIER_ARRIVED', 'DELIVERED', 'RECEIVED', 'COMPLETED'].includes(deliveryStatus) ? 'COMPLETED' : 'PENDING',
      responsibleActor: translate('libCourierWorkflow.actorCourierYou'),
      actionType: 'PICKUP',
      primaryButtonText: translate('libCourierWorkflow.confirmPickup'),
      secondaryButtonText: translate('libCourierWorkflow.scanSellerQr'),
      canAct: deliveryStatus === 'READY_FOR_PICKUP',
      prerequisites: ['accepted']
    },
    {
      key: 'picked_up',
      label: translate('libCourierWorkflow.stepPickedUp'),
      state: deliveryStatus === 'PICKED_UP' ? 'CURRENT_ACTION' :
        ['IN_TRANSIT', 'COURIER_ARRIVED', 'DELIVERED', 'RECEIVED', 'COMPLETED'].includes(deliveryStatus) ? 'COMPLETED' : 'PENDING',
      responsibleActor: translate('libCourierWorkflow.actorCourierYou'),
      actionType: 'START_DELIVERY',
      primaryButtonText: translate('libCourierWorkflow.startDelivery'),
      canAct: deliveryStatus === 'PICKED_UP',
      prerequisites: ['ready_for_pickup']
    },
    {
      key: 'in_transit',
      label: translate('libCourierWorkflow.stepInTransit'),
      state: deliveryStatus === 'IN_TRANSIT' ? 'CURRENT_ACTION' :
        ['COURIER_ARRIVED', 'DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION', 'DELIVERED', 'RECEIVED', 'COMPLETED'].includes(deliveryStatus) ? 'COMPLETED' : 'PENDING',
      responsibleActor: translate('libCourierWorkflow.actorCourierYou'),
      actionType: 'ARRIVE',
      primaryButtonText: translate('libCourierWorkflow.arrived'),
      canAct: deliveryStatus === 'IN_TRANSIT',
      prerequisites: ['picked_up']
    },
    {
      key: 'arrived',
      label: translate('libCourierWorkflow.stepArrived'),
      state: deliveryStatus === 'COURIER_ARRIVED' ? 'CURRENT_ACTION' :
        ['DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION', 'DELIVERED', 'RECEIVED', 'COMPLETED'].includes(deliveryStatus) ? 'COMPLETED' : 'PENDING',
      responsibleActor: translate('libCourierWorkflow.actorCourierYou'),
      actionType: 'VERIFY_PRODUCT',
      primaryButtonText: translate('libCourierWorkflow.verifyProducts'),
      canAct: deliveryStatus === 'COURIER_ARRIVED',
      prerequisites: ['in_transit']
    },
    {
      key: 'product_verified',
      label: translate('libCourierWorkflow.stepProductVerified'),
      state: flags.allProductsVerified ? 'COMPLETED' :
        ['PRODUCT_VERIFIED', 'PAYMENT_VERIFIED', 'DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION'].includes(deliveryStatus) ? 'COMPLETED' :
        deliveryStatus === 'COURIER_ARRIVED' ? 'CURRENT_ACTION' : 'LOCKED',
      responsibleActor: translate('libCourierWorkflow.actorCourierYou'),
      actionType: 'VERIFY_PRODUCT',
      primaryButtonText: translate('libCourierWorkflow.verifyProducts'),
      canAct: flags.courierCanVerifyProduct === true,
      prerequisites: ['arrived']
    },
    {
      key: 'payment',
      label: isCash ? translate('libCourierWorkflow.stepCashCollected') : translate('libCourierWorkflow.stepPaymentConfirmed'),
      state: flags.paymentVerified || flags.receiptConfirmed ? 'COMPLETED' :
        ['PAYMENT_VERIFIED', 'AWAITING_BUYER_CONFIRMATION'].includes(deliveryStatus) ? 'COMPLETED' :
        flags.allProductsVerified ? 'CURRENT_ACTION' : 'LOCKED',
      responsibleActor: isCash ? translate('libCourierWorkflow.actorCourierYou') : translate('libCourierWorkflow.actorBuyerOperator'),
      actionType: isCash ? 'CONFIRM_CASH' : 'WAIT_PAYMENT',
      primaryButtonText: isCash ? translate('libCourierWorkflow.confirmCash') : undefined,
      canAct: flags.courierCanConfirmCash === true,
      prerequisites: ['product_verified']
    },
    // No door QR: once the goods are verified and the money settled, the server
    // closes the handover itself. Only the buyer's confirmation remains.
    {
      key: 'buyer_acknowledged',
      label: translate('libCourierWorkflow.stepBuyerAcknowledged'),
      state: flags.allLinesAcknowledged ? 'COMPLETED' :
        flags.allProductsVerified ? 'CURRENT_ACTION' : 'LOCKED',
      responsibleActor: translate('libCourierWorkflow.actorBuyer'),
      actionType: 'WAIT_BUYER',
      canAct: flags.buyerCanAcknowledge === true,
      prerequisites: ['product_verified']
    },
    {
      key: 'delivered',
      label: translate('libCourierWorkflow.stepDelivered'),
      state: flags.receiptConfirmed ? 'COMPLETED' :
        flags.allLinesAcknowledged && flags.paymentVerified ? 'CURRENT_ACTION' : 'LOCKED',
      responsibleActor: translate('libCourierWorkflow.actorBuyer'),
      actionType: 'WAIT_BUYER',
      canAct: flags.buyerCanConfirmReceipt === true,
      prerequisites: ['buyer_acknowledged', 'payment']
    }
  ]

  // Determine current action step
  let currentStep = steps.find(s => s.state === 'CURRENT_ACTION')
  if (isTerminalMission) {
    currentStep = undefined
  }
  const nextActionStep = currentStep || steps.find(s => s.state === 'LOCKED' && !flags.allProductsVerified && s.key === 'product_verified')

  // Stage classification
  let stage: CourierWorkflowState['stage'] = 'pre_handover'
  if (['COURIER_ARRIVED', 'PRODUCT_VERIFIED', 'PAYMENT_VERIFIED', 'DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION'].includes(deliveryStatus)) {
    stage = 'handover'
  } else if (['DELIVERED', 'RECEIVED', 'COMPLETED'].includes(deliveryStatus) || isTerminalMission) {
    stage = 'completed'
  }

  // Compute responsible actor & explanation for the current status
  let responsibleActor = translate('libCourierWorkflow.actorSystem')
  let explanation = translate('libCourierWorkflow.explainDefault', { status: adminLabel(deliveryStatus) })
  let actionType: WorkflowStep['actionType'] = 'WAIT_SELLER'
  let primaryButtonText: string | undefined
  let secondaryButtonText: string | undefined

  switch (deliveryStatus) {
    case 'COURIER_ASSIGNED':
      responsibleActor = translate('libCourierWorkflow.actorCourierYou')
      explanation = translate('libCourierWorkflow.explainAssigned')
      actionType = 'ACCEPT_REJECT'
      primaryButtonText = translate('libCourierWorkflow.acceptMission')
      secondaryButtonText = translate('libCourierWorkflow.rejectMission')
      break
    case 'COURIER_ACCEPTED':
      responsibleActor = translate('libCourierWorkflow.actorSeller')
      explanation = translate('libCourierWorkflow.explainAccepted')
      actionType = 'WAIT_SELLER'
      break
    case 'READY_FOR_PICKUP':
      responsibleActor = translate('libCourierWorkflow.actorCourierYou')
      explanation = translate('libCourierWorkflow.explainReady')
      actionType = 'PICKUP'
      primaryButtonText = translate('libCourierWorkflow.confirmPickup')
      secondaryButtonText = translate('libCourierWorkflow.scanSellerQr')
      break
    case 'PICKED_UP':
      responsibleActor = translate('libCourierWorkflow.actorCourierYou')
      explanation = translate('libCourierWorkflow.explainPickedUp')
      actionType = 'START_DELIVERY'
      primaryButtonText = translate('libCourierWorkflow.startDelivery')
      break
    case 'IN_TRANSIT':
      responsibleActor = translate('libCourierWorkflow.actorCourierYou')
      explanation = translate('libCourierWorkflow.explainInTransit')
      actionType = 'ARRIVE'
      primaryButtonText = translate('libCourierWorkflow.arrived')
      break
    case 'COURIER_ARRIVED':
      responsibleActor = translate('libCourierWorkflow.actorCourierYou')
      explanation = translate('libCourierWorkflow.explainArrived')
      actionType = 'VERIFY_PRODUCT'
      primaryButtonText = translate('libCourierWorkflow.verifyProducts')
      break
    case 'PRODUCT_VERIFIED':
      if (isCash) {
        responsibleActor = translate('libCourierWorkflow.actorCourierYou')
        explanation = translate('libCourierWorkflow.explainCollectCash')
        actionType = 'CONFIRM_CASH'
        primaryButtonText = translate('libCourierWorkflow.confirmCash')
      } else {
        responsibleActor = translate('libCourierWorkflow.actorBuyerOperator')
        explanation = translate('libCourierWorkflow.explainWaitMobile')
        actionType = 'WAIT_PAYMENT'
      }
      break
    case 'PAYMENT_VERIFIED':
    case 'DELIVERY_SCAN_SUCCESS':
    case 'AWAITING_BUYER_CONFIRMATION':
      responsibleActor = translate('libCourierWorkflow.actorBuyer')
      explanation = translate('libCourierWorkflow.explainWaitBuyerItems')
      actionType = 'WAIT_BUYER'
      break
    case 'DELIVERED':
    case 'RECEIVED':
    case 'COMPLETED':
      responsibleActor = translate('libCourierWorkflow.actorNoneCompleted')
      explanation = translate('libCourierWorkflow.explainCompleted')
      actionType = 'COMPLETED'
      break
    case 'FAILED':
      responsibleActor = translate('libCourierWorkflow.actorNoneFailed')
      explanation = translate('libCourierWorkflow.explainFailed')
      actionType = 'COMPLETED'
      break
    case 'COURIER_REJECTED':
      responsibleActor = translate('libCourierWorkflow.actorCourierYou')
      explanation = translate('libCourierWorkflow.explainRejected')
      actionType = 'COMPLETED'
      break
    default:
      responsibleActor = translate('libCourierWorkflow.actorSystem')
      explanation = translate('libCourierWorkflow.explainDefault', { status: adminLabel(deliveryStatus) })
      actionType = 'WAIT_BUYER'
  }

  // The handover endpoint's permission flags are the server's single source of
  // truth for what the courier may do next at the door. When the delivery status
  // alone cannot tell (product verify, cash and the buyer's confirmation all happen under
  // COURIER_ARRIVED), drive the action panel from these instead of guessing.
  // The override is restricted to the door states: once the status itself is
  // definitive (payment confirmed, scan done, delivered), the status mapping
  // above must win instead of the generic flag fallbacks.
  if (deliveryStatus === 'COURIER_ARRIVED' || deliveryStatus === 'PRODUCT_VERIFIED') {
    if (flags.allProductsVerified && flags.paymentVerified) {
      responsibleActor = translate('libCourierWorkflow.actorBuyer')
      explanation = translate('libCourierWorkflow.explainVerifiedPaid')
      actionType = 'WAIT_BUYER'
    } else if (flags.courierCanConfirmCash) {
      responsibleActor = translate('libCourierWorkflow.actorCourierYou')
      explanation = translate('libCourierWorkflow.explainCollectCash')
      actionType = 'CONFIRM_CASH'
      primaryButtonText = translate('libCourierWorkflow.confirmCash')
    } else if (flags.courierCanVerifyProduct) {
      responsibleActor = translate('libCourierWorkflow.actorCourierYou')
      explanation = translate('libCourierWorkflow.explainArrived')
      actionType = 'VERIFY_PRODUCT'
      primaryButtonText = translate('libCourierWorkflow.verifyProducts')
    } else if (flags.allProductsVerified && !isCash) {
      // Mobile money is settled by the operator, not by a courier tap. Once every
      // product is verified there is nothing for the courier to click until the
      // payment is confirmed by the provider, so show a wait state, not a button.
      responsibleActor = translate('libCourierWorkflow.actorBuyerOperator')
      explanation = translate('libCourierWorkflow.explainWaitMobile')
      actionType = 'WAIT_PAYMENT'
    }
  }

  return {
    currentStatus: deliveryStatus as DeliveryStatus,
    orderStatus,
    paymentMethod,
    responsibleActor,
    explanation,
    actionType,
    primaryButtonText,
    secondaryButtonText,
    steps,
    nextActionStep,
    stage
  }
}

// Convenience: minimal API for components that only need the current action
export function getCourierActionState(
  deliveryStatus: string,
  orderStatus?: string,
  paymentMethod?: string,
  handoverFlags?: CourierWorkflowState['handoverFlags']
): {
  responsibleActor: string
  explanation: string
  actionType: WorkflowStep['actionType']
  primaryButtonText?: string
  secondaryButtonText?: string
} {
  const wf = getCourierWorkflow(deliveryStatus, orderStatus, paymentMethod, handoverFlags)
  return {
    responsibleActor: wf.responsibleActor,
    explanation: wf.explanation,
    actionType: wf.actionType,
    primaryButtonText: wf.primaryButtonText,
    secondaryButtonText: wf.secondaryButtonText
  }
}
