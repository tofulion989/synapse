import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

import ChatPanel from './components/ChatPanel'
import MemoryPanel from './components/MemoryPanel'
import ModelSelector from './components/ModelSelector'
import { useSynapseApi } from './hooks/useSynapseApi'

const introMessages = [
  {
    id: 'msg-001',
    role: 'system',
    content: 'You are Synapse, the unified AI command console.',
  },
  {
    id: 'msg-002',
    role: 'assistant',
    content:
      'Ready when you are. Select memories to inject context and choose the model on the left.',
  },
]

const randomId = (prefix) => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function App() {
  const {
    models,
    memories,
    loading,
    error,
    refreshModels,
    refreshMemories,
    addMemory,
    sendChat,
    streamChat,
    setError,
  } = useSynapseApi()

  const [selectedMemoryIds, setSelectedMemoryIds] = useState([])
  const [messages, setMessages] = useState(introMessages)
  const [activeModel, setActiveModel] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusMessage, setStatusMessage] = useState(null)
  const controllerRef = useRef(null)

  useEffect(() => {
    refreshModels()
    refreshMemories()
  }, [refreshModels, refreshMemories])

  useEffect(() => {
    if (!models.length) return
    setActiveModel((current) => {
      if (current) return current
      const preferred = models.find((model) => model.default)
      return preferred?.name ?? models[0].name
    })
  }, [models])

  useEffect(() => {
    const timeout = setTimeout(() => {
      refreshMemories({ query: searchQuery })
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery, refreshMemories])

  useEffect(() => {
    setSelectedMemoryIds((previous) =>
      previous.filter((id) => memories.some((memory) => memory.id === id)),
    )
  }, [memories])

  useEffect(
    () => () => {
      controllerRef.current?.abort()
    },
    [],
  )

  const selectedMemories = useMemo(
    () => memories.filter((memory) => selectedMemoryIds.includes(memory.id)),
    [memories, selectedMemoryIds],
  )

  const handleSend = async (text) => {
    const trimmed = text.trim()
    if (!trimmed) return
    controllerRef.current?.abort()

    const userMessage = {
      id: randomId('msg'),
      role: 'user',
      content: trimmed,
    }

    const history = [...messages, userMessage]
    setMessages(history)
    setStatusMessage(null)
    setError(null)

    const assistantId = randomId('msg')
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
      },
    ])

    const controller = new AbortController()
    controllerRef.current = controller

    try {
      await streamChat(
        {
          messages: history.map(({ role, content }) => ({ role, content })),
          model: activeModel || undefined,
          include_memories: selectedMemoryIds,
        },
        {
          signal: controller.signal,
          onEvent: (event) => {
            if (event.event === 'token' && typeof event.content === 'string') {
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? { ...message, content: message.content + event.content }
                    : message,
                ),
              )
            } else if (event.event === 'complete') {
              if (typeof event.content === 'string') {
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === assistantId ? { ...message, content: event.content } : message,
                  ),
                )
              }
              if (Array.isArray(event.used_memories) && event.used_memories.length > 0) {
                setSelectedMemoryIds(event.used_memories)
              }
              const label = event.placeholder
                ? 'Placeholder response generated locally.'
                : event.provider
                ? `Response served by ${event.provider} (${event.model})`
                : `Response served by ${event.model}`
              setStatusMessage(label)
            } else if (event.event === 'error' && event.error) {
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? { ...message, content: `Error: ${event.error}` }
                    : message,
                ),
              )
            }
          },
        },
      )
    } catch (err) {
      if (err?.name === 'AbortError') {
        setStatusMessage('Streaming cancelled.')
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, content: `${message.content}\n[stream cancelled]` }
              : message,
          ),
        )
        return
      }

      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? { ...message, role: 'system', content: `Chat failed: ${err.message}` }
            : message,
        ),
      )

      try {
        const response = await sendChat({
          messages: history.map(({ role, content }) => ({ role, content })),
          model: activeModel || undefined,
          include_memories: selectedMemoryIds,
        })

        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, role: 'assistant', content: response.content }
              : message,
          ),
        )

        if (Array.isArray(response.used_memories) && response.used_memories.length > 0) {
          setSelectedMemoryIds(response.used_memories)
        }

        setStatusMessage(
          response.placeholder
            ? 'Placeholder response generated locally.'
            : response.provider
            ? `Response served by ${response.provider} (${response.model})`
            : `Response served by ${response.model}`,
        )
      } catch (fallbackError) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, content: `Fallback failed: ${fallbackError.message}` }
              : message,
          ),
        )
      }
    } finally {
      controllerRef.current = null
    }
  }

  const handleCreateMemory = async (payload) => {
    try {
      const record = await addMemory(payload)
      setSelectedMemoryIds((prev) => [record.id, ...prev])
      setStatusMessage('Memory saved.')
    } catch (_err) {
      // error state already managed by hook
    }
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <ModelSelector
          models={models}
          activeModel={activeModel}
          onSelect={(model) => {
            setActiveModel(model)
            setStatusMessage(`Model switched to ${model}`)
          }}
          disabled={loading.chat}
        />
        <MemoryPanel
          memories={memories}
          selectedIds={selectedMemoryIds}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          onToggleMemory={(memoryId) =>
            setSelectedMemoryIds((previous) =>
              previous.includes(memoryId)
                ? previous.filter((id) => id !== memoryId)
                : [...previous, memoryId],
            )
          }
          onRefresh={() => refreshMemories({ query: searchQuery })}
          onCreateMemory={handleCreateMemory}
          loading={loading.memories}
        />
      </aside>
      <main className="app-content">
        {(error || statusMessage) && (
          <div className={`status-banner ${error ? 'is-error' : ''}`}>
            {error || statusMessage}
          </div>
        )}
        <ChatPanel
          messages={messages}
          onSend={handleSend}
          isStreaming={loading.chat}
          onStop={() => controllerRef.current?.abort()}
          selectedMemories={selectedMemories}
          tokenUsage={null}
        />
      </main>
    </div>
  )
}

export default App
