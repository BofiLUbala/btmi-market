import { get, post, upload } from './client'
import type { LoginResponse, RegisterRequest, RegisterResponse, User, WhatsAppChallenge } from './types'

export const authApi = {
  register: (body: RegisterRequest) => post<RegisterResponse>('/auth/register', body),

  resendActivation: (email: string) => post<null>('/auth/resend-activation', { email }),

  reinitializeRegistration: (email: string) =>
    post<null>('/auth/reinitialize-registration', { email }),

  completeRegistrationReinitialization: (body: { token: string; email: string; password: string; password_confirmation: string }) =>
    post<LoginResponse>('/auth/reinitialize-registration/complete', body),

  login: (email: string, password: string) =>
    post<LoginResponse>('/auth/login', { email, password }),

  /** Whether the WhatsApp channel is offered (an OpenWA gateway is configured). */
  whatsappStatus: () => get<{ enabled: boolean }>('/auth/whatsapp/status'),

  /** Checks phone + password and sends a sign-in code on WhatsApp. */
  whatsappLogin: (phone: string, password: string) =>
    post<WhatsAppChallenge>('/auth/whatsapp/login', { phone, password }),

  whatsappVerify: (challenge_id: string, code: string) =>
    post<LoginResponse>('/auth/whatsapp/verify', { challenge_id, code }),

  whatsappResend: (challenge_id: string) =>
    post<WhatsAppChallenge>('/auth/whatsapp/resend', { challenge_id }),

  forgotPassword: (identifier: string) =>
    post<null>('/auth/forgot-password', { identifier }),

  resetPassword: (body: {
    token: string
    password: string
    password_confirmation: string
  }) => post<null>('/auth/reset-password', body),

  me: () => get<User>('/auth/me'),

  uploadAvatar: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return upload<{ avatar_url: string }>('/auth/me/avatar', formData)
  },

  refresh: (refresh_token: string) =>
    post<LoginResponse>('/auth/refresh', { refresh_token }),

  logout: (refresh_token: string) => post<null>('/auth/logout', { refresh_token })
}
