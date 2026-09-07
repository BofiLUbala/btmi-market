import { Redirect } from 'expo-router'

// Backward-compatible alias for links from older APKs.
export default function LegacyRegisterChoiceRedirect() {
  return <Redirect href="/auth/register" />
}
