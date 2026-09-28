/**
 * "Se souvenir de moi": keeps only the e-mail of the last sign-in, per space,
 * so the next login is pre-filled. The password is never stored by the app —
 * the browser's password manager offers it (autocomplete="current-password").
 */
export type LoginSpace = 'buyer' | 'seller' | 'employee' | 'courier' | 'admin'

const key = (space: LoginSpace) => `btmi.rememberedEmail.${space}`

export function getRememberedEmail(space: LoginSpace): string {
  try {
    return localStorage.getItem(key(space)) ?? ''
  } catch {
    return ''
  }
}

/** Save the e-mail when "remember me" is ticked, forget it otherwise. */
export function rememberLogin(space: LoginSpace, email: string, remember: boolean) {
  try {
    if (remember && email.trim()) localStorage.setItem(key(space), email.trim().toLowerCase())
    else localStorage.removeItem(key(space))
  } catch {
    /* private mode / storage disabled: nothing to remember */
  }
}
