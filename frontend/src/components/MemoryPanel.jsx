import { useMemo, useState } from 'react'
import PropTypes from 'prop-types'

const placeholderTags = (tags = []) =>
  tags.map((tag) => tag.startsWith('#') ? tag : `#${tag}`).join(' ')

export default function MemoryPanel({
  memories,
  selectedIds,
  onToggleMemory,
  onRefresh,
  onCreateMemory,
  onSearch,
  searchQuery,
  loading,
}) {
  const [formState, setFormState] = useState({
    title: '',
    content: '',
    tags: '',
  })

  const isSelected = useMemo(() => new Set(selectedIds), [selectedIds])

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!formState.content.trim()) return

    const tags = formState.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)

    try {
      await onCreateMemory?.({
        title: formState.title.trim() || null,
        content: formState.content.trim(),
        tags,
      })
      setFormState({ title: '', content: '', tags: '' })
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <section className="memory-panel">
      <header className="panel-header">
        <h2>Memory Spine</h2>
        <div className="panel-actions">
          <button
            type="button"
            className="text-button"
            onClick={onRefresh}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </header>

      <div className="memory-search">
        <input
          type="search"
          placeholder="Search memories…"
          value={searchQuery}
          onChange={(event) => onSearch?.(event.target.value)}
        />
      </div>

      <div className="memory-list">
        {loading && <p className="muted">Loading memories…</p>}
        {!loading && memories.length === 0 && (
          <p className="muted">No memories yet — add your first note below.</p>
        )}
        {!loading &&
          memories.map((memory) => (
            <label key={memory.id} className="memory-item">
              <input
                type="checkbox"
                checked={isSelected.has(memory.id)}
                onChange={() => onToggleMemory?.(memory.id)}
              />
              <div className="memory-body">
                <div className="memory-title">
                  {memory.title || memory.id.slice(0, 8)}
                </div>
                <div className="memory-content">{memory.content}</div>
                {memory.tags?.length > 0 && (
                  <div className="memory-tags">
                    {placeholderTags(memory.tags)}
                  </div>
                )}
              </div>
            </label>
          ))}
      </div>

      <form className="memory-form" onSubmit={handleSubmit}>
        <h3>Add Memory</h3>
        <input
          name="title"
          type="text"
          placeholder="Optional title"
          value={formState.title}
          onChange={handleInputChange}
        />
        <textarea
          name="content"
          placeholder="What do you want to remember?"
          value={formState.content}
          onChange={handleInputChange}
          rows={4}
        />
        <input
          name="tags"
          type="text"
          placeholder="Tags (comma separated)"
          value={formState.tags}
          onChange={handleInputChange}
        />
        <button type="submit" className="primary" disabled={loading}>
          Save Memory
        </button>
      </form>
    </section>
  )
}

MemoryPanel.propTypes = {
  memories: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string,
      content: PropTypes.string.isRequired,
      tags: PropTypes.arrayOf(PropTypes.string),
    }),
  ),
  selectedIds: PropTypes.arrayOf(PropTypes.string),
  onToggleMemory: PropTypes.func,
  onRefresh: PropTypes.func,
  onCreateMemory: PropTypes.func,
  onSearch: PropTypes.func,
  searchQuery: PropTypes.string,
  loading: PropTypes.bool,
}

MemoryPanel.defaultProps = {
  memories: [],
  selectedIds: [],
  searchQuery: '',
  loading: false,
}
