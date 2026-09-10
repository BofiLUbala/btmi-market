import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'

export interface UploadFile {
  uri: string
  type: string
}

const AVATAR_MAX_EDGE = 1024
const AVATAR_COMPRESSION = 0.8

/** Product photos are the marketplace card and the detail gallery, so they keep
 *  more resolution than an avatar -- but still well inside the API's 5 MB cap
 *  for product images (`maxProductImageBytes` in product_image_service.go). */
const PRODUCT_MAX_EDGE = 1600
const PRODUCT_COMPRESSION = 0.82

/** Re-encodes a picked photo into a bounded JPEG before upload. The picker only
 *  applies JPEG compression, so a camera original still arrives at full sensor
 *  resolution -- several megabytes, which the API rejects above its size cap and
 *  a mobile connection cannot push before the request times out. Re-encoding
 *  also normalises iOS HEIC, which the API does not accept.
 *
 *  The bound is measured on the decoded image rather than on the dimensions the
 *  picker reported: those are optional, and treating a missing value as "small
 *  enough" let a full-resolution original through unresized. */
async function prepareUpload(uri: string, maxEdge: number, compress: number): Promise<UploadFile> {
  let image = await ImageManipulator.manipulate(uri).renderAsync()
  if (Math.max(image.width, image.height) > maxEdge) {
    const size = image.width >= image.height ? { width: maxEdge } : { height: maxEdge }
    image = await ImageManipulator.manipulate(image).resize(size).renderAsync()
  }
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress })
  return { uri: result.uri, type: 'image/jpeg' }
}

export function prepareAvatarUpload(asset: { uri: string }): Promise<UploadFile> {
  return prepareUpload(asset.uri, AVATAR_MAX_EDGE, AVATAR_COMPRESSION)
}

/** Same normalisation for a product photo, at the larger product bound. */
export function prepareProductImageUpload(asset: { uri: string }): Promise<UploadFile> {
  return prepareUpload(asset.uri, PRODUCT_MAX_EDGE, PRODUCT_COMPRESSION)
}
