import { useEffect, useRef, useState, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  ts: number
}

interface ChatLayoutProps {
  messages: ChatMessage[]
  isThinking?: boolean
  onSend: (text: string) => void
  onMicToggle?: () => void
  isListening?: boolean
}

// ── Sticky scroll ────────────────────────────────────────────────────────────

function useStickyScroll(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      pinnedRef.current = el.scrollHeight - (el.scrollTop + el.clientHeight) <= 10
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (pinnedRef.current && ref.current) {
      requestAnimationFrame(() => {
        if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
      })
    }
  }, [dep])

  return ref
}

// ── Streaming text ───────────────────────────────────────────────────────────

function StreamingText({ text }: { text: string }) {
  const [visible, setVisible] = useState('')
  const [done, setDone] = useState(false)
  const startRef = useRef(0)

  useEffect(() => {
    setVisible(''); setDone(false); startRef.current = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const elapsed = now - startRef.current
      const chars = Math.min(text.length, Math.round(elapsed / 10))
      setVisible(text.slice(0, chars))
      if (chars < text.length) raf = requestAnimationFrame(tick)
      else setDone(true)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [text])

  return <span>{visible}{!done && <span className="hud-cursor" />}</span>
}

// ── Single message row (Anakot desktop style, NO profile icons) ──────────────

function MessageRow({ msg, isLatest, isStreaming }: {
  msg: ChatMessage; isLatest: boolean; isStreaming: boolean
}) {
  const isUser = msg.role === 'user'
  const isSystem = msg.role === 'system'
  const time = new Date(msg.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

  if (isSystem) {
    return (
      <div className="flex justify-center py-2 px-8">
        <span className="animate-fade-in" style={{
          fontSize: 11, letterSpacing: '0.03em',
          color: 'color-mix(in srgb, var(--col-text-secondary) 55%, transparent)',
          background: 'color-mix(in srgb, var(--col-text-primary) 3%, transparent)',
          padding: '2px 14px', borderRadius: 10,
        }}>{msg.text}</span>
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? 'flex-row-reverse' : ''} animate-fade-in`}
      style={{ padding: '4px 24px', gap: 10 }}>
      {/* Bubble only — no avatar/profile icon */}
      <div style={{ maxWidth: '68%' }}>
        {/* Role + timestamp header */}
        <div className="flex items-baseline gap-2 mb-1" style={{ padding: isUser ? '0 4px 0 0' : '0 0 0 4px' }}>
          <span style={{
            fontSize: 10, fontWeight: 500, letterSpacing: '0.02em',
            color: 'color-mix(in srgb, var(--col-arc-primary) 50%, transparent)',
            opacity: 0.8,
          }}>{isUser ? 'You' : 'J.A.R.V.I.S.'}</span>
          <span style={{
            fontSize: 9,
            color: 'color-mix(in srgb, var(--col-text-secondary) 30%, transparent)',
            fontVariantNumeric: 'tabular-nums' as const,
          }}>{time}</span>
        </div>

        {/* Bubble body — Anakot style */}
        {isUser ? (
          /* User bubble: glass background, all corners rounded, faint border */
          <div style={{
            padding: '8px 14px',
            background: 'color-mix(in srgb, var(--col-arc-primary) 5%, transparent)',
            border: '1px solid color-mix(in srgb, var(--col-arc-primary) 8%, transparent)',
            borderRadius: 10,
          }}>
            <div style={{
              fontSize: 13, lineHeight: 1.6,
              color: 'var(--col-text-primary)',
              wordWrap: 'break-word' as const, whiteSpace: 'pre-wrap' as const,
            }}>{msg.text}</div>
          </div>
        ) : (
          /* AI bubble: transparent, left border accent only */
          <div style={{
            padding: '4px 0 4px 12px',
            borderLeft: '2px solid color-mix(in srgb, var(--col-arc-primary) 20%, transparent)',
          }}>
            <div style={{
              fontSize: 13, lineHeight: 1.6,
              color: 'var(--col-text-primary)',
              wordWrap: 'break-word' as const, whiteSpace: 'pre-wrap' as const,
            }}>
              {isLatest && isStreaming ? <StreamingText text={msg.text} /> : msg.text}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Typing indicator ─────────────────────────────────────────────────────────

function TypingRow() {
  return (
    <div className="flex animate-fade-in" style={{ padding: '4px 24px', gap: 10 }}>
      <div style={{ maxWidth: '68%' }}>
        <div className="flex items-baseline gap-2 mb-1" style={{ padding: '0 0 0 12px' }}>
          <span style={{
            fontSize: 10, fontWeight: 500, letterSpacing: '0.02em',
            color: 'color-mix(in srgb, var(--col-arc-primary) 50%, transparent)',
            opacity: 0.8,
          }}>J.A.R.V.I.S.</span>
          <span style={{
            fontSize: 9,
            color: 'color-mix(in srgb, var(--col-text-secondary) 30%, transparent)',
            fontVariantNumeric: 'tabular-nums' as const,
          }}>now</span>
        </div>
        <div style={{
          padding: '4px 0 4px 12px',
          borderLeft: '2px solid color-mix(in srgb, var(--col-arc-primary) 20%, transparent)',
        }}>
          <div className="flex items-center gap-2.5">
            {/* Dither square — Anakot pattern */}
            <span className="dither" style={{
              display: 'inline-block', width: 6, height: 6, borderRadius: 1.5,
              color: 'color-mix(in srgb, var(--col-arc-primary) 60%, transparent)',
            }} />
            <span style={{
              fontSize: 11,
              color: 'color-mix(in srgb, var(--col-text-secondary) 50%, transparent)',
            }}>Thinking…</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3" style={{
      flex: 1, minHeight: 300,
      color: 'color-mix(in srgb, var(--col-text-secondary) 35%, transparent)',
    }}>
      <div style={{ fontSize: 28, opacity: 0.35 }}>◈</div>
      <p style={{ fontSize: 12, letterSpacing: '0.04em' }}>Awaiting input, Sir.</p>
    </div>
  )
}

// ── Composer (no profile icons) ──────────────────────────────────────────────

function Composer({ onSend, onMicToggle, isListening }: {
  onSend: (text: string) => void; onMicToggle?: () => void; isListening?: boolean
}) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const val = text.trim()
    if (!val) return
    onSend(val)
    setText('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
  }, [text, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div style={{ flexShrink: 0, padding: '8px 16px 12px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 6,
          background: 'rgba(8,12,24,0.88)',
          border: '1px solid color-mix(in srgb, var(--col-arc-primary) 10%, transparent)',
          borderRadius: 12,
          padding: '6px 8px 6px 12px',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        }}>
          {/* Mic */}
          <button onClick={isListening ? undefined : onMicToggle} style={{
            width: 30, height: 30, flexShrink: 0, alignSelf: 'flex-end',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isListening ? 'color-mix(in srgb, var(--col-energy-alert) 12%, transparent)' : 'transparent',
            border: isListening ? '1px solid color-mix(in srgb, var(--col-energy-alert) 35%, transparent)' : '1px solid var(--col-border-dim)',
            borderRadius: 8, color: isListening ? 'var(--col-energy-alert)' : 'var(--col-text-secondary)',
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </button>

          {/* Textarea */}
          <textarea ref={inputRef} value={text}
            onChange={e => {
              setText(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 90) + 'px'
            }}
            onKeyDown={handleKeyDown}
            placeholder="Send a follow-up" rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 13, lineHeight: 1.55, color: 'var(--col-text-primary)',
              resize: 'none', minHeight: 20, maxHeight: 90,
              fontFamily: 'var(--font-body)', padding: '5px 0',
            }}
          />

          {/* Send — white circle with dark arrow */}
          <button onClick={handleSend} disabled={!text.trim()} style={{
            width: 30, height: 30, flexShrink: 0, alignSelf: 'flex-end',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: text.trim() ? '#fff' : 'color-mix(in srgb, var(--col-text-primary) 6%, transparent)',
            border: 'none', borderRadius: 8,
            cursor: text.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke={text.trim() ? '#080c18' : 'color-mix(in srgb, var(--col-text-primary) 25%, transparent)'}
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M12 19V5" /><path d="m5 12 7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ChatLayout ───────────────────────────────────────────────────────────────

export function ChatLayout({
  messages, isThinking = false, onSend, onMicToggle, isListening = false,
}: ChatLayoutProps) {
  const scrollRef = useStickyScroll(messages.length)
  const lastAssistantIdx = [...messages].reverse().findIndex(m => m.role === 'assistant')

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', minHeight: 0, position: 'relative',
    }}>
      {/* Glass panel — behind text, covers canvas when chat has messages */}
      {messages.length > 0 && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'var(--col-bg-glass)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }} />
      )}

      {/* Scrollable chat history */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: '8px 0', scrollBehavior: 'smooth', position: 'relative', zIndex: 1,
      }}>
        {messages.length === 0 && !isThinking && <EmptyState />}

        {messages.map((msg, i) => {
          const isLast = msg.role === 'assistant' && i === messages.length - 1 - lastAssistantIdx
          return <MessageRow key={msg.id} msg={msg} isLatest={isLast} isStreaming={isLast && isThinking} />
        })}

        {isThinking && <TypingRow />}

        {/* Bottom clearance */}
        <div style={{ height: 16, flexShrink: 0 }} aria-hidden="true" />
      </div>

      {/* Composer */}
      <Composer onSend={onSend} onMicToggle={onMicToggle} isListening={isListening} />
    </div>
  )
}
