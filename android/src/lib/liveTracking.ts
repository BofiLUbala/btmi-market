/**
 * Delivery statuses during which the courier shares their position: from the
 * moment they accept the mission (on the way to the shop) until they arrive.
 * Same list as the server (models.LiveTrackingStatuses).
 */
export const LIVE_TRACKING_STATUSES = ['COURIER_ACCEPTED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT']

export const isLiveTracked = (deliveryStatus?: string | null) => LIVE_TRACKING_STATUSES.includes(deliveryStatus || '')

/** Before pickup the courier is heading to the shop, not yet to the buyer. */
export const isHeadingToShop = (deliveryStatus?: string | null) => deliveryStatus === 'COURIER_ACCEPTED' || deliveryStatus === 'READY_FOR_PICKUP'
