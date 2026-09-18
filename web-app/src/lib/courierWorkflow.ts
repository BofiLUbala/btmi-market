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
  actionType?: 'ACCEPT_REJECT' | 'PICKUP' | 'START_DELIVERY' | 'ARRIVE' | 'VERIFY_PRODUCT' | 'CONFIRM_CASH' | 'SCAN_DELIVERY' | 'WAIT_SELLER' | 'WAIT_PAYMENT' | 'WAIT_BUYER' | 'COMPLETED'
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
    deliveryScanned?: boolean
    receiptConfirmed?: boolean
    paymentVerified?: boolean
    courierCanVerifyProduct?: boolean
    courierCanConfirmCash?: boolean
    courierCanScanDelivery?: boolean
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
  deliveryStatus: string,
  orderStatus?: string,
  paymentMethod?: string,
  handoverFlags?: CourierWorkflowState['handoverFlags']
): CourierWorkflowState {
  const isReady = ['READY', 'READY_FOR_PICKUP'].includes(orderStatus || '')
  const isCash = paymentMethod === 'CASH_ON_DELIVERY'
  const flags = handoverFlags || {}

  // Build step definitions in order
  const steps: WorkflowStep[] = [
    {
      key: 'assigned',
      label: 'Mission assignée',
      state: deliveryStatus === 'COURIER_ASSIGNED' ? 'CURRENT_ACTION' :
        ['COURIER_ACCEPTED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'COURIER_ARRIVED', 'DELIVERED', 'RECEIVED', 'COMPLETED'].includes(deliveryStatus) ? 'COMPLETED' : 'PENDING',
      responsibleActor: 'Commerce Admin → Livreur',
      actionType: 'ACCEPT_REJECT',
      primaryButtonText: 'Accepter',
      secondaryButtonText: 'Refuser',
      canAct: deliveryStatus === 'COURIER_ASSIGNED',
      prerequisites: []
    },
    {
      key: 'accepted',
      label: 'Mission acceptée',
      state: deliveryStatus === 'COURIER_ACCEPTED' ? 'CURRENT_ACTION' :
        ['READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'COURIER_ARRIVED', 'DELIVERED', 'RECEIVED', 'COMPLETED'].includes(deliveryStatus) ? 'COMPLETED' : 'PENDING',
      responsibleActor: 'Livreur (Vous)',
      actionType: isReady ? 'PICKUP' : 'WAIT_SELLER',
      primaryButtonText: isReady ? 'Confirmer la récupération' : undefined,
      secondaryButtonText: isReady ? 'Scanner le QR vendeur' : undefined,
      canAct: deliveryStatus === 'COURIER_ACCEPTED' && isReady,
      prerequisites: ['assigned']
    },
    {
      key: 'ready_for_pickup',
      label: 'Commande prête pour récupération',
      state: deliveryStatus === 'READY_FOR_PICKUP' ? 'CURRENT_ACTION' :
        ['PICKED_UP', 'IN_TRANSIT', 'COURIER_ARRIVED', 'DELIVERED', 'RECEIVED', 'COMPLETED'].includes(deliveryStatus) ? 'COMPLETED' : 'PENDING',
      responsibleActor: isReady ? 'Vendeur' : 'Livreur (Vous)',
      actionType: 'PICKUP',
      primaryButtonText: 'Confirmer la récupération',
      secondaryButtonText: 'Scanner le QR vendeur',
      canAct: deliveryStatus === 'READY_FOR_PICKUP',
      prerequisites: ['accepted']
    },
    {
      key: 'picked_up',
      label: 'Commande récupérée',
      state: deliveryStatus === 'PICKED_UP' ? 'CURRENT_ACTION' :
        ['IN_TRANSIT', 'COURIER_ARRIVED', 'DELIVERED', 'RECEIVED', 'COMPLETED'].includes(deliveryStatus) ? 'COMPLETED' : 'PENDING',
      responsibleActor: 'Livreur (Vous)',
      actionType: 'START_DELIVERY',
      primaryButtonText: 'Démarrer la livraison',
      canAct: deliveryStatus === 'PICKED_UP',
      prerequisites: ['ready_for_pickup']
    },
    {
      key: 'in_transit',
      label: 'En route',
      state: deliveryStatus === 'IN_TRANSIT' ? 'CURRENT_ACTION' :
        ['COURIER_ARRIVED', 'DELIVERED', 'RECEIVED', 'COMPLETED'].includes(deliveryStatus) ? 'COMPLETED' : 'PENDING',
      responsibleActor: 'Livreur (Vous)',
      actionType: 'ARRIVE',
      primaryButtonText: 'Je suis arrivé',
      canAct: deliveryStatus === 'IN_TRANSIT',
      prerequisites: ['picked_up']
    },
    {
      key: 'arrived',
      label: 'Livreur arrivé',
      state: deliveryStatus === 'COURIER_ARRIVED' ? 'CURRENT_ACTION' :
        ['DELIVERED', 'RECEIVED', 'COMPLETED'].includes(deliveryStatus) ? 'COMPLETED' : 'PENDING',
      responsibleActor: 'Livreur (Vous)',
      actionType: 'VERIFY_PRODUCT',
      primaryButtonText: 'Vérifier les produits',
      canAct: deliveryStatus === 'COURIER_ARRIVED',
      prerequisites: ['in_transit']
    },
    {
      key: 'product_verified',
      label: 'Produits vérifiés',
      state: flags.allProductsVerified ? 'COMPLETED' :
        deliveryStatus === 'COURIER_ARRIVED' ? 'CURRENT_ACTION' : 'LOCKED',
      responsibleActor: 'Livreur (Vous)',
      actionType: 'VERIFY_PRODUCT',
      primaryButtonText: 'Vérifier les produits',
      canAct: flags.courierCanVerifyProduct === true,
      prerequisites: ['arrived']
    },
    {
      key: 'payment',
      label: isCash ? 'Espèces encaissées' : 'Paiement confirmé',
      state: flags.deliveryScanned || flags.receiptConfirmed ? 'COMPLETED' :
        flags.paymentVerified ? 'COMPLETED' :
        flags.allProductsVerified ? 'CURRENT_ACTION' : 'LOCKED',
      responsibleActor: isCash ? 'Livreur (Vous)' : 'Acheteur / Opérateur',
      actionType: isCash ? 'CONFIRM_CASH' : 'WAIT_PAYMENT',
      primaryButtonText: isCash ? 'Confirmer réception des espèces' : undefined,
      canAct: flags.courierCanConfirmCash === true,
      prerequisites: ['product_verified']
    },
    {
      key: 'scan_delivery',
      label: 'QR de remise scanné',
      state: flags.deliveryScanned ? 'COMPLETED' :
        flags.allProductsVerified && flags.paymentVerified && !flags.deliveryScanned ? 'CURRENT_ACTION' : 'LOCKED',
      responsibleActor: 'Livreur (Vous)',
      actionType: 'SCAN_DELIVERY',
      primaryButtonText: 'Scanner le QR acheteur',
      canAct: flags.courierCanScanDelivery === true,
      prerequisites: ['product_verified', 'payment']
    },
    {
      key: 'buyer_acknowledged',
      label: 'Articles confirmés par l\'acheteur',
      state: flags.allLinesAcknowledged ? 'COMPLETED' :
        flags.deliveryScanned ? 'CURRENT_ACTION' : 'LOCKED',
      responsibleActor: 'Acheteur',
      actionType: 'WAIT_BUYER',
      canAct: flags.buyerCanAcknowledge === true,
      prerequisites: ['scan_delivery']
    },
    {
      key: 'delivered',
      label: 'Livraison terminée',
      state: flags.receiptConfirmed ? 'COMPLETED' :
        flags.allLinesAcknowledged && flags.deliveryScanned && flags.paymentVerified ? 'CURRENT_ACTION' : 'LOCKED',
      responsibleActor: 'Acheteur',
      actionType: 'WAIT_BUYER',
      canAct: flags.buyerCanConfirmReceipt === true,
      prerequisites: ['buyer_acknowledged', 'scan_delivery', 'payment']
    }
  ]

  // Determine current action step
  const currentStep = steps.find(s => s.state === 'CURRENT_ACTION')
  const nextActionStep = currentStep || steps.find(s => s.state === 'LOCKED' && !flags.allProductsVerified && s.key === 'product_verified')

  // Stage classification
  let stage: CourierWorkflowState['stage'] = 'pre_handover'
  if (['COURIER_ARRIVED', 'DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION'].includes(deliveryStatus)) {
    stage = 'handover'
  } else if (['DELIVERED', 'RECEIVED', 'COMPLETED'].includes(deliveryStatus)) {
    stage = 'completed'
  }

  // Compute responsible actor & explanation for the current status
  let responsibleActor = 'Système'
  let explanation = `Suivi de livraison (${deliveryStatus}).`
  let actionType: WorkflowStep['actionType'] = 'WAIT_SELLER'
  let primaryButtonText: string | undefined
  let secondaryButtonText: string | undefined

  switch (deliveryStatus) {
    case 'COURIER_ASSIGNED':
      responsibleActor = 'Livreur (Vous)'
      explanation = 'Cette mission vous est attribuée. Vous devez l\'accepter ou la refuser.'
      actionType = 'ACCEPT_REJECT'
      primaryButtonText = 'Accepter'
      secondaryButtonText = 'Refuser'
      break
    case 'COURIER_ACCEPTED':
      if (isReady) {
        responsibleActor = 'Livreur (Vous)'
        explanation = 'La commande est prête chez le vendeur. Confirmez la récupération des colis.'
        actionType = 'PICKUP'
        primaryButtonText = 'Confirmer la récupération'
        secondaryButtonText = 'Scanner le QR vendeur'
      } else {
        responsibleActor = 'Vendeur'
        explanation = 'En attente que le vendeur prépare la commande.'
        actionType = 'WAIT_SELLER'
      }
      break
    case 'READY_FOR_PICKUP':
      responsibleActor = 'Livreur (Vous)'
      explanation = 'La commande est prête chez le vendeur. Confirmez la récupération des colis.'
      actionType = 'PICKUP'
      primaryButtonText = 'Confirmer la récupération'
      secondaryButtonText = 'Scanner le QR vendeur'
      break
    case 'PICKED_UP':
      responsibleActor = 'Livreur (Vous)'
      explanation = 'Colis en votre possession. Démarrez le trajet de livraison.'
      actionType = 'START_DELIVERY'
      primaryButtonText = 'Démarrer la livraison'
      break
    case 'IN_TRANSIT':
      responsibleActor = 'Livreur (Vous)'
      explanation = 'Trajet de livraison en cours. Validez votre arrivée une fois sur place chez l\'acheteur.'
      actionType = 'ARRIVE'
      primaryButtonText = 'Je suis arrivé'
      break
    case 'COURIER_ARRIVED':
      responsibleActor = 'Livreur (Vous)'
      explanation = 'Vous êtes arrivé chez l\'acheteur. Procédez à la vérification des produits.'
      actionType = 'VERIFY_PRODUCT'
      primaryButtonText = 'Vérifier les produits'
      break
    case 'PRODUCT_VERIFIED':
    case 'PAYMENT_VERIFIED':
      if (isCash) {
        responsibleActor = 'Livreur (Vous)'
        explanation = 'Produits vérifiés. Encaissez le montant en espèces auprès de l\'acheteur.'
        actionType = 'CONFIRM_CASH'
        primaryButtonText = 'Confirmer réception des espèces'
      } else {
        responsibleActor = 'Acheteur / Opérateur'
        explanation = 'En attente de confirmation du paiement mobile.'
        actionType = 'WAIT_PAYMENT'
      }
      break
    case 'DELIVERED':
    case 'RECEIVED':
    case 'COMPLETED':
      responsibleActor = 'Aucun (Livraison terminée)'
      explanation = 'Livraison finalisée et clôturée.'
      actionType = 'COMPLETED'
      break
    default:
      responsibleActor = 'Système'
      explanation = `Suivi de livraison (${deliveryStatus}).`
      actionType = 'WAIT_BUYER'
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