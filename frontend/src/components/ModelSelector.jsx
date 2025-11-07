import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

const defaultSections = ['all', 'local', 'cloud']

export default function ModelSelector({
  models,
  activeModel,
  onSelect,
  disabled,
  providerStatus,
  onOpenSettings,
}) {
  const validModels = useMemo(
    () =>
      models.filter(
        (model) => model.available !== false && model.model_status !== 'offline',
      ),
    [models],
  )

  const [selectedModel, setSelectedModel] = useState(() => {
    const persisted = localStorage.getItem('selectedModel')
    return activeModel || persisted || ''
  })

  useEffect(() => {
    if (activeModel && activeModel !== selectedModel) {
      setSelectedModel(activeModel)
    }
  }, [activeModel])

  const [open, setOpen] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('model_sections_open'))
      return stored || defaultSections.reduce((acc, id) => ({ ...acc, [id]: true }), {})
    } catch {
      return defaultSections.reduce((acc, id) => ({ ...acc, [id]: true }), {})
    }
  })

  useEffect(() => {
    localStorage.setItem('model_sections_open', JSON.stringify(open))
  }, [open])

  const filteredModels = (section) => {
    if (section === 'local') return validModels.filter((m) => m.category === 'local')
    if (section === 'cloud') return validModels.filter((m) => m.category !== 'local')
    return validModels
  }

  const sections = defaultSections
    .map((id) => ({
      id,
      title: id === 'all' ? 'All Models' : id === 'local' ? 'Local' : 'Cloud',
      items: filteredModels(id),
    }))
    .filter((section) => section.items.length > 0)

  const handleSelect = (name) => {
    if (disabled) return
    setSelectedModel(name)
    localStorage.setItem('selectedModel', name)
    onSelect?.(name)
  }

  const providerWarnings = useMemo(() => {
    const entries = Object.entries(providerStatus || {})
    return entries.filter(([, status]) => status && status !== 'ok')
  }, [providerStatus])

  const handleProviderClick = (provider) => {
    onOpenSettings?.(provider)
  }

  if (!sections.length) {
    return (
      <section className="model-selector">
        <header className="panel-header">
          <h2>Models</h2>
        </header>
        <p className="muted">No models available.</p>
      </section>
    )
  }

  return (
    <section className="model-selector">
      <header className="panel-header">
        <h2>Models</h2>
      </header>
      <div className="model-sections">
        {sections.map((section) => (
          <div key={section.id} className="model-section">
            <h4
              className="model-section__header"
              onClick={() => setOpen((prev) => ({ ...prev, [section.id]: !prev[section.id] }))}
            >
              {open[section.id] ? '▼' : '▶'} {section.title} ({section.items.length})
            </h4>
            {open[section.id] && (
              <ul className="model-list">
                {section.items.map((model) => (
                  <li
                    key={model.name}
                    className={model.name === selectedModel ? 'is-active' : ''}
                    onClick={() => handleSelect(model.name)}
                    title={`${model.provider} • ${model.category}`}
                  >
                    <span>{model.name}</span>
                    <span className="provider">{model.provider}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {providerWarnings.length > 0 && (
          <div className="provider-warnings">
            {providerWarnings.map(([provider, status]) => (
              <button
                key={provider}
                type="button"
                className="provider-warning"
                onClick={() => handleProviderClick(provider)}
              >
                {provider} ({status})
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
      category: PropTypes.string,
      available: PropTypes.bool,
      model_status: PropTypes.string,
    }),
  ),
  activeModel: PropTypes.string,
  onSelect: PropTypes.func,
  disabled: PropTypes.bool,
  providerStatus: PropTypes.objectOf(PropTypes.string),
  onOpenSettings: PropTypes.func,
}

ModelSelector.defaultProps = {
  models: [],
  activeModel: '',
  disabled: false,
  providerStatus: {},
  onOpenSettings: undefined,
}
