import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'

const FAVORITES_KEY = 'synapse_fav_models'

const focusableSelectors =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function ModelModal({ open, models, activeModel, onSelect, onClose }) {
  const dialogRef = useRef(null)
  const searchRef = useRef(null)
  const [query, setQuery] = useState('')
  const [favorites, setFavorites] = useState(() => {
    if (typeof window === 'undefined') return []
    try {
      return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
      } else if (event.key === 'Tab') {
        const dialog = dialogRef.current
        if (!dialog) return
        const focusable = dialog.querySelectorAll(focusableSelectors)
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault()
            last.focus()
          }
        } else if (document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    setQuery('')
    const timer = setTimeout(() => {
      searchRef.current?.focus()
    }, 0)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      clearTimeout(timer)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const toggleFavorite = (name) => {
    setFavorites((prev) => {
      if (prev.includes(name)) {
        return prev.filter((entry) => entry !== name)
      }
      return [...prev, name]
    })
  }

  const filteredModels = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = models || []
    const base = needle
      ? list.filter((model) => {
          const haystacks = [
            model.name,
            model.model_id,
            model.provider,
            model.description,
            model.type,
            model.category,
          ]
          return haystacks.some((value) => value?.toLowerCase().includes(needle))
        })
      : list

    return [...base].sort((a, b) => {
      const aFav = favorites.includes(a.name)
      const bFav = favorites.includes(b.name)
      if (aFav !== bFav) return aFav ? -1 : 1
      if (a.provider !== b.provider) return a.provider.localeCompare(b.provider)
      return a.name.localeCompare(b.name)
    })
  }, [models, query, favorites])

  const grouped = useMemo(() => {
    const map = {}
    filteredModels.forEach((model) => {
      const providerKey = (model.provider || 'other').toUpperCase()
      if (!map[providerKey]) map[providerKey] = {}
      const typeKey = model.category || model.type || 'general'
      if (!map[providerKey][typeKey]) map[providerKey][typeKey] = []
      map[providerKey][typeKey].push(model)
    })
    return map
  }, [filteredModels])

  if (!open) return null

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={onClose} />
      <section
        id="model-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-modal-heading"
        className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        ref={dialogRef}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div>
            <h2 id="model-modal-heading" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Select a Model
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-300">
              Search by name, provider, or capability. Press Enter to pick.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Close model chooser"
          >
            ✕
          </button>
        </header>
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <input
            ref={searchRef}
            type="search"
            placeholder="Search models…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {filteredModels.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-300">No models match that search.</p>
          ) : (
            Object.entries(grouped).map(([provider, groups]) => (
              <div key={provider} className="mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {provider}
                </h3>
                <div className="mt-2 space-y-3">
                  {Object.entries(groups).map(([typeKey, modelsForType]) => (
                    <div key={typeKey}>
                      <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{typeKey}</p>
                      <ul className="mt-1 space-y-2">
                        {modelsForType.map((model) => {
                          const isActive = model.name === activeModel
                          const isFavorite = favorites.includes(model.name)
                          return (
                            <li key={model.name}>
                              <div
                                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                                  isActive
                                    ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-900/20'
                                    : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-indigo-400 dark:hover:bg-slate-800'
                                }`}
                              >
                                <button
                                  type="button"
                                  className="flex-1 text-left text-slate-800 dark:text-slate-100"
                                  onClick={() => {
                                    onSelect?.(model.name)
                                    onClose?.()
                                  }}
                                >
                                  <span className="font-semibold">{model.model_id || model.name}</span>
                                  <span className="ml-2 text-xs text-slate-500 dark:text-slate-300">
                                    {model.description || model.type || model.category}
                                  </span>
                                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                                    <span>{model.vram_mb ? `${model.vram_mb} MB VRAM` : 'Shared VRAM'}</span>
                                    {model.cost_per_1k && <span className="ml-2">${model.cost_per_1k}/1K tokens</span>}
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  className={`ml-3 inline-flex items-center justify-center rounded-full p-2 text-lg ${
                                    isFavorite
                                      ? 'text-amber-500 hover:text-amber-400'
                                      : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
                                  }`}
                                  aria-label={isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
                                  onClick={() => toggleFavorite(model.name)}
                                >
                                  {isFavorite ? '★' : '☆'}
                                </button>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )

  return createPortal(content, document.body)
}

ModelModal.propTypes = {
  open: PropTypes.bool.isRequired,
  models: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      model_id: PropTypes.string,
      provider: PropTypes.string,
      description: PropTypes.string,
      type: PropTypes.string,
      category: PropTypes.string,
      vram_mb: PropTypes.number,
      cost_per_1k: PropTypes.number,
    }),
  ),
  activeModel: PropTypes.string,
  onSelect: PropTypes.func,
  onClose: PropTypes.func,
}

ModelModal.defaultProps = {
  models: [],
  activeModel: '',
  onSelect: undefined,
  onClose: undefined,
}
