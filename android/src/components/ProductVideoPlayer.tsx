import { createElement, useEffect, useRef, useState, type ReactNode } from 'react'
import { Linking, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { requireOptionalNativeModule } from 'expo-modules-core'
import { resolveMediaUrl } from '../api/client'
import { useI18n } from '../store/i18n'
import { ShareSheet } from './ShareSheet'

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
export function ProductVideoPlayer({ url, style, share }: { url?: string; style?: StyleProp<ViewStyle>; share?: ShareTarget }) {
  const source = resolveMediaUrl(url)
  if (!source) return null
  if (Platform.OS === 'web') return <WebHero source={source} style={style} share={share} />
  const mod = expoVideo()
  return mod ? <NativeHero source={source} mod={mod} style={style} share={share} /> : <ExternalHero source={source} style={style} />
}

/** What the share button sends: the product page link and a line of text. */
export type ShareTarget = { url: string; text: string }

const SPEEDS = [1, 1.25, 1.5, 2, 0.5]
const VOLUME_STEP = 0.2

type ToolbarProps = {
  rate: number
  muted: boolean
  volume: number
  onRate: () => void
  onMute: () => void
  onVolume: (delta: number) => void
  onFullscreen: () => void
  onShare?: () => void
}

/** The reader's controls once the full video plays: speed, volume, mute,
 *  fullscreen and share. Seek and pause stay on the player's own controls. */
function VideoToolbar({ rate, muted, volume, onRate, onMute, onVolume, onFullscreen, onShare }: ToolbarProps) {
  const { t } = useI18n()
  const level = muted ? 0 : Math.round(volume * 100)
  return (
    <View style={styles.toolbar} pointerEvents="box-none">
      <View style={styles.toolbarRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('product.video.speed', { rate: String(rate) })} onPress={onRate} style={styles.toolBtn}>
          <Text style={styles.toolText}>{rate}x</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('product.video.volumeDown')} onPress={() => onVolume(-VOLUME_STEP)} style={styles.toolBtn}>
          <Ionicons name="volume-low" size={18} color="#FFFFFF" />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={muted ? t('product.video.unmute') : t('product.video.mute')} onPress={onMute} style={styles.toolBtn}>
          <Ionicons name={muted || level === 0 ? 'volume-mute' : 'volume-medium'} size={18} color="#FFFFFF" />
          <Text style={styles.toolSmall}>{level}%</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('product.video.volumeUp')} onPress={() => onVolume(VOLUME_STEP)} style={styles.toolBtn}>
          <Ionicons name="volume-high" size={18} color="#FFFFFF" />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('product.video.fullscreen')} onPress={onFullscreen} style={styles.toolBtn}>
          <Ionicons name="expand" size={18} color="#FFFFFF" />
        </Pressable>
        {onShare ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('product.video.share')} onPress={onShare} style={styles.toolBtn}>
            <Ionicons name="share-social" size={18} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const nextRate = (rate: number) => SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length]
const clampVolume = (v: number) => Math.max(0, Math.min(1, Math.round(v * 10) / 10))

function TapHint() {
  const { t } = useI18n()
  return (
    <View style={styles.hint} pointerEvents="none">
      <Ionicons name="volume-high" size={14} color="#FFFFFF" />
      <Text style={styles.hintText}>{t('product.video.tapToWatch')}</Text>
    </View>
  )
}

function WebHero({ source, style, share }: { source: string; style?: StyleProp<ViewStyle>; share?: ShareTarget }) {
  const { t } = useI18n()
  const ref = useRef<HTMLVideoElement | null>(null)
  const [full, setFull] = useState(false)
  const [rate, setRate] = useState(1)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [sharing, setSharing] = useState(false)

  // Keep the toolbar in step when the browser's own controls change volume.
  const syncVolume = (e: { currentTarget: HTMLVideoElement }) => {
    if (!full) return
    setMuted(e.currentTarget.muted)
    setVolume(e.currentTarget.volume)
  }
  const toolbar = {
    // Read the current values off the element, not React state, so quick
    // repeated taps each take effect.
    onRate: () => { const r = nextRate(ref.current?.playbackRate ?? rate); setRate(r); if (ref.current) ref.current.playbackRate = r },
    onMute: () => { const m = !(ref.current?.muted ?? muted); setMuted(m); if (ref.current) ref.current.muted = m },
    onVolume: (delta: number) => {
      const video = ref.current
      const v = clampVolume((video ? (video.muted ? 0 : video.volume) : muted ? 0 : volume) + delta)
      setVolume(v); setMuted(v === 0)
      if (ref.current) { ref.current.volume = v; ref.current.muted = v === 0 }
    },
    onFullscreen: () => { void ref.current?.requestFullscreen?.().catch(() => undefined) },
  }

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
        onVolumeChange: syncVolume,
        style: { width: '100%', height: '100%', objectFit: full ? 'contain' : 'cover', backgroundColor: '#000', cursor: full ? 'default' : 'pointer', display: 'block' },
      })}
      {!full ? <TapHint /> : (
        <VideoToolbar rate={rate} muted={muted} volume={volume} {...toolbar} onShare={share ? () => setSharing(true) : undefined} />
      )}
      {share ? <ShareSheet visible={sharing} onClose={() => setSharing(false)} url={share.url} text={share.text} /> : null}
    </View>
  )
}

