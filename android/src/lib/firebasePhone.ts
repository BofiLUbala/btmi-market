/**
 * Phone sign-in by SMS, through Firebase — the Android and iOS version.
 * The web version is firebasePhone.web.ts; both answer the screens with the
 * same functions and the same errors (shared pieces: firebasePhoneCommon.ts).
 *
 * Firebase sends the message from the device and checks the code itself; what
 * we get back is an ID token, which the backend verifies (see
 * `backend/internal/service/auth_firebase.go`). No code of ours ever travels
 * by SMS, and no SMS gateway is called from the server.
 *
 * `@react-native-firebase/auth` is native code, so it exists only in a
 * development or production build — never in Expo Go. Everything here loads it
 * lazily and reports `available: false` when it is absent, so the app still
 * runs in Expo Go with the SMS choice simply not offered. The server likewise
 * refuses the channel unless FIREBASE_PROJECT_ID is set, and
 * `/auth/sms/status` is what the screens ask before showing the option.
 */

import { SmsError, isE164, toSmsError, type ConfirmationResult, type SmsChallenge } from './firebasePhoneCommon'
import Constants from 'expo-constants'

export { SmsError, type SmsChallenge }

// React Native Firebase 22+ speaks the modular API: `getAuth()` hands out the
// auth instance and `signInWithPhoneNumber(auth, phone)` starts the SMS. The old
// callable `auth()` namespace is gone from the package, so calling it throws.
type FirebaseAuthModule = {
  getAuth: () => unknown
  signInWithPhoneNumber: (auth: unknown, phone: string) => Promise<ConfirmationResult>
}

let cached: FirebaseAuthModule | null | undefined

/**
 * The native module, or null in a build without it. A missing module is not an
 * error worth reporting: it only means this build cannot offer SMS.
 */
function firebaseAuth(): FirebaseAuthModule | null {
  if (cached !== undefined) return cached
  // Expo Go ships no native Firebase, and merely requiring the package there
  // starts an initialisation that throws from outside this try — surfacing a
  // red "Native module NativeRNFBTurboApp is not registered" over whatever
  // screen happened to ask. Nothing is wrong: this client simply cannot do
  // SMS. Asking Constants first keeps the question from being asked at all.
  if (Constants.appOwnership === 'expo') {
    cached = null
    return cached
  }
  try {
    // Required lazily and by name so Metro does not fail the bundle when the
    // package is not installed.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-firebase/auth')
    const usable = typeof mod?.getAuth === 'function' && typeof mod?.signInWithPhoneNumber === 'function'
    cached = usable ? (mod as FirebaseAuthModule) : null
  } catch {
    cached = null
  }
  return cached
}

/** Whether this build carries the native Firebase module at all. */
export function isFirebasePhoneAvailable(): boolean {
  return firebaseAuth() !== null
}

/**
 * Asks Firebase to text a code to an E.164 number. On Android the check is
 * usually silent (Play Integrity), so no reCAPTCHA is shown; the returned
 * handle is what `confirmSmsCode` later needs.
 */
export async function sendSmsCode(phoneE164: string, forceResend = false): Promise<SmsChallenge> {
  const auth = firebaseAuth()
  if (!auth) throw new SmsError('SMS_UNAVAILABLE')
  if (!isE164(phoneE164)) throw new SmsError('INVALID_PHONE')
  try {
    // The modular call has no resend flag: asking again simply sends a fresh code.
    void forceResend
    const confirmation = await auth.signInWithPhoneNumber(auth.getAuth(), phoneE164)
    return { phone: phoneE164, confirmation }
  } catch (cause) {
    if (__DEV__) console.warn('[firebasePhone] sendSmsCode failed', (cause as { code?: string })?.code, (cause as Error)?.message)
    throw toSmsError(cause)
  }
}

/**
 * Checks the typed code with Firebase and returns the ID token to hand to our
 * backend. A wrong or expired code throws an `SmsError` the caller translates.
 */
export async function confirmSmsCode(challenge: SmsChallenge, code: string): Promise<string> {
  try {
    const credential = await challenge.confirmation.confirm(code.trim())
    const token = await credential?.user?.getIdToken()
    if (!token) throw new SmsError('OTP_INCORRECT')
    return token
  } catch (cause) {
    throw cause instanceof SmsError ? cause : toSmsError(cause)
  }
}

/** A new code for the same number; Firebase issues a fresh handle. */
export function resendSmsCode(challenge: SmsChallenge): Promise<SmsChallenge> {
  return sendSmsCode(challenge.phone, true)
}
