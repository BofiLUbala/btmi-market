import AsyncStorage from '@react-native-async-storage/async-storage'

const SELLER_SIGNUP_INTENT = 'btmi.seller-signup-intent'

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export const sellerIntent = {
  set: (email: string) => AsyncStorage.setItem(SELLER_SIGNUP_INTENT, normalizeEmail(email)),
  clear: () => AsyncStorage.removeItem(SELLER_SIGNUP_INTENT),
  isFor: async (email: string) => {
    const intendedEmail = await AsyncStorage.getItem(SELLER_SIGNUP_INTENT)
    return Boolean(intendedEmail && intendedEmail === normalizeEmail(email))
  },
}
