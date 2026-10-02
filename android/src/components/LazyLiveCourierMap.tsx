import { lazy } from 'react'
import { ErrorState } from './ui'
import { useI18n } from '../store/i18n'

/** Shown when this binary lacks MapLibre (Expo Go): the status line on the order page still applies. */
function MapUnavailable() {
  const { t } = useI18n()
  return <ErrorState message={t('liveMap.noMap')} />
}

// MapLibre is a native module: loaded only when a map is shown, so the rest
// of the app never evaluates it. Without it (Expo Go), say so instead of crashing.
export const LazyLiveCourierMap = lazy(() => import('./LiveCourierMap')
  .then((m) => ({ default: m.LiveCourierMap ?? MapUnavailable }))
  .catch(() => ({ default: MapUnavailable })))
