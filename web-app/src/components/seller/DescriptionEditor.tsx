import { useEffect, useMemo, useRef, useState } from 'react'
import {
  composeDescription,
  descriptionTemplateFor,
  draftFromDescription,
  type DescriptionDraft,
} from '@/lib/productDescription'
import { useI18n } from '@/store/i18n'

/**
 * Structured description input for the seller product forms.
 *
 * It still reads and writes the single `description` string the API expects;
 * the sections only change how the seller fills it in and how the buyer page
 * lays it out (see lib/productDescription.ts).
 */
export function DescriptionEditor({
  categorySlug,
  value,
  onChange,
  idPrefix = 'desc',
}: {
  categorySlug?: string | null
  value: string
  onChange: (next: string) => void
  idPrefix?: string
}) {
  const { t, lang } = useI18n()
  const template = useMemo(() => descriptionTemplateFor(categorySlug), [categorySlug])
  const [draft, setDraft] = useState<DescriptionDraft>(() => draftFromDescription(value, template))
  const lastEmitted = useRef(value)

  // Re-map when the category changes, or when the parent replaces the value
  // (form reset, product loaded) rather than echoing our own edit back.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value
      setDraft(draftFromDescription(value, template))
    }
  }, [value, template])

  // On a category switch, serialise with the *previous* template (so its
  // sections keep their headings) and re-read with the new one: anything the
  // new layout has no field for lands in `extra` instead of being dropped.
  const previousTemplate = useRef(template)
  useEffect(() => {
    const from = previousTemplate.current
    previousTemplate.current = template
    if (from.tone === template.tone) return
    setDraft((prev) => draftFromDescription(composeDescription(prev, from, lang), template))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template])

  function update(next: DescriptionDraft) {
    setDraft(next)
    const text = composeDescription(next, template, lang)
    lastEmitted.current = text
    onChange(text)
  }

  return (
    <div className="desc-editor">
      <div className="desc-editor-head">
        <span className="desc-editor-title">{t('seller.descEditor.title')}</span>
        <span className="desc-editor-tone">{t('seller.descEditor.adaptedTo', { tone: t(`seller.descEditor.tone.${template.tone}`) })}</span>
      </div>
      <p className="field-hint" style={{ margin: 0 }}>{t('seller.descEditor.hint')}</p>

      <div className="field">
        <label htmlFor={`${idPrefix}-intro`}>{t('seller.descEditor.intro')}</label>
        <textarea
          id={`${idPrefix}-intro`}
          className="input"
          rows={3}
          value={draft.intro}
          placeholder={template.introPlaceholder[lang]}
          onChange={(e) => update({ ...draft, intro: e.target.value })}
        />
      </div>

      <div className="desc-editor-sections">
        {template.sections.map((section) => (
          <div className="field desc-editor-section" key={section.key}>
            <label htmlFor={`${idPrefix}-${section.key}`}>
              {section.label[lang]} <span className="muted small">{t('seller.descEditor.optional')}</span>
            </label>
            <textarea
              id={`${idPrefix}-${section.key}`}
              className="input"
              rows={2}
              value={draft.values[section.key] ?? ''}
              placeholder={section.placeholder[lang]}
              onChange={(e) => update({ ...draft, values: { ...draft.values, [section.key]: e.target.value } })}
            />
          </div>
        ))}
      </div>

      {draft.extra.length > 0 && (
        <div className="desc-editor-extra">
          <span className="small bold">{t('seller.descEditor.otherSections')}</span>
          {draft.extra.map((section, index) => (
            <div className="field desc-editor-section" key={`${section.heading}-${index}`}>
              <div className="row-between">
                <label htmlFor={`${idPrefix}-extra-${index}`}>{section.heading}</label>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => update({ ...draft, extra: draft.extra.filter((_, i) => i !== index) })}
                >
                  {t('common.remove')}
                </button>
              </div>
              <textarea
                id={`${idPrefix}-extra-${index}`}
                className="input"
                rows={2}
                value={section.body}
                onChange={(e) =>
                  update({
                    ...draft,
                    extra: draft.extra.map((x, i) => (i === index ? { ...x, body: e.target.value } : x)),
                  })
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
