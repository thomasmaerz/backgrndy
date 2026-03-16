'use client'

import { useState, useEffect, useCallback } from 'react'
import { QueuePanel } from '@/components/enrich/QueuePanel'
import { ChatPanel } from '@/components/enrich/ChatPanel'
import { Message } from '@/lib/ai'

interface QueueItem {
  id: string
  raw_text: string
  company_name: string | null
}

interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export default function EnrichPage() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [selected, setSelected] = useState<QueueItem | null>(null)
  const [chat, setChat] = useState<ChatTurn[]>([])
  const [conversationHistory, setConversationHistory] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState('')

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/enrich/queue')
      const data = await res.json()
      setQueue(data)
    } catch (error) {
      console.error('Failed to fetch queue:', error)
    }
  }, [])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  // Auto-select first item when queue loads
  useEffect(() => {
    if (queue.length > 0 && !selected) {
      selectItem(queue[0])
    }
  }, [queue, selected])

  const selectItem = async (item: QueueItem) => {
    setSelected(item)
    setChat([])
    setConversationHistory([])
    setInput('')
    setAiLoading(true)

    try {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stagingId: item.id }),
      })

      const data = await res.json()

      if (data.status === 'needs_input') {
        setChat([{ role: 'assistant', content: data.agentMessage }])
        setConversationHistory(data.conversationHistory)
      }
    } catch (error) {
      console.error('Failed to start enrich:', error)
    } finally {
      setAiLoading(false)
    }
  }

  const handleSend = async (msg: string) => {
    if (!selected || !msg.trim()) return

    const userTurn: ChatTurn = { role: 'user', content: msg }
    setChat((prev) => [...prev, userTurn])
    setAiLoading(true)

    try {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stagingId: selected.id,
          conversationHistory,
          userMessage: msg,
        }),
      })

      const data = await res.json()

      if (data.status === 'needs_input') {
        setChat((prev) => [...prev, { role: 'assistant', content: data.agentMessage }])
        setConversationHistory(data.conversationHistory)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setAiLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!selected) return

    setAiLoading(true)

    try {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stagingId: selected.id,
          conversationHistory,
          action: 'confirm',
        }),
      })

      const data = await res.json()

      if (data.status === 'complete') {
        setChat((prev) => [
          ...prev,
          { role: 'assistant', content: '✓ Saved to your claims library.' },
        ])

        // Remove from queue and advance
        setTimeout(() => {
          setQueue((prev) => prev.filter((item) => item.id !== selected.id))
          setSelected(null)

          // Select next item
          const currentIndex = queue.findIndex((item) => item.id === selected.id)
          if (queue[currentIndex + 1]) {
            selectItem(queue[currentIndex + 1])
          } else if (queue.length > 1) {
            selectItem(queue[0])
          } else {
            fetchQueue()
          }
        }, 800)
      }
    } catch (error) {
      console.error('Failed to confirm:', error)
    } finally {
      setAiLoading(false)
    }
  }

  const handleSkip = async () => {
    if (!selected) return

    // Optimistically remove from queue
    const prevSelected = selected
    setQueue((prev) => prev.filter((item) => item.id !== selected.id))
    setSelected(null)

    try {
      await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stagingId: prevSelected.id,
          action: 'skip',
        }),
      })

      // Select next item
      const currentIndex = queue.findIndex((item) => item.id === prevSelected.id)
      if (queue[currentIndex + 1]) {
        selectItem(queue[currentIndex + 1])
      } else if (queue.length > 1) {
        selectItem(queue[0])
      }
    } catch (error) {
      console.error('Failed to skip:', error)
    }
  }

  const handleBatchEnrich = async () => {
    setBatchRunning(true)
    setBatchProgress('Starting batch enrichment...')

    try {
      let cursor: string | null = null

      while (true) {
        setBatchProgress(`Processing batch... (cursor: ${cursor || 'start'})`)

        const res: Response = await fetch('/api/enrich/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cursor, batchSize: 5 }),
        })

        const data = await res.json()

        if (!data.nextCursor) {
          break
        }

        cursor = data.nextCursor
      }

      setBatchProgress('Batch complete!')
      await fetchQueue()
    } catch (error) {
      console.error('Batch enrich error:', error)
    } finally {
      setBatchRunning(false)
      setBatchProgress('')
    }
  }

  return (
    <div className="flex h-[calc(100vh-0px)] -m-8 overflow-hidden">
      <QueuePanel
        items={queue}
        selectedId={selected?.id || null}
        onSelect={selectItem}
        loading={aiLoading}
        onBatchEnrich={handleBatchEnrich}
        batchRunning={batchRunning}
        batchProgress={batchProgress}
      />

      <ChatPanel
        item={selected}
        chat={chat}
        loading={aiLoading}
        onSend={handleSend}
        onConfirm={handleConfirm}
        onSkip={handleSkip}
        input={input}
        onInputChange={setInput}
      />
    </div>
  )
}
