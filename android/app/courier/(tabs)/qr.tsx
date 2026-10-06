import { Redirect } from 'expo-router'

/** Never shown: the centre tab press is intercepted in _layout and opens /courier/scan.
 *  A direct visit (old link, restored route) goes to the scanner too. */
export default function CourierScanTab() {
  return <Redirect href="/courier/scan" />
}
