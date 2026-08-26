export const TERMINAL_ORDER_STATUSES = ['COMPLETED', 'CANCELLED', 'REJECTED'] as const

export function isTerminalOrderStatus(status?: string | null): boolean {
  return !!status && (TERMINAL_ORDER_STATUSES as readonly string[]).includes(status)
}

export function hasActiveOrderStatus(statuses: Array<string | null | undefined>): boolean {
  return statuses.some((status) => !isTerminalOrderStatus(status))
}
