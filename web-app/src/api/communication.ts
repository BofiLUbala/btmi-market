import { get, post } from './client'
import { adminApi } from './admin'

export type SenderType =
  | 'BUYER'
  | 'SELLER'
  | 'EMPLOYEE'
  | 'COMMERCE_ADMIN'
  | 'SUPER_ADMIN'
  | 'SYSTEM'

export type NotificationType =
  | 'NEW_ORDER'
  | 'ORDER_ACCEPTED'
  | 'ORDER_REJECTED'
  | 'ORDER_PREPARING'
  | 'ORDER_READY_FOR_PICKUP'
  | 'COURIER_ASSIGNED'
  | 'COURIER_PICKED_UP'
  | 'DELIVERY_IN_TRANSIT'
  | 'COURIER_NEAR_DESTINATION'
  | 'COURIER_ARRIVED'
  | 'DELIVERED'
  | 'BUYER_RECEIPT_REQUIRED'
  | 'ORDER_COMPLETED'
  | 'ORDER_CANCELLED'
  | 'DELIVERY_ASSIGNED'
  | 'DELIVERY_FAILED'
  | 'DELIVERY_DELAYED'
  | 'NEW_MESSAGE'
  | 'PAYMENT_CONFIRMED'
  | 'CASH_CONFIRMATION_REQUIRED'
  | 'NEW_REVIEW'

export interface OrderConversation {
  id: string
  order_id: string
  buyer_id: string
  shop_id: string
  business_id: string
  created_at: string
  updated_at: string
}

export interface OrderMessage {
  id: string
  conversation_id: string
  sender_user_id: string
  sender_type: SenderType
  sender_name: string
  body: string
  is_admin_intervention: boolean
  recipient_scope: RecipientScope
  recipient_user_id?: string
  read_by_buyer_at?: string
  read_by_seller_at?: string
  created_at: string
}

export type RecipientScope = 'BUYER' | 'SELLER_OWNER' | 'EMPLOYEE' | 'ALL_PARTICIPANTS'

export interface OrderConversationParticipant {
  user_id: string
  name: string
  type: Exclude<RecipientScope, 'ALL_PARTICIPANTS'>
  last_read_at?: string
}

export interface OrderConversationDetail {
  conversation: OrderConversation
  order_number: string
  order_status: string
  delivery_method: string
  final_total: number
  shop_name: string
  business_name: string
  buyer_name: string
  participants: OrderConversationParticipant[]
  messages: OrderMessage[]
}

export interface ConversationListItem {
  conversation_id: string
  order_id: string
  order_number: string
  order_status: string
  buyer_id: string
  buyer_name: string
  shop_id: string
  shop_name: string
  business_id: string
  business_name: string
  last_message: string
  last_sender_type: SenderType
  last_message_at: string
  unread_count: number
  created_at: string
}

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  body: string
  reference_type: string
  reference_id: string
  metadata: Record<string, unknown>
  read_at?: string
  created_at: string
  is_read: boolean
}

export interface UnreadCounts {
  unread_messages: number
  unread_notifications: number
}

// ----------------- Buyer & Seller APIs -----------------

export async function fetchOrderConversation(orderId: string): Promise<OrderConversationDetail> {
  return get<OrderConversationDetail>(`/orders/${orderId}/conversation`)
}

export async function sendOrderMessage(orderId: string, body: string): Promise<OrderMessage> {
  return post<OrderMessage>(`/orders/${orderId}/messages`, { body })
}

export async function fetchBuyerConversations(params?: { limit?: number; offset?: number }): Promise<{
  items: ConversationListItem[]
  total: number
  limit: number
  offset: number
}> {
  return get<{
    items: ConversationListItem[]
    total: number
    limit: number
    offset: number
  }>('/buyer/conversations', params)
}

export async function fetchBuyerUnreadCounts(): Promise<UnreadCounts> {
  return get<UnreadCounts>('/buyer/unread-counts')
}

export async function fetchSellerConversations(params?: {
  shop_id?: string
  business_id?: string
  limit?: number
  offset?: number
}): Promise<{
  items: ConversationListItem[]
  total: number
  limit: number
  offset: number
}> {
  return get<{
    items: ConversationListItem[]
    total: number
    limit: number
    offset: number
  }>('/seller/conversations', params)
}

