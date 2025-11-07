import { useCallback, useState } from 'react'

import {
  chatWithModel,
  chatWithModelStream,
  createMemory,
  deleteMemory,
  listMemories,
  listModels,
} from '../lib/api'

const initialLoading = {
  models: false,
  memories: false,
  chat: false,
}

export function useSynapseApi() {
  const [models, setModels] = useState([])
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(initialLoading)
  const [error, setError] = useState(null)

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
      setModels(response || [])
    }),
    [withLoading],
  )

  const refreshMemories = useCallback(
    withLoading('memories', async ({ query, tags, limit } = {}) => {
      const response = await listMemories({ query, tags, limit })
      setMemories(response || [])
    }),
    [withLoading],
  )

  const addMemory = useCallback(
    withLoading('memories', async (payload) => {
      const record = await createMemory(payload)
      setMemories((prev) => [record, ...prev])
      return record
    }),
    [withLoading],
  )

  const removeMemory = useCallback(
    withLoading('memories', async (memoryId) => {
      await deleteMemory(memoryId)
      setMemories((prev) => prev.filter((memory) => memory.id !== memoryId))
    }),
    [withLoading],
  )

  const sendChat = useCallback(
    withLoading('chat', async (payload) => {
      return chatWithModel(payload)
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

  return {
    models,
    memories,
    loading,
    error,
    refreshModels,
    refreshMemories,
    addMemory,
    removeMemory,
    sendChat,
    streamChat,
    setError,
  }
}
