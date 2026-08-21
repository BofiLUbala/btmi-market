import { get, post } from './client'
import type { LoginResponse, RegisterResponse, User } from './types'

export const authApi = {
  register: (body: {
    first_name: string
    last_name: string
    phone: string
    email: string
    password: string
    password_confirmation: string
  }) => post<RegisterResponse>('/auth/register', body),

  resendActivation: (email: string) => post<null>('/auth/resend-activation', { email }),

  login: (email: string, password: string) =>
    post<LoginResponse>('/auth/login', { email, password }),

  forgotPassword: (email: string) =>
    post<null>('/auth/forgot-password', { email }),

  resetPassword: (body: {
    token: string
    password: string
    password_confirmation: string
  }) => post<null>('/auth/reset-password', body),

  me: () => get<User>('/auth/me'),

  refresh: (refresh_token: string) =>
    post<LoginResponse>('/auth/refresh', { refresh_token }),

  logout: () => post<null>('/auth/logout', {})
}