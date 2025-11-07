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
  const prefs =
    typeof window !== 'undefined'
      ? (() => {
          try {
            return JSON.parse(localStorage.getItem('synapse_prefs') || '{}')
          } catch {
            return {}
          }
        })()
      : {}

  const {
    models,
    memories,
    tags,
    loading,
    error,
    stats,
    refreshModels,
    refreshMemories,
    refreshTags,
    addMemory,
    sendChat,
    streamChat,
    exportAllMemories,
    importMemoryBatch,
    setError,
    setStats,
  } = useSynapseApi()

  const [selectedMemoryIds, setSelectedMemoryIds] = useState(prefs.memoryIds || [])
  const [messages, setMessages] = useState(introMessages)
  const [activeModel, setActiveModel] = useState(prefs.model || '')
  const [searchQuery, setSearchQuery] = useState(prefs.search || '')
  const [activeTags, setActiveTags] = useState(prefs.tags || [])
  const [systemPrompt, setSystemPrompt] = useState(prefs.systemPrompt || '')
  const [showSystemPrompt, setShowSystemPrompt] = useState(prefs.showSystemPrompt ?? false)
  const [showStatsDetails, setShowStatsDetails] = useState(prefs.showStatsDetails ?? false)
  const [statusMessage, setStatusMessage] = useState(null)
  const controllerRef = useRef(null)

  useEffect(() => {
    refreshModels()
    refreshMemories({ query: searchQuery, tags: activeTags })
    refreshTags()
  }, [refreshModels, refreshMemories, refreshTags])

  useEffect(() => {
    if (!models.length) return
    setActiveModel((current) => {
      if (current) return current
      const preferred = models.find((model) => model.default)
      return preferred?.name ?? models[0].name
    })
  }, [models])

  useEffect(() => {
    setStats(null)
  }, [activeModel, setStats])

  useEffect(() => {
    const timeout = setTimeout(() => {
      refreshMemories({ query: searchQuery, tags: activeTags })
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery, activeTags, refreshMemories])

  useEffect(() => {
    setSelectedMemoryIds((previous) =>
      previous.filter((id) => memories.some((memory) => memory.id === id)),
    )
  }, [memories])

  useEffect(() => {
    setActiveTags((previous) =>
      previous.filter((tag) => tags.some((entry) => entry.tag === tag)),
    )
  }, [tags])

  useEffect(
    () => () => {
      controllerRef.current?.abort()
    },
    [],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const payload = {
      model: activeModel,
      memoryIds: selectedMemoryIds,
      search: searchQuery,
      tags: activeTags,
      systemPrompt,
      showSystemPrompt,
      showStatsDetails,
    }
    localStorage.setItem('synapse_prefs', JSON.stringify(payload))
  }, [
    activeModel,
    selectedMemoryIds,
    searchQuery,
    activeTags,
    systemPrompt,
    showSystemPrompt,
    showStatsDetails,
  ])

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

    const payloadBase = {
      messages: history.map(({ role, content }) => ({ role, content })),
      model: activeModel || undefined,
      include_memories: selectedMemoryIds,
      system: systemPrompt || undefined,
    }

    try {
      await streamChat(
        payloadBase,
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
              if (event.stats) {
                setStats(event.stats)
              }
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
        const response = await sendChat(payloadBase)

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

  const handleToggleTag = (tag) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((entry) => entry !== tag) : [...prev, tag],
    )
  }

  const handleExportMemories = async () => {
    try {
      const payload = await exportAllMemories()
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `synapse-memories-${new Date().toISOString()}.json`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
      setStatusMessage(`Exported ${payload.count ?? payload.memories?.length ?? 0} memories.`)
    } catch (err) {
      setError(err.message || 'Export failed')
    }
  }

  const handleImportMemories = async (file) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const memoriesPayload = Array.isArray(data)
        ? data
        : Array.isArray(data.memories)
        ? data.memories
        : null
      if (!memoriesPayload) {
        throw new Error('File must contain a memories array.')
      }
      await importMemoryBatch({ memories: memoriesPayload })
      setStatusMessage(`Imported ${memoriesPayload.length} memories.`)
    } catch (err) {
      setError(err.message || 'Import failed')
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
          tags={tags}
          activeTags={activeTags}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          onToggleMemory={(memoryId) =>
            setSelectedMemoryIds((previous) =>
              previous.includes(memoryId)
                ? previous.filter((id) => id !== memoryId)
                : [...previous, memoryId],
            )
          }
          onRefresh={() => refreshMemories({ query: searchQuery, tags: activeTags })}
          onCreateMemory={handleCreateMemory}
          onToggleTag={handleToggleTag}
          onClearTags={() => setActiveTags([])}
          onExport={handleExportMemories}
          onImport={handleImportMemories}
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
          onSaveMemory={(message) =>
            handleCreateMemory({
              title: message.content.slice(0, 60),
              content: message.content,
              tags: ['#chat'],
            })
          }
          systemPrompt={systemPrompt}
          onSystemPromptChange={setSystemPrompt}
          systemExpanded={showSystemPrompt}
          onToggleSystem={() => setShowSystemPrompt((prev) => !prev)}
          usageStats={stats}
          activeModel={activeModel}
          showStatsDetails={showStatsDetails}
          onToggleStats={() => setShowStatsDetails((prev) => !prev)}
        />
      </main>
    </div>
  )
}

export default App