function NativeHero({ source, mod, style, share }: { source: string; mod: VideoModule; style?: StyleProp<ViewStyle>; share?: ShareTarget }) {
  const { t } = useI18n()
  const [full, setFull] = useState(false)
  const fullRef = useRef(false)
  const viewRef = useRef<InstanceType<VideoModule['VideoView']> | null>(null)
  const [rate, setRate] = useState(1)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [sharing, setSharing] = useState(false)
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

  const toolbar = {
    onRate: () => { const r = nextRate(player.playbackRate); setRate(r); player.playbackRate = r },
    onMute: () => { const m = !player.muted; setMuted(m); player.muted = m },
    onVolume: (delta: number) => {
      const v = clampVolume((player.muted ? 0 : player.volume) + delta)
      setVolume(v); setMuted(v === 0)
      player.volume = v
      player.muted = v === 0
    },
    onFullscreen: () => { void viewRef.current?.enterFullscreen().catch(() => undefined) },
  }

  return (
    <View style={[styles.box, style]} accessibilityLabel={t('product.video.title')}>
      <mod.VideoView ref={viewRef} player={player} style={StyleSheet.absoluteFill} contentFit={full ? 'contain' : 'cover'} nativeControls={full} />
      {!full ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('product.video.watch')} onPress={watch} style={StyleSheet.absoluteFill}>
          <TapHint />
        </Pressable>
      ) : (
        <VideoToolbar rate={rate} muted={muted} volume={volume} {...toolbar} onShare={share ? () => setSharing(true) : undefined} />
      )}
      {share ? <ShareSheet visible={sharing} onClose={() => setSharing(false)} url={share.url} text={share.text} /> : null}
    </View>
  )
}

/** A silent cover for marketplace cards: the video's first seconds on a loop,
 *  its first frame standing in as the cover while it loads. It never takes
 *  touches, so the card around it still opens the product. Without the native
 *  video module (older installed app) it renders `fallback` instead. */
export function VideoLoopPreview({ url, style, fallback }: { url?: string | null; style?: StyleProp<ViewStyle>; fallback: ReactNode }) {
  const source = resolveMediaUrl(url ?? undefined)
  if (!source) return <>{fallback}</>
  if (Platform.OS === 'web') return <WebLoop source={source} style={style} />
  const mod = expoVideo()
  return mod ? <NativeLoop source={source} mod={mod} style={style} /> : <>{fallback}</>
}

function WebLoop({ source, style }: { source: string; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    const video = ref.current
    if (!video) return
    video.muted = true
    video.defaultMuted = true
    void video.play().catch(() => undefined)
    const resume = () => { if (document.visibilityState === 'visible') void video.play().catch(() => undefined) }
    document.addEventListener('visibilitychange', resume)
    return () => document.removeEventListener('visibilitychange', resume)
  }, [])
  return (
    <View style={[styles.box, style]} pointerEvents="none">
      {createElement('video', {
        ref,
        // #t=0.1 makes the browser paint the first frame as the cover before playback.
        src: `${source}#t=0.1`,
        autoPlay: true,
        muted: true,
        playsInline: true,
        preload: 'metadata',
        onTimeUpdate: (e: { currentTarget: HTMLVideoElement }) => {
          if (e.currentTarget.currentTime >= PREVIEW_SECONDS) e.currentTarget.currentTime = 0
        },
        onEnded: (e: { currentTarget: HTMLVideoElement }) => { e.currentTarget.currentTime = 0; void e.currentTarget.play().catch(() => undefined) },
        style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' },
      })}
    </View>
  )
}

function NativeLoop({ source, mod, style }: { source: string; mod: VideoModule; style?: StyleProp<ViewStyle> }) {
  const player = mod.useVideoPlayer(source, (p) => {
    p.muted = true
    p.loop = false
    p.timeUpdateEventInterval = 0.5
    p.play()
  })
  useEffect(() => {
    const time = player.addListener('timeUpdate', ({ currentTime }) => {
      if (currentTime >= PREVIEW_SECONDS) player.currentTime = 0
    })
    const end = player.addListener('playToEnd', () => { player.currentTime = 0; player.play() })
    return () => { time.remove(); end.remove() }
  }, [player])
  return (
    <View style={[styles.box, style]} pointerEvents="none">
      <mod.VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
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
  // Below the stock chip and share/favourite buttons that sit on the gallery's top edge.
  toolbar: { position: 'absolute', top: 72, left: 0, right: 0, alignItems: 'center' },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.6)' },
  toolBtn: { minWidth: 40, height: 40, paddingHorizontal: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  toolText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  toolSmall: { color: '#FFFFFF', fontWeight: '700', fontSize: 11 },
})
