import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'

export interface UploadFile {
  uri: string
  name: string
  type: string
}

const AVATAR_MAX_EDGE = 1024
const AVATAR_COMPRESSION = 0.8

/** Re-encodes a picked photo into a bounded JPEG before upload. The picker only
 *  applies JPEG compression, so a camera original still arrives at full sensor
 *  resolution -- several megabytes for an 88px avatar, which the API rejects
 *  above its 8 MB cap and a mobile connection cannot push before the request
 *  times out. Re-encoding also normalises iOS HEIC, which the API does not
 *  accept. */
export async function prepareAvatarUpload(asset: { uri: string; width?: number; height?: number }): Promise<UploadFile> {
  const context = ImageManipulator.manipulate(asset.uri)
  const width = asset.width ?? 0
  const height = asset.height ?? 0
  if (Math.max(width, height) > AVATAR_MAX_EDGE) {
    context.resize(width >= height ? { width: AVATAR_MAX_EDGE } : { height: AVATAR_MAX_EDGE })
  }
  const image = await context.renderAsync()
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: AVATAR_COMPRESSION })
  return { uri: result.uri, name: `avatar-${Date.now()}.jpg`, type: 'image/jpeg' }
}
