interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

interface MessageAreaProps {
  messages: Message[]
  state: string
}

export function MessageArea({ messages, state }: MessageAreaProps) {
  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  return (
    <div className="message-area">
      {messages.length === 0 && (
        <div style={{ textAlign: 'center', color: '#333', marginTop: 40, fontSize: 13 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>◈</div>
          Awaiting input, Sir.
        </div>
      )}

      {messages.map(msg => (
        <div key={msg.id} className={`msg ${msg.role}`}>
          {msg.role !== 'system' && (
            <div style={{ fontSize: 9, color: '#555', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>
              {msg.role === 'user' ? 'You' : 'J.A.R.V.I.S.'}
            </div>
          )}
          <div>{msg.content}</div>
          <div className="msg-meta">{formatTime(msg.timestamp)}</div>
        </div>
      ))}

      {state === 'thinking' && (
        <div className="thinking">
          <span>Thinking</span>
          <span className="thinking-dots">
            <span /><span /><span />
          </span>
        </div>
      )}
    </div>
  )
}
