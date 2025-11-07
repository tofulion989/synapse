import PropTypes from 'prop-types'

const formatContext = (limit) =>
  limit ? `${Intl.NumberFormat().format(limit)} tokens` : 'context unknown'

const formatCost = (cost) => (cost ? `$${cost.toFixed(4)}/1K` : 'cost unknown')

const optionTitle = (model) => {
  const parts = [
    `${model.provider} · ${model.category === 'local' ? 'local' : 'cloud'}`,
    formatContext(model.context_limit),
    formatCost(model.cost_per_1k),
  ]
  if (model.description) parts.push(model.description)
  return parts.join(' | ')
}

export default function ModelSelector({
  models,
  activeModel,
  onSelect,
  disabled,
}) {
  const localModels = models.filter((model) => model.category === 'local')
  const cloudModels = models.filter((model) => model.category !== 'local')

  const renderDropdown = (list, label) => (
    <label className="model-dropdown">
      <span>{label}</span>
      <select
        value={
          list.some((model) => model.name === activeModel) ? activeModel : ''
        }
        onChange={(event) => onSelect?.(event.target.value)}
        disabled={disabled || list.length === 0}
      >
        <option value="" disabled>
          {list.length === 0 ? 'No options' : 'Select model'}
        </option>
        {list.map((model) => (
          <option key={model.name} value={model.name} title={optionTitle(model)}>
            {model.name} ({model.provider})
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <section className="model-selector">
      <header className="panel-header">
        <h2>Models</h2>
      </header>
      {models.length === 0 ? (
        <p className="muted">No models configured.</p>
      ) : (
        <div className="model-selectors">
          <label className="model-dropdown">
            <span>All Models</span>
            <select
              value={activeModel}
              onChange={(event) => onSelect?.(event.target.value)}
              disabled={disabled}
            >
              <option value="" disabled>
                Choose a model
              </option>
              {models.map((model) => (
                <option
                  key={model.name}
                  value={model.name}
                  title={optionTitle(model)}
                >
                  {model.name} ({model.provider})
                </option>
              ))}
            </select>
          </label>
          {renderDropdown(localModels, 'Local')}
          {renderDropdown(cloudModels, 'Cloud')}
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
