import RegisterPage from '@/pages/auth/RegisterPage'

// Sellers register with the same 4-step form as buyers (account, personal
// details, address, review), plus the seller policy consent on the last step.
export default function SellerRegisterPage() {
  return <RegisterPage accountType="SELLER" />
}
