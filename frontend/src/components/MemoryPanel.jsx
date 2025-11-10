import { useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'

const CATEGORY_FILTER_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'project', label: 'Project' },
  { value: 'idea', label: 'Idea' },
  { value: 'experiment', label: 'Experiment' },
  { value: 'note', label: 'Note' },
  { value: 'other', label: 'Other' },
  { value: 'general', label: 'General' },
]

const CATEGORY_FORM_OPTIONS = [
  { value: 'project', label: 'Project' },
  { value: 'idea', label: 'Idea' },
  { value: 'experiment', label: 'Experiment' },
  { value: 'note', label: 'Note' },
  { value: 'other', label: 'Other' },
]

const INTENT_OPTIONS = [
  { value: 'inform', label: 'Inform' },
  { value: 'query', label: 'Query' },
  { value: 'warn', label: 'Warn' },
  { value: 'inspire', label: 'Inspire' },
]

const DEFAULT_ROW_HEIGHT = 120
const OVERSCAN_COUNT = 6

const formatCategory = (value) => {
  if (!value) return 'General'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

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
  onOpenConfig,
  onSelectAll,
  searchQuery,
  loading,
}) {
  const [formState, setFormState] = useState({
    title: '',
    content: '',
    tags: '',
    category: 'project',
    intent: 'inform',
  })
  const [duplicateSelection, setDuplicateSelection] = useState({})
  const [searchInput, setSearchInput] = useState(searchQuery || '')
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery || '')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [expandedRows, setExpandedRows] = useState({})
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [virtualRerender, setVirtualRerender] = useState(0)

  const memoryLookup = useMemo(
    () => Object.fromEntries(memories.map((memory) => [memory.id, memory])),
    [memories],
  )
  const selectedDuplicateIds = useMemo(
    () => Object.entries(duplicateSelection).filter(([, checked]) => checked).map(([id]) => id),
    [duplicateSelection],
  )
  const isSelected = useMemo(() => new Set(selectedIds), [selectedIds])
  const allSelected = useMemo(
    () => memories.length > 0 && memories.every((memory) => isSelected.has(memory.id)),
    [isSelected, memories],
  )
  const partiallySelected = selectedIds.length > 0 && !allSelected

  const searchInputRef = useRef(null)
  const listParentRef = useRef(null)
  const rowHeightsRef = useRef({})
  const selectAllRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    setSearchInput(searchQuery || '')
    setDebouncedQuery(searchQuery || '')
  }, [searchQuery])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput)
    }, 250)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    onSearch?.(debouncedQuery)
  }, [debouncedQuery, onSearch])

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(() => {
    setDuplicateSelection({})
  }, [duplicateGroups])

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = partiallySelected
    }
  }, [partiallySelected])

  useEffect(() => {
    const container = listParentRef.current
    if (!container) return undefined
    const handleScroll = () => setScrollTop(container.scrollTop)
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setViewportHeight(entry.contentRect.height)
      }
    })
    container.addEventListener('scroll', handleScroll)
    resizeObserver.observe(container)
    handleScroll()
    setViewportHeight(container.clientHeight)
    return () => {
      container.removeEventListener('scroll', handleScroll)
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    const ids = new Set(memories.map((memory) => memory.id))
    Object.keys(rowHeightsRef.current).forEach((id) => {
      if (!ids.has(id)) {
        delete rowHeightsRef.current[id]
      }
    })
  }, [memories])

  const normalizedQuery = debouncedQuery.trim().toLowerCase()
  const filteredMemories = useMemo(() => {
    return memories.filter((memory) => {
      const categoryValue = (memory.category || 'general').toLowerCase()
      if (categoryFilter && categoryValue !== categoryFilter) {
        return false
      }
      if (activeTags.length) {
        const tagsLower = (memory.tags || []).map((tag) => tag.toLowerCase())
        const hasTag = activeTags.some((tag) => tagsLower.includes(tag.toLowerCase()))
        if (!hasTag) return false
      }
      if (!normalizedQuery) return true
      const haystacks = [
        memory.title || '',
        memory.content || '',
        (memory.tags || []).join(' '),
        memory.category || '',
        memory.intent || '',
      ]
      return haystacks.some((value) => value.toLowerCase().includes(normalizedQuery))
    })
  }, [memories, categoryFilter, activeTags, normalizedQuery])

  const heights = useMemo(() => {
    return filteredMemories.map((memory) => rowHeightsRef.current[memory.id] || DEFAULT_ROW_HEIGHT)
  }, [filteredMemories, virtualRerender])

  const prefixSums = useMemo(() => {
    const sums = [0]
    heights.forEach((height) => {
      sums.push(sums[sums.length - 1] + height)
    })
    return sums
  }, [heights])

  const totalHeight = prefixSums[prefixSums.length - 1] || 0

  const findIndexForOffset = (offset) => {
    let low = 0
    let high = prefixSums.length - 1
    while (low < high) {
      const mid = Math.floor((low + high) / 2)
      if (prefixSums[mid] <= offset) {
        low = mid + 1
      } else {
        high = mid
      }
    }
    return Math.max(0, low - 1)
  }

  const startIndex = Math.max(0, findIndexForOffset(scrollTop) - OVERSCAN_COUNT)
  const endIndex = Math.min(
    filteredMemories.length,
    findIndexForOffset(scrollTop + viewportHeight) + 1 + OVERSCAN_COUNT,
  )

  const visibleItems = []
  for (let index = startIndex; index < endIndex; index += 1) {
    visibleItems.push({
      index,
      memory: filteredMemories[index],
      offset: prefixSums[index],
    })
  }

  const measureRow = (id) => (node) => {
    if (!node) return
    const height = node.getBoundingClientRect().height
    if (!height) return
    if (Math.abs(height - (rowHeightsRef.current[id] || 0)) > 1) {
      rowHeightsRef.current[id] = height
      setVirtualRerender((value) => value + 1)
    }
  }

  const toggleExpand = (id) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleDuplicateToggle = (memoryId) => {
    setDuplicateSelection((prev) => ({
      ...prev,
      [memoryId]: !prev[memoryId],
    }))
  }

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!formState.content.trim()) return
    const { category, intent } = formState
    const tagList = formState.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)

    await onCreateMemory?.({
      title: formState.title.trim() || null,
      content: formState.content.trim(),
      tags: tagList,
      category,
      intent,
    })
    setFormState({ title: '', content: '', tags: '', category, intent })
  }

  const tokenEstimate = Math.max(0, Math.ceil(formState.content.length / 4))

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

  const visibleCountLabel =
    filteredMemories.length === memories.length
      ? `${filteredMemories.length} memories`
      : `${filteredMemories.length} filtered / ${memories.length}`

  return (
    <section className="memory-panel flex h-full flex-col overflow-hidden">
      <header className="panel-header">
        <h2>Memory Spine</h2>
        <span className="text-xs text-slate-500 dark:text-slate-300">{visibleCountLabel}</span>
      </header>
      <div className="flex flex-1 flex-col gap-4 overflow-hidden">
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 text-sm dark:border-slate-700">
            <div className="flex flex-wrap gap-2">
              <input
                ref={searchInputRef}
                type="search"
                placeholder="Search memories..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                aria-label="Filter by category"
              >
                {CATEGORY_FILTER_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-200">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={(event) => onSelectAll?.(event.target.checked)}
                />
                Select All
              </label>
              <span>Press Ctrl + K to focus search</span>
            </div>
          </div>
          {suggestions?.length > 0 && (
            <div className="border-b border-slate-200 px-4 py-3 text-sm dark:border-slate-700">
              <div className="mb-2 font-semibold text-slate-600 dark:text-slate-300">Suggested Memories</div>
              <div className="space-y-2">
                {suggestions.map(({ memory, score }) => (
                  <div
                    key={memory.id}
                    className="flex flex-col rounded-xl border border-slate-200 bg-white/70 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/50 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <strong>{memory.title || memory.id.slice(0, 8)}</strong>
                      <p className="text-slate-600 dark:text-slate-300">{memory.content}</p>
                      <small className="text-slate-400 dark:text-slate-500">Score: {score ? score.toFixed(2) : 'n/a'}</small>
                    </div>
                    <button
                      type="button"
                      className="mt-2 w-full rounded-md bg-indigo-600 px-3 py-1 text-sm font-medium text-white transition hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 lg:mt-0 lg:w-auto"
                      onClick={() => onApproveSuggestion?.(memory.id)}
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex-1 overflow-hidden px-2 pb-4">
            <div
              ref={listParentRef}
              className="relative h-full overflow-y-auto rounded-2xl bg-white/40 dark:bg-slate-900/20"
              role="region"
              aria-label="Memory list"
            >
              {loading ? (
                <p className="p-4 text-sm text-slate-500 dark:text-slate-300">Loading memories…</p>
              ) : filteredMemories.length === 0 ? (
                <p className="p-4 text-sm text-slate-500 dark:text-slate-300">
                  No memories found — add your first note below.
                </p>
              ) : (
                <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
                  {visibleItems.map(({ memory, offset }) => {
                    const isExpanded = expandedRows[memory.id]
                    const displayContent =
                      isExpanded || (memory.content || '').length <= 100
                        ? memory.content
                        : `${memory.content?.slice(0, 100)}…`
                    return (
                      <div
                        key={memory.id}
                        ref={measureRow(memory.id)}
                        className="absolute left-0 right-0 border-b border-slate-200 px-3 py-3 dark:border-slate-800"
                        style={{ transform: `translateY(${offset}px)` }}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected.has(memory.id)}
                            onChange={() => onToggleMemory?.(memory.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                                {memory.title || memory.id.slice(0, 8)}
                              </h4>
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                {formatCategory(memory.category)}
                              </span>
                              {memory.intent && (
                                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                                  {memory.intent}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{displayContent}</p>
                            {memory.content?.length > 100 && (
                              <button
                                type="button"
                                className="mt-1 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                                onClick={() => toggleExpand(memory.id)}
                              >
                                {isExpanded ? 'Collapse' : 'Expand'}
                              </button>
                            )}
                            {memory.tags?.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {memory.tags.map((tag) => (
                                  <span
                                    key={`${memory.id}-${tag}`}
                                    className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <details className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
            <summary className="cursor-pointer text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:text-slate-200">
              Tag Filters
            </summary>
            <div className="mt-3 space-y-2">
              {tags.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-300">No tags yet.</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(({ tag, count }) => (
                      <button
                        key={tag}
                        type="button"
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          activeTags.includes(tag)
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-100'
                            : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:bg-slate-800'
                        }`}
                        onClick={() => onToggleTag?.(tag)}
                      >
                        {tag}
                        <span className="ml-1 text-[10px] opacity-70">{count}</span>
                      </button>
                    ))}
                  </div>
                  {activeTags.length > 0 && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                      onClick={onClearTags}
                    >
                      Clear tags
                    </button>
                  )}
                </>
              )}
            </div>
          </details>

          <details className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
            <summary className="cursor-pointer text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:text-slate-200">
              Intelligence
            </summary>
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                <button type="button" className="text-button" onClick={onCheckDuplicates}>
                  Find duplicates
                </button>
                <button type="button" className="text-button" onClick={onCheckContradictions}>
                  Check contradictions
                </button>
              </div>
              {duplicateGroups?.length > 0 && (
                <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  {duplicateGroups.map((group) => (
                    <div key={group.ids.join('-')} className="space-y-1 text-sm">
                      <div className="text-xs text-slate-500 dark:text-slate-300">
                        Score: {group.score.toFixed(2)}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {group.ids.map((id) => (
                          <label key={id} className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-200">
                            <input
                              type="checkbox"
                              checked={!!duplicateSelection[id]}
                              onChange={() => handleDuplicateToggle(id)}
                            />
                            <span>{memoryLookup[id]?.title || id.slice(0, 8)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="primary w-full"
                    disabled={selectedDuplicateIds.length < 2}
                    onClick={() => onMergeDuplicates?.(selectedDuplicateIds)}
                  >
                    Merge Selected
                  </button>
                </div>
              )}
              {contradictionReport && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500 dark:bg-amber-900/20 dark:text-amber-100">
                  <strong className="block text-xs uppercase tracking-wide">Contradictions</strong>
                  <p>{contradictionReport}</p>
                </div>
              )}
            </div>
          </details>

          <div
            className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/40"
            data-settings-panel
          >
            <div className="panel-actions">
              <div className="memory-toolbar">
                <button type="button" className="text-button" onClick={onRefresh} disabled={loading}>
                  Refresh
                </button>
                <button type="button" className="text-button" onClick={onExport}>
                  Export
                </button>
                <button type="button" className="text-button" onClick={handleImportClick}>
                  Import
                </button>
                <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleFileChange} />
              </div>
            </div>
            <form className="memory-form mt-4 space-y-3" onSubmit={handleSubmit}>
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-200">Add Memory</h3>
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  name="title"
                  type="text"
                  placeholder="Optional title"
                  value={formState.title}
                  onChange={handleInputChange}
                />
                <div className="flex gap-2">
                  <select
                    name="category"
                    value={formState.category}
                    onChange={handleInputChange}
                    className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {CATEGORY_FORM_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    name="intent"
                    value={formState.intent}
                    onChange={handleInputChange}
                    className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {INTENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
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
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-300">
                <span>Token estimate: {tokenEstimate}</span>
                <button type="button" className="text-button" onClick={onOpenConfig}>
                  Model Configuration
                </button>
              </div>
              <button type="submit" className="primary" disabled={loading}>
                Save Memory
              </button>
            </form>
          </div>
        </div>
      </div>
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
      category: PropTypes.string,
      intent: PropTypes.string,
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
  duplicateGroups: PropTypes.arrayOf(
    PropTypes.shape({
      ids: PropTypes.arrayOf(PropTypes.string).isRequired,
      score: PropTypes.number.isRequired,
    }),
  ),
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
  onOpenConfig: PropTypes.func,
  onSelectAll: PropTypes.func,
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
  onToggleMemory: undefined,
  onRefresh: undefined,
  onCreateMemory: undefined,
  onSearch: undefined,
  onToggleTag: undefined,
  onClearTags: undefined,
  onExport: undefined,
  onImport: undefined,
  onApproveSuggestion: undefined,
  onCheckDuplicates: undefined,
  onMergeDuplicates: undefined,
  onCheckContradictions: undefined,
  onOpenConfig: undefined,
  onSelectAll: undefined,
  searchQuery: '',
  loading: false,
}
