import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

const costTierStyles = {
  $$$: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-200',
  $$: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
  $: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
}

const badgeBase =
  'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-200'

export default function ModelSelector({
  models,
  activeModel,
  onSelect,
  disabled,
  providerStatus,
  ollamaStatus,
  onOpenSettings,
  onRetry,
}) {
  const validModels = useMemo(
    () =>
      models.filter(
        (model) =>
          model.available !== false &&
          model.enabled !== false &&
          model.model_status !== 'offline',
      ),
    [models],
  )

  const [query, setQuery] = useState('')
  const [selectedModel, setSelectedModel] = useState(() => {
    if (activeModel) return activeModel
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('selectedModel') || ''
  })

  useEffect(() => {
    if (activeModel && activeModel !== selectedModel) {
      setSelectedModel(activeModel)
    }
  }, [activeModel, selectedModel])

  const filteredModels = useMemo(() => {
    if (!query.trim()) return validModels
    const needle = query.toLowerCase()
    return validModels.filter(
      (model) =>
        model.name.toLowerCase().includes(needle) ||
        model.model_id?.toLowerCase().includes(needle) ||
        model.description?.toLowerCase().includes(needle),
    )
  }, [query, validModels])

  const sortModels = (list) => [...list].sort((a, b) => a.name.localeCompare(b.name))

  const localModels = sortModels(filteredModels.filter((model) => model.type === 'local'))
  const cloudModels = sortModels(filteredModels.filter((model) => model.type === 'cloud'))

  const handleSelect = (name) => {
    if (disabled) return
    setSelectedModel(name)
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedModel', name)
    }
    onSelect?.(name)
  }

  const providerWarnings = useMemo(
    () =>
      (providerStatus || []).filter((entry) => entry.status && entry.status !== 'ok'),
    [providerStatus],
  )

  const renderList = (items) => {
    if (!items.length) {
      return <p className="text-sm text-slate-500">No models detected.</p>
    }
    return (
      <ul className="flex flex-col gap-2">
        {items.map((model) => {
          const costClass =
            costTierStyles[model.cost_tier] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'
          return (
            <li key={model.name}>
              <button
                type="button"
                onClick={() => handleSelect(model.name)}
                className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                  model.name === selectedModel
                    ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:bg-slate-50 dark:hover:border-indigo-400 dark:hover:bg-slate-800'
                }`}
                title={model.description || `${model.provider} • ${model.source}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {model.model_id || model.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">
                      {model.description || model.provider}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold ${costClass}`}>
                    {model.cost_tier || '?'}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={badgeBase}>{model.provider}</span>
                  <span className={badgeBase}>
                    {model.vram_mb ? `${model.vram_mb} MB` : model.type || 'cloud'}
                  </span>
                  {model.category && (
                    <span className={badgeBase}>{model.category}</span>
                  )}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
          Models
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-xs font-medium text-indigo-600 hover:underline disabled:text-slate-400"
            onClick={onRetry}
            disabled={disabled}
          >
            Refresh
          </button>
          <button
            type="button"
            className="text-xs font-medium text-slate-500 hover:underline"
            onClick={() => onOpenSettings?.()}
          >
            Configure
          </button>
        </div>
      </div>
      <input
        type="search"
        placeholder="Search models"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />
      <div className="space-y-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Local Models ({localModels.length})
          </h3>
          <div className="mt-2 rounded-2xl bg-white/70 p-3 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900/40 dark:ring-slate-800">
            {renderList(localModels)}
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Cloud Models ({cloudModels.length})
          </h3>
          <div className="mt-2 rounded-2xl bg-white/70 p-3 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900/40 dark:ring-slate-800">
            {renderList(cloudModels)}
          </div>
        </div>
      </div>
      {ollamaStatus !== 'ok' && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500 dark:bg-amber-900/20 dark:text-amber-200">
          ⚠️ Ollama unreachable — local models hidden.
        </div>
      )}
      {providerWarnings.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Provider Alerts
          </p>
          <div className="flex flex-col gap-1">
            {providerWarnings.map(({ provider, status, message }) => (
              <button
                key={provider}
                type="button"
                className="text-left text-xs text-slate-600 underline-offset-2 hover:underline dark:text-slate-200"
                onClick={() => onOpenSettings?.(provider)}
              >
                {provider}: {status}
                {message ? ` — ${message}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

ModelSelector.propTypes = {
  models: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      provider: PropTypes.string,
      source: PropTypes.string,
      enabled: PropTypes.bool,
      available: PropTypes.bool,
      model_status: PropTypes.string,
      model_id: PropTypes.string,
      description: PropTypes.string,
      type: PropTypes.string,
      vram_mb: PropTypes.number,
      category: PropTypes.string,
      cost_tier: PropTypes.string,
    }),
  ),
  activeModel: PropTypes.string,
  onSelect: PropTypes.func,
  disabled: PropTypes.bool,
  providerStatus: PropTypes.arrayOf(
    PropTypes.shape({
      provider: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
      message: PropTypes.string,
    }),
  ),
  ollamaStatus: PropTypes.string,
  onOpenSettings: PropTypes.func,
  onRetry: PropTypes.func,
}

ModelSelector.defaultProps = {
  models: [],
  activeModel: '',
  disabled: false,
  providerStatus: [],
  ollamaStatus: 'unknown',
  onOpenSettings: undefined,
  onRetry: undefined,
}
