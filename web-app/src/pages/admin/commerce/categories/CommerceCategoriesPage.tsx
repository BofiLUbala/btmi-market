import { useState, useEffect, useCallback } from 'react'
import { adminCommerceApi, type AdminCategoryItem } from '@/api/admin'
import { useT } from '@/store/i18n'

export default function CommerceCategoriesPage() {
  const t = useT()
  const [categories, setCategories] = useState<AdminCategoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatSlug, setNewCatSlug] = useState('')
  const [newCatSort, setNewCatSort] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [showSubCreate, setShowSubCreate] = useState<string | null>(null)
  const [newSubName, setNewSubName] = useState('')
  const [newSubSlug, setNewSubSlug] = useState('')
  const [newSubSort, setNewSubSort] = useState(0)
  const [subEditId, setSubEditId] = useState<string | null>(null)
  const [subEditName, setSubEditName] = useState('')

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminCommerceApi.listCategories()
      setCategories(res)
    } catch (err) {
      console.error('Failed to load categories', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  const handleCreateCategory = async () => {
    if (!newCatName.trim() || !newCatSlug.trim()) return
    try {
      await adminCommerceApi.createCategory(newCatName, newCatSlug, newCatSort)
      setNewCatName('')
      setNewCatSlug('')
      setNewCatSort(0)
      setShowCreate(false)
      fetchCategories()
    } catch (err) {
      console.error(err)
    }
  }

  const handleUpdateCategory = async (id: string) => {
    try {
      await adminCommerceApi.updateCategory(id, { name: editName, slug: editSlug })
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>{t('common.name')}</label>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #334155', backgroundColor: '#1e293b', color: '#f8fafc', fontSize: 13, width: 200 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>{t('admin.categories.slug')}</label>
              <input value={newCatSlug} onChange={e => setNewCatSlug(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #334155', backgroundColor: '#1e293b', color: '#f8fafc', fontSize: 13, width: 160 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>{t('admin.categories.sort')}</label>
              <input type="number" value={newCatSort} onChange={e => setNewCatSort(Number(e.target.value))} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #334155', backgroundColor: '#1e293b', color: '#f8fafc', fontSize: 13, width: 80 }} />
            </div>
            <button onClick={handleCreateCategory} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', backgroundColor: '#10b981', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('admin.categories.create')}</button>
            <button onClick={() => setShowCreate(false)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #334155', backgroundColor: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>{t('common.cancel')}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>{t('common.loading')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {categories.map(cat => (
            <div key={cat.ID} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, backgroundColor: '#1e293b', color: '#94a3b8' }}>#{cat.SortOrder}</span>
                  {editingId === cat.ID ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input value={editName} onChange={e => setEditName(e.target.value)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #334155', backgroundColor: '#1e293b', color: '#f8fafc', fontSize: 13 }} />
                      <input value={editSlug} onChange={e => setEditSlug(e.target.value)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #334155', backgroundColor: '#1e293b', color: '#f8fafc', fontSize: 13 }} />
                      <button onClick={() => handleUpdateCategory(cat.ID)} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', backgroundColor: '#10b981', color: '#fff', fontSize: 11, cursor: 'pointer' }}>{t('common.save')}</button>
                      <button onClick={() => setEditingId(null)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #334155', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>{t('common.cancel')}</button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{cat.Name}</span>
                  )}
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    backgroundColor: cat.Status === 'ACTIVE' ? '#064e3b' : '#7f1d1d',
                    color: cat.Status === 'ACTIVE' ? '#a7f3d0' : '#fca5a5'
                  }}>{cat.Status}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setEditingId(cat.ID); setEditName(cat.Name); setEditSlug(cat.Slug) }} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #334155', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>{t('common.edit')}</button>
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
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, backgroundColor: sub.status === 'ACTIVE' ? '#064e3b' : '#7f1d1d', color: sub.status === 'ACTIVE' ? '#a7f3d0' : '#fca5a5' }}>{sub.status}</span>
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
