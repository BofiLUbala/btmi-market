import OrdersScreen from '../orders/index'

// The reference design puts "Commandes" in the bottom bar: the same order
// history as /orders, which shows a guest the sign-in prompt itself.
export default function MyOrdersTab() {
  return <OrdersScreen />
}
