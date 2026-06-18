/**
 * useSoundEffects — Web Audio synthesized UI sounds.
 * Mechanical keyboard click style for toggles.
 * Also fires navigator.vibrate() as a haptic bonus layer.
 *
 * Sound design:
 *   click          — sharp transient + noise burst (mechanical key press)
 *   toggleOn       — click + ascending confirmation chime
 *   toggleOff      — click + descending release chime
 *   sidebarOpen    — soft two-pulse arrive
 *   sidebarClose   — soft two-pulse leave
 *   sectionToggle  — crisp single blip
 */

import { useCallback, useRef } from 'react'

// ── Audio context (lazy, shared) ──────────────────────────────────────────

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

// ── Haptic patterns (duration ms, intensity 0-1) ──────────────────────────

function patternToVibrate(pattern: Array<{ duration: number; delay?: number }>): number[] {
  const result: number[] = []
  for (let i = 0; i < pattern.length; i++) {
    if (i > 0 && pattern[i].delay) result.push(pattern[i].delay!)
    result.push(pattern[i].duration)
  }
  return result
}

function vibrate(pattern: number[]): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(pattern) } catch { /* */ }
  }
}

// ── Web Audio sound primitives ────────────────────────────────────────────

/**
 * Mechanical keyboard click.
 * Layers:
 *   1. Sharp sine transient (2400→600Hz, ~6ms) — the "tick"
 *   2. Short noise burst (~10ms) — the "clack" texture
 *   3. Quiet resonance body (~15ms) — the "thock" of the switch housing
 */
function playClick(ctx: AudioContext) {
  const t = ctx.currentTime

  // 1. Sine transient — sharp attack, fast decay
  const osc = ctx.createOscillator()
  const oscGain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(2400, t)
  osc.frequency.exponentialRampToValueAtTime(600, t + 0.006)
  oscGain.gain.setValueAtTime(0.35, t)
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.008)
  osc.connect(oscGain).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.01)

  // 2. Noise burst — the "clack" texture
  const noiseLen = 0.012
  const buf = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) // linear decay
  }
  const noise = ctx.createBufferSource()
  noise.buffer = buf
  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(0.18, t)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + noiseLen)
  // Bandpass to shape the noise — mechanical clicks are mid-frequency
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 3500
  bp.Q.value = 1.2
  noise.connect(bp).connect(noiseGain).connect(ctx.destination)
  noise.start(t)
  noise.stop(t + noiseLen + 0.001)

  // 3. Resonance body — quiet low thock
  const body = ctx.createOscillator()
  const bodyGain = ctx.createGain()
  body.type = 'sine'
  body.frequency.setValueAtTime(180, t)
  body.frequency.exponentialRampToValueAtTime(80, t + 0.015)
  bodyGain.gain.setValueAtTime(0.08, t)
  bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.018)
  body.connect(bodyGain).connect(ctx.destination)
  body.start(t)
  body.stop(t + 0.02)
}

/** Short ascending chime — two rising tones */
function playChimeUp(ctx: AudioContext) {
  const t = ctx.currentTime
  const freqs = [900, 1600, 2000]
  const durs = [0.04, 0.04]
  const gaps = [0.02, 0.02]
  let offset = 0
  for (let i = 0; i < durs.length; i++) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(freqs[i], t + offset)
    o.frequency.linearRampToValueAtTime(freqs[i + 1], t + offset + durs[i])
    g.gain.setValueAtTime(0, t + offset)
    g.gain.linearRampToValueAtTime(0.15, t + offset + 0.005)
    g.gain.exponentialRampToValueAtTime(0.001, t + offset + durs[i])
    o.connect(g).connect(ctx.destination)
    o.start(t + offset)
    o.stop(t + offset + durs[i] + 0.001)
    offset += durs[i] + gaps[i]
  }
}

/** Short descending chime — two falling tones */
function playChimeDown(ctx: AudioContext) {
  const t = ctx.currentTime
  const freqs = [1200, 600, 400]
  const durs = [0.04, 0.05]
  const gaps = [0.02, 0.02]
  let offset = 0
  for (let i = 0; i < durs.length; i++) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(freqs[i], t + offset)
    o.frequency.linearRampToValueAtTime(freqs[i + 1], t + offset + durs[i])
    g.gain.setValueAtTime(0, t + offset)
    g.gain.linearRampToValueAtTime(0.12, t + offset + 0.005)
    g.gain.exponentialRampToValueAtTime(0.001, t + offset + durs[i])
    o.connect(g).connect(ctx.destination)
    o.start(t + offset)
    o.stop(t + offset + durs[i] + 0.001)
    offset += durs[i] + gaps[i]
  }
}

/** Soft two-pulse arrive (sidebar open) */
function playSoftArrive(ctx: AudioContext) {
  const t = ctx.currentTime
  for (let i = 0; i < 2; i++) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = 600
    const start = t + i * 0.055
    g.gain.setValueAtTime(0, start)
    g.gain.linearRampToValueAtTime(0.06, start + 0.005)
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.02)
    o.connect(g).connect(ctx.destination)
    o.start(start)
    o.stop(start + 0.025)
  }
}

