import { createEventStream } from 'h3'
import { generateContentForTask } from './generator'
import { getContentGenerationTask } from './taskStore'

export function handleContentGenerationStream(taskId, event, auth) {
  const eventStream = createEventStream(event)

  const emit = async (type, payload = {}) => {
    await eventStream.push({
      event: type,
      data: JSON.stringify(payload),
    })
  }

  ;(async () => {
    try {
      const task = await generateContentForTask(taskId, event, auth, { emit })
      await emit('complete', { task, success: true })
    }
    catch (error) {
      const message = error?.statusMessage || error?.message || String(error)
      const statusCode = error?.statusCode || 500
      let task = error?.data || null
      if (!task) {
        try {
          task = await getContentGenerationTask(taskId)
        }
        catch {
          task = null
        }
      }
      await emit('error', { message, statusCode, task })
    }
    finally {
      await eventStream.close()
    }
  })()

  return eventStream.send()
}
