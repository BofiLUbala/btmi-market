import { Alert, Platform } from 'react-native'

export type ConfirmChoice = {
  text: string
  style?: 'cancel' | 'destructive' | 'default'
  onPress?: () => void
}

/**
 * Ask before doing something, on every platform the app runs on.
 *
 * `Alert.alert` is a no-op in react-native-web: the call returns, no dialog is
 * drawn, and the button's `onPress` never runs. Since the website is the Expo
 * app, every confirmation-gated action — confirming cash at the door, arriving,
 * failing a delivery, returning a parcel — silently did nothing on the web.
 *
 * On web we ask with `window.confirm` and run the branch the person chose; on
 * native we keep the platform dialog, so the phone behaviour is unchanged.
 */
export type ConfirmOptions = {
  cancelable?: boolean
  /** Dismissed without choosing: on web this is a declined prompt. */
  onDismiss?: () => void
}

export function confirmAction(
  title: string,
  message?: string,
  choices?: ConfirmChoice[],
  options?: ConfirmOptions,
): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, choices, options)
    return
  }
  const text = message ? title + '\n\n' + message : title
  const actions = (choices ?? []).filter((c) => c.style !== 'cancel')
  const cancel = (choices ?? []).find((c) => c.style === 'cancel')
  const declined = () => {
    // Declining is the web equivalent of both "cancel" and "dismissed"; a caller
    // that only passed onDismiss still has to hear about it, or a promise
    // waiting on the answer would never settle.
    if (cancel?.onPress) cancel.onPress()
    else options?.onDismiss?.()
  }
  const canAsk = typeof window !== 'undefined' && typeof window.confirm === 'function'

  // No action to take: this is a message, not a question. Say it out loud —
  // staying silent is how web users lost every error the app tried to show.
  if (actions.length === 0) {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(text)
    return
  }

  if (actions.length === 1) {
    if (!canAsk || window.confirm(text)) actions[0].onPress?.()
    else declined()
    return
  }

  // Several things the person could do (an action sheet on the phone). Offer
  // them in order rather than choosing one for them; declining every option
  // means cancel.
  if (!canAsk) {
    declined()
    return
  }
  for (const action of actions) {
    if (window.confirm(text + '\n\n' + action.text + '?')) {
      action.onPress?.()
      return
    }
  }
  declined()
}
