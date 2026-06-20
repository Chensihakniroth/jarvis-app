import { useState, useEffect, useCallback, useRef } from 'react'
import { ArcReactor } from './components/ArcReactor'
import AuroraShaderBackground, { type BackgroundTheme } from './components/AuroraShaderBackground'
import { useSoundEffects } from './hooks/useSoundEffects'
import { Loader, type LoaderProps, type LoaderType, LOADER_TYPES } from './components/ui/loader'
import { MatrixCodeRain } from './components/ui/matrix-code-rain'
import { PanelLeftIcon, PanelRightIcon } from '@/lib/icons'
import { ChatLayout } from './components/ChatLayout'

// ── JARVIS Subtitle Filter ──────────────────────────────────────────────────
// Strips markdown, emojis, bullet points, filler — same as the TTS filter
// so the on-screen subtitle matches what the voice actually says.
function jarvisFilter(text: string) {
  if (!text) return ''
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/[#*_`>~]/g, '')
    .replace(/[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\b(Let me think|Thinking\.\.\.|I think|Let me see|Let me check|Let me look|I'll check|I'll look|I'll see|Let me find)\b/gi, '')
    .replace(/\b(Sure!|Certainly!|Of course!|Absolutely!|Great!|Hello!|Great question!|Of course[.]?|Sure thing|No problem|Here you go|Here it is|As you wish)\b/gi, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

type AppState = 'booting' | 'ready' | 'listening' | 'speaking' | 'thinking' | 'error'
interface LogEntry { time: string; msg: string; type: 'info' | 'error' | 'ok' }
interface ModelInfo { id: string; name: string; provider: string; desc: string }
interface ToolCall { id: string; name: string; status: 'running' | 'completed' | 'failed'; startedAt: number }
interface SubAgent { id: string; name: string; status: 'running' | 'completed' | 'failed'; startedAt: number }
interface SessionInfo { contextUsed: number; contextMax: number; cost: number }
interface ChatMessage { id: string; role: 'user' | 'assistant' | 'system'; text: string; ts: number }

function now() {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function App() {
  const [state, setState] = useState<AppState>('booting')
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    try { return localStorage.getItem('jarvis-voice') !== 'false' } catch { return true }
  })
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem('jarvis-sound') !== 'false' } catch { return true }
  })
  const [listening, setListening] = useState(false)
  const [responseText, setResponseText] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const [gatewayStatus, setGatewayStatus] = useState<'online' | 'offline' | 'error'>('offline')
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([])
  const [currentModel, setCurrentModel] = useState('')
  const [currentProvider, setCurrentProvider] = useState('')
  const [wsConnected, setWsConnected] = useState(false)
  const [sessionToken, setSessionToken] = useState('')
  const [currentSessionId, setCurrentSessionId] = useState('')

  // ── Persistent UI settings (all read from localStorage with safe fallbacks) ──
  const [modelSectionOpen, setModelSectionOpen] = useState(() => {
    try { return localStorage.getItem('jarvis-section-model') === 'true' } catch { return false }
  })
  const [statusSectionOpen, setStatusSectionOpen] = useState(() => {
    try { return localStorage.getItem('jarvis-section-status') !== 'false' } catch { return true }
  })
  const [logSectionOpen, setLogSectionOpen] = useState(() => {
    try { return localStorage.getItem('jarvis-section-log') !== 'false' } catch { return true }
  })

  const [contextSectionOpen, setContextSectionOpen] = useState(() => {
    try { return localStorage.getItem('jarvis-section-context') !== 'false' } catch { return true }
  })
  const [costSectionOpen, setCostSectionOpen] = useState(() => {
    try { return localStorage.getItem('jarvis-section-cost') !== 'false' } catch { return true }
  })
  const [diagSectionOpen, setDiagSectionOpen] = useState(() => {
    try { return localStorage.getItem('jarvis-section-diag') !== 'false' } catch { return true }
  })
  const [loaderSectionOpen, setLoaderSectionOpen] = useState(() => {
    try { return localStorage.getItem('jarvis-section-loader') === 'true' } catch { return false }
  })
  const [activeLoader, setActiveLoader] = useState<LoaderType>(() => {
    try { return (localStorage.getItem('jarvis-loader-variant') as LoaderType) || 'rose-curve' } catch { return 'rose-curve' }
  })

  const [bgTheme, setBgTheme] = useState<BackgroundTheme>(() => {
    try { return (localStorage.getItem('jarvis-bg-theme') as BackgroundTheme) || 'aurora' } catch { return 'aurora' }
  })
  const [bgSectionOpen, setBgSectionOpen] = useState(() => {
    try { return localStorage.getItem('jarvis-section-bg') === 'true' } catch { return false }
  })

  // Glass opacity (0-100, default 55)
  const [glassOpacity, setGlassOpacity] = useState(() => {
    try { return Number(localStorage.getItem('jarvis-glass-opacity')) || 55 } catch { return 55 }
  })
  const [glassSectionOpen, setGlassSectionOpen] = useState(() => {
    try { return localStorage.getItem('jarvis-section-glass') === 'true' } catch { return false }
  })

  // Code Rain settings (persisted)
  const [crCharset, setCrCharset] = useState(() => {
    try { return localStorage.getItem('jarvis-cr-charset') || 'Latin' } catch { return 'Latin' }
  })
  const [crFontSize, setCrFontSize] = useState(() => {
    try { return Number(localStorage.getItem('jarvis-cr-fontsize')) || 14 } catch { return 14 }
  })
  const [crSpeed, setCrSpeed] = useState(() => {
    try { return Number(localStorage.getItem('jarvis-cr-speed')) || 0.4 } catch { return 0.4 }
  })
  const [crDensity, setCrDensity] = useState(() => {
    try { return Number(localStorage.getItem('jarvis-cr-density')) || 1 } catch { return 1 }
  })
  const [crColor, setCrColor] = useState(() => {
    try { return localStorage.getItem('jarvis-cr-color') || '#00FF41' } catch { return '#00FF41' }
  })

  const CHARSET_PRESETS: Record<string, string> = {
    'Latin': 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+-=[]{}|;:,./<>?',
    'Katakana': 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン',
    'Symbols': '◆◇○●□■△▲▽▼★☆♠♣♥♦',
    'Binary': '01',
    'Hex': '0123456789ABCDEF',
  }

  const [tools, setTools] = useState<ToolCall[]>([])
  const [subAgents, setSubAgents] = useState<SubAgent[]>([])
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)

  const sfx = useSoundEffects()

  useEffect(() => {
    sfx.setEnabled(soundEnabled)
  }, [soundEnabled, sfx])

  // Persist sidebar section states
  useEffect(() => { try { localStorage.setItem('jarvis-section-model', String(modelSectionOpen)) } catch {} }, [modelSectionOpen])
  useEffect(() => { try { localStorage.setItem('jarvis-section-status', String(statusSectionOpen)) } catch {} }, [statusSectionOpen])
  useEffect(() => { try { localStorage.setItem('jarvis-section-log', String(logSectionOpen)) } catch {} }, [logSectionOpen])
  useEffect(() => { try { localStorage.setItem('jarvis-section-context', String(contextSectionOpen)) } catch {} }, [contextSectionOpen])
  useEffect(() => { try { localStorage.setItem('jarvis-section-cost', String(costSectionOpen)) } catch {} }, [costSectionOpen])
  useEffect(() => { try { localStorage.setItem('jarvis-section-diag', String(diagSectionOpen)) } catch {} }, [diagSectionOpen])
  useEffect(() => { try { localStorage.setItem('jarvis-section-loader', String(loaderSectionOpen)) } catch {} }, [loaderSectionOpen])
  useEffect(() => { try { localStorage.setItem('jarvis-section-bg', String(bgSectionOpen)) } catch {} }, [bgSectionOpen])
  useEffect(() => { try { localStorage.setItem('jarvis-section-glass', String(glassSectionOpen)) } catch {} }, [glassSectionOpen])
  // Persist glass opacity + update CSS variable
  useEffect(() => {
    try { localStorage.setItem('jarvis-glass-opacity', String(glassOpacity)) } catch {}
    document.documentElement.style.setProperty('--glass-opacity', String(glassOpacity / 100))
  }, [glassOpacity])

  // Initialize CSS variable on mount
  useEffect(() => {
    document.documentElement.style.setProperty('--glass-opacity', String(glassOpacity / 100))
  }, [])

  // Persist Code Rain settings
  useEffect(() => { try { localStorage.setItem('jarvis-cr-charset', crCharset) } catch {} }, [crCharset])
  useEffect(() => { try { localStorage.setItem('jarvis-cr-fontsize', String(crFontSize)) } catch {} }, [crFontSize])
  useEffect(() => { try { localStorage.setItem('jarvis-cr-speed', String(crSpeed)) } catch {} }, [crSpeed])
  useEffect(() => { try { localStorage.setItem('jarvis-cr-density', String(crDensity)) } catch {} }, [crDensity])
  useEffect(() => { try { localStorage.setItem('jarvis-cr-color', crColor) } catch {} }, [crColor])

  // Persist loader variant
  useEffect(() => { try { localStorage.setItem('jarvis-loader-variant', activeLoader) } catch {} }, [activeLoader])

  // Keep session ID ref in sync with state (avoids stale closures in handleSend)
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId
  }, [currentSessionId])

  // Keep ws connected ref in sync
  useEffect(() => {
    wsConnectedRef.current = wsConnected
  }, [wsConnected])

  // Keep state ref in sync (for timeout checks)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const speakingRef = useRef(false)
  const textRef = useRef('')
  const charIndexRef = useRef(0)
  const isStreamingRef = useRef(false)
  const wsRef = useRef<WebSocket | null>(null)
  const wsIdRef = useRef(0)
  const currentSessionIdRef = useRef('')
  const wsConnectedRef = useRef(false)
  const stateRef = useRef<AppState>('booting')

  const addLog = useCallback((msg: string, type: LogEntry['type'] = 'info') => {
    setLogEntries(prev => [...prev.slice(-200), { time: now(), msg, type }])
  }, [])

  // Session caching — avoid recreating on every message
  const SESSION_KEY = 'jarvis-session-id'
  const getCachedSession = () => { try { return localStorage.getItem(SESSION_KEY) || '' } catch { return '' } }
  const setCachedSession = (id: string) => { try { localStorage.setItem(SESSION_KEY, id) } catch { /* ignore */ } }

  const wsCall = useCallback((method: string, params: Record<string, unknown> = {}) => {
    return new Promise<any>((resolve, reject) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) { reject(new Error('WS not connected')); return }
      const id = `${++wsIdRef.current}`
      const handler = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.id === id) {
            ws.removeEventListener('message', handler)
            if (msg.error) {
              const errMsg = typeof msg.error === 'string' ? msg.error : JSON.stringify(msg.error)
              reject(new Error(errMsg))
            } else {
              resolve(msg.result)
            }
          }
        } catch { /* ignore */ }
      }
      ws.addEventListener('message', handler)
      ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }))
      setTimeout(() => { ws.removeEventListener('message', handler); reject(new Error('RPC timeout: ' + method)) }, 15000)
    })
  }, [])

  // Main process events
  useEffect(() => {
    window.jarvisAPI?.onGatewayReady((result: any) => {
      if (result?.ok) {
        setGatewayStatus('online')
        if (result.sessionToken) setSessionToken(result.sessionToken)
        addLog(`Gateway ${result.alreadyRunning ? 'already running' : 'started'} on port ${result.port}`, 'ok')
      } else {
        setGatewayStatus('error')
        addLog(`Gateway failed: ${result?.error}`, 'error')
      }
    })
    window.jarvisAPI?.onGatewayExit((data: any) => {
      setGatewayStatus('offline')
      setWsConnected(false)
      addLog(`Gateway exited (code: ${data?.code})`, 'error')
    })
    window.jarvisAPI?.onMainLog((entry: any) => {
      addLog(entry.msg, entry.type)
    })
  }, [addLog])

  // WebSocket connect with auto-reconnect
  useEffect(() => {
    if (gatewayStatus !== 'online') return

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let shouldReconnect = true
    let eventHandler: ((event: MessageEvent) => void) | null = null

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return
      addLog('Connecting WebSocket...', 'info')
      const token = sessionToken
      const wsUrl = token ? `ws://127.0.0.1:9119/api/ws?token=${encodeURIComponent(token)}` : `ws://127.0.0.1:9119/api/ws`
      addLog(`WS: ${token ? 'with token' : 'no token'}`, 'info')
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        addLog('WebSocket connected!', 'ok')
        setWsConnected(true)
        // Always create a fresh session — cached sessions may be stale after gateway restart
        wsCall('session.create', {}).then((sessResult: any) => {
          const sid = sessResult?.session_id || sessResult?.stored_session_id || sessResult?.id || ''
          setCurrentSessionId(sid)
          setCachedSession(sid)
          currentSessionIdRef.current = sid
          addLog(`Session created: ${sid.slice(0,20)}...`, 'ok')
        }).catch((sessErr: any) => {
          addLog(`Session create failed: ${sessErr?.message || sessErr}`, 'info')
        })
        // Load models
        wsCall('model.options', { picker_hints: true, include_unconfigured: true }).then((result: any) => {
          addLog(`model.options ok, keys: ${Object.keys(result || {}).join(',')}`, 'ok')
          if (result?.providers) {
            const models: ModelInfo[] = []
            for (const provider of result.providers) {
              const pName = provider.slug || provider.name || 'unknown'
              if (Array.isArray(provider.models)) {
                for (const m of provider.models) {
                  if (typeof m === 'string') {
                    models.push({ id: m, name: m.split('/').pop() || m, provider: pName, desc: pName })
                  } else if (m && typeof m === 'object') {
                    models.push({ id: m.id || m.model || m.slug || '', name: m.name || m.id || m.model || m.slug || '', provider: pName, desc: m.description || m.desc || pName })
                  }
                }
              }
            }
            setAvailableModels(models)
            addLog(`Loaded ${models.length} models from ${result.providers.length} providers`, 'ok')
          }
          if (result?.model) setCurrentModel(result.model)
          if (result?.provider) setCurrentProvider(result.provider)
        }).catch((err: any) => addLog(`model.options failed: ${err?.message || err}`, 'error'))
      }

      // Listen for agent response events
      eventHandler = (evt: MessageEvent) => {
        try {
          const msg = JSON.parse(evt.data)
          // DEBUG: log all incoming messages
          addLog(`[WS msg] method=${msg.method || 'none'} id=${msg.id || 'none'} type=${msg.params?.type || 'none'}`, 'info')
          // Events have no id and method=event
          if (!msg.id && msg.method === 'event') {
            const eventType = msg.params?.type || ''
            const payload = msg.params?.payload || {}
            const sid = msg.params?.session_id || ''
            if (eventType) addLog(`Event: ${eventType} (sid: ${sid.slice(0,8)})`, 'info')

            // Streaming text chunks — display immediately, no TTS yet
            if (eventType === 'message.delta' && payload.text) {
              textRef.current += payload.text
              isStreamingRef.current = true
              setResponseText(textRef.current)
            }
            // Complete message — now start TTS with full text
            if (eventType === 'message.complete') {
              const content = payload.text || textRef.current
              if (content && typeof content === 'string') {
                const filtered = jarvisFilter(content)
                textRef.current = filtered
                charIndexRef.current = filtered.length
                setResponseText(filtered)
                const assistantMsg: ChatMessage = { id: `a-${Date.now()}`, role: 'assistant', text: filtered, ts: Date.now() }
                setChatMessages(prev => [...prev, assistantMsg])
              }
              setState('ready')
              isStreamingRef.current = false
              // Start TTS now with the complete text
              if (textRef.current) {
                speak(textRef.current)
              }
            }
            if (eventType === 'status.update' && payload.text) {
              addLog(`Status: ${payload.text}`, 'info')
            }
            if (eventType === 'session.created' && sid) {
              setCurrentSessionId(sid)
              setCachedSession(sid)
            }

            // Diagnostics & Metrics extraction
            if (eventType === 'tool.start') {
              setTools(prev => [...prev.filter(t => t.id !== payload.id), {
                id: (payload.id as string) || `${Date.now()}`,
                name: (payload.name as string) || 'tool',
                status: 'running' as const,
                startedAt: Date.now()
              }].slice(-15))
            }
            if (eventType === 'tool.complete') {
              setTools(prev => prev.map(t => t.id === payload.id ? { ...t, status: 'completed' as const } : t))
            }
            if (eventType === 'subagent.start') {
              setSubAgents(prev => [...prev.filter(a => a.id !== payload.id), {
                id: (payload.id as string) || `${Date.now()}`,
                name: (payload.name as string) || 'sub-agent',
                status: 'running' as const,
                startedAt: Date.now()
              }].slice(-5))
            }
            if (eventType === 'subagent.complete') {
              setSubAgents(prev => prev.map(a => a.id === payload.id ? { ...a, status: 'completed' as const } : a))
            }
            if (eventType === 'session.info') {
              setSessionInfo({
                contextUsed: (payload.context_used as number) || (payload.contextUsed as number) || 0,
                contextMax: (payload.context_max as number) || (payload.contextMax as number) || 200000,
                cost: (payload.cost as number) || 0
              })
            }
          }
        } catch { /* ignore */ }
      }
      ws.addEventListener('message', eventHandler)

      ws.onclose = (e) => {
        if (eventHandler) ws.removeEventListener('message', eventHandler)
        setWsConnected(false)
        wsRef.current = null
        const reasons: Record<number, string> = { 4401: 'auth failed', 4403: 'forbidden', 4404: 'disabled' }
        addLog(`WS closed: code=${e.code} (${reasons[e.code] || 'unknown'})`, 'error')
        if (shouldReconnect && gatewayStatus === 'online') {
          addLog('Auto-reconnect in 3s...', 'info')
          reconnectTimer = setTimeout(connect, 3000)
        }
      }
    }

    connect()
    return () => {
      shouldReconnect = false
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
    }
  }, [gatewayStatus, sessionToken, addLog, wsCall])

  // Typewriter effect — only runs for non-streaming responses (simulated mode)
  const typewriterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    // Skip during streaming — text appears instantly from deltas
    if (isStreamingRef.current) return
    if (!textRef.current || charIndexRef.current >= textRef.current.length) return
    typewriterTimerRef.current = setTimeout(() => {
      charIndexRef.current += 1
      setResponseText(textRef.current.slice(0, charIndexRef.current))
    }, 15)
    return () => {
      if (typewriterTimerRef.current) clearTimeout(typewriterTimerRef.current)
    }
  }, [responseText])

  // Split text into sentences for subtitle display
  const splitSentences = useCallback((text: string) => {
    const normalized = text.replace(/[\u2014\u2013]/g, '. ')
    const raw = normalized.match(/[^.!?;]+[.!?;]+[\s]*/g) || [normalized]
    return raw.map(s => s.trim()).filter(s => s.length > 0)
  }, [])

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    const el = chatScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatMessages, responseText])

  const speak = useCallback(async (text: string) => {
    if (!voiceEnabled || speakingRef.current) return
    speakingRef.current = true
    addLog(`Speaking: "${text.slice(0, 80)}"`, 'info')

    // Split into sentences for synced subtitle display
    const sentences = splitSentences(text)
    let currentSentenceIdx = 0
    let rafId: number | null = null
    let audioEl: HTMLAudioElement | null = null

    try {
      const result = await window.jarvisAPI?.speakTextFiltered(text)
      addLog(`TTS result: ok=${result?.ok} audioLen=${result?.audio?.length || 0}`, 'info')
      if (result?.ok && result?.audio) {
        const audio = new Audio(`data:audio/wav;base64,${result.audio}`)
        audioEl = audio

        // Show first sentence immediately when audio starts
        audio.onplay = () => {
          setState('speaking')
          if (sentences.length > 0) {
            setResponseText(sentences[0])
            currentSentenceIdx = 0
          }
        }

        // Subtitle sync: show only 1-2 sentences at a time, sliding window
        const syncSubtitles = () => {
          if (!audioEl || audioEl.paused || audioEl.ended) return
          if (sentences.length <= 1) return

          const t = audioEl.currentTime
          const dur = audioEl.duration
          if (!dur || !isFinite(dur) || dur === 0) {
            rafId = requestAnimationFrame(syncSubtitles)
            return
          }

          // Map time → character position → sentence index
          const totalChars = sentences.reduce((sum, s) => sum + s.length, 0)
          const elapsedRatio = Math.min(t / dur, 1)
          const elapsedChars = elapsedRatio * totalChars

          let charCount = 0
          let targetIdx = 0
          for (let i = 0; i < sentences.length; i++) {
            charCount += sentences[i].length
            if (elapsedChars >= charCount) {
              targetIdx = i + 1
            } else {
              break
            }
          }
          targetIdx = Math.min(targetIdx, sentences.length - 1)

          if (targetIdx > currentSentenceIdx) {
            currentSentenceIdx = targetIdx
            // Show only 1-2 sentences: current + previous (if exists)
            const startIdx = Math.max(0, currentSentenceIdx - 1)
            setResponseText(sentences.slice(startIdx, currentSentenceIdx + 1).join(' '))
          }

          rafId = requestAnimationFrame(syncSubtitles)
        }

        audio.onended = () => {
          // Show only the last 1-2 sentences on end, not the full text
          if (sentences.length > 2) {
            setResponseText(sentences.slice(-2).join(' '))
          } else {
            setResponseText(text)
          }
          speakingRef.current = false
          setState('ready')
          if (rafId) cancelAnimationFrame(rafId)
        }
        audio.onerror = (e) => {
          addLog(`TTS playback error: ${e}`, 'error')
          setResponseText(text)
          speakingRef.current = false
          setState('ready')
          if (rafId) cancelAnimationFrame(rafId)
        }

        await audio.play()
        rafId = requestAnimationFrame(syncSubtitles)
      } else {
        addLog(`TTS failed: ${result?.error || 'unknown'}`, 'error')
        speakingRef.current = false
        setState('ready')
        setResponseText(text)
      }
    } catch (err) {
      addLog(`TTS error: ${err}`, 'error')
      speakingRef.current = false
      setState('ready')
      setResponseText(text)
    }
  }, [voiceEnabled, addLog, splitSentences])

  const handleSend = useCallback(async (text: string) => {
    sfx.click()
    if (!text.trim()) return

    // Reset and stop any playing audio for new response
    speakingRef.current = false
    textRef.current = ''
    charIndexRef.current = 0
    isStreamingRef.current = false
    setResponseText('')

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text: text.trim(), ts: Date.now() }
    setChatMessages(prev => [...prev, userMsg])
    addLog(`User: "${text.slice(0, 80)}"`, 'info')
    setState('thinking')
    try {
      if (wsConnectedRef.current) {
        addLog('Sending prompt.submit...', 'info')
        // Read session ID from ref to avoid stale closure
        let sid = currentSessionIdRef.current
        if (!sid) {
          addLog('No session, creating one...', 'info')
          const sessResult = await wsCall('session.create', {})
          sid = sessResult?.session_id || sessResult?.stored_session_id || sessResult?.id || ''
          setCurrentSessionId(sid)
          setCachedSession(sid)
          currentSessionIdRef.current = sid
          addLog(`Session: ${sid.slice(0,20)}...`, 'ok')
        }
        if (wsRef.current) {
          const sendMsg = JSON.stringify({ jsonrpc: '2.0', id: `${++wsIdRef.current}`, method: 'prompt.submit', params: { text, session_id: sid } })
          addLog(`[WS send] ${sendMsg.slice(0,120)}`, 'info')
          wsRef.current.send(sendMsg)
          addLog('Prompt submitted, waiting for response events...', 'info')
          // Fallback timeout — if no response in 30s, stop thinking
          setTimeout(() => {
            if (stateRef.current === 'thinking') {
              setState('ready')
              addLog('Response timeout — no reply from agent', 'error')
            }
          }, 30000)
        } else {
          addLog('WebSocket not available', 'error')
        }
      } else {
        setTimeout(() => {
          const response = `Acknowledged, Sir. Processing: "${text}"`
          textRef.current = response
          charIndexRef.current = 0
          setResponseText('')
          const assistantMsg: ChatMessage = { id: `a-${Date.now()}`, role: 'assistant', text: response, ts: Date.now() }
          setChatMessages(prev => [...prev, assistantMsg])
          addLog('Agent responded (simulated)', 'ok')
          setState('ready')
          speak(response)
        }, 1500)
      }
    } catch (err: any) {
      const msg = err?.message || err?.toString() || String(err)
      addLog(`Error: ${msg}`, 'error')
      setState('error')
    }
  }, [addLog, wsCall, speak, sfx])

  const handleModelChange = useCallback(async (modelId: string, provider: string) => {
    sfx.click()
    addLog(`Switching to ${modelId}...`, 'info')
    try {
      if (wsConnected) await wsCall('model.set', { scope: 'main', provider, model: modelId })
      setCurrentModel(modelId)
      setCurrentProvider(provider)
      addLog(`Model switched to ${modelId}`, 'ok')
    } catch (err) { addLog(`Model switch failed: ${err}`, 'error') }
  }, [addLog, wsCall, wsConnected, sfx])

  const handleMicToggle = useCallback(() => {
    setListening(l => {
      const next = !l
      if (next) sfx.toggleOn()
      else sfx.toggleOff()
      addLog(next ? 'Voice input: listening...' : 'Voice input stopped', 'info')
      return next
    })
  }, [addLog, sfx])

  const toggleLeftSidebar = () => {
    setLeftSidebarOpen(prev => {
      const next = !prev
      if (next) sfx.sidebarOpen()
      else sfx.sidebarClose()
      return next
    })
  }

  const toggleRightSidebar = () => {
    setRightSidebarOpen(prev => {
      const next = !prev
      if (next) sfx.sidebarOpen()
      else sfx.sidebarClose()
      return next
    })
  }

  const toggleVoice = () => {
    setVoiceEnabled(prev => {
      const next = !prev
      try { localStorage.setItem('jarvis-voice', String(next)) } catch { /* ignore */ }
      if (next) sfx.toggleOn()
      else sfx.toggleOff()
      return next
    })
  }

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev
      try { localStorage.setItem('jarvis-sound', String(next)) } catch { /* ignore */ }
      if (next) sfx.toggleOn()
      else sfx.toggleOff()
      return next
    })
  }

  const toggleModelSection = () => {
    sfx.sectionToggle()
    setModelSectionOpen(!modelSectionOpen)
  }

  const toggleStatusSection = () => {
    sfx.sectionToggle()
    setStatusSectionOpen(!statusSectionOpen)
  }

  const toggleLogSection = () => {
    sfx.sectionToggle()
    setLogSectionOpen(!logSectionOpen)
  }

  const toggleContextSection = () => {
    sfx.sectionToggle()
    setContextSectionOpen(!contextSectionOpen)
  }

  const toggleCostSection = () => {
    sfx.sectionToggle()
    setCostSectionOpen(!costSectionOpen)
  }

  const toggleDiagSection = () => {
    sfx.sectionToggle()
    setDiagSectionOpen(!diagSectionOpen)
  }

  const toggleLoaderSection = () => {
    sfx.sectionToggle()
    setLoaderSectionOpen(!loaderSectionOpen)
  }

  const toggleBgSection = () => {
    sfx.sectionToggle()
    setBgSectionOpen(!bgSectionOpen)
  }

  const toggleGlassSection = () => {
    sfx.sectionToggle()
    setGlassSectionOpen(!glassSectionOpen)
  }

  const handleBgThemeChange = (t: BackgroundTheme) => {
    sfx.click()
    setBgTheme(t)
    try { localStorage.setItem('jarvis-bg-theme', t) } catch { /* ignore */ }
  }

  // Keyboard shortcuts: Ctrl++/Ctrl+-/Ctrl+0 for zoom
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      if (e.key === '+' || e.key === '=' || e.key === 'Add') {
        e.preventDefault()
        window.jarvisAPI?.zoomIn()
      } else if (e.key === '-' || e.key === 'Subtract') {
        e.preventDefault()
        window.jarvisAPI?.zoomOut()
      } else if (e.key === '0') {
        e.preventDefault()
        window.jarvisAPI?.zoomReset()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Derived metrics
  const contextUsed = sessionInfo?.contextUsed || 0
  const contextMax = sessionInfo?.contextMax || 200000
  const contextPct = Math.min(100, Math.round((contextUsed / contextMax) * 100)) || 0
  const cost = sessionInfo?.cost || 0
  const contextColor = contextPct > 85 ? 'var(--red)' : contextPct > 60 ? 'var(--gold)' : 'var(--green)'

  // ── Derived display helpers ──
  const stateLabel = state === 'speaking' ? 'SPEAKING' : state === 'thinking' ? 'PROCESSING' : state === 'listening' ? 'LISTENING' : state === 'error' ? 'ERROR' : gatewayStatus === 'online' ? 'ONLINE' : 'STANDBY'
  const stateChipClass = state === 'speaking' ? 'speaking' : state === 'thinking' ? 'thinking' : state === 'error' ? 'error' : 'ready'
  const logBadgeColor = logEntries.length > 50 ? 'var(--col-energy-warn)' : 'var(--col-arc-primary)'

  return (
    <div className="hud-root">
      {/* ═══ Z-LAYER 0: Background ═══ */}
      {bgTheme === 'matrix-code-rain' ? (
        <MatrixCodeRain
          charset={CHARSET_PRESETS[crCharset] || CHARSET_PRESETS['Latin']}
          fontSize={crFontSize}
          speed={crSpeed}
          density={crDensity}
          textColor={crColor}
        />
      ) : (
        <AuroraShaderBackground theme={bgTheme} />
      )}

      {/* ═══ Z-LAYER 1: Titlebar ═══ */}
      <div className="hud-titlebar" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="hud-titlebar-left">
          <button className="hud-titlebar-btn" onClick={toggleLeftSidebar} title="Toggle Sidebar" style={{ WebkitAppRegion: 'no-drag', marginRight: 4 } as React.CSSProperties}>
            <PanelLeftIcon className="size-4 opacity-70" />
          </button>
          <span className="hud-titlebar-dot" style={{ background: 'var(--col-energy-active)', boxShadow: '0 0 8px var(--col-energy-active)' }} />
          <span className="hud-titlebar-brand font-display">J.A.R.V.I.S.</span>
          <span className="hud-titlebar-sep" />
          <span className="hud-titlebar-model font-accent" style={{ color: 'var(--col-arc-primary)' }}>
            MODEL: {currentModel ? currentModel.split('/').pop() : '—'}
          </span>
        </div>
        <div className="hud-titlebar-center">
          <span className="hud-titlebar-session font-mono" style={{ color: 'var(--col-text-secondary)', fontSize: 10 }}>
            {currentSessionId ? `SES:${currentSessionId.slice(0,8)}` : 'NO SESSION'}
          </span>
        </div>
        <div className="hud-titlebar-right" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button className="hud-titlebar-btn" onClick={toggleRightSidebar} title="Toggle Right Sidebar" style={{ marginRight: 8 }}>
            <PanelRightIcon className="size-4 opacity-70" />
          </button>
          <button className="hud-titlebar-btn" onClick={() => window.jarvisAPI?.minimize()} title="Minimize">
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.2"/></svg>
          </button>
          <button className="hud-titlebar-btn" onClick={() => window.jarvisAPI?.maximize()} title="Maximize">
            <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.2" rx="1"/></svg>
          </button>
          <button className="hud-titlebar-btn hud-titlebar-close" onClick={() => window.jarvisAPI?.close()} title="Close">
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.2"/></svg>
          </button>
        </div>
      </div>

      {/* ═══ Z-LAYER 2: Main Layout ═══ */}
      <div className="hud-layout">

        {/* ─── LEFT SIDEBAR ─── */}
        <aside className={`hud-sidebar ${leftSidebarOpen ? '' : 'hud-sidebar-collapsed'}`}>
          <div className="hud-sidebar-inner">
            {/* MODEL Section */}
            <div className="hud-panel-section">
              <div className="panel-header" onClick={toggleModelSection}>
                <span className="panel-icon">◈</span>
                <span style={{ flex: 1 }}>MODEL</span>
                <span className="font-mono" style={{ fontSize: 9, color: 'var(--col-arc-primary)', fontWeight: 400 }}>
                  {currentModel ? currentModel.split('/').pop() : '—'}
                </span>
                <span className={`hud-chevron ${modelSectionOpen ? 'hud-chevron-open' : ''}`}>▾</span>
              </div>
              {modelSectionOpen && (
                <div className="hud-panel-body">
                  {availableModels.length === 0 && (
                    <div className="font-mono" style={{ fontSize: 9, color: 'var(--col-text-secondary)', padding: '4px 0' }}>No models loaded</div>
                  )}
                  {availableModels.map(m => (
                    <div key={m.id} className={`hud-model-item ${currentModel === m.id ? 'hud-model-active' : ''}`} onClick={() => handleModelChange(m.id, m.provider)}>
                      <span className="hud-model-name">{m.name}</span>
                      <span className="hud-model-provider">{m.provider}</span>
                      {currentModel === m.id && <span className="hud-model-check" style={{ color: 'var(--col-energy-active)' }}>●</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* STATUS Section */}
            <div className="hud-panel-section">
              <div className="panel-header" onClick={toggleStatusSection}>
                <span className="panel-icon">◎</span>
                <span style={{ flex: 1 }}>STATUS</span>
                <span className={`pulse-dot ${stateChipClass === 'ready' ? '' : ''}`} style={{
                  background: stateChipClass === 'ready' ? 'var(--col-arc-primary)' : stateChipClass === 'speaking' ? 'var(--col-energy-active)' : stateChipClass === 'thinking' ? 'var(--col-energy-warn)' : 'var(--col-energy-alert)',
                  color: stateChipClass === 'ready' ? 'var(--col-arc-primary)' : stateChipClass === 'speaking' ? 'var(--col-energy-active)' : stateChipClass === 'thinking' ? 'var(--col-energy-warn)' : 'var(--col-energy-alert)',
                }} />
                <span className={`hud-chevron ${statusSectionOpen ? 'hud-chevron-open' : ''}`}>▾</span>
              </div>
              {statusSectionOpen && (
                <div className="hud-panel-body">
                  {/* Gateway */}
                  <div className="hud-status-row">
                    <span className="hud-status-label font-accent">GATEWAY</span>
                    <span className="pulse-dot" style={{
                      background: gatewayStatus === 'online' ? 'var(--col-energy-active)' : 'var(--col-energy-alert)',
                      color: gatewayStatus === 'online' ? 'var(--col-energy-active)' : 'var(--col-energy-alert)',
                      width: 6, height: 6,
                    }} />
                    <span className="hud-status-val font-mono" style={{ color: gatewayStatus === 'online' ? 'var(--col-energy-active)' : gatewayStatus === 'error' ? 'var(--col-energy-alert)' : 'var(--col-text-secondary)' }}>
                      {gatewayStatus === 'online' ? 'CONNECTED' : gatewayStatus === 'error' ? 'ERROR' : 'OFFLINE'}
                    </span>
                  </div>
                  {/* WebSocket */}
                  <div className="hud-status-row">
                    <span className="hud-status-label font-accent">WEBSOCKET</span>
                    <span className="pulse-dot" style={{
                      background: wsConnected ? 'var(--col-energy-active)' : 'var(--col-text-secondary)',
                      color: wsConnected ? 'var(--col-energy-active)' : 'var(--col-text-secondary)',
                      width: 6, height: 6,
                    }} />
                    <span className="hud-status-val font-mono" style={{ color: wsConnected ? 'var(--col-energy-active)' : 'var(--col-text-secondary)' }}>
                      {wsConnected ? 'CONNECTED' : 'DISCONNECTED'}
                    </span>
                  </div>
                  {/* State Chip */}
                  <div className="hud-status-row">
                    <span className="hud-status-label font-accent">STATE</span>
                    <span className={`status-chip ${stateChipClass}`}>
                      {stateLabel}
                    </span>
                  </div>
                  {/* Toggles */}
                  <div className="hud-toggle-row">
                    <span className="hud-toggle-label font-accent">VOICE REPLY</span>
                    <div className={`hud-toggle ${voiceEnabled ? 'on' : ''}`} onClick={toggleVoice} />
                  </div>
                  <div className="hud-toggle-row">
                    <span className="hud-toggle-label font-accent">VOICE INPUT</span>
                    <div className={`hud-toggle ${listening ? 'on' : ''}`} onClick={handleMicToggle} style={listening ? { borderColor: 'var(--col-energy-alert)', background: 'rgba(255,45,85,0.15)' } : undefined} />
                  </div>
                  <div className="hud-toggle-row">
                    <span className="hud-toggle-label font-accent">SOUND FX</span>
                    <div className={`hud-toggle ${soundEnabled ? 'on' : ''}`} onClick={toggleSound} />
                  </div>
                </div>
              )}
            </div>

            {/* LOG Section */}
            <div className="hud-panel-section">
              <div className="panel-header" onClick={toggleLogSection}>
                <span className="panel-icon">▤</span>
                <span style={{ flex: 1 }}>LOG</span>
                <span className="hud-log-badge" style={{ background: logBadgeColor }}>{logEntries.length}</span>
                <span className={`hud-chevron ${logSectionOpen ? 'hud-chevron-open' : ''}`}>▾</span>
              </div>
              {logSectionOpen && (
                <div className="hud-panel-body">
                  <div className="hud-log-panel hud-scroll">
                    {logEntries.length === 0 && (
                      <div className="hud-log-entry"><span className="hud-log-msg">Awaiting input...</span></div>
                    )}
                    {logEntries.slice(-60).map((e, i) => (
                      <div key={i} className="hud-log-entry log-entry-anim">
                        <span className="hud-log-time font-mono">{e.time}</span>
                        <span className={`hud-log-msg font-mono ${e.type === 'error' ? 'hud-log-error' : e.type === 'ok' ? 'hud-log-ok' : ''}`}>{e.msg}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Sidebar Toggle Tab */}
          <button className="hud-sidebar-toggle" onClick={toggleLeftSidebar}>
            {leftSidebarOpen ? '‹' : '›'}
          </button>
        </aside>

        {/* ─── CORE VIEWPORT ─── */}
        <main className={`hud-core ${chatMessages.length > 0 ? 'hud-core--chat-active' : ''}`}>

          {/* ── Hero Welcome (no messages) ── */}
          {chatMessages.length === 0 && !responseText && (
            <div className="hud-hero">
              <div className={`hud-hero-reactor ${state === 'thinking' ? 'hud-orb-thinking' : state === 'speaking' ? 'hud-orb-speaking' : state === 'listening' ? 'hud-orb-listening' : state === 'error' ? 'hud-orb-error' : 'hud-orb-idle'}`}>
                <ArcReactor state={state} size={280} />
              </div>
              <div className="hud-hero-status">
                <span className={`status-chip ${stateChipClass}`}>
                  <span className="pulse-dot" style={{
                    width: 6, height: 6,
                    background: stateChipClass === 'ready' ? 'var(--col-arc-primary)' : stateChipClass === 'speaking' ? 'var(--col-energy-active)' : stateChipClass === 'thinking' ? 'var(--col-energy-warn)' : 'var(--col-energy-alert)',
                    color: stateChipClass === 'ready' ? 'var(--col-arc-primary)' : stateChipClass === 'speaking' ? 'var(--col-energy-active)' : stateChipClass === 'thinking' ? 'var(--col-energy-warn)' : 'var(--col-energy-alert)',
                  }} />
                  {stateLabel}
                </span>
              </div>
              <div className="hud-hero-greeting font-display">
                <span className="hud-hero-title">J.A.R.V.I.S.</span>
                <span className="hud-hero-subtitle font-accent">Just A Rather Very Intelligent System</span>
              </div>
              {/* Voice bars in hero mode */}
              {state === 'speaking' && (
                <div className="hud-voice-bars">
                  {[...Array(12)].map((_, i) => (
                    <span key={i} style={{ animationDelay: `${i * 0.08}s` }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Docked Reactor Header (has messages) ── */}
          {(chatMessages.length > 0 || responseText) && (
            <div className="hud-docked-header">
              <div className={`hud-docked-reactor ${state === 'thinking' ? 'hud-orb-thinking' : state === 'speaking' ? 'hud-orb-speaking' : state === 'listening' ? 'hud-orb-listening' : state === 'error' ? 'hud-orb-error' : 'hud-orb-idle'}`}>
                <ArcReactor state={state} size={48} />
              </div>
              <div className="hud-docked-info">
                <span className="hud-docked-name font-display">J.A.R.V.I.S.</span>
                <span className={`hud-docked-status status-chip-mini ${stateChipClass}`}>
                  <span className="pulse-dot" style={{
                    width: 5, height: 5,
                    background: stateChipClass === 'ready' ? 'var(--col-arc-primary)' : stateChipClass === 'speaking' ? 'var(--col-energy-active)' : stateChipClass === 'thinking' ? 'var(--col-energy-warn)' : 'var(--col-energy-alert)',
                    color: stateChipClass === 'ready' ? 'var(--col-arc-primary)' : stateChipClass === 'speaking' ? 'var(--col-energy-active)' : stateChipClass === 'thinking' ? 'var(--col-energy-warn)' : 'var(--col-energy-alert)',
                  }} />
                  {stateLabel}
                </span>
              </div>
              <div className="hud-docked-meta font-mono">
                <span style={{ color: 'var(--col-text-secondary)', fontSize: 10 }}>{chatMessages.length} messages</span>
              </div>
              {/* Voice bars inline */}
              {state === 'speaking' && (
                <div className="hud-voice-bars hud-voice-bars--inline">
                  {[...Array(8)].map((_, i) => (
                    <span key={i} style={{ animationDelay: `${i * 0.08}s` }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Chat Thread + Composer ── */}
          {(chatMessages.length > 0 || responseText || true) && (
            <ChatLayout
              messages={chatMessages}
              isThinking={state === 'thinking'}
              onSend={handleSend}
              onMicToggle={handleMicToggle}
              isListening={listening}
            />
          )}
        </main>

        {/* ─── RIGHT SIDEBAR ─── */}
        <aside className={`hud-sidebar-right ${rightSidebarOpen ? '' : 'hud-sidebar-collapsed'}`}>
          <div className="hud-sidebar-inner">
            {/* BACKGROUND Section */}
            <div className="hud-panel-section">
              <div className="panel-header" onClick={toggleBgSection}>
                <span className="panel-icon">◈</span>
                <span style={{ flex: 1 }}>BACKGROUND</span>
                <span className={`hud-chevron ${bgSectionOpen ? 'hud-chevron-open' : ''}`}>▾</span>
              </div>
              {bgSectionOpen && (
                <div className="hud-panel-body">
                  <div className="hud-bg-grid">
                    {([
                      { id: 'aurora' as BackgroundTheme, label: 'Aurora', colors: ['#00D4FF', '#0066CC', '#00AADD'] },
                      { id: 'ember' as BackgroundTheme, label: 'Ember', colors: ['#FF6B35', '#CC2211', '#FF9900'] },
                      { id: 'void' as BackgroundTheme, label: 'Void', colors: ['#8800FF', '#5500CC', '#AA00FF'] },
                      { id: 'matrix' as BackgroundTheme, label: 'Matrix', colors: ['#00FF41', '#00AA33', '#00DD66'] },
                      { id: 'nebula' as BackgroundTheme, label: 'Nebula', colors: ['#CC33FF', '#8800CC', '#FF00FF'] },
                      { id: 'arctic' as BackgroundTheme, label: 'Arctic', colors: ['#44CCFF', '#66DDFF', '#88EEFF'] },
                      { id: 'static-dark' as BackgroundTheme, label: 'Dark', colors: ['#1a1a2e', '#16162a', '#111111'] },
                      { id: 'matrix-code-rain' as BackgroundTheme, label: 'Code Rain', colors: ['#00FF41', '#00cc33', '#009922'] },
                    ]).map(t => (
                      <div
                        key={t.id}
                        onClick={() => handleBgThemeChange(t.id)}
                        className={`hud-bg-card ${bgTheme === t.id ? 'hud-bg-card-active' : ''}`}
                      >
                        <div className="hud-bg-card-preview" style={{ background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]}, ${t.colors[2]})` }} />
                        <span className="hud-bg-card-label font-accent">{t.label}</span>
                        {bgTheme === t.id && <span className="hud-bg-card-check">⌐ ¬</span>}
                      </div>
                    ))}
                  </div>

                  {/* Code Rain settings */}
                  {bgTheme === 'matrix-code-rain' && (
                    <div className="hud-cr-settings">
                      <div className="hud-cr-label font-accent">CODE RAIN SETTINGS</div>
                      <div className="hud-cr-row">
                        <label className="hud-cr-label-sm font-accent">Character Set</label>
                        <select value={crCharset} onChange={(e) => setCrCharset(e.target.value)} className="hud-cr-select">
                          {Object.keys(CHARSET_PRESETS).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </div>
                      <div className="hud-cr-row">
                        <label className="hud-cr-label-sm font-accent">Font Size: {crFontSize}px</label>
                        <input type="range" min={8} max={24} value={crFontSize} onChange={(e) => setCrFontSize(Number(e.target.value))} className="hud-cr-range" />
                      </div>
                      <div className="hud-cr-row">
                        <label className="hud-cr-label-sm font-accent">Speed: {crSpeed.toFixed(1)}x</label>
                        <input type="range" min={0.1} max={3} step={0.1} value={crSpeed} onChange={(e) => setCrSpeed(Number(e.target.value))} className="hud-cr-range" />
                      </div>
                      <div className="hud-cr-row">
                        <label className="hud-cr-label-sm font-accent">Density: {crDensity.toFixed(1)}x</label>
                        <input type="range" min={0.2} max={2} step={0.1} value={crDensity} onChange={(e) => setCrDensity(Number(e.target.value))} className="hud-cr-range" />
                      </div>
                      <div className="hud-cr-row">
                        <label className="hud-cr-label-sm font-accent">Color</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input type="color" value={crColor} onChange={(e) => setCrColor(e.target.value)} className="hud-cr-color" />
                          <span className="font-mono" style={{ fontSize: 10, color: '#00FF41' }}>{crColor}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* GLASS Section — Chat overlay opacity */}
            <div className="hud-panel-section">
              <div className="panel-header" onClick={toggleGlassSection}>
                <span className="panel-icon">◻</span>
                <span style={{ flex: 1 }}>GLASS</span>
                <span className="font-mono" style={{ fontSize: 9, color: 'var(--col-arc-primary)' }}>{glassOpacity}%</span>
                <span className={`hud-chevron ${glassSectionOpen ? 'hud-chevron-open' : ''}`}>▾</span>
              </div>
              {glassSectionOpen && (
                <div className="hud-panel-body">
                  <div className="hud-cr-row">
                    <label className="hud-cr-label-sm font-accent">Overlay Opacity: {glassOpacity}%</label>
                    <input
                      type="range" min={0} max={100} step={5}
                      value={glassOpacity}
                      onChange={e => setGlassOpacity(Number(e.target.value))}
                      className="hud-cr-range"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    {[0, 25, 50, 75, 100].map(v => (
                      <button
                        key={v}
                        onClick={() => setGlassOpacity(v)}
                        style={{
                          flex: 1, padding: '3px 0',
                          background: glassOpacity === v ? 'var(--col-arc-primary)' : 'transparent',
                          border: `1px solid ${glassOpacity === v ? 'var(--col-arc-primary)' : 'var(--col-border-dim)'}`,
                          borderRadius: 4, color: glassOpacity === v ? 'var(--col-bg-void)' : 'var(--col-text-secondary)',
                          fontSize: 9, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >{v}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* CONTEXT Section — Arc Gauge */}
            <div className="hud-panel-section">
              <div className="panel-header" onClick={toggleContextSection}>
                <span className="panel-icon">⊞</span>
                <span style={{ flex: 1 }}>CONTEXT</span>
                <span className="font-mono" style={{ fontSize: 9, color: contextPct > 85 ? 'var(--col-energy-alert)' : 'var(--col-arc-primary)' }}>{contextPct}%</span>
                <span className={`hud-chevron ${contextSectionOpen ? 'hud-chevron-open' : ''}`}>▾</span>
              </div>
              {contextSectionOpen && (
                <div className="hud-panel-body">
                  <div className="hud-arc-gauge">
                    <svg viewBox="0 0 120 70" width="120" height="70">
                      {/* Background arc */}
                      <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="rgba(0,212,255,0.1)" strokeWidth="8" strokeLinecap="round" />
                      {/* Fill arc */}
                      <path
                        d="M 10 60 A 50 50 0 0 1 110 60"
                        fill="none"
                        stroke={contextPct > 85 ? 'var(--col-energy-alert)' : contextPct > 60 ? 'var(--col-energy-warn)' : 'var(--col-arc-primary)'}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${contextPct * 1.57} 157`}
                        className="arc-gauge-fill"
                      />
                      {/* Center text */}
                      <text x="60" y="52" textAnchor="middle" fill="var(--col-text-primary)" fontSize="14" fontFamily="JetBrains Mono" fontWeight="700">
                        {Math.round(contextUsed / 1000)}k
                      </text>
                      <text x="60" y="64" textAnchor="middle" fill="var(--col-text-secondary)" fontSize="8" fontFamily="JetBrains Mono">
                        / {Math.round(contextMax / 1000)}k
                      </text>
                    </svg>
                  </div>
                </div>
              )}
            </div>

            {/* COST Section */}
            <div className="hud-panel-section">
              <div className="panel-header" onClick={toggleCostSection}>
                <span className="panel-icon">$</span>
                <span style={{ flex: 1 }}>RUNTIME</span>
                <span className={`hud-chevron ${costSectionOpen ? 'hud-chevron-open' : ''}`}>▾</span>
              </div>
              {costSectionOpen && (
                <div className="hud-panel-body">
                  <div className="hud-cost-display">
                    <span className="hud-cost-label font-accent">TOTAL COST (USD)</span>
                    <span className="hud-cost-value font-mono" style={{ color: 'var(--col-arc-primary)' }}>${cost.toFixed(4)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* LOADER Section */}
            <div className="hud-panel-section">
              <div className="panel-header" onClick={toggleLoaderSection}>
                <span className="panel-icon">⚙</span>
                <span style={{ flex: 1 }}>LOADER</span>
                <span className={`hud-chevron ${loaderSectionOpen ? 'hud-chevron-open' : ''}`}>▾</span>
              </div>
              {loaderSectionOpen && (
                <div className="hud-panel-body">
                  <div className="hud-loader-display">
                    <Loader type={activeLoader} className="text-cyan size-10" pathSteps={120} />
                  </div>
                  <div className="hud-loader-list hud-scroll">
                    {LOADER_TYPES.map(variant => (
                      <div
                        key={variant}
                        className={`hud-model-item ${activeLoader === variant ? 'hud-model-active' : ''}`}
                        onClick={() => { sfx.click(); setActiveLoader(variant); }}
                      >
                        <span className="hud-model-name">{variant}</span>
                        {activeLoader === variant && <span className="hud-model-check" style={{ color: 'var(--col-energy-active)' }}>●</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* TACTICAL Section */}
            <div className="hud-panel-section">
              <div className="panel-header" onClick={toggleDiagSection}>
                <span className="panel-icon">🛠</span>
                <span style={{ flex: 1 }}>TACTICAL</span>
                <span className={`hud-chevron ${diagSectionOpen ? 'hud-chevron-open' : ''}`}>▾</span>
              </div>
              {diagSectionOpen && (
                <div className="hud-panel-body">
                  {/* Active tools */}
                  {tools.length > 0 && tools.some(t => t.status === 'running') && (
                    <div style={{ marginBottom: 10 }}>
                      <div className="hud-tactical-label font-accent">ACTIVE TOOLS ({tools.filter(t => t.status === 'running').length})</div>
                      {tools.map(t => (
                        <div key={t.id} className="hud-tactical-row">
                          <span style={{ color: t.status === 'running' ? 'var(--col-energy-warn)' : 'var(--col-energy-active)' }}>
                            {t.status === 'running' ? '⟳' : '✓'}
                          </span>
                          <span className="hud-tactical-name font-mono">{t.name}</span>
                          <span className="hud-tactical-bar" style={{ background: t.status === 'running' ? 'var(--col-energy-warn)' : 'var(--col-energy-active)' }} />
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Sub agents */}
                  {subAgents.length > 0 && subAgents.some(a => a.status === 'running') && (
                    <div style={{ marginBottom: 10 }}>
                      <div className="hud-tactical-label font-accent">SUB-AGENTS ({subAgents.filter(a => a.status === 'running').length})</div>
                      {subAgents.map(a => (
                        <div key={a.id} className="hud-tactical-row">
                          <span style={{ color: a.status === 'running' ? 'var(--col-energy-warn)' : 'var(--col-energy-active)' }}>
                            {a.status === 'running' ? '⟳' : '✓'}
                          </span>
                          <span className="hud-tactical-name font-mono">{a.name}</span>
                          <span className="hud-tactical-bar" style={{ background: a.status === 'running' ? 'var(--col-energy-warn)' : 'var(--col-energy-active)' }} />
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Default status */}
                  {(!tools.some(t => t.status === 'running') && !subAgents.some(a => a.status === 'running')) && (
                    <div className="hud-tactical-idle font-mono">
                      <div><span style={{ color: 'var(--col-energy-active)' }}>▸</span> INTEGRITY  <span style={{ color: 'var(--col-energy-active)' }}>████████░░</span>  SECURE</div>
                      <div><span style={{ color: 'var(--col-text-secondary)' }}>▸</span> TOOLS      <span style={{ color: 'var(--col-text-secondary)' }}>░░░░░░░░░░</span>  STANDBY</div>
                      <div><span style={{ color: 'var(--col-text-secondary)' }}>▸</span> SUB-NETS   <span style={{ color: 'var(--col-text-secondary)' }}>░░░░░░░░░░</span>  INACTIVE</div>
                      <div><span style={{ color: 'var(--col-energy-alert)' }}>▸</span> SHELLS      <span style={{ color: 'var(--col-energy-alert)' }}>░░░░░░░░░░</span>  TERMINATED</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Sidebar Toggle Tab */}
          <button className="hud-sidebar-toggle" onClick={toggleRightSidebar}>
            {rightSidebarOpen ? '›' : '‹'}
          </button>
        </aside>
      </div>
    </div>
  )
}
