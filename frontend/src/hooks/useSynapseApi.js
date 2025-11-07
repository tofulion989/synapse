import { useCallback, useState } from 'react'

import {
  chatWithModel,
  chatWithModelStream,
  consolidateMemories,
  createMemory,
  deleteMemory,
  detectContradictions,
  exportMemories,
  fetchDuplicates,
  importMemories,
  listMemories,
  listModels,
  listTags,
  summarizeConversation,
  suggestMemories,
} from '../lib/api'

const initialLoading = {
  models: false,
  memories: false,
  chat: false,
  tags: false,
  export: false,
  import: false,
}

export function useSynapseApi() {
  const [models, setModels] = useState([])
  const [providerStatus, setProviderStatus] = useState([])
  const [ollamaStatus, setOllamaStatus] = useState('unknown')
  const [memories, setMemories] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(initialLoading)
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [duplicates, setDuplicates] = useState([])

  const withLoading = useCallback((key, fn) => {
    return async (...args) => {
      setLoading((prev) => ({ ...prev, [key]: true }))
      setError(null)
      try {
        return await fn(...args)
      } catch (err) {
        if (err?.name !== 'AbortError') {
          console.error(err)
          setError(err.message || 'Unexpected error')
        }
        throw err
      } finally {
        setLoading((prev) => ({ ...prev, [key]: false }))
      }
    }
  }, [])

  const refreshModels = useCallback(
    withLoading('models', async () => {
      const response = await listModels()
      setModels(response?.models || [])
      setProviderStatus(response?.provider_status || [])
      setOllamaStatus(response?.ollama_status || 'unknown')
    }),
    [withLoading],
  )

  const refreshMemories = useCallback(
    withLoading('memories', async ({ query, tags: tagFilters, limit } = {}) => {
      const response = await listMemories({ query, tags: tagFilters, limit })
      setMemories(response || [])
    }),
    [withLoading],
  )

  const refreshTags = useCallback(
    withLoading('tags', async () => {
      const response = await listTags()
      setTags(response || [])
    }),
    [withLoading],
  )

  const addMemory = useCallback(
    withLoading('memories', async (payload) => {
      const record = await createMemory(payload)
      setMemories((prev) => [record, ...prev])
      refreshTags()
      return record
    }),
    [withLoading, refreshTags],
  )

  const removeMemory = useCallback(
    withLoading('memories', async (memoryId) => {
      await deleteMemory(memoryId)
      setMemories((prev) => prev.filter((memory) => memory.id !== memoryId))
      refreshTags()
    }),
    [withLoading, refreshTags],
  )

  const sendChat = useCallback(
    withLoading('chat', async (payload) => {
      const response = await chatWithModel(payload)
      setStats(response?.stats || null)
      return response
    }),
    [withLoading],
  )

  const streamChat = useCallback(
    withLoading('chat', async (payload, options = {}) => {
      const { onEvent, signal } = options
      const body = await chatWithModelStream(payload, { signal })
      if (!body) {
        throw new Error('Empty response stream from server')
      }

      const reader = body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (value) {
          buffer += decoder.decode(value, { stream: !done })
        } else if (done) {
          buffer += decoder.decode(new Uint8Array(), { stream: false })
        }

        let newlineIndex = buffer.indexOf('\n')
        while (newlineIndex >= 0) {
          const line = buffer.slice(0, newlineIndex).trim()
          buffer = buffer.slice(newlineIndex + 1)
          if (line) {
            try {
              const data = JSON.parse(line)
              onEvent?.(data)
              if (data.event === 'complete' && data.stats) {
                setStats(data.stats)
              }
            } catch (err) {
              console.error('Failed to parse stream chunk', err)
            }
          }
          newlineIndex = buffer.indexOf('\n')
        }

        if (done) {
          const tail = buffer.trim()
          if (tail) {
            try {
              const data = JSON.parse(tail)
              onEvent?.(data)
              if (data.event === 'complete' && data.stats) {
                setStats(data.stats)
              }
            } catch (err) {
              console.error('Failed to parse trailing chunk', err)
            }
          }
          break
        }
      }
    }),
    [withLoading],
  )

  const exportAllMemories = useCallback(
    withLoading('export', async () => {
      return exportMemories()
    }),
    [withLoading],
  )

  const importMemoryBatch = useCallback(
    withLoading('import', async (payload) => {
      const response = await importMemories(payload)
      await refreshMemories()
      refreshTags()
      return response
    }),
    [withLoading, refreshMemories, refreshTags],
  )

  const fetchSuggestions = useCallback(
    withLoading('memories', async ({ query, limit = 5 }) => {
      if (!query?.trim()) {
        setSuggestions([])
        return []
      }
      const response = await suggestMemories({ query, limit })
      const result = response?.suggestions || []
      setSuggestions(result)
      return result
    }),
    [withLoading],
  )

  const summarizeChat = useCallback(
    withLoading('chat', async (payload) => summarizeConversation(payload)),
    [withLoading],
  )

  const getDuplicates = useCallback(
    withLoading('memories', async (threshold) => {
      const response = await fetchDuplicates(threshold)
      setDuplicates(response?.duplicates || [])
      return response
    }),
    [withLoading],
  )

  const mergeMemories = useCallback(
    withLoading('memories', async (payload) => {
      const response = await consolidateMemories(payload)
      await refreshMemories()
      return response
    }),
    [withLoading, refreshMemories],
  )

  const analyzeContradictions = useCallback(
    withLoading('memories', async (payload) => detectContradictions(payload)),
    [withLoading],
  )

  return {
    models,
    providerStatus,
    ollamaStatus,
    memories,
    tags,
    loading,
    error,
    stats,
    suggestions,
    duplicates,
    refreshModels,
    refreshMemories,
    refreshTags,
    addMemory,
    removeMemory,
    sendChat,
    streamChat,
    exportAllMemories,
    importMemoryBatch,
    setError,
    setStats,
    fetchSuggestions,
    summarizeChat,
    getDuplicates,
    mergeMemories,
    analyzeContradictions,
  }
}
