import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'

const formatContext = (limit) =>
  limit ? `${Intl.NumberFormat().format(limit)} tokens` : 'context unknown'

const formatCost = (cost) => (cost ? `$${cost.toFixed(4)}/1K` : 'cost unknown')

const radioTitle = (model) => {
  const parts = [
    `${model.provider} • ${model.category === 'local' ? 'local' : 'cloud'}`,
    formatContext(model.context_limit),
    formatCost(model.cost_per_1k),
  ]
  if (model.description) parts.push(model.description)
  return parts.join(' | ')
}

const defaultSections = {
  all: true,
  local: true,
  cloud: true,
}

export default function ModelSelector({
  models,
  activeModel,
  onSelect,
  disabled,
}) {
  const localModels = models.filter((model) => model.category === 'local')
  const cloudModels = models.filter((model) => model.category !== 'local')
  const [sections, setSections] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('model_sections')) || defaultSections
    } catch {
      return defaultSections
    }
  })

  useEffect(() => {
    localStorage.setItem('model_sections', JSON.stringify(sections))
  }, [sections])

  const renderList = (list, heading, key) => (
    <div className="model-collapsible">
      <button
        type="button"
        className="model-collapsible-header"
        onClick={() => setSections((prev) => ({ ...prev, [key]: !prev[key] }))}
      >
        <span>{sections[key] ? '▼' : '▶'}</span>
        <strong>{heading}</strong>
      </button>
      <div className={`model-collapsible-body ${sections[key] ? 'open' : ''}`}>
        {list.length === 0 ? (
          <p className="muted">No models available.</p>
        ) : (
          <ul>
            {list.map((model) => (
              <li key={model.name}>
                <label className="radio-row" title={radioTitle(model)}>
                  <input
                    type="radio"
                    name={`model-${key}`}
                    value={model.name}
                    checked={activeModel === model.name}
                    onChange={() => onSelect?.(model.name)}
                    disabled={disabled || model.description === 'Ollama offline'}
                  />
                  <span>
                    <strong>{model.name}</strong>
                    <em>{model.provider}</em>
                    {model.description && <small>{model.description}</small>}
                    <div className="model-meta">
                      {model.context_limit && (
                        <span>{formatContext(model.context_limit)}</span>
                      )}
                      {model.cost_per_1k && (
                        <span>{formatCost(model.cost_per_1k)}</span>
                      )}
                    </div>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )

  return (
    <section className="model-selector">
      <header className="panel-header">
        <h2>Models</h2>
      </header>
      {models.length === 0 ? (
        <p className="muted">No models configured.</p>
      ) : (
        <div className="model-collapsible-stack">
          {renderList(models, 'All models', 'all')}
          {renderList(localModels, 'Local', 'local')}
          {renderList(cloudModels, 'Cloud', 'cloud')}
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
      description: PropTypes.string,
      default: PropTypes.bool,
      category: PropTypes.string,
    }),
  ),
  activeModel: PropTypes.string,
  onSelect: PropTypes.func,
  disabled: PropTypes.bool,
}

ModelSelector.defaultProps = {
  models: [],
  activeModel: '',
  disabled: false,
}
