/**
 * What the native and the web versions of the phone sign-in share, so both
 * answer the screens in exactly the same terms (see firebasePhone.ts and
 * firebasePhone.web.ts, which Metro picks per platform).
 */

export type ConfirmationResult = {
  confirm: (code: string) => Promise<{ user: { getIdToken: () => Promise<string> } } | null>
}

/** What a pending SMS looks like to the screens: opaque, with a resend. */
export type SmsChallenge = {
  phone: string
  confirmation: ConfirmationResult
}

/** Errors the screens can translate; anything else keeps Firebase's own code. */
export class SmsError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code)
    this.name = 'SmsError'
  }
}

export const isE164 = (phone: string) => /^\+\d{7,15}$/.test(phone)

export function toSmsError(cause: unknown): SmsError {
  const code = (cause as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/invalid-phone-number':
      return new SmsError('INVALID_PHONE')
    case 'auth/too-many-requests':
      return new SmsError('RATE_LIMITED')
    case 'auth/quota-exceeded':
      return new SmsError('SMS_QUOTA_EXCEEDED')
    case 'auth/invalid-verification-code':
      return new SmsError('OTP_INCORRECT')
    case 'auth/code-expired':
    case 'auth/session-expired':
      return new SmsError('OTP_EXPIRED')
    case 'auth/network-request-failed':
      return new SmsError('NETWORK_ERROR')
    case 'auth/captcha-check-failed':
    case 'auth/missing-client-identifier':
    case 'auth/unauthorized-domain':
    case 'auth/operation-not-allowed':
    case 'auth/app-not-authorized':
      return new SmsError('SMS_UNAVAILABLE')
  }
  return new SmsError(code || 'SMS_FAILED', (cause as Error)?.message)
}
