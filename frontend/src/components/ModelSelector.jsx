import PropTypes from 'prop-types'

export default function ModelSelector({
  models,
  activeModel,
  onSelect,
  disabled,
}) {
  const localModels = models.filter((model) => model.category === 'local')
  const cloudModels = models.filter((model) => model.category !== 'local')

  const renderList = (list, heading) =>
    list.length > 0 && (
      <>
        <h3 className="model-group-heading">{heading}</h3>
        <ul>
          {list.map((model) => (
            <li key={model.name}>
              <label className="radio-row">
                <input
                  type="radio"
                  name="model"
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
                      <span title="Max context tokens">
                        Context: {Intl.NumberFormat().format(model.context_limit)}
                      </span>
                    )}
                    {model.cost_per_1k && (
                      <span title="Approximate cost per 1K input tokens">
                        ${model.cost_per_1k.toFixed(4)}/1K
                      </span>
                    )}
                  </div>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </>
    )

  return (
    <section className="model-selector">
      <header className="panel-header">
        <h2>Models</h2>
      </header>
      {models.length === 0 ? (
        <p className="muted">No models configured.</p>
      ) : (
        <>
          {renderList(localModels, 'Local')}
          {renderList(cloudModels, 'Cloud')}
        </>
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
