const defaultBase = 'http://localhost:8000'

const baseUrl = (() => {
  const raw = import.meta.env.VITE_API_URL || defaultBase
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
})()

function buildUrl(path, params) {
  const url = new URL(`${baseUrl}${path}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item !== undefined && item !== null && item !== '') {
            url.searchParams.append(key, item)
          }
        })
      } else if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value)
      }
    })
  }
  return url.toString()
}

async function request(path, options = {}) {
  const { method = 'GET', body, params, headers = {} } = options
  const url = buildUrl(path, params)

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (response.status === 204) {
    return null
  }

  const text = await response.text()
  let payload = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    const message =
      typeof payload === 'string'
        ? payload
        : typeof payload?.detail === 'string'
        ? payload.detail
        : payload?.error || `Request failed with status ${response.status}`
    throw new Error(message)
  }

  return payload
}

export async function listModels(params = {}) {
  const search = new URLSearchParams()
  if (params.force) search.set('force', 'true')
  const suffix = search.toString() ? `?${search}` : ''
  return request(`/api/models${suffix}`)
}

export async function listMemories({ query, tags, limit } = {}) {
  return request('/api/memories', {
    params: {
      q: query,
      tag: tags,
      limit,
    },
  })
}

export async function listTags() {
  return request('/api/memories/tags')
}

export async function suggestMemories(payload) {
  return request('/api/memories/suggest', {
    method: 'POST',
    body: payload,
  })
}

export async function createMemory(memory) {
  return request('/api/memories', {
    method: 'POST',
    body: memory,
  })
}

export async function deleteMemory(memoryId) {
  return request(`/api/memories/${memoryId}`, {
    method: 'DELETE',
  })
}

export async function exportMemories() {
  return request('/api/memories/export')
}

export async function importMemories(payload) {
  return request('/api/memories/import', {
    method: 'POST',
    body: payload,
  })
}

export async function chatWithModel(payload) {
  return request('/api/chat', {
    method: 'POST',
    body: payload,
  })
}

export async function chatWithModelStream(payload, { signal } = {}) {
  const response = await fetch(buildUrl('/api/chat/stream'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok) {
    const text = await response.text()
    let message = `Request failed with status ${response.status}`
    if (text) {
      try {
        const parsed = JSON.parse(text)
        if (typeof parsed === 'string') {
          message = parsed
        } else if (typeof parsed?.detail === 'string') {
          message = parsed.detail
        } else if (parsed?.error) {
          message = parsed.error
        }
      } catch {
        message = text
      }
    }
    throw new Error(message)
  }

  return response.body
}

export async function healthCheck() {
  return request('/api/health')
}

export async function summarizeConversation(payload) {
  return request('/api/chat/summarize', {
    method: 'POST',
    body: payload,
  })
}

export async function fetchDuplicates(threshold) {
  return request('/api/memories/deduplicate', {
    params: threshold ? { threshold } : undefined,
  })
}

export async function consolidateMemories(payload) {
  return request('/api/memories/consolidate', {
    method: 'POST',
    body: payload,
  })
}

export async function detectContradictions(payload) {
  return request('/api/memories/contradictions', {
    method: 'POST',
    body: payload,
  })
}

export async function saveModelPreferences(preferences) {
  return request('/api/models/preferences', {
    method: 'POST',
    body: { preferences },
  })
}
