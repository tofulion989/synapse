import PropTypes from 'prop-types'
import { useEffect, useMemo, useState } from 'react'

export default function Sidebar({
  isOpen,
  onClose,
  activeModel,
  onOpenConfig,
  onOpenModelModal,
  isModelModalOpen,
  modelButtonRef,
  providerStatus,
  ollamaStatus,
  onRefreshModels,
  statusMessage,
  error,
  tags,
  activeTags,
  onToggleTag,
  onClearTags,
  onCheckDuplicates,
  onCheckContradictions,
}) {
  const [tagsOpen, setTagsOpen] = useState(false)
  const [intelligenceOpen, setIntelligenceOpen] = useState(false)
  const [showAllTags, setShowAllTags] = useState(false)

  useEffect(() => {
    if (!isOpen) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const displayedTags = useMemo(
    () => (showAllTags ? tags : tags.slice(0, 10)),
    [tags, showAllTags],
  )

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/40 transition-opacity md:hidden ${
          isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        className={`fixed top-14 bottom-0 left-0 z-40 w-72 shrink-0 border-r border-gray-300 bg-white shadow-lg transition-transform duration-200 ease-in-out dark:border-gray-700 dark:bg-gray-900 md:static md:top-0 md:h-auto md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="complementary"
        aria-label="Provider and Tags Panel"
      >
        <div className="flex h-full max-h-screen flex-col gap-4 overflow-y-auto border-l border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <section
            className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/40"
            aria-label="Active model controls"
          >
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              Active Model
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
              {activeModel || 'Default routing'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                ref={modelButtonRef}
                className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={onOpenModelModal}
                aria-haspopup="dialog"
                aria-expanded={isModelModalOpen}
                aria-controls="model-modal"
              >
                Change Model…
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={onOpenConfig}
              >
                Manage Models
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={onRefreshModels}
              >
                Refresh
              </button>
            </div>
          </section>

          <section
            className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/40"
            aria-label="Provider status"
          >
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              Provider Status
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-200">
              <li className="flex items-center justify-between">
                <span>ollama</span>
                <span className="font-medium">{ollamaStatus || 'unknown'}</span>
              </li>
              {(providerStatus || []).map(({ provider, status, message }) => (
                <li key={provider} className="flex flex-col">
                  <div className="flex items-center justify-between">
                    <span>{provider}</span>
                    <span className="font-medium">{status}</span>
                  </div>
                  {message && <p className="text-xs text-slate-500 dark:text-slate-300">{message}</p>}
                </li>
              ))}
            </ul>
          </section>

          <section
            className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/40"
            aria-label="Tags and intelligence tools"
          >
            <details open={tagsOpen} onToggle={(event) => setTagsOpen(event.target.open)}>
              <summary
                aria-controls="sidebar-tags"
                className="flex cursor-pointer list-none items-center justify-between rounded-xl px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Tags
                <span className="text-xs text-slate-500 dark:text-slate-400">{tagsOpen ? '▲' : '▼'}</span>
              </summary>
              <div id="sidebar-tags" className="mt-3 space-y-2">
                {tags.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">No tags yet.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {displayedTags.map(({ tag, count }) => {
                        const isActive = activeTags.includes(tag)
                        return (
                          <button
                            key={tag}
                            type="button"
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${
                              isActive
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-100'
                                : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:bg-slate-800'
                            }`}
                            aria-pressed={isActive}
                            onClick={() => onToggleTag?.(tag)}
                          >
                            {tag} <span className="ml-1 text-[10px] opacity-70">{count}</span>
                          </button>
                        )
                      })}
                    </div>
                    {tags.length > 10 && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                        onClick={() => setShowAllTags((prev) => !prev)}
                      >
                        {showAllTags ? 'Show fewer' : `Show ${tags.length - 10} more`}
                      </button>
                    )}
                    {activeTags.length > 0 && (
                      <button
                        type="button"
                        className="text-xs text-slate-500 hover:underline dark:text-slate-300"
                        onClick={onClearTags}
                      >
                        Clear tags
                      </button>
                    )}
                  </>
                )}
              </div>
            </details>

            <details
              className="mt-4"
              open={intelligenceOpen}
              onToggle={(event) => setIntelligenceOpen(event.target.open)}
            >
              <summary
                aria-controls="sidebar-intelligence"
                className="flex cursor-pointer list-none items-center justify-between rounded-xl px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Intelligence
                <span className="text-xs text-slate-500 dark:text-slate-400">{intelligenceOpen ? '▲' : '▼'}</span>
              </summary>
              <div id="sidebar-intelligence" className="mt-3 space-y-2 text-sm">
                <button
                  type="button"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-left text-slate-700 transition hover:border-indigo-300 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:bg-slate-800"
                  onClick={onCheckDuplicates}
                >
                  Find duplicates
                </button>
                <button
                  type="button"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-left text-slate-700 transition hover:border-indigo-300 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:bg-slate-800"
                  onClick={onCheckContradictions}
                >
                  Check contradictions
                </button>
              </div>
            </details>
          </section>

          <section
            className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/40"
            aria-label="Session status"
          >
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              Session
            </h2>
            <div className="mt-2 space-y-2 text-sm">
              {error && <p className="text-rose-600 dark:text-rose-400">Error: {error}</p>}
              {statusMessage && <p className="text-slate-600 dark:text-slate-200">{statusMessage}</p>}
              {!error && !statusMessage && (
                <p className="text-slate-500 dark:text-slate-300">No recent activity.</p>
              )}
            </div>
          </section>
        </div>
      </aside>
    </>
  )
}

Sidebar.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  activeModel: PropTypes.string,
  onOpenConfig: PropTypes.func,
  onOpenModelModal: PropTypes.func,
  isModelModalOpen: PropTypes.bool,
  modelButtonRef: PropTypes.shape({ current: PropTypes.any }),
  providerStatus: PropTypes.arrayOf(
    PropTypes.shape({
      provider: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
      message: PropTypes.string,
    }),
  ),
  ollamaStatus: PropTypes.string,
  onRefreshModels: PropTypes.func,
  statusMessage: PropTypes.string,
  error: PropTypes.string,
  tags: PropTypes.arrayOf(
    PropTypes.shape({
      tag: PropTypes.string.isRequired,
      count: PropTypes.number.isRequired,
    }),
  ),
  activeTags: PropTypes.arrayOf(PropTypes.string),
  onToggleTag: PropTypes.func,
  onClearTags: PropTypes.func,
  onCheckDuplicates: PropTypes.func,
  onCheckContradictions: PropTypes.func,
}

Sidebar.defaultProps = {
  isOpen: true,
  onClose: undefined,
  activeModel: '',
  onOpenConfig: undefined,
  onOpenModelModal: undefined,
  isModelModalOpen: false,
  modelButtonRef: undefined,
  providerStatus: [],
  ollamaStatus: 'unknown',
  onRefreshModels: undefined,
  statusMessage: null,
  error: null,
  tags: [],
  activeTags: [],
  onToggleTag: undefined,
  onClearTags: undefined,
  onCheckDuplicates: undefined,
  onCheckContradictions: undefined,
}
