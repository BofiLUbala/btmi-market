import { useState, useEffect, useCallback, useMemo } from 'react'
import { adminLabel } from '@/lib/adminLabels'
import { adminCommerceApi, type AdminCategoryAttribute, type AdminCategoryItem } from '@/api/admin'
import { useI18n, useT } from '@/store/i18n'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { missingCatalogCategories, type CatalogCategory } from '@/lib/categoryCatalog'
import { categoryLabel, subcategoryLabel } from '@/lib/categoryLabels'
import { descriptionTemplateFor } from '@/lib/productDescription'

export default function CommerceCategoriesPage() {
  const t = useT()
  const { lang: uiLang } = useI18n()
  const [categories, setCategories] = useState<AdminCategoryItem[]>([])
  const [attributes, setAttributes] = useState<Record<string, AdminCategoryAttribute[]>>({})
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [addingSlug, setAddingSlug] = useState<string | null>(null)
  const [addError, setAddError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [showSubCreate, setShowSubCreate] = useState<string | null>(null)
  const [newSubName, setNewSubName] = useState('')
  const [newSubSlug, setNewSubSlug] = useState('')
  const [newSubSort, setNewSubSort] = useState(0)
  const [subEditId, setSubEditId] = useState<string | null>(null)
  const [subEditName, setSubEditName] = useState('')

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    try {
      const [res, attrs] = await Promise.all([
        adminCommerceApi.listCategories(),
        adminCommerceApi.getAttributeSuggestions().catch(() => ({})),
      ])
      setCategories(res)
      setAttributes(attrs)
    } catch (err) {
      console.error('Failed to load categories', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  // Every slug already in the database counts, inactive ones included: those
  // are re-enabled from the list below rather than added a second time.
  const available = useMemo(() => missingCatalogCategories(categories.map((c) => c.Slug)), [categories])
  const lang = uiLang === 'en' ? 'en' : 'fr'

  const handleAddFromCatalog = async (entry: CatalogCategory) => {
    setAddingSlug(entry.slug)
    setAddError('')
    try {
      const nextSort = Math.max(0, ...categories.filter((c) => c.Status === 'ACTIVE').map((c) => c.SortOrder)) + 1
      const created = await adminCommerceApi.createCategory(entry.name, entry.slug, nextSort)
      for (const [index, sub] of entry.subcategories.entries()) {
        await adminCommerceApi.createSubcategory(created.id, sub.name, sub.slug, index + 1)
      }
      await fetchCategories()
    } catch (err) {
      setAddError(t('admin.categories.addFailed', { error: err instanceof Error ? err.message : String(err) }))
    } finally {
      setAddingSlug(null)
    }
  }

  const handleUpdateCategory = async (id: string) => {
    try {
      // The slug is fixed by the catalogue: it drives the icon, translations and
      // the product description template, so only the name is editable.
      await adminCommerceApi.updateCategory(id, { name: editName })
      setEditingId(null)
      fetchCategories()
    } catch (err) {
      console.error(err)
    }
  }

  const handleToggleCategory = async (id: string, currentStatus: string) => {
    try {
      await adminCommerceApi.updateCategory(id, { status: currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })
      fetchCategories()
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateSubcategory = async (categoryId: string) => {
    if (!newSubName.trim() || !newSubSlug.trim()) return
    try {
      await adminCommerceApi.createSubcategory(categoryId, newSubName, newSubSlug, newSubSort)
      setNewSubName('')
      setNewSubSlug('')
      setNewSubSort(0)
      setShowSubCreate(null)
      fetchCategories()
    } catch (err) {
      console.error(err)
    }
  }

  const handleUpdateSubcategory = async (id: string) => {
    try {
      await adminCommerceApi.updateSubcategory(id, { name: subEditName })
      setSubEditId(null)
      fetchCategories()
    } catch (err) {
      console.error(err)
    }
  }

  const handleToggleSubcategory = async (id: string, currentStatus: string) => {
    try {
      await adminCommerceApi.updateSubcategory(id, { status: currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })
      fetchCategories()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{t('admin.categories.title')}</h2>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{t('admin.categories.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          style={{
            padding: '8px 16px', borderRadius: 6, border: 'none',
            backgroundColor: '#10b981', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600
          }}
        >+ {t('admin.categories.newCategory')}</button>
      </div>

      {showCreate && (
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{t('admin.categories.catalogTitle')}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{t('admin.categories.catalogHint')}</div>
            </div>
            <button onClick={() => setShowCreate(false)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #334155', backgroundColor: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>{t('common.cancel')}</button>
          </div>
          {addError && <div role="alert" style={{ color: '#fca5a5', fontSize: 12, marginBottom: 10 }}>{addError}</div>}
          {available.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: 13, padding: '12px 0' }}>{t('admin.categories.catalogEmpty')}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
              {available.map((entry) => {
                const template = descriptionTemplateFor(entry.slug)
                return (
                  <div key={entry.slug} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 8, border: '1px solid #1e293b', backgroundColor: '#111c30' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, backgroundColor: '#064e3b', color: '#6ee7b7', flexShrink: 0 }}>
                        <CategoryIcon slug={entry.slug} width={20} height={20} />
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, color: '#f8fafc' }}>{categoryLabel(t, entry.slug, entry.name)}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{entry.slug}</div>
                      </div>
                      <button
                        onClick={() => handleAddFromCatalog(entry)}
                        disabled={addingSlug !== null}
                        style={{ padding: '6px 12px', borderRadius: 6, border: 'none', backgroundColor: '#10b981', color: '#fff', fontSize: 12, fontWeight: 600, cursor: addingSlug ? 'wait' : 'pointer', opacity: addingSlug && addingSlug !== entry.slug ? 0.5 : 1 }}
                      >{addingSlug === entry.slug ? t('admin.categories.adding') : t('admin.categories.add')}</button>
                    </div>
                    {entry.subcategories.length > 0 && (
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>
                        <span style={{ color: '#64748b', fontWeight: 700 }}>{t('admin.categories.subcategoriesLabel')}: </span>
                        {entry.subcategories.map((s) => subcategoryLabel(t, s.slug, s.name)).join(' · ')}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginBottom: 4 }}>{t('admin.categories.descriptionSections').toUpperCase()}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {template.sections.map((section) => (
                          <span key={section.key} title={section.placeholder[lang]} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, border: '1px solid #334155', color: '#e2e8f0' }}>{section.label[lang]}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>{t('common.loading')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {categories.map(cat => (
            <div key={cat.ID} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, backgroundColor: '#1e293b', color: '#94a3b8' }}>#{cat.SortOrder}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, backgroundColor: '#1e293b', color: '#6ee7b7' }}>
                    <CategoryIcon slug={cat.Slug} width={18} height={18} />
                  </span>
                  {editingId === cat.ID ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input value={editName} onChange={e => setEditName(e.target.value)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #334155', backgroundColor: '#1e293b', color: '#f8fafc', fontSize: 13 }} />
                      <button onClick={() => handleUpdateCategory(cat.ID)} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', backgroundColor: '#10b981', color: '#fff', fontSize: 11, cursor: 'pointer' }}>{t('common.save')}</button>
                      <button onClick={() => setEditingId(null)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #334155', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>{t('common.cancel')}</button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{categoryLabel(t, cat.Slug, cat.Name)}</span>
                  )}
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    backgroundColor: cat.Status === 'ACTIVE' ? '#064e3b' : '#7f1d1d',
                    color: cat.Status === 'ACTIVE' ? '#a7f3d0' : '#fca5a5'
                  }}>{adminLabel(cat.Status)}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <button onClick={() => { setEditingId(cat.ID); setEditName(cat.Name) }} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #334155', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>{t('common.edit')}</button>
                  <button onClick={() => setShowSubCreate(showSubCreate === cat.ID ? null : cat.ID)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #10b981', color: '#10b981', fontSize: 11, cursor: 'pointer' }}>+ {t('admin.categories.sub')}</button>
                  <button onClick={() => handleToggleCategory(cat.ID, cat.Status)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #f59e0b', color: '#f59e0b', fontSize: 11, cursor: 'pointer' }}>
                    {cat.Status === 'ACTIVE' ? t('admin.categories.disable') : t('admin.categories.enable')}
                  </button>
                </div>
              </div>

              {/* Subcategories */}
              {showSubCreate === cat.ID && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, padding: 8, backgroundColor: '#1e293b', borderRadius: 6, alignItems: 'end' }}>
                  <input placeholder={t('common.name')} value={newSubName} onChange={e => setNewSubName(e.target.value)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 12 }} />
                  <input placeholder={t('admin.categories.slug')} value={newSubSlug} onChange={e => setNewSubSlug(e.target.value)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 12 }} />
                  <input type="number" placeholder={t('admin.categories.sort')} value={newSubSort} onChange={e => setNewSubSort(Number(e.target.value))} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 12, width: 60 }} />
                  <button onClick={() => handleCreateSubcategory(cat.ID)} style={{ padding: '4px 10px', borderRadius: 4, border: 'none', backgroundColor: '#10b981', color: '#fff', fontSize: 11, cursor: 'pointer' }}>{t('admin.categories.create')}</button>
                </div>
              )}

              {cat.Subcategories && cat.Subcategories.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 20 }}>
                  {cat.Subcategories.map(sub => (
                    <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', backgroundColor: '#1e293b', borderRadius: 6, fontSize: 13 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#64748b', fontSize: 11 }}>#{sub.sort_order}</span>
                        {subEditId === sub.id ? (
                          <input value={subEditName} onChange={e => setSubEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleUpdateSubcategory(sub.id)} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', fontSize: 12 }} autoFocus />
                        ) : (
                          <span style={{ color: '#f8fafc' }}>{sub.name}</span>
                        )}
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, backgroundColor: sub.status === 'ACTIVE' ? '#064e3b' : '#7f1d1d', color: sub.status === 'ACTIVE' ? '#a7f3d0' : '#fca5a5' }}>{adminLabel(sub.status)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {subEditId === sub.id ? (
                          <button onClick={() => handleUpdateSubcategory(sub.id)} style={{ padding: '2px 6px', borderRadius: 3, border: 'none', backgroundColor: '#10b981', color: '#fff', fontSize: 10, cursor: 'pointer' }}>{t('common.save')}</button>
                        ) : (
                          <button onClick={() => { setSubEditId(sub.id); setSubEditName(sub.name) }} style={{ padding: '2px 6px', borderRadius: 3, border: '1px solid #334155', color: '#94a3b8', fontSize: 10, cursor: 'pointer' }}>{t('common.edit')}</button>
                        )}
                        <button onClick={() => handleToggleSubcategory(sub.id, sub.status)} style={{ padding: '2px 6px', borderRadius: 3, border: '1px solid #f59e0b', color: '#f59e0b', fontSize: 10, cursor: 'pointer' }}>
                          {sub.status === 'ACTIVE' ? t('admin.categories.disable') : t('admin.categories.enable')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#475569', fontSize: 12, marginLeft: 20 }}>{t('admin.categories.noSubcategories')}</div>
              )}

              {/* Attribute definitions the seller product form enforces for this category. */}
              <div style={{ marginTop: 10, marginLeft: 20 }}>
                <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{t('admin.categories.formAttributes').toUpperCase()}</div>
                {(attributes[cat.Slug] ?? []).length === 0 ? (
                  <div style={{ color: '#475569', fontSize: 12 }}>{t('admin.categories.noAttributes')}</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(attributes[cat.Slug] ?? []).map((a) => (
                      <span
                        key={`${a.subcategory ?? ''}-${a.key}`}
                        title={a.allowed_values.length ? a.allowed_values.join(', ') : t('admin.categories.attrFreeText')}
                        style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0' }}
                      >
                        {uiLang === 'en' ? a.label_en || a.label : a.label}
                        {a.subcategory ? <span style={{ color: '#64748b' }}> · {a.subcategory}</span> : null}
                        {a.required ? <span style={{ color: '#fbbf24', fontWeight: 700 }}> · {t('admin.categories.attrRequired')}</span> : null}
                        {a.variant_attribute ? <span style={{ color: '#60a5fa', fontWeight: 700 }}> · {t('admin.categories.attrVariant')}</span> : null}
                        {a.allowed_values.length ? <span style={{ color: '#64748b' }}> · {t('admin.categories.attrValues', { count: a.allowed_values.length })}</span> : null}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Sections the seller's product description form asks for in this category. */}
              <div style={{ marginTop: 10, marginLeft: 20 }}>
                <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{t('admin.categories.descriptionSections').toUpperCase()}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {descriptionTemplateFor(cat.Slug).sections.map((section) => (
                    <span key={section.key} title={section.placeholder[lang]} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0' }}>{section.label[lang]}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
