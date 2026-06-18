import { useState } from 'react'
import type { ToolCall, SubAgent, SessionInfo } from '../hooks/useGateway'

interface SystemStatusProps {
  gateway: { running: boolean; port: number }
  tools: ToolCall[]
  subAgents: SubAgent[]
  session: SessionInfo | null
  ctxPct: number
  logEntries: Array<{ time: string; msg: string; type: 'info' | 'error' | 'success' }>
  currentModel: string
  onModelChange: (model: string) => void
}

const MODELS = [
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', desc: 'Best reasoning' },
  { id: 'claude-haiku-4', name: 'Claude Haiku 4', desc: 'Fast & efficient' },
  { id: 'gpt-4o', name: 'GPT-4o', desc: 'OpenAI flagship' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', desc: 'Lightweight' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: 'Google deep think' },
]

export function SystemStatus({ gateway, tools, subAgents, session, ctxPct, logEntries, currentModel, onModelChange }: SystemStatusProps) {
  const [logOpen, setLogOpen] = useState(false)
  const activeTools = tools.filter(t => t.status === 'running')
  const doneTools = tools.filter(t => t.status === 'completed')
  const activeAgents = subAgents.filter(a => a.status === 'running')
  const doneAgents = subAgents.filter(a => a.status === 'completed')

  return (
    <>
      {/* Context */}
      <div className="section">
        <div className="section-title">CONTEXT USAGE</div>
        <div className="context-bar">
          <div className={`context-fill ${ctxPct > 70 ? 'warn' : ''}`} style={{ width: `${ctxPct}%` }} />
        </div>
        <div className="context-text">
          {session
            ? `${(session.contextUsed / 1000).toFixed(1)}K / ${(session.contextMax / 1000).toFixed(0)}K tokens · ${ctxPct}%`
            : '0 / 200K tokens · 0%'}
        </div>
      </div>

      {/* Model Picker */}
      <div className="section">
        <div className="section-title">MODEL</div>
        <div className="model-picker">
          {MODELS.map(m => (
            <div
              key={m.id}
              className={`model-option ${currentModel === m.id ? 'active' : ''}`}
              onClick={() => onModelChange(m.id)}
            >
              <span className="model-name">
                {m.name}
                <small>{m.desc}</small>
              </span>
              {currentModel === m.id && <span className="model-check">✓</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Tools */}
      <div className="section">
        <div className="section-title">
          TOOLS {activeTools.length > 0 && <span style={{ color: 'var(--gold)' }}>({activeTools.length})</span>}
        </div>
        {activeTools.length === 0 && doneTools.length === 0 && (
          <div className="context-text">No tools used</div>
        )}
        {activeTools.slice(-3).map(tool => (
          <div key={tool.id} className="item">
            <span className="item-icon running">⟳</span>
            <span className="item-name">{tool.name}</span>
            <span className="item-status">running</span>
          </div>
        ))}
        {doneTools.length > 0 && (
          <div className="context-text" style={{ marginTop: 4 }}>{doneTools.length} completed</div>
        )}
      </div>

      {/* Sub-Agents */}
      <div className="section">
        <div className="section-title">
          SUB-AGENTS {activeAgents.length > 0 && <span style={{ color: 'var(--gold)' }}>({activeAgents.length})</span>}
        </div>
        {activeAgents.length === 0 && doneAgents.length === 0 && (
          <div className="context-text">No active sub-agents</div>
        )}
        {activeAgents.map(agent => (
          <div key={agent.id} className="item">
            <span className="item-icon running">⟳</span>
            <span className="item-name">{agent.name}</span>
            <span className="item-status">running</span>
          </div>
        ))}
        {doneAgents.length > 0 && (
          <div className="context-text" style={{ marginTop: 4 }}>{doneAgents.length} completed</div>
        )}
      </div>

      {/* Gateway */}
      <div className="section">
        <div className="section-title">GATEWAY</div>
        <div className="item">
          <span className={`item-icon ${gateway.running ? 'done' : 'running'}`}>
            {gateway.running ? '✓' : '✗'}
          </span>
          <span className="item-name">
            {gateway.running ? `Connected (port ${gateway.port})` : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Log Panel */}
      <div className="section">
        <div className="section-title log-toggle" onClick={() => setLogOpen(!logOpen)}>
          <span>LOG ({logEntries.length})</span>
          <span className={`arrow ${logOpen ? 'open' : ''}`}>▶</span>
        </div>
        {logOpen && (
          <div className="log-panel">
            {logEntries.length === 0 && (
              <div className="log-entry"><span className="log-msg">No entries yet</span></div>
            )}
            {logEntries.slice(-50).map((entry, i) => (
              <div key={i} className="log-entry">
                <span className="log-time">{entry.time}</span>
                <span className={`log-msg ${entry.type}`}>{entry.msg}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
