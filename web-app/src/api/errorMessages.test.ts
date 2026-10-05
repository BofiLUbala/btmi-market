import { describe, expect, it } from 'vitest'
import { localizeApiError } from './errorMessages'
import { fr } from '@/locales/fr'
import { en } from '@/locales/en'

describe('localizeApiError', () => {
  it('translates a known code into the selected language', () => {
    expect(localizeApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password', 'fr')).toBe(fr['apiError.INVALID_CREDENTIALS'])
    expect(localizeApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password', 'en')).toBe(en['apiError.INVALID_CREDENTIALS'])
  })

  it('never shows the English backend message to a French reader', () => {
    const msg = localizeApiError(404, 'ORDER_NOT_FOUND', 'Order not found', 'fr')
    expect(msg).toBe('Commande introuvable.')
  })

  it('keeps the precise message of a generic code when it is already in the reader language', () => {
    expect(localizeApiError(400, 'VALIDATION_ERROR', 'fee is required', 'en')).toBe('fee is required')
    expect(localizeApiError(400, 'VALIDATION_ERROR', 'fee is required', 'fr')).toBe(fr['apiError.VALIDATION_ERROR'])
  })

  it('does not show a French backend message to an English reader', () => {
    const msg = localizeApiError(400, 'INVALID_DATE', 'La date doit être au format AAAA-MM-JJ.', 'en')
    expect(msg).toBe(en['apiError.INVALID_DATE'])
  })

  it('reads a service error whose message is itself a code', () => {
    expect(localizeApiError(409, 'VALIDATION_ERROR', 'QR_WRONG_COURIER', 'fr')).toBe(fr['apiError.QR_WRONG_COURIER'])
  })

  it('falls back on the HTTP status for an unknown code', () => {
    expect(localizeApiError(503, 'SOME_NEW_CODE', 'Something broke', 'fr')).toBe(fr['apiError.status.500'])
    expect(localizeApiError(0, 'NETWORK_ERROR', '', 'en')).toBe(en['apiError.NETWORK_ERROR'])
    expect(localizeApiError(418, 'SOME_NEW_CODE', '', 'fr')).toBe('La requête a échoué (418).')
  })
})
