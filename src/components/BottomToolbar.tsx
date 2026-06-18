interface BottomToolbarProps {
  state: string
  onVoiceToggle: () => void
  onSendText: (text: string) => void
  onRetry: () => void
  voiceEnabled: boolean
  onVoiceEnabledToggle: () => void
}

export function BottomToolbar({ state, onVoiceToggle, onSendText, onRetry, voiceEnabled, onVoiceEnabledToggle }: BottomToolbarProps) {
  const handleSubmit = () => {
    const input = document.getElementById('chat-input') as HTMLInputElement
    if (input && input.value.trim()) {
      onSendText(input.value)
      input.value = ''
    }
  }

  return (
    <div className="toolbar">
      {/* Voice input toggle (mic) */}
      <button
        className={`voice-btn ${state === 'listening' ? 'active' : ''}`}
        onClick={onVoiceToggle}
        title={state === 'listening' ? 'Stop listening' : 'Start voice input'}
      >
        {state === 'listening' ? '◉' : '◎'}
      </button>

      {/* Voice output toggle (speaker) */}
      <button
        className={`voice-btn ${voiceEnabled ? 'active' : ''}`}
        onClick={onVoiceEnabledToggle}
        title={voiceEnabled ? 'Voice replies ON — click to mute' : 'Voice replies OFF — click to enable'}
      >
        {voiceEnabled ? '🔊' : '🔇'}
      </button>

      <input
        id="chat-input"
        type="text"
        placeholder={state === 'listening' ? 'Listening...' : state === 'speaking' ? 'Speaking...' : 'Type a message...'}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
        disabled={state === 'thinking' || state === 'speaking'}
      />
      <button onClick={handleSubmit} disabled={state === 'thinking' || state === 'speaking'}>
        {state === 'thinking' ? '⏳' : 'SEND'}
      </button>
      {state === 'error' && (
        <button onClick={onRetry} style={{ background: 'var(--red)', color: '#fff' }}>
          RETRY
        </button>
      )}
    </div>
  )
}
