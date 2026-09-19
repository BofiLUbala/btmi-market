export const TERMINAL_ORDER_STATUSES = ['COMPLETED', 'CANCELLED', 'REJECTED', 'DELIVERED', 'RECEIVED'] as const

/**
 * Terminal at the courier-mission level. A FAILED / COURIER_REJECTED mission is
 * over for that courier, though the order itself may be re-assigned by an admin.
 */
export const TERMINAL_DELIVERY_STATUSES = ['DELIVERED', 'RECEIVED', 'COMPLETED', 'CANCELLED', 'FAILED', 'COURIER_REJECTED'] as const

export function isTerminalOrderStatus(status?: string | null): boolean {
  return !!status && (TERMINAL_ORDER_STATUSES as readonly string[]).includes(status)
}

export function isTerminalDeliveryStatus(status?: string | null): boolean {
  return !!status && (TERMINAL_DELIVERY_STATUSES as readonly string[]).includes(status)
}

export function hasActiveOrderStatus(statuses: Array<string | null | undefined>): boolean {
  return statuses.some((status) => !isTerminalOrderStatus(status))
}