import { useState, useEffect } from 'react'

interface TopBarProps {
  state: string
  gateway: { running: boolean; port: number }
  messageCount: number
}

export function TopBar({ state, gateway, messageCount }: TopBarProps) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const stateLabel = {
    booting: 'INITIALIZING',
    ready: 'READY',
    listening: 'LISTENING',
    speaking: 'SPEAKING',
    thinking: 'PROCESSING',
    error: 'ERROR',
  }[state] || 'STANDBY'

  const stateColor = {
    booting: '#ffd740',
    ready: '#00e676',
    listening: '#00e5ff',
    speaking: '#00e5ff',
    thinking: '#ffd740',
    error: '#ff1744',
  }[state] || '#555'

  return (
    <div className="top-bar">
      <span className="brand">J.A.R.V.I.S.</span>
      <div className="top-bar-right">
        <span style={{ fontSize: 10, color: stateColor, fontWeight: 600, letterSpacing: 1 }}>
          {stateLabel}
        </span>
        <span className={`status-badge ${gateway.running ? 'online' : state === 'thinking' ? 'thinking' : 'offline'}`}>
          {gateway.running ? '● CONNECTED' : state === 'thinking' ? '● THINKING' : '● OFFLINE'}
        </span>
        <span className="clock">
          {time.toLocaleTimeString('en-US', { hour12: false })}
        </span>
      </div>
    </div>
  )
}
