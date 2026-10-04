import { useEffect, useState } from 'react'
import { addCategory, COLORS, deleteCategory, nextColor, updateCategory, useCategories, type CategoryDef, type ColorName } from '../categories'
import { useTasks } from '../store'

/** Название + выбор цвета. Используется и для новой категории, и для правки. */
export function CategoryEditor({ initial, onSave, onCancel, onDelete }: {
  initial?: CategoryDef
  onSave: (label: string, color: ColorName) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [color, setColor] = useState<ColorName>(initial?.color ?? nextColor())
  const ok = label.trim().length > 0

  return (
    <div className={`cat-editor cc-${color}`}>
      <input
        className="cat-editor-input"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Название, например «учёба»"
        autoFocus
        maxLength={24}
        enterKeyHint="done"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (ok) onSave(label, color)
          }
        }}
      />
      <div className="swatches" role="radiogroup" aria-label="Цвет">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={c}
            className={`swatch cc-${c}` + (color === c ? ' on' : '')}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <div className="cat-editor-actions">
        {onDelete && <button type="button" className="link-btn" style={{ color: 'var(--red)', marginRight: 'auto' }} onClick={onDelete}>Удалить</button>}
        <button type="button" className="link-btn" onClick={onCancel}>Отмена</button>
        <button type="button" className="link-btn" style={{ fontWeight: 600 }} disabled={!ok} onClick={() => onSave(label, color)}>
          {initial ? 'Сохранить' : 'Добавить'}
        </button>
      </div>
    </div>
  )
}

/** Список категорий: переименовать, перекрасить, удалить, добавить */
export function CategoriesSheet({ onClose }: { onClose: () => void }) {
  const categories = useCategories()
  const tasks = useTasks()
  const [editing, setEditing] = useState<string | 'new' | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const remove = (c: CategoryDef) => {
    const n = tasks.filter((t) => t.category === c.id).length
    const msg = n ? `Удалить категорию «${c.label}»? У ${n} дел станет «без категории».` : `Удалить категорию «${c.label}»?`
    if (confirm(msg)) {
      deleteCategory(c.id)
      setEditing(null)
    }
  }

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Категории" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span style={{ minWidth: 70 }} />
          <h2>Категории</h2>
          <button onClick={onClose}>Готово</button>
        </div>
        <div className="sheet-body">
          <div className="group">
            {categories.map((c) =>
              editing === c.id ? (
                <CategoryEditor
                  key={c.id}
                  initial={c}
                  onCancel={() => setEditing(null)}
                  onSave={(label, color) => {
                    updateCategory(c.id, { label, color })
                    setEditing(null)
                  }}
                  onDelete={categories.length > 1 ? () => remove(c) : undefined}
                />
              ) : (
                <button key={c.id} className={`row cc-${c.color}`} onClick={() => setEditing(c.id)}>
                  <span className="dot" style={{ width: 12, height: 12, marginLeft: 5, marginRight: 5 }} />
                  <span className="row-body"><span className="row-title">{c.label}</span></span>
                  <span className="row-meta">{tasks.filter((t) => t.category === c.id).length || ''}</span>
                </button>
              ),
            )}
          </div>
          {editing === 'new' ? (
            <div className="group">
              <CategoryEditor
                onCancel={() => setEditing(null)}
                onSave={(label, color) => {
                  addCategory(label, color)
                  setEditing(null)
                }}
              />
            </div>
          ) : (
            <button className="plain-btn" onClick={() => setEditing('new')}>+ Новая категория</button>
          )}
          <div className="hint">В быстром вводе категорию можно указать тегом: #работа, #учёба — или первыми буквами: #р</div>
        </div>
      </div>
    </div>
  )
}
