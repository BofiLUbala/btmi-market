import { get, post, upload } from './client'
import type { LoginResponse, RegisterRequest, RegisterResponse, User } from './types'

export const authApi = {
  register: (body: RegisterRequest) => post<RegisterResponse>('/auth/register', body),

  resendActivation: (email: string) => post<null>('/auth/resend-activation', { email }),

  reinitializeRegistration: (email: string, password: string) =>
    post<null>('/auth/reinitialize-registration', { email, password }),

  login: (email: string, password: string) =>
    post<LoginResponse>('/auth/login', { email, password }),

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

  logout: () => post<null>('/auth/logout', {})
}
