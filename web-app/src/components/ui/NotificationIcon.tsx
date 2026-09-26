import type { ReactNode } from 'react'
import {
  BagIcon, BellIcon, BoxIcon, CardIcon, CashIcon, ChatIcon, CheckCircleIcon, ClockIcon,
  FlagIcon, GiftIcon, PenIcon, PinIcon, ReviewIcon, TruckIcon, WarningIcon, XCircleIcon,
} from './Icons'

/** Line icon for a notification type (buyer and seller inboxes share it). */
export function notificationIcon(type: string): ReactNode {
  const size = { width: 16, height: 16 }
  switch (type) {
    case 'NEW_ORDER':
      return <BagIcon {...size} />
    case 'ORDER_ACCEPTED':
    case 'ORDER_PREPARING':
    case 'ORDER_READY_FOR_PICKUP':
      return <BoxIcon {...size} />
    case 'COURIER_ASSIGNED':
    case 'DELIVERY_ASSIGNED':
    case 'COURIER_PICKED_UP':
    case 'DELIVERY_IN_TRANSIT':
      return <TruckIcon {...size} />
    case 'COURIER_NEAR_DESTINATION':
      return <PinIcon {...size} />
    case 'COURIER_ARRIVED':
      return <FlagIcon {...size} />
    case 'DELIVERED':
      return <GiftIcon {...size} />
    case 'BUYER_RECEIPT_REQUIRED':
      return <PenIcon {...size} />
    case 'ORDER_COMPLETED':
      return <CheckCircleIcon {...size} />
    case 'ORDER_CANCELLED':
    case 'ORDER_REJECTED':
      return <XCircleIcon {...size} />
    case 'DELIVERY_FAILED':
      return <WarningIcon {...size} />
    case 'DELIVERY_DELAYED':
      return <ClockIcon {...size} />
    case 'PAYMENT_CONFIRMED':
      return <CardIcon {...size} />
    case 'CASH_CONFIRMATION_REQUIRED':
      return <CashIcon {...size} />
    case 'NEW_MESSAGE':
      return <ChatIcon {...size} />
    case 'NEW_REVIEW':
      return <ReviewIcon {...size} />
    default:
      return <BellIcon {...size} />
  }
}
