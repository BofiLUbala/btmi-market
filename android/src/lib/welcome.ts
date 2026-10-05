import AsyncStorage from '@react-native-async-storage/async-storage'

/** First-launch onboarding ("Bienvenue"): shown once, then never again. */
const WELCOME_KEY = 'tbk.welcomeSeen'

export async function hasSeenWelcome(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(WELCOME_KEY)) === '1' } catch { return true }
}

export async function markWelcomeSeen(): Promise<void> {
  try { await AsyncStorage.setItem(WELCOME_KEY, '1') } catch { /* best effort */ }
}
