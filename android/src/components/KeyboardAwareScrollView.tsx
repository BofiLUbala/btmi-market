import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Keyboard, Platform, ScrollView, StatusBar, TextInput, type ScrollViewProps } from 'react-native'

/**
 * ScrollView that keeps the focused field above the keyboard on Android.
 *
 * The app is edge-to-edge (Expo 57): the window no longer resizes when the
 * keyboard opens, so a field near the bottom of a page stays hidden under it.
 * This adds room below the content for the keyboard and scrolls the focused
 * input into view. iOS keeps the native behaviour.
 */
export const KeyboardAwareScrollView = forwardRef<ScrollView, ScrollViewProps>(function KeyboardAwareScrollView(
  { contentContainerStyle, onScroll, scrollEventThrottle, ...props },
  ref,
) {
  const scrollRef = useRef<ScrollView>(null)
  const offset = useRef(0)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  useImperativeHandle(ref, () => scrollRef.current as ScrollView)

  useEffect(() => {
    if (Platform.OS !== 'android') return
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height)
      const keyboardTop = e.endCoordinates.screenY
      const input = TextInput.State.currentlyFocusedInput() as unknown as {
        measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void
      } | null
      input?.measureInWindow?.((_x, y, _w, h) => {
        // measureInWindow excludes the status bar; the keyboard's screenY does not.
        const bottom = y + h + (StatusBar.currentHeight ?? 0) + 16
        if (bottom > keyboardTop) {
          // Wait one frame so the extra bottom room exists before scrolling.
          requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: offset.current + bottom - keyboardTop, animated: true }))
        }
      })
    })
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0))
    return () => { show.remove(); hide.remove() }
  }, [])

  return (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      {...props}
      scrollEventThrottle={scrollEventThrottle ?? 16}
      onScroll={(e) => { offset.current = e.nativeEvent.contentOffset.y; onScroll?.(e) }}
      contentContainerStyle={[contentContainerStyle, keyboardHeight ? { paddingBottom: keyboardHeight } : null]}
    />
  )
})
