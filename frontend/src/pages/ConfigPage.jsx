import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

import { listModels } from '../lib/api'

export default function ConfigPage({
  models: initialModels,
  providerStatus: initialStatus,
  onSavePreferences,
  onRefresh,
  saving,
  onClose,
}) {
  const [models, setModels] = useState(initialModels)
  const [statuses, setStatuses] = useState(initialStatus)
  const [draft, setDraft] = useState({})
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  const load = async (force = false) => {
    setLoading(true)
    try {
      const response = await listModels({ force })
      setModels(response.models || [])
      setStatuses(response.provider_status || [])
      onRefresh?.({ force: true })
      const ts = new Date()
      setLastUpdated(ts)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setToast(err.message || 'Failed to refresh models')
      setTimeout(() => setToast(null), 3000)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(true)
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('model_prefs_draft')
    if (stored) {
      try {
        setDraft(JSON.parse(stored))
        return
      } catch {
        setDraft({})
      }
    }
  }, [])

  useEffect(() => {
    const next = {}
    models.forEach((model) => {
      next[model.name] =
        draft[model.name] ?? (model.enabled !== false && model.available !== false)
    })
    setDraft(next)
    localStorage.setItem('model_prefs_draft', JSON.stringify(next))
  }, [models])

  const grouped = useMemo(() => {
    const map = {}
    models.forEach((model) => {
      const key = model.provider
      if (!map[key]) map[key] = []
      map[key].push(model)
    })
    return map
  }, [models])

  const handleToggle = (name) => {
    setDraft((prev) => {
      const next = { ...prev, [name]: !prev[name] }
      localStorage.setItem('model_prefs_draft', JSON.stringify(next))
      return next
    })
  }

  const handleSave = async () => {
    const preferences = Object.entries(draft).map(([name, enabled]) => ({
      name,
      enabled,
    }))
    await onSavePreferences(preferences)
    setToast('Preferences saved')
    setTimeout(() => setToast(null), 3000)
    await load(true)
  }

  return (
    <div className="config-page">
      <header className="config-header">
        <h1>Model Configuration</h1>
        <div className="config-actions">
          <span className="config-updated">
            {lastUpdated ? `last updated: ${lastUpdated.toLocaleTimeString()}` : ''}
          </span>
          <div className="config-buttons">
            <button type="button" className="text-button" onClick={() => load(true)}>
              Refresh
            </button>
            <button type="button" className="text-button" onClick={onClose}>
              Back
            </button>
            <button
              type="button"
              className="primary"
              onClick={handleSave}
              disabled={saving || loading}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </header>
      {toast && <div className="status-banner">{toast}</div>}
      <div className="provider-status">
        {(statuses || []).map(({ provider, status }) => (
          <span key={provider}>
            {provider}: {status}
          </span>
        ))}
      </div>
      {models.length > 0 && (
        <section className="model-stats">
          <h2>Model Stats</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th scope="col" className="px-4 py-2 text-left">
                    Model
                  </th>
                  <th scope="col" className="px-4 py-2 text-left">
                    Provider
                  </th>
                  <th scope="col" className="px-4 py-2 text-left">
                    VRAM (MB)
                  </th>
                  <th scope="col" className="px-4 py-2 text-left">
                    Cost / 1K
                  </th>
                  <th scope="col" className="px-4 py-2 text-left">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {models
                  .slice()
                  .sort((a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name))
                  .map((model) => (
                    <tr key={model.name} className="bg-white dark:bg-slate-900">
                      <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">
                        {model.model_id || model.name}
                      </td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{model.provider || '—'}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                        {model.vram_mb != null ? model.vram_mb : 'Shared'}
                      </td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                        {model.cost_per_1k ? `$${model.cost_per_1k}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                        {model.model_status || 'unknown'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {loading && <p>Loading models…</p>}
      <div className="config-groups">
        {Object.entries(grouped).map(([provider, list]) => (
          <section key={provider}>
            <h2>{provider}</h2>
            <ul>
              {list.map((model) => (
                <li key={model.name}>
                  <label>
                    <input
                      type="checkbox"
                      checked={draft[model.name] ?? true}
                      onChange={() => handleToggle(model.name)}
                    />
                    <span className="config-model-name">{model.name}</span>
                    {model.ctx && <span>{model.ctx} ctx</span>}
                    {model.cost_per_1k && <small>${model.cost_per_1k}/1K</small>}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

ConfigPage.propTypes = {
  models: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      provider: PropTypes.string,
      ctx: PropTypes.number,
      cost_per_1k: PropTypes.number,
      enabled: PropTypes.bool,
    }),
  ),
  providerStatus: PropTypes.arrayOf(
    PropTypes.shape({
      provider: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
    }),
  ),
  onSavePreferences: PropTypes.func.isRequired,
  onRefresh: PropTypes.func,
  saving: PropTypes.bool,
  onClose: PropTypes.func,
}

ConfigPage.defaultProps = {
  models: [],
  providerStatus: [],
  onRefresh: undefined,
  saving: false,
  onClose: undefined,
}
