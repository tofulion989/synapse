import PropTypes from 'prop-types'

export default function ModelSelector({
  models,
  activeModel,
  onSelect,
  disabled,
}) {
  return (
    <section className="model-selector">
      <header className="panel-header">
        <h2>Models</h2>
      </header>
      {models.length === 0 ? (
        <p className="muted">No models configured.</p>
      ) : (
        <ul>
          {models.map((model) => (
            <li key={model.name}>
              <label className="radio-row">
                <input
                  type="radio"
                  name="model"
                  value={model.name}
                  checked={activeModel === model.name}
                  onChange={() => onSelect?.(model.name)}
                  disabled={disabled}
                />
                <span>
                  <strong>{model.name}</strong>
                  <em>{model.provider}</em>
                </span>
              </label>
            </li>
          ))}
        </ul>
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