/** Soft two-pulse leave (sidebar close) */
function playSoftLeave(ctx: AudioContext) {
  const t = ctx.currentTime
  for (let i = 0; i < 2; i++) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = 500
    const start = t + i * 0.055
    g.gain.setValueAtTime(0, start)
    g.gain.linearRampToValueAtTime(0.05, start + 0.005)
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.02)
    o.connect(g).connect(ctx.destination)
    o.start(start)
    o.stop(start + 0.025)
  }
}

/** Crisp single blip (section expand/collapse) */
function playBlip(ctx: AudioContext) {
  const t = ctx.currentTime
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(1800, t)
  o.frequency.exponentialRampToValueAtTime(800, t + 0.008)
  g.gain.setValueAtTime(0.2, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.01)
  o.connect(g).connect(ctx.destination)
  o.start(t)
  o.stop(t + 0.012)
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useSoundEffects() {
  const enabledRef = useRef(true)

  const fire = useCallback((audioFn: (ctx: AudioContext) => void, hapticPattern?: number[]) => {
    if (!enabledRef.current) return
    try {
      const ctx = getCtx()
      audioFn(ctx)
    } catch { /* audio context not available */ }
    if (hapticPattern) vibrate(hapticPattern)
  }, [])

  // Haptic patterns for bonus vibration layer
  const airyTapHaptic = patternToVibrate([{ duration: 16 }])
  const softArriveHaptic = patternToVibrate([{ duration: 18 }, { delay: 36, duration: 22 }])
  const softLeaveHaptic = patternToVibrate([{ duration: 22 }, { delay: 32, duration: 16 }])

  return {
    // Single click — mechanical keyboard press
    click: useCallback(() => fire(playClick, airyTapHaptic), [fire]),

    // Toggle ON — click + ascending chime
    toggleOn: useCallback(() => {
      if (!enabledRef.current) return
      try {
        const ctx = getCtx()
        playClick(ctx)
        // Chime starts after click finishes (~20ms)
        const origTime = ctx.currentTime
        // We schedule the chime by creating a second audio graph offset in time
        // Simpler: just call playChimeUp with a small delay via setTimeout
      } catch { /* */ }
      vibrate([...airyTapHaptic, 30, ...patternToVibrate([
        { duration: 28 },
        { delay: 42, duration: 30 },
        { delay: 48, duration: 38 },
      ])])
      // Schedule chime after click
      try {
        const ctx = getCtx()
        const t = ctx.currentTime
        const freqs = [900, 1600, 2000]
        const durs = [0.04, 0.04]
        const gaps = [0.02, 0.02]
        let offset = 0.022 // start after click
        for (let i = 0; i < durs.length; i++) {
          const o = ctx.createOscillator()
          const g = ctx.createGain()
          o.type = 'sine'
          o.frequency.setValueAtTime(freqs[i], t + offset)
          o.frequency.linearRampToValueAtTime(freqs[i + 1], t + offset + durs[i])
          g.gain.setValueAtTime(0, t + offset)
          g.gain.linearRampToValueAtTime(0.15, t + offset + 0.005)
          g.gain.exponentialRampToValueAtTime(0.001, t + offset + durs[i])
          o.connect(g).connect(ctx.destination)
          o.start(t + offset)
          o.stop(t + offset + durs[i] + 0.001)
          offset += durs[i] + gaps[i]
        }
      } catch { /* */ }
    }, [fire]),

    // Toggle OFF — click + descending chime
    toggleOff: useCallback(() => {
      if (!enabledRef.current) return
      try {
        const ctx = getCtx()
        playClick(ctx)
      } catch { /* */ }
      vibrate([...airyTapHaptic, 20, ...patternToVibrate([
        { duration: 22 },
        { delay: 32, duration: 16 },
      ])])
      // Schedule chime after click
      try {
        const ctx = getCtx()
        const t = ctx.currentTime
        const freqs = [1200, 600, 400]
        const durs = [0.04, 0.05]
        const gaps = [0.02, 0.02]
        let offset = 0.022
        for (let i = 0; i < durs.length; i++) {
          const o = ctx.createOscillator()
          const g = ctx.createGain()
          o.type = 'sine'
          o.frequency.setValueAtTime(freqs[i], t + offset)
          o.frequency.linearRampToValueAtTime(freqs[i + 1], t + offset + durs[i])
          g.gain.setValueAtTime(0, t + offset)
          g.gain.linearRampToValueAtTime(0.12, t + offset + 0.005)
          g.gain.exponentialRampToValueAtTime(0.001, t + offset + durs[i])
          o.connect(g).connect(ctx.destination)
          o.start(t + offset)
          o.stop(t + offset + durs[i] + 0.001)
          offset += durs[i] + gaps[i]
        }
      } catch { /* */ }
    }, [fire]),

    // Sidebar open — soft two-pulse arrive
    sidebarOpen: useCallback(() => fire(playSoftArrive, softArriveHaptic), [fire]),

    // Sidebar close — soft two-pulse leave
    sidebarClose: useCallback(() => fire(playSoftLeave, softLeaveHaptic), [fire]),

    // Section expand/collapse — crisp single blip
    sectionToggle: useCallback(() => fire(playBlip), [fire]),

    setEnabled: (v: boolean) => { enabledRef.current = v },
  }
}
