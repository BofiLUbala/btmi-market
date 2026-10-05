import { Image } from 'expo-image'
import { View, type StyleProp, type ViewStyle } from 'react-native'

const LOGO = require('../../assets/icon.png')

/**
 * The TBK monogram (the app icon artwork) as an inline logo tile. The source
 * PNG has a thin white margin around its rounded square, so it is drawn
 * slightly enlarged inside a clipped tile of the same navy.
 */
export function BrandLogo({ size = 40, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size * 0.26, overflow: 'hidden', backgroundColor: '#050B1A' }, style]}>
      <Image source={LOGO} style={{ width: '100%', height: '100%', transform: [{ scale: 1.1 }] }} contentFit="cover" accessible={false} />
    </View>
  )
}
