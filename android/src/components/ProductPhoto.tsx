import { Image, type ImageContentFit } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, View, type StyleProp, type ImageStyle, type ViewStyle } from 'react-native'
import { VideoLoopPreview } from './ProductVideoPlayer'
import { categoryIcon } from '../lib/categoryIcons'
import { useColors } from '../store/theme'

type Props = {
  /** The seller's photo; nothing when the product has none. */
  uri?: string | null
  categorySlug?: string
  categoryName?: string
  style?: StyleProp<ImageStyle>
  contentFit?: ImageContentFit
  transition?: number
  accessibilityLabel?: string
  /** The seller's explainer video: when present it replaces the photo as a
   *  silent loop of its first seconds. */
  video?: string | null
}

/**
 * A product photo, or a plain tile with the category icon when the seller has
 * not added one. Never a stock picture: a product is only ever shown with the
 * seller's own photo, so the image always matches what is sold.
 */
export function ProductPhoto({ video, ...props }: Props) {
  if (!video) return <StillPhoto {...props} />
  return <VideoLoopPreview url={video} style={props.style as StyleProp<ViewStyle>} fallback={<StillPhoto {...props} />} />
}

function StillPhoto({ uri, categorySlug, categoryName, style, contentFit = 'cover', transition, accessibilityLabel }: Omit<Props, 'video'>) {
  const colors = useColors()
  if (uri) return <Image source={uri} style={style} contentFit={contentFit} transition={transition} accessibilityLabel={accessibilityLabel} />
  return (
    <View style={[style as object, styles.empty, { backgroundColor: colors.surfaceAlt }]} accessibilityLabel={accessibilityLabel}>
      <Ionicons name={categoryIcon(categorySlug, categoryName)} size={34} color={colors.faint} />
    </View>
  )
}

const styles = StyleSheet.create({ empty: { alignItems: 'center', justifyContent: 'center' } })
