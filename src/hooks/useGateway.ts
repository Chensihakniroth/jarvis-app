import { useState, useEffect, useRef, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

export interface GatewayState {
  connected: boolean
  url: string
  error: string | null
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  status: 'running' | 'completed' | 'failed'
  output?: string
  startedAt: number
}

export interface SubAgent {
  id: string
  name: string
  goal: string
  status: 'running' | 'completed' | 'failed' | 'queued'
  startedAt: number
}

export interface SessionInfo {
  id: string
  title: string
  messages: number
  contextUsed: number
  contextMax: number
  cost: number
}

// ── Gateway Hook ─────────────────────────────────────────────────────────────

export function useGateway(gatewayUrl: string | undefined) {
  const [state, setState] = useState<GatewayState>({ connected: false, url: '', error: null })
  const [tools, setTools] = useState<ToolCall[]>([])
  const [subAgents, setSubAgents] = useState<SubAgent[]>([])
  const [session, setSession] = useState<SessionInfo | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const requestIdRef = useRef(0)
  const pendingRef = useRef<Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>>(new Map())

  // Connect to gateway WebSocket
  useEffect(() => {
    if (!gatewayUrl) return

    console.log('[Gateway] Connecting to:', gatewayUrl)
    const ws = new WebSocket(gatewayUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[Gateway] Connected')
      setState({ connected: true, url: gatewayUrl, error: null })
      // Send initial session.list
      callRPC('session.list', {}).catch(console.error)
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        handleMessage(msg)
      } catch (err) {
        console.error('[Gateway] Parse error:', err)
      }
    }

    ws.onerror = (err) => {
      console.error('[Gateway] Error:', err)
      setState(s => ({ ...s, error: 'WebSocket error' }))
    }

    ws.onclose = () => {
      console.log('[Gateway] Disconnected')
      setState({ connected: false, url: '', error: 'Disconnected' })
      wsRef.current = null
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [gatewayUrl])

  // Handle incoming messages
  const handleMessage = useCallback((msg: Record<string, unknown>) => {
    // RPC response
    if (msg.id && pendingRef.current.has(msg.id as string)) {
      const pending = pendingRef.current.get(msg.id as string)!
      pendingRef.current.delete(msg.id as string)
      if (msg.error) {
        pending.reject(new Error(msg.error as string))
      } else {
        pending.resolve(msg.result)
      }
      return
    }

    // Server events
    const event = msg as { type?: string; payload?: Record<string, unknown> }
    switch (event.type) {
      case 'gateway.ready':
        console.log('[Gateway] Ready')
        break
      case 'session.info':
        if (event.payload) {
          setSession({
            id: event.payload.id as string || '',
            title: event.payload.title as string || '',
            messages: (event.payload.messages as number) || 0,
            contextUsed: (event.payload.context_used as number) || 0,
            contextMax: (event.payload.context_max as number) || 0,
            cost: (event.payload.cost as number) || 0,
          })
        }
        break
      case 'tool.start':
        if (event.payload) {
          setTools(prev => [...prev.slice(-20), {
            id: event.payload!.id as string || `${Date.now()}`,
            name: event.payload!.name as string || 'unknown',
            input: (event.payload!.input as Record<string, unknown>) || {},
            status: 'running',
            startedAt: Date.now(),
          }])
        }
        break
      case 'tool.complete':
        if (event.payload) {
          setTools(prev => prev.map(t =>
            t.id === event.payload!.id ? { ...t, status: 'completed', output: String(event.payload!.output || '') } : t
          ))
        }
        break
      case 'subagent.start':
        if (event.payload) {
          setSubAgents(prev => [...prev.slice(-10), {
            id: event.payload!.id as string || `${Date.now()}`,
            name: event.payload!.name as string || 'agent',
            goal: event.payload!.goal as string || '',
            status: 'running',
            startedAt: Date.now(),
          }])
        }
        break
      case 'subagent.complete':
        if (event.payload) {
          setSubAgents(prev => prev.map(a =>
            a.id === event.payload!.id ? { ...a, status: 'completed' } : a
          ))
        }
        break
      default:
        // Unknown event type — ignore
        break
    }
  }, [])

  // RPC call helper
  const callRPC = useCallback((method: string, params: Record<string, unknown> = {}): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'))
        return
      }
      const id = `${++requestIdRef.current}`
      pendingRef.current.set(id, { resolve, reject })
      wsRef.current.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }))
      // Timeout after 30s
      setTimeout(() => {
        if (pendingRef.current.has(id)) {
          pendingRef.current.delete(id)
          reject(new Error(`RPC timeout: ${method}`))
        }
      }, 30000)
    })
  }, [])

  // Send a prompt to the agent
  const sendPrompt = useCallback(async (text: string) => {
    try {
      // Create a new session or use existing
      const result = await callRPC('session.create', { cols: 80 }) as { info?: { id: string } }
      const sessionId = result?.info?.id
      if (!sessionId) throw new Error('Failed to create session')

      // Submit the prompt
      await callRPC('prompt.submit', { session_id: sessionId, text })
      return sessionId
    } catch (err) {
      console.error('[Gateway] Send prompt failed:', err)
      throw err
    }
  }, [callRPC])

  return {
    state,
    tools,
    subAgents,
    session,
    callRPC,
    sendPrompt,
  }
}
