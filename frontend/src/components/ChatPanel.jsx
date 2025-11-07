import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'

function MessageBubble({ role, content }) {
  return (
    <div className={`chat-bubble ${role}`}>
      <div className="bubble-role">{role}</div>
      <div className="bubble-content">{content}</div>
    </div>
  )
}

MessageBubble.propTypes = {
  role: PropTypes.string.isRequired,
  content: PropTypes.string.isRequired,
}

export default function ChatPanel({
  messages,
  onSend,
  onStop,
  isStreaming,
  selectedMemories,
  onSaveMemory,
  systemPrompt,
  onSystemPromptChange,
  systemExpanded,
  onToggleSystem,
  usageStats,
  activeModel,
  showStatsDetails,
  onToggleStats,
}) {
  const [draft, setDraft] = useState('')
  const endRef = useRef(null)
  const textareaRef = useRef(null)
  const systemRef = useRef(null)
  const MAX_LINES = 6
  const SYSTEM_MAX_LINES = 6

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    const lineHeight =
      typeof window !== 'undefined'
        ? parseFloat(window.getComputedStyle(textarea).lineHeight) || 20
        : 20
    const maxHeight = lineHeight * MAX_LINES
    const newHeight = Math.min(textarea.scrollHeight, maxHeight)
    textarea.style.height = `${newHeight}px`
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [draft])

  useEffect(() => {
    if (!systemExpanded) return
    const textarea = systemRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    const lineHeight =
      typeof window !== 'undefined'
        ? parseFloat(window.getComputedStyle(textarea).lineHeight) || 20
        : 20
    const maxHeight = lineHeight * SYSTEM_MAX_LINES
    const newHeight = Math.min(textarea.scrollHeight, maxHeight)
    textarea.style.height = `${newHeight}px`
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [systemPrompt, systemExpanded])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!draft.trim()) return
    await onSend?.(draft.trim())
    setDraft('')
  }

  const formatTokens = (value) => {
    if (value === null || value === undefined) return '—'
    return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString()
  }

  const usagePercent = usageStats?.percent_used
  const usageClass =
    usagePercent == null
      ? 'usage-safe'
      : usagePercent > 90
      ? 'usage-high'
      : usagePercent > 70
      ? 'usage-warn'
      : 'usage-safe'
  const contextLabel = formatTokens(usageStats?.token_count)
  const limitLabel = formatTokens(usageStats?.model_limit)
  const percentLabel = usagePercent == null ? '—' : `${usagePercent}%`

  return (
    <section className="chat-panel">
      <header className="panel-header">
        <div>
          <h2>Conversation</h2>
        </div>
        {isStreaming && onStop ? (
          <button type="button" className="text-button" onClick={onStop}>
            Stop
          </button>
        ) : null}
      </header>

      <div className="system-block">
        <button type="button" className="text-button" onClick={onToggleSystem}>
          {systemExpanded ? 'Hide System Prompt' : 'Show System Prompt'}
        </button>
        {systemExpanded && (
          <textarea
            ref={systemRef}
            className="system-textarea"
            placeholder="Provide high-level guidance for Synapse…"
            value={systemPrompt}
            onChange={(event) => onSystemPromptChange?.(event.target.value)}
            rows={2}
          />
        )}
      </div>

      <div className="usage-bar">
        <span className={`usage-pill ${usageClass}`}>
          Context: {contextLabel} / {limitLabel} tokens ({percentLabel})
        </span>
        <div className="usage-meta">
          <span>Model: {activeModel || 'default'}</span>
          <button type="button" className="usage-info" onClick={onToggleStats}>
            ⓘ
          </button>
        </div>
      </div>
      {showStatsDetails && (
        <div className="usage-details">
          Includes the system prompt, manually selected memories, and recent chat history.
        </div>
      )}

      <div className="chat-body">
        <div className="chat-stream">
          {messages.map((message) => (
            <div key={message.id} className="chat-message-row">
              <MessageBubble role={message.role} content={message.content} />
              {message.role === 'assistant' && (
                <button
                  type="button"
                  className="save-memory"
                  onClick={() => onSaveMemory?.(message)}
                  title="Save this response as memory"
                >
                  Save
                </button>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {selectedMemories.length > 0 && (
          <aside className="chat-context">
            <h3>Injected Context</h3>
            <ul>
              {selectedMemories.map((memory) => (
                <li key={memory.id}>
                  <strong>{memory.title || memory.id.slice(0, 8)}</strong>
                  <p>{memory.content}</p>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      <form className="chat-input" onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          placeholder="Ask Synapse…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          disabled={isStreaming}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              handleSubmit(event)
            }
          }}
        />
        <div className="chat-actions">
          <button type="submit" className="primary" disabled={isStreaming}>
            Send
          </button>
        </div>
      </form>
    </section>
  )
}

ChatPanel.propTypes = {
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      role: PropTypes.string.isRequired,
      content: PropTypes.string.isRequired,
    }),
  ),
  onSend: PropTypes.func,
  onStop: PropTypes.func,
  isStreaming: PropTypes.bool,
  selectedMemories: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string,
      content: PropTypes.string.isRequired,
    }),
  ),
  onSaveMemory: PropTypes.func,
  systemPrompt: PropTypes.string,
  onSystemPromptChange: PropTypes.func,
  systemExpanded: PropTypes.bool,
  onToggleSystem: PropTypes.func,
  usageStats: PropTypes.shape({
    token_count: PropTypes.number,
    model_limit: PropTypes.number,
    percent_used: PropTypes.number,
  }),
  activeModel: PropTypes.string,
  showStatsDetails: PropTypes.bool,
  onToggleStats: PropTypes.func,
}

ChatPanel.defaultProps = {
  messages: [],
  selectedMemories: [],
  isStreaming: false,
  systemPrompt: '',
  systemExpanded: false,
  usageStats: null,
  activeModel: '',
  showStatsDetails: false,
}
