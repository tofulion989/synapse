import { useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'

const placeholderTags = (tags = []) =>
  tags.map((tag) => tag.startsWith('#') ? tag : `#${tag}`).join(' ')

export default function MemoryPanel({
  memories,
  selectedIds,
  tags,
  activeTags,
  suggestions,
  duplicateGroups,
  contradictionReport,
  onToggleMemory,
  onRefresh,
  onCreateMemory,
  onSearch,
  onToggleTag,
  onClearTags,
  onExport,
  onImport,
  onApproveSuggestion,
  onCheckDuplicates,
  onMergeDuplicates,
  onCheckContradictions,
  searchQuery,
  loading,
}) {
  const [formState, setFormState] = useState({
    title: '',
    content: '',
    tags: '',
  })
  const fileInputRef = useRef(null)

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

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      await onImport?.(file)
    } finally {
      event.target.value = ''
    }
  }

  return (
    <section className="memory-panel">
      <header className="panel-header">
        <h2>Memory Spine</h2>
        <div className="panel-actions">
          <div className="memory-toolbar">
            <button
              type="button"
              className="text-button"
              onClick={onRefresh}
              disabled={loading}
            >
              Refresh
            </button>
            <button type="button" className="text-button" onClick={onExport}>
              Export
            </button>
            <button type="button" className="text-button" onClick={handleImportClick}>
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              hidden
              onChange={handleFileChange}
            />
          </div>
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

      {suggestions?.length > 0 && (
        <div className="suggestions-panel">
          <div className="tag-filter-header">
            <span>Suggested Memories</span>
          </div>
          <div className="suggestion-list">
            {suggestions.map(({ memory, score }) => (
              <div key={memory.id} className="suggestion-item">
                <div>
                  <strong>{memory.title || memory.id.slice(0, 8)}</strong>
                  <p>{memory.content}</p>
                  <small>Score: {score ? score.toFixed(2) : 'n/a'}</small>
                </div>
                <button
                  type="button"
                  className="primary"
                  onClick={() => onApproveSuggestion?.(memory.id)}
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tags.length > 0 && (
        <div className="memory-tag-filters">
          <div className="tag-filter-header">
            <span>Tags</span>
            {activeTags.length > 0 && (
              <button type="button" className="text-button" onClick={onClearTags}>
                Clear
              </button>
            )}
          </div>
          <div className="tag-chip-row">
            {tags.map(({ tag, count }) => (
              <button
                key={tag}
                type="button"
                className={`tag-chip ${activeTags.includes(tag) ? 'is-active' : ''}`}
                onClick={() => onToggleTag?.(tag)}
              >
                {tag}
                <span>{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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

      <div className="intelligence-panel">
        <h3>Intelligence</h3>
        <div className="intelligence-actions">
          <button type="button" className="text-button" onClick={onCheckDuplicates}>
            Find duplicates
          </button>
          <button type="button" className="text-button" onClick={onCheckContradictions}>
            Check contradictions
          </button>
        </div>
        {duplicateGroups?.length > 0 && (
          <div className="duplicate-list">
            {duplicateGroups.map((group, index) => (
              <div key={`${group.join('-')}-${index}`} className="duplicate-row">
                <span>{group.join(' + ')}</span>
                <button type="button" className="text-button" onClick={() => onMergeDuplicates?.(group)}>
                  Merge
                </button>
              </div>
            ))}
          </div>
        )}
        {contradictionReport && (
          <div className="contradiction-report">
            <strong>Contradictions</strong>
            <p>{contradictionReport}</p>
          </div>
        )}
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
  tags: PropTypes.arrayOf(
    PropTypes.shape({
      tag: PropTypes.string.isRequired,
      count: PropTypes.number.isRequired,
    }),
  ),
  activeTags: PropTypes.arrayOf(PropTypes.string),
  suggestions: PropTypes.arrayOf(
    PropTypes.shape({
      memory: PropTypes.shape({
        id: PropTypes.string.isRequired,
        content: PropTypes.string.isRequired,
      }),
      score: PropTypes.number,
    }),
  ),
  duplicateGroups: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)),
  contradictionReport: PropTypes.string,
  onToggleMemory: PropTypes.func,
  onRefresh: PropTypes.func,
  onCreateMemory: PropTypes.func,
  onSearch: PropTypes.func,
  onToggleTag: PropTypes.func,
  onClearTags: PropTypes.func,
  onExport: PropTypes.func,
  onImport: PropTypes.func,
  onApproveSuggestion: PropTypes.func,
  onCheckDuplicates: PropTypes.func,
  onMergeDuplicates: PropTypes.func,
  onCheckContradictions: PropTypes.func,
  searchQuery: PropTypes.string,
  loading: PropTypes.bool,
}

MemoryPanel.defaultProps = {
  memories: [],
  selectedIds: [],
  tags: [],
  activeTags: [],
  suggestions: [],
  duplicateGroups: [],
  contradictionReport: '',
  searchQuery: '',
  loading: false,
}
