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

export interface CourierActionState {
  responsibleActor: string
  explanation: string
  actionType: 'ACCEPT_REJECT' | 'PICKUP' | 'START_DELIVERY' | 'ARRIVE' | 'HANDOVER' | 'WAIT_SELLER' | 'WAIT_PAYMENT' | 'WAIT_BUYER' | 'COMPLETED'
  primaryButtonText?: string
  secondaryButtonText?: string
}

export function getCourierActionState(deliveryStatus: string, orderStatus?: string, paymentMethod?: string): CourierActionState {
  const isReady = ['READY', 'READY_FOR_PICKUP'].includes(orderStatus || '')

  switch (deliveryStatus) {
    case 'COURIER_ASSIGNED':
      return {
        responsibleActor: 'Livreur (Vous)',
        explanation: 'Cette mission vous est attribuée. Vous devez l\'accepter ou la refuser.',
        actionType: 'ACCEPT_REJECT',
        primaryButtonText: 'Accepter',
        secondaryButtonText: 'Refuser'
      }

    case 'COURIER_ACCEPTED':
      if (isReady) {
        return {
          responsibleActor: 'Livreur (Vous)',
          explanation: 'La commande est prête chez le vendeur. Confirmez la récupération des colis.',
          actionType: 'PICKUP',
          primaryButtonText: 'Confirmer la récupération',
          secondaryButtonText: 'Scanner le QR vendeur'
        }
      }
      return {
        responsibleActor: 'Vendeur',
        explanation: 'En attente que le vendeur prépare la commande.',
        actionType: 'WAIT_SELLER'
      }

    case 'READY_FOR_PICKUP':
      return {
        responsibleActor: 'Livreur (Vous)',
        explanation: 'La commande est prête chez le vendeur. Confirmez la récupération des colis.',
        actionType: 'PICKUP',
        primaryButtonText: 'Confirmer la récupération',
        secondaryButtonText: 'Scanner le QR vendeur'
      }

    case 'PICKED_UP':
      return {
        responsibleActor: 'Livreur (Vous)',
        explanation: 'Colis en votre possession. Démarrez le trajet de livraison.',
        actionType: 'START_DELIVERY',
        primaryButtonText: 'Démarrer la livraison'
      }

    case 'IN_TRANSIT':
      return {
        responsibleActor: 'Livreur (Vous)',
        explanation: 'Trajet de livraison en cours. Validez votre arrivée une fois sur place chez l\'acheteur.',
        actionType: 'ARRIVE',
        primaryButtonText: 'Je suis arrivé'
      }

    case 'COURIER_ARRIVED':
      return {
        responsibleActor: 'Livreur (Vous)',
        explanation: 'Vous êtes arrivé chez l\'acheteur. Procédez à la vérification des produits et au paiement.',
        actionType: 'HANDOVER',
        primaryButtonText: 'Scanner le QR acheteur'
      }

    case 'PRODUCT_VERIFIED':
      if (paymentMethod === 'CASH_ON_DELIVERY') {
        return {
          responsibleActor: 'Livreur (Vous)',
          explanation: 'Produits vérifiés. Encaissez le montant en espèces auprès de l\'acheteur.',
          actionType: 'HANDOVER',
          primaryButtonText: 'Confirmer réception des espèces'
        }
      }
      return {
        responsibleActor: 'Acheteur / Opérateur',
        explanation: 'En attente de confirmation du paiement mobile.',
        actionType: 'WAIT_PAYMENT'
      }

    case 'PAYMENT_VERIFIED':
      return {
        responsibleActor: 'Acheteur',
        explanation: 'Paiement confirmé. En attente de la confirmation de réception par l\'acheteur.',
        actionType: 'WAIT_BUYER'
      }

    case 'DELIVERED':
    case 'RECEIVED':
    case 'COMPLETED':
      return {
        responsibleActor: 'Aucun (Livraison terminée)',
        explanation: 'Livraison finalisée et clôturée.',
        actionType: 'COMPLETED'
      }

    default:
      return {
        responsibleActor: 'Système',
        explanation: `Suivi de livraison (${deliveryStatus}).`,
        actionType: 'WAIT_BUYER'
      }
  }
}
