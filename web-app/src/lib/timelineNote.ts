/**
 * Timeline notes are written by the server in English. The lifecycle ones are
 * known phrases and get a translation; anything else (a rejection reason typed
 * by a person) is shown as written.
 */
export function timelineNote(t: (key: string) => string, note: string): string {
  const key = `timelineNote.${note.trim()}`
  const label = t(key)
  return label !== key ? label : note
}
