/**
 * Phone sign-in by SMS, through Firebase — the web version.
 *
 * Metro picks this file instead of firebasePhone.ts when the app runs in a
 * browser, so the screens call exactly the same functions on the web and on the
 * phone and get the same results: a code by SMS, then the ID token that our
 * backend checks (backend/internal/service/auth_firebase.go).
 *
 * The one thing the web adds is Google's reCAPTCHA, which Firebase requires to
 * keep bots from sending SMS. It runs invisibly, in a container this file adds
 * to the page, and only asks the person for something when Google doubts them.
 */

import { getApp, getApps, initializeApp } from 'firebase/app'
import { RecaptchaVerifier, getAuth, signInWithPhoneNumber, type Auth } from 'firebase/auth'
import { firebaseWebConfig } from './firebaseWebConfig'
import { SmsError, isE164, toSmsError, type SmsChallenge } from './firebasePhoneCommon'

export { SmsError, type SmsChallenge }

const CONTAINER_ID = 'tbk-recaptcha'

let auth: Auth | null = null
let verifier: RecaptchaVerifier | null = null

function webAuth(): Auth {
  if (!auth) {
    const app = getApps().length ? getApp() : initializeApp(firebaseWebConfig)
    auth = getAuth(app)
  }
  return auth
}

/** Always available in a browser; the server still decides through /auth/sms/status. */
export function isFirebasePhoneAvailable(): boolean {
  return typeof document !== 'undefined'
}

/**
 * A fresh invisible reCAPTCHA for each send. A verifier that has failed or been
 * used cannot be reused, so the previous one is cleared first.
 */
function newVerifier(): RecaptchaVerifier {
  verifier?.clear()
  let host = document.getElementById(CONTAINER_ID)
  if (!host) {
    host = document.createElement('div')
    host.id = CONTAINER_ID
    document.body.appendChild(host)
  }
  verifier = new RecaptchaVerifier(webAuth(), host, { size: 'invisible' })
  return verifier
}

function dropVerifier() {
  verifier?.clear()
  verifier = null
}

/** Asks Firebase to text a code to an E.164 number. */
export async function sendSmsCode(phoneE164: string, _forceResend = false): Promise<SmsChallenge> {
  if (!isFirebasePhoneAvailable()) throw new SmsError('SMS_UNAVAILABLE')
  if (!isE164(phoneE164)) throw new SmsError('INVALID_PHONE')
  try {
    const confirmation = await signInWithPhoneNumber(webAuth(), phoneE164, newVerifier())
    return { phone: phoneE164, confirmation }
  } catch (cause) {
    dropVerifier()
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