export async function fetchSellerUnreadCounts(params?: {
  shop_id?: string
  business_id?: string
}): Promise<UnreadCounts> {
  return get<UnreadCounts>('/seller/unread-counts', params)
}

// ----------------- Notification APIs -----------------

export async function fetchNotifications(params?: { limit?: number; offset?: number }): Promise<{
  items: NotificationItem[]
  total: number
  limit: number
  offset: number
}> {
  return get<{
    items: NotificationItem[]
    total: number
    limit: number
    offset: number
  }>('/notifications', params)
}

export async function markNotificationRead(id: string): Promise<{ status: string }> {
  return post<{ status: string }>(`/notifications/${id}/read`)
}

export async function markAllNotificationsRead(): Promise<{ status: string }> {
  return post<{ status: string }>('/notifications/read-all')
}

export async function fetchUnreadNotificationsCount(): Promise<{ unread_count: number }> {
  return get<{ unread_count: number }>('/notifications/unread-count')
}

// ----------------- Courier Action APIs -----------------

export async function confirmCourierArrival(orderId: string): Promise<{ message: string; delivery_status: string }> {
  return post<{ message: string; delivery_status: string }>(`/orders/${orderId}/courier-arrived`)
}

export async function confirmCourierPickedUp(orderId: string): Promise<{ message: string; delivery_status: string }> {
  return post<{ message: string; delivery_status: string }>(`/orders/${orderId}/courier-picked-up`)
}

export async function confirmCourierNearDestination(orderId: string): Promise<{ message: string; delivery_status: string }> {
  return post<{ message: string; delivery_status: string }>(`/orders/${orderId}/courier-near-destination`)
}

// ----------------- Admin Supervision APIs -----------------

export async function fetchAdminOrderCommunications(params?: {
  search?: string
  status?: string
  shop_id?: string
  limit?: number
  offset?: number
}): Promise<{
  items: ConversationListItem[]
  total: number
  limit: number
  offset: number
}> {
  const qs = new URLSearchParams()
  if (params?.search) qs.set('search', params.search)
  if (params?.status) qs.set('status', params.status)
  if (params?.shop_id) qs.set('shop_id', params.shop_id)
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.offset) qs.set('offset', String(params.offset))
  const q = qs.toString()
  return adminApi<{
    items: ConversationListItem[]
    total: number
    limit: number
    offset: number
  }>(q ? `/admin/commerce/order-communications?${q}` : '/admin/commerce/order-communications')
}

export async function fetchAdminOrderConversation(orderId: string): Promise<OrderConversationDetail> {
  return adminApi<OrderConversationDetail>(`/admin/commerce/orders/${orderId}/conversation`)
}

export async function adminInterveneOrder(orderId: string, body: string, recipientScope: RecipientScope, recipientUserId?: string): Promise<OrderMessage> {
  return adminApi<OrderMessage>(`/admin/commerce/orders/${orderId}/intervene`, {
    method: 'POST',
    body: JSON.stringify({ body, recipient_scope: recipientScope, recipient_user_id: recipientUserId || null })
  })
}

export async function fetchAdminNotifications(params?: { limit?: number; offset?: number }): Promise<{
  items: NotificationItem[]
  total: number
  limit: number
  offset: number
}> {
  const qs = new URLSearchParams()
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.offset) qs.set('offset', String(params.offset))
  const q = qs.toString()
  return adminApi<{
    items: NotificationItem[]
    total: number
    limit: number
    offset: number
  }>(q ? `/admin/notifications?${q}` : '/admin/notifications')
}

export async function fetchAdminUnreadNotificationsCount(): Promise<{ unread_count: number }> {
  return adminApi<{ unread_count: number }>('/admin/notifications/unread-count')
}

export async function markAdminNotificationRead(id: string): Promise<{ status: string }> {
  return adminApi<{ status: string }>(`/admin/notifications/${id}/read`, {
    method: 'POST'
  })
}

export async function markAllAdminNotificationsRead(): Promise<{ status: string }> {
  return adminApi<{ status: string }>('/admin/notifications/read-all', {
    method: 'POST'
  })
}
