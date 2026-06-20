import { useEffect, useRef, useState, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  ts: number
}

interface MessageAreaProps {
  messages: ChatMessage[]
  isThinking?: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function useStickyScroll(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      pinnedRef.current = el.scrollHeight - (el.scrollTop + el.clientHeight) <= 12
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (pinnedRef.current && ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight
    }
  }, [dep])

  return ref
}

// ── Streaming text reveal ────────────────────────────────────────────────────

function StreamingText({ text }: { text: string }) {
  const [visible, setVisible] = useState('')
  const [done, setDone] = useState(false)
  const startRef = useRef(0)

  useEffect(() => {
    setVisible('')
    setDone(false)
    startRef.current = performance.now()

    let raf = 0
    const tick = (now: number) => {
      const elapsed = now - startRef.current
      const chars = Math.min(text.length, Math.round(elapsed / 12))
      setVisible(text.slice(0, chars))
      if (chars < text.length) {
        raf = requestAnimationFrame(tick)
      } else {
        setDone(true)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [text])

  return (
    <span>
      {visible}
      {!done && <span className="hud-cursor" />}
    </span>
  )
}

// ── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ role }: { role: 'user' | 'assistant' }) {
  if (role === 'user') {
    return (
      <div className="hud-thread-avatar">
        <div className="avatar-user" />
      </div>
    )
  }
  return (
    <div className="hud-thread-avatar">
      <div className="avatar-ai" />
    </div>
  )
}

// ── Single message row ───────────────────────────────────────────────────────

function MessageRow({ message, isLatestAssistant, isStreaming }: {
  message: ChatMessage
  isLatestAssistant: boolean
  isStreaming: boolean
}) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center py-2 animate-fade-in">
        <span className="system-msg">{message.text}</span>
      </div>
    )
  }

  return (
    <div className={`hud-thread-msg ${isUser ? 'hud-thread-msg--user' : ''} animate-fade-in`}>
      {!isUser && <Avatar role="assistant" />}
      <div className="hud-thread-bubble" style={{ maxWidth: '72%' }}>
        <div className="bubble-header">
          <span className="bubble-role" style={{ color: 'var(--col-arc-primary)', opacity: 0.6 }}>
            {isUser ? 'You' : 'J.A.R.V.I.S.'}
          </span>
          <span className="bubble-time">{formatTime(message.ts)}</span>
        </div>
        <div className={isUser ? 'hud-thread-bubble--user' : 'hud-thread-bubble--ai'}>
          <div className="hud-thread-bubble-text">
            {isLatestAssistant && isStreaming ? (
              <StreamingText text={message.text} />
            ) : (
              message.text
            )}
          </div>
        </div>
      </div>
      {isUser && <Avatar role="user" />}
    </div>
  )
}

// ── Thinking indicator ───────────────────────────────────────────────────────

function ThinkingRow() {
  return (
    <div className="hud-thread-msg animate-fade-in">
      <Avatar role="assistant" />
      <div className="typing-wrap">
        <div className="hud-typing">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
        <span className="thinking-label">Thinking</span>
      </div>
    </div>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4" style={{
      flex: 1, minHeight: 300, color: 'var(--col-text-secondary)', opacity: 0.3,
    }}>
      <div style={{ fontSize: 32, opacity: 0.5 }}>◈</div>
      <p style={{ fontSize: 13, letterSpacing: '0.06em' }}>Awaiting input, Sir.</p>
    </div>
  )
}

// ── MessageArea ──────────────────────────────────────────────────────────────

export function MessageArea({ messages, isThinking = false }: MessageAreaProps) {
  const scrollRef = useStickyScroll(messages.length)
  const lastAssistantIdx = [...messages].reverse().findIndex(m => m.role === 'assistant')

  return (
    <div className="hud-thread">
      <div ref={scrollRef} className="hud-thread-scroll">
        {messages.length === 0 && !isThinking && <EmptyState />}

        {messages.map((msg, i) => {
          const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1 - lastAssistantIdx
          return (
            <MessageRow
              key={msg.id}
              message={msg}
              isLatestAssistant={isLastAssistant}
              isStreaming={isLastAssistant && isThinking}
            />
          )
        })}

        {isThinking && <ThinkingRow />}
      </div>
    </div>
  )
}
