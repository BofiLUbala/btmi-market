import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'

export interface UploadFile {
  uri: string
  type: string
}

const AVATAR_MAX_EDGE = 1024
const AVATAR_COMPRESSION = 0.8

/** Re-encodes a picked photo into a bounded JPEG before upload. The picker only
 *  applies JPEG compression, so a camera original still arrives at full sensor
 *  resolution -- several megabytes for an 88px avatar, which the API rejects
 *  above its 8 MB cap and a mobile connection cannot push before the request
 *  times out. Re-encoding also normalises iOS HEIC, which the API does not
 *  accept.
 *
 *  The bound is measured on the decoded image rather than on the dimensions the
 *  picker reported: those are optional, and treating a missing value as "small
 *  enough" let a full-resolution original through unresized. */
export async function prepareAvatarUpload(asset: { uri: string }): Promise<UploadFile> {
  let image = await ImageManipulator.manipulate(asset.uri).renderAsync()
  if (Math.max(image.width, image.height) > AVATAR_MAX_EDGE) {
    const size = image.width >= image.height ? { width: AVATAR_MAX_EDGE } : { height: AVATAR_MAX_EDGE }
    image = await ImageManipulator.manipulate(image).resize(size).renderAsync()
  }
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: AVATAR_COMPRESSION })
  return { uri: result.uri, type: 'image/jpeg' }
}
