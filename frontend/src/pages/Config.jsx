import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

export default function ConfigPage({
  models,
  providerStatus,
  onSavePreferences,
  onRefresh,
  saving,
  onClose,
}) {
  const [draft, setDraft] = useState({})
  const [toast, setToast] = useState(null)

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
  }, [models.length])

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
    onRefresh?.()
  }

  return (
    <div className="config-page">
      <header className="config-header">
        <h1>Model Configuration</h1>
        <div className="config-actions">
          <button type="button" className="text-button" onClick={onClose}>
            Back
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>
      {toast && <div className="status-banner">{toast}</div>}
      <div className="provider-status">
        {providerStatus.map(({ provider, status }) => (
          <span key={provider}>
            {provider}: {status}
          </span>
        ))}
      </div>
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
