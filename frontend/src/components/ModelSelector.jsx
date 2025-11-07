import { useMemo, useState } from 'react'
import PropTypes from 'prop-types'

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

  const localModels = useMemo(
    () => validModels.filter((model) => model.provider === 'ollama'),
    [validModels],
  )
  const cloudModels = useMemo(
    () => validModels.filter((model) => model.provider !== 'ollama'),
    [validModels],
  )

  const [selectedModel, setSelectedModel] = useState(() => {
    const persisted = localStorage.getItem('selectedModel')
    return activeModel || persisted || ''
  })

  if (activeModel && activeModel !== selectedModel) {
    setSelectedModel(activeModel)
  }

  const handleSelect = (name) => {
    if (disabled) return
    setSelectedModel(name)
    localStorage.setItem('selectedModel', name)
    onSelect?.(name)
  }

  const providerWarnings = useMemo(
    () =>
      (providerStatus || []).filter((entry) => entry.status && entry.status !== 'ok'),
    [providerStatus],
  )

  const handleProviderClick = (provider) => {
    onOpenSettings?.(provider)
  }

  const renderGroup = (title, items) => (
    <div className="model-section">
      <h4 className="model-section__header">
        {title} ({items.length})
      </h4>
      <ul className="model-list">
        {items.length === 0 ? (
          <li className="muted">None available</li>
        ) : (
          items.map((model) => (
            <li
              key={model.name}
              className={model.name === selectedModel ? 'is-active' : ''}
              onClick={() => handleSelect(model.name)}
              title={`${model.provider} • ${model.source}`}
            >
              <span>{model.name}</span>
              <span className="provider">{model.provider}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  )

  return (
    <section className="model-selector">
      <header className="panel-header">
        <h2>Models</h2>
      </header>
      <div className="model-sections">
        {renderGroup('Local Models', localModels)}
        {renderGroup('Cloud Models', cloudModels)}
        {ollamaStatus !== 'ok' && (
          <div className="provider-warning">
            ⚠️ Ollama unreachable — local models hidden.
            <button type="button" className="text-button" onClick={onRetry}>
              Retry
            </button>
          </div>
        )}
        {providerWarnings.length > 0 && (
          <div className="provider-warnings">
            {providerWarnings.map(({ provider, status, message }) => (
              <button
                key={provider}
                type="button"
                className="provider-warning"
                onClick={() => handleProviderClick(provider)}
              >
                {provider} ({status})
                {message ? ` — ${message}` : null}
              </button>
            ))}
          </div>
        )}
      </div>
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
