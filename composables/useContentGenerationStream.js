export function useContentGenerationStream() {
  const userStore = useUserStore()

  async function streamGenerate(taskId, mode, handlers = {}) {
    const endpoint = mode === 'regenerate' ? 'regenerate-stream' : 'generate-stream'
    const res = await fetch(`/api/admin/content-generation/tasks/${taskId}/${endpoint}`, {
      method: 'POST',
      headers: {
        ...(userStore.token ? { Authorization: `Bearer ${userStore.token}` } : {}),
      },
    })

    if (res.status === 401) {
      userStore.logout()
      const path = window.location.pathname + window.location.search
      await navigateTo({ path: '/admin/login', query: { redirect: path } })
      return
    }

    const contentType = res.headers.get('content-type') || ''
    if (!res.ok && !contentType.includes('text/event-stream')) {
      let message = '生成失败'
      try {
        const body = await res.json()
        message = body?.statusMessage || body?.message || message
      }
      catch {
        message = res.statusText || message
      }
      throw new Error(message)
    }

    if (!res.body) {
      throw new Error('流式响应无内容')
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const blocks = buffer.split('\n\n')
      buffer = blocks.pop() || ''

      for (const block of blocks) {
        if (!block.trim()) continue

        let eventType = 'message'
        const dataLines = []

        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim()
          }
          else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim())
          }
        }

        const dataText = dataLines.join('\n')
        if (!dataText) continue

        let payload = {}
        try {
          payload = JSON.parse(dataText)
        }
        catch {
          continue
        }

        handlers.onEvent?.(eventType, payload)

        if (eventType === 'chunk' && payload.text) {
          handlers.onChunk?.(payload.text)
        }
        else if (eventType === 'source') {
          handlers.onSource?.(payload)
        }
        else if (eventType === 'phase') {
          handlers.onPhase?.(payload)
        }
        else if (eventType === 'status') {
          handlers.onStatus?.(payload)
        }
        else if (eventType === 'complete') {
          handlers.onComplete?.(payload)
        }
        else if (eventType === 'error') {
          handlers.onError?.(payload)
        }
      }
    }
  }

  return { streamGenerate }
}
