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
  tokenUsage,
  selectedMemories,
}) {
  const [draft, setDraft] = useState('')
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!draft.trim()) return
    await onSend?.(draft.trim())
    setDraft('')
  }

  return (
    <section className="chat-panel">
      <header className="panel-header">
        <div>
          <h2>Conversation</h2>
          {tokenUsage && (
            <p className="muted">
              Tokens: {tokenUsage.current} / {tokenUsage.limit}
            </p>
          )}
        </div>
        {isStreaming && onStop ? (
          <button type="button" className="text-button" onClick={onStop}>
            Stop
          </button>
        ) : null}
      </header>

      <div className="chat-body">
        <div className="chat-stream">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              role={message.role}
              content={message.content}
            />
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
          placeholder="Ask Synapse…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          disabled={isStreaming}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
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
  tokenUsage: PropTypes.shape({
    current: PropTypes.number.isRequired,
    limit: PropTypes.number.isRequired,
  }),
  selectedMemories: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string,
      content: PropTypes.string.isRequired,
    }),
  ),
}

ChatPanel.defaultProps = {
  messages: [],
  selectedMemories: [],
  isStreaming: false,
  tokenUsage: null,
}
