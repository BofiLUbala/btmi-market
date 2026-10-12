import { createElement, useEffect, useRef, useState } from 'react'
import { Linking, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { requireOptionalNativeModule } from 'expo-modules-core'
import { resolveMediaUrl } from '../api/client'
import { useI18n } from '../store/i18n'

/** The muted teaser replays this many first seconds until the buyer taps. */
const PREVIEW_SECONDS = 10

type VideoModule = typeof import('expo-video')

let videoModule: VideoModule | null | undefined
/** expo-video is a native module: binaries built before it was added lack it,
 *  and requiring it there would crash an OTA-updated app. Load it only when the
 *  native side is present; otherwise the hero falls back to opening the video
 *  in the phone's own player. */
function expoVideo(): VideoModule | null {
  if (videoModule !== undefined) return videoModule
  videoModule = null
  if (Platform.OS === 'web') return videoModule
  try {
    if (!requireOptionalNativeModule('ExpoVideo')) return videoModule
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    videoModule = require('expo-video') as VideoModule
  } catch {
    videoModule = null
  }
  return videoModule
}

/** The seller's explainer video at the top of the product page: a muted loop of
 *  its first seconds, then the whole video with sound once the buyer taps it. */
export function ProductVideoPlayer({ url, style }: { url?: string; style?: StyleProp<ViewStyle> }) {
  const source = resolveMediaUrl(url)
  if (!source) return null
  if (Platform.OS === 'web') return <WebHero source={source} style={style} />
  const mod = expoVideo()
  return mod ? <NativeHero source={source} mod={mod} style={style} /> : <ExternalHero source={source} style={style} />
}

function TapHint() {
  const { t } = useI18n()
  return (
    <View style={styles.hint} pointerEvents="none">
      <Ionicons name="volume-high" size={14} color="#FFFFFF" />
      <Text style={styles.hintText}>{t('product.video.tapToWatch')}</Text>
    </View>
  )
}

function WebHero({ source, style }: { source: string; style?: StyleProp<ViewStyle> }) {
  const { t } = useI18n()
  const ref = useRef<HTMLVideoElement | null>(null)
  const [full, setFull] = useState(false)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    // React does not keep the `muted` attribute in sync, and autoplay needs it.
    video.muted = !full
    video.defaultMuted = !full
    if (!full) void video.play().catch(() => undefined)
    // A browser pauses media in a hidden tab and never resumes it by itself,
    // so the teaser restarts whenever the page is shown again.
    const resume = () => { if (!full && document.visibilityState === 'visible') void video.play().catch(() => undefined) }
    document.addEventListener('visibilitychange', resume)
    return () => document.removeEventListener('visibilitychange', resume)
  }, [full])

  const watch = () => {
    const video = ref.current
    if (!video || full) return
    setFull(true)
    video.currentTime = 0
    video.muted = false
    void video.play().catch(() => undefined)
  }

  return (
    <View style={[styles.box, style]} accessibilityLabel={t('product.video.title')}>
      {createElement('video', {
        ref,
        src: source,
        autoPlay: true,
        muted: true,
        playsInline: true,
        preload: 'auto',
        controls: full,
        onTimeUpdate: (e: { currentTarget: HTMLVideoElement }) => {
          if (!full && e.currentTarget.currentTime >= PREVIEW_SECONDS) e.currentTarget.currentTime = 0
        },
        onEnded: (e: { currentTarget: HTMLVideoElement }) => {
          if (!full) { e.currentTarget.currentTime = 0; void e.currentTarget.play().catch(() => undefined) }
        },
        onClick: watch,
        style: { width: '100%', height: '100%', objectFit: full ? 'contain' : 'cover', backgroundColor: '#000', cursor: full ? 'default' : 'pointer', display: 'block' },
      })}
      {!full ? <TapHint /> : null}
    </View>
  )
}

function NativeHero({ source, mod, style }: { source: string; mod: VideoModule; style?: StyleProp<ViewStyle> }) {
  const { t } = useI18n()
  const [full, setFull] = useState(false)
  const fullRef = useRef(false)
  const player = mod.useVideoPlayer(source, (p) => {
    p.muted = true
    p.loop = false
    p.timeUpdateEventInterval = 0.5
    p.play()
  })

  useEffect(() => {
    const time = player.addListener('timeUpdate', ({ currentTime }) => {
      if (!fullRef.current && currentTime >= PREVIEW_SECONDS) player.currentTime = 0
    })
    const end = player.addListener('playToEnd', () => {
      if (!fullRef.current) { player.currentTime = 0; player.play() }
    })
    return () => { time.remove(); end.remove() }
  }, [player])

  const watch = () => {
    fullRef.current = true
    setFull(true)
    player.currentTime = 0
    player.muted = false
    player.play()
  }

  return (
    <View style={[styles.box, style]} accessibilityLabel={t('product.video.title')}>
      <mod.VideoView player={player} style={StyleSheet.absoluteFill} contentFit={full ? 'contain' : 'cover'} nativeControls={full} />
      {!full ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('product.video.watch')} onPress={watch} style={StyleSheet.absoluteFill}>
          <TapHint />
        </Pressable>
      ) : null}
    </View>
  )
}

/** Installed app without the native video module: a poster that opens the
 *  video in the phone's own player. */
function ExternalHero({ source, style }: { source: string; style?: StyleProp<ViewStyle> }) {
  const { t } = useI18n()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('product.video.watch')} onPress={() => void Linking.openURL(source)} style={[styles.box, styles.poster, style]}>
      <Ionicons name="play-circle" size={64} color="#FFFFFF" />
      <Text style={styles.posterText}>{t('product.video.watch')}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  box: { width: '100%', height: '100%', backgroundColor: '#000', overflow: 'hidden' },
  poster: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  posterText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  // Raised clear of the details sheet, which overlaps the bottom of the phone gallery.
  hint: { position: 'absolute', left: 12, bottom: 52, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.6)' },
  hintText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
})
