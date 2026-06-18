const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const { spawn, spawnSync } = require('child_process')
const path = require('path')
const os = require('os')
const fs = require('fs')
const net = require('net')

const CACHE_DIR = path.join(os.homedir(), '.jarvis-app', 'cache')
fs.mkdirSync(CACHE_DIR, { recursive: true })
app.setPath('userData', CACHE_DIR)
app.setPath('cache', CACHE_DIR)

// Disable GPU disk cache to avoid permission errors on Windows
app.commandLine.appendSwitch('disable-gpu-disk-cache', 'true')
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache', 'true')

const GATEWAY_PORT = 9119
const GATEWAY_HOST = '127.0.0.1'

let mainWindow = null
let gatewayProcess = null

// ── Persistent TTS Server ────────────────────────────────────────────────────
let ttsServerProc = null

function startTtsServer() {
  if (ttsServerProc) return
  const pythonInfo = findPython()
  if (!pythonInfo) { console.log('[TTS] no python found'); return }
  const ttsScript = path.join(__dirname, 'tts_server.py')
  try { fs.accessSync(ttsScript) } catch { console.log('[TTS] tts_server.py not found'); return }
  try {
    ttsServerProc = spawn(pythonInfo.exe, [ttsScript, 'jarvis'], {
      cwd: pythonInfo.projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    ttsServerProc.stderr.on('data', (d) => { console.error('[TTS]', d.toString().trim()) })
    ttsServerProc.on('exit', (code) => { console.log(`[TTS] server exited code=${code}`); ttsServerProc = null })
    console.log('[TTS] persistent server started')
  } catch (e) { console.error('[TTS] failed to start:', e.message) }
}

function ttsSpeakViaServer(text) {
  return new Promise((resolve, reject) => {
    if (!ttsServerProc || !ttsServerProc.stdin || ttsServerProc.stdin.destroyed) {
      reject(new Error('TTS server not running')); return
    }
    const filtered = jarvisFilter(text)
    if (!filtered) { reject(new Error('empty after filter')); return }
    const input = Buffer.from(filtered, 'utf-8').toString('base64') + '\n'
    let buf = ''
    const onData = (chunk) => {
      buf += chunk.toString()
      const nl = buf.indexOf('\n')
      if (nl !== -1) {
        ttsServerProc.stdout.removeListener('data', onData)
        const b64 = buf.slice(0, nl).trim()
        b64 ? resolve({ ok: true, audio: b64, filtered }) : reject(new Error('empty TTS response'))
      }
    }
    ttsServerProc.stdout.on('data', onData)
    ttsServerProc.stdin.write(input)
    setTimeout(() => {
      try { ttsServerProc?.stdout.removeListener('data', onData) } catch {}
      reject(new Error('TTS server timeout'))
    }, 15000)
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isPortInUse(port) {
  return new Promise((resolve) => {
    const s = new net.Socket()
    s.setTimeout(1000)
    s.on('connect', () => { s.destroy(); resolve(true) })
    s.on('timeout', () => { s.destroy(); resolve(false) })
    s.on('error', () => { s.destroy(); resolve(false) })
    s.connect(port, GATEWAY_HOST)
  })
}

function findPython() {
  const root = path.join(__dirname, '..', '..', 'anakot-agent')
  const candidates = [
    process.platform === 'win32' ? path.join(root, '.venv', 'Scripts', 'python.exe') : path.join(root, '.venv', 'bin', 'python'),
    'python', 'python3',
  ]
  for (const exe of candidates) {
    try { if (spawnSync(exe, ['--version'], { timeout: 5000 }).status === 0) return { exe, projectRoot: root } } catch {}
  }
  return null
}

function logToRenderer(msg, type) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('main-log', {
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      msg, type: type || 'info',
    })
  }
}

// ── Gateway ──────────────────────────────────────────────────────────────────

async function startGateway() {
  const alreadyRunning = await isPortInUse(GATEWAY_PORT)
  if (alreadyRunning) {
    logToRenderer('Gateway already running on port ' + GATEWAY_PORT, 'ok')
    const tokenFile = path.join(os.tmpdir(), 'anakot-gateway-token')
    let sessionToken = ''
    try { sessionToken = fs.readFileSync(tokenFile, 'utf8').trim() } catch {}
    return { ok: true, port: GATEWAY_PORT, alreadyRunning: true, sessionToken }
  }

  const pythonInfo = findPython()
  if (!pythonInfo) { const e = 'Python not found'; logToRenderer(e, 'error'); return { ok: false, error: e } }

  logToRenderer(`Starting gateway with: ${pythonInfo.exe}`, 'info')
  logToRenderer(`Working dir: ${pythonInfo.projectRoot}`, 'info')

  return new Promise((resolve, reject) => {
    let resolved = false, stderrBuf = ''
    const sessionToken = require('crypto').randomBytes(32).toString('hex')
    try { fs.writeFileSync(path.join(os.tmpdir(), 'anakot-gateway-token'), sessionToken) } catch {}

    const jarvisSystemPrompt = [
      'You are J.A.R.V.I.S. — Just A Rather Very Intelligent System.', '',
      '## Rules',
      '- Respond in plain spoken English only — no markdown, no bullet points, no asterisks',
      '- Never show reasoning or thinking out loud',
      '- Be concise — 1 to 3 sentences max unless the task requires more',
      '- Always address the user as "sir"',
      '- Speak like you are reporting, not explaining',
      '- If executing a tool, briefly confirm before and after',
      '- Never say "I think", "Let me", "Sure!", "Certainly!" or "Of course!"',
      '- Never use lists or numbered steps in responses', '',
      '## Tool Call Behavior',
      '- Before tool call: "On it, sir."',
      '- After tool call: "Done, sir. [one sentence result]"',
      '- On error: "Apologies sir, [one sentence reason]."', '',
    ].join('\n')

    try {
      gatewayProcess = spawn(pythonInfo.exe,
        ['-m', 'anakot_cli.main', 'dashboard', '--port', String(GATEWAY_PORT), '--no-open', '--skip-build', '--insecure'],
        { cwd: pythonInfo.projectRoot, env: { ...process.env, PYTHONUNBUFFERED: '1', ANAKOT_DASHBOARD_SESSION_TOKEN: sessionToken, ANAKOT_EPHEMERAL_SYSTEM_PROMPT: jarvisSystemPrompt }, stdio: ['ignore', 'pipe', 'pipe'], detached: false })
    } catch (e) { logToRenderer(`Spawn failed: ${e.message}`, 'error'); reject(e); return }

    gatewayProcess.stdout.setEncoding('utf8')
    gatewayProcess.stdout.on('data', (d) => {
      for (const line of d.split('\n')) {
        if (!line.trim()) continue
        logToRenderer(`[GW] ${line}`, 'info')
        if (line.includes('Running on') || line.includes('Application startup complete') || line.includes('Uvicorn running')) {
          if (!resolved) { resolved = true; logToRenderer(`Gateway ready! Token: ${sessionToken.slice(0,8)}...`, 'ok'); resolve({ ok: true, port: GATEWAY_PORT, alreadyRunning: false, sessionToken }) }
        }
      }
    })
    gatewayProcess.stderr.setEncoding('utf8')
    gatewayProcess.stderr.on('data', (d) => { stderrBuf += d; for (const line of d.split('\n')) { if (line.trim()) logToRenderer(`[GW err] ${line}`, 'error') } })
    gatewayProcess.on('error', (err) => { logToRenderer(`Gateway process error: ${err.message}`, 'error'); if (!resolved) { resolved = true; reject(err) } })
    gatewayProcess.on('exit', (code, signal) => {
      logToRenderer(`Gateway exited (code=${code}, signal=${signal})`, 'error')
      gatewayProcess = null
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('gateway-exit', { code, signal })
    })

    const start = Date.now()
    const poll = setInterval(async () => {
      if (resolved) { clearInterval(poll); return }
      if (await isPortInUse(GATEWAY_PORT)) {
        clearInterval(poll)
        if (!resolved) { resolved = true; logToRenderer(`Gateway ready (port detected)! Token: ${sessionToken.slice(0,8)}...`, 'ok'); resolve({ ok: true, port: GATEWAY_PORT, alreadyRunning: false, sessionToken }) }
      } else if (Date.now() - start > 30000) {
        clearInterval(poll)
        if (!resolved) { resolved = true; reject(new Error('Gateway did not start within 30s')) }
      }
    }, 1000)
  })
}

function stopGateway() {
  if (gatewayProcess) { try { gatewayProcess.kill('SIGTERM') } catch {}; gatewayProcess = null }
  if (ttsServerProc) { try { ttsServerProc.kill('SIGTERM') } catch {}; ttsServerProc = null }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, title: 'J.A.R.V.I.S.', backgroundColor: '#0a0a14',
    frame: false, titleBarStyle: 'hidden', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  mainWindow.setMenuBarVisibility(false)
  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))

  mainWindow.webContents.on('did-finish-load', async () => {
    logToRenderer('Window loaded, starting gateway...', 'info')
    try {
      const result = await startGateway()
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('gateway-ready', result)
      startTtsServer()
    } catch (err) {
      logToRenderer(`Gateway failed: ${err.message}`, 'error')
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('gateway-ready', { ok: false, error: err.message })
    }
  })
}

// ── JARVIS Response Filter ──────────────────────────────────────────────────

function jarvisFilter(text) {
  if (!text) return ''
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/[#*_`>]/g, '')
    .replace(/[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\b(Let me think|Thinking\.\.\.|I think|Let me see|Let me check|Let me look|I'll check|I'll look|I'll see|Let me find)\b/gi, '')
    .replace(/\b(Sure!|Certainly!|Of course!|Absolutely!|Great!|Hello!|Great question!|Of course[.]?|Sure thing|No problem|Here you go|Here it is|As you wish)\b/gi, '')
    .replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()
}

// ── IPC ─────────────────────────────────────────────────────────────────────

ipcMain.handle('gateway-start', async () => { try { return await startGateway() } catch (err) { return { ok: false, error: err.message } } })
ipcMain.handle('gateway-status', async () => { const r = await isPortInUse(GATEWAY_PORT); return { running: r, port: r ? GATEWAY_PORT : 0 } })

ipcMain.on('zoom-in', () => { if (mainWindow) { const f = mainWindow.webContents.getZoomFactor(); mainWindow.webContents.setZoomFactor(Math.min(2, f + 0.1)) } })
ipcMain.on('zoom-out', () => { if (mainWindow) { const f = mainWindow.webContents.getZoomFactor(); mainWindow.webContents.setZoomFactor(Math.max(0.5, f - 0.1)) } })
ipcMain.on('zoom-reset', () => { if (mainWindow) mainWindow.webContents.setZoomFactor(1) })
ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize() })
ipcMain.on('window-maximize', () => { if (mainWindow) { if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize() } })
ipcMain.on('window-close', () => { if (mainWindow) mainWindow.close() })

// TTS — persistent Piper server with retries
async function handleTts(text, filtered, maxRetries = 3, delayMs = 500) {
  const effectiveFiltered = filtered || jarvisFilter(text)
  let lastErr = null
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try { return await ttsSpeakViaServer(text) } catch (e) { lastErr = e }
    if (attempt < maxRetries) {
      console.log(`[TTS] attempt ${attempt}/${maxRetries} failed, retrying in ${delayMs}ms...`)
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
  throw lastErr || new Error('TTS failed after retries')
}

ipcMain.handle('tts-speak', async (event, text) => {
  try { return await handleTts(text, jarvisFilter(text)) } catch (err) { console.error('TTS failed:', err.message); return { ok: false, error: err.message } }
})

ipcMain.handle('tts-speak-filtered', async (event, text) => {
  const filtered = jarvisFilter(text)
  if (!filtered) return { ok: false, error: 'empty after filter' }
  try { return await handleTts(text, filtered) } catch (err) { console.error('TTS failed:', err.message); return { ok: false, error: err.message, filtered } }
})

ipcMain.handle('tts-filter', (event, text) => ({ ok: true, filtered: jarvisFilter(text) }))

// ── App ─────────────────────────────────────────────────────────────────────

function setupMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Edit', submenu: [{ role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [
      { label: 'Zoom In', accelerator: 'CommandOrControl+Plus', click: () => { if (mainWindow) { const f = mainWindow.webContents.getZoomFactor(); mainWindow.webContents.setZoomFactor(Math.min(2, f + 0.1)) } } },
      { label: 'Zoom Out', accelerator: 'CommandOrControl+Minus', click: () => { if (mainWindow) { const f = mainWindow.webContents.getZoomFactor(); mainWindow.webContents.setZoomFactor(Math.max(0.5, f - 0.1)) } } },
      { label: 'Reset Zoom', accelerator: 'CommandOrControl+0', click: () => { if (mainWindow) mainWindow.webContents.setZoomFactor(1) } },
      { type: 'separator' }, { role: 'togglefullscreen' },
    ]},
  ]))
}

app.whenReady().then(() => { setupMenu(); createWindow() })
app.on('window-all-closed', () => { stopGateway(); if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', stopGateway)
