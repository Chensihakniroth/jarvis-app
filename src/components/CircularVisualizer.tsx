import { useEffect, useRef } from 'react'

interface Props {
  state: 'booting' | 'ready' | 'listening' | 'speaking' | 'thinking' | 'error'
  size?: number
}

const AMP_MAP: Record<string, number> = {
  booting: 0.4, ready: 0.08, listening: 0.25, speaking: 0.75, thinking: 0.3, error: 0.05,
}
const HUE_MAP: Record<string, number> = {
  booting: 42, ready: 185, listening: 185, speaking: 185, thinking: 42, error: 0,
}

export function CircularVisualizer({ state, size = 180 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(state)
  const sizeRef = useRef(size)

  // Keep refs in sync — animation loop reads these, no restart needed
  stateRef.current = state
  sizeRef.current = size

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const s = sizeRef.current
    const dpr = window.devicePixelRatio || 1
    canvas.width = s * dpr
    canvas.height = s * dpr
    ctx.scale(dpr, dpr)

    const cx = s / 2, cy = s / 2
    const rCore = s * 0.12
    const rCoilInner = s * 0.18
    const rCoilOuter = s * 0.28
    const rVisualizer = s * 0.32
    const maxVisualizer = s * 0.46
    const maxBar = maxVisualizer - rVisualizer
    const barCount = 60
    const smoothed = new Float32Array(barCount).fill(0)

    let animId = 0
    let lastTime = performance.now()

    const draw = (now: number) => {
      const dt = (now - lastTime) / 1000.0
      lastTime = now

      const currentState = stateRef.current
      const amp = AMP_MAP[currentState] || 0.08
      const hue = HUE_MAP[currentState] || 185
      const t = now / 1000

      ctx.clearRect(0, 0, s, s)

      const globalPulse = 1 + Math.sin(t * (currentState === 'speaking' ? 12 : currentState === 'thinking' ? 8 : 4)) * 0.05

      // 1. Ambient Background Glow
      const ambientGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxVisualizer)
      ambientGrad.addColorStop(0, `hsla(${hue}, 100%, 65%, ${0.12 * globalPulse})`)
      ambientGrad.addColorStop(0.4, `hsla(${hue}, 100%, 50%, 0.02)`)
      ambientGrad.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`)
      ctx.fillStyle = ambientGrad
      ctx.fillRect(0, 0, s, s)

      // 2. Concentric Tech Ticks & Cyber Circles
      ctx.beginPath()
      ctx.arc(cx, cy, size * 0.47, 0, Math.PI * 2)
      ctx.strokeStyle = `hsla(${hue}, 100%, 45%, 0.12)`
      ctx.lineWidth = 1
      ctx.setLineDash([2, 8])
      ctx.stroke()
      ctx.setLineDash([])

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(t * 0.15)
      ctx.beginPath()
      ctx.arc(0, 0, size * 0.30, 0, Math.PI * 2)
      ctx.strokeStyle = `hsla(${hue}, 100%, 60%, 0.18)`
      ctx.lineWidth = 1.5
      ctx.setLineDash([12, 24, 4, 24])
      ctx.stroke()
      ctx.restore()
      ctx.setLineDash([])

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(-t * 0.25)
      ctx.beginPath()
      ctx.arc(0, 0, rCoilInner - 3, 0, Math.PI * 2)
      ctx.strokeStyle = `hsla(${hue}, 100%, 75%, 0.25)`
      ctx.lineWidth = 1
      ctx.setLineDash([6, 12, 1, 12])
      ctx.stroke()
      ctx.restore()
      ctx.setLineDash([])

      // 3. Cybernetic Target Brackets
      ctx.strokeStyle = `hsla(${hue}, 100%, 55%, 0.2)`
      ctx.lineWidth = 1
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2
        const x1 = cx + Math.cos(angle) * (rVisualizer + 4)
        const y1 = cy + Math.sin(angle) * (rVisualizer + 4)
        const x2 = cx + Math.cos(angle) * (rVisualizer + 12)
        const y2 = cy + Math.sin(angle) * (rVisualizer + 12)
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }

      // 4. The 10 Induction Coils
      const coilCount = 10
      const coilSpin = t * 0.08
      for (let i = 0; i < coilCount; i++) {
        const angle = (i / coilCount) * Math.PI * 2 + coilSpin
        const pInner1 = angle - 0.16
        const pInner2 = angle + 0.16
        const pOuter1 = angle - 0.22
        const pOuter2 = angle + 0.22

        const x1 = cx + Math.cos(pInner1) * rCoilInner
        const y1 = cy + Math.sin(pInner1) * rCoilInner
        const x2 = cx + Math.cos(pInner2) * rCoilInner
        const y2 = cy + Math.sin(pInner2) * rCoilInner
        const x3 = cx + Math.cos(pOuter2) * rCoilOuter
        const y3 = cy + Math.sin(pOuter2) * rCoilOuter
        const x4 = cx + Math.cos(pOuter1) * rCoilOuter
        const y4 = cy + Math.sin(pOuter1) * rCoilOuter

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.lineTo(x3, y3)
        ctx.lineTo(x4, y4)
        ctx.closePath()

        const pulseVal = 0.6 + Math.sin(t * 6 + i * 2) * 0.3
        const coilGrad = ctx.createLinearGradient(x1, y1, x3, y3)
        coilGrad.addColorStop(0, `hsla(${hue}, 100%, 75%, ${0.1 * pulseVal})`)
        coilGrad.addColorStop(0.5, `hsla(${hue}, 100%, 65%, ${0.45 * pulseVal})`)
        coilGrad.addColorStop(1, `hsla(${hue}, 100%, 55%, ${0.05 * pulseVal})`)
        ctx.fillStyle = coilGrad
        ctx.fill()

        ctx.beginPath()
        for (let w = 0.25; w <= 0.75; w += 0.1) {
          const rCur = rCoilInner + (rCoilOuter - rCoilInner) * w
          const angleOffset = 0.16 + (0.22 - 0.16) * w
          const xa = cx + Math.cos(angle - angleOffset) * rCur
          const ya = cy + Math.sin(angle - angleOffset) * rCur
          const xb = cx + Math.cos(angle + angleOffset) * rCur
          const yb = cy + Math.sin(angle + angleOffset) * rCur
          ctx.moveTo(xa, ya)
          ctx.lineTo(xb, yb)
        }
        ctx.strokeStyle = `hsla(${hue}, 80%, 40%, ${0.35 * pulseVal})`
        ctx.lineWidth = 1
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.lineTo(x3, y3)
        ctx.lineTo(x4, y4)
        ctx.closePath()
        ctx.strokeStyle = `hsla(${hue}, 100%, 80%, ${0.3 + pulseVal * 0.3})`
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // 5. Sound Visualizer Pillars
      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2
        const phase = (i / barCount) * Math.PI * 2
        let val = 0.05

        switch (currentState) {
          case 'ready':
            val = 0.04 + Math.sin(t * 2 + phase) * 0.03
            break
          case 'listening':
            val = 0.12 + Math.sin(t * 6 + phase * 3) * 0.08 + Math.random() * 0.04
            break
          case 'thinking':
            val = 0.18 + Math.sin(t * 8 + phase * 5) * 0.10 + Math.random() * 0.05
            break
          case 'booting':
            val = 0.25 + Math.sin(t * 3 + phase) * 0.15
            break
          case 'speaking':
            val = 0.35 + Math.sin(t * 12 + phase * 2) * 0.25 + Math.random() * 0.25
            break
          case 'error':
            val = 0.05 + Math.sin(t * 15 + phase) * 0.03
            break
        }

        smoothed[i] += (val - smoothed[i]) * 0.18
        const len = Math.max(3, smoothed[i] * maxBar * amp + 3)

        const xStart = cx + Math.cos(angle) * rVisualizer
        const yStart = cy + Math.sin(angle) * rVisualizer
        const xEnd = cx + Math.cos(angle) * (rVisualizer + len)
        const yEnd = cy + Math.sin(angle) * (rVisualizer + len)

        const barGrad = ctx.createLinearGradient(xStart, yStart, xEnd, yEnd)
        barGrad.addColorStop(0, `hsla(${hue}, 100%, 80%, 0.8)`)
        barGrad.addColorStop(0.5, `hsla(${hue}, 100%, 65%, 0.5)`)
        barGrad.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`)

        ctx.beginPath()
        ctx.moveTo(xStart, yStart)
        ctx.lineTo(xEnd, yEnd)
        ctx.strokeStyle = barGrad
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.stroke()
      }

      // 6. Central Arc Reactor Core
      ctx.beginPath()
      ctx.arc(cx, cy, rCore, 0, Math.PI * 2)
      ctx.strokeStyle = `hsla(${hue}, 100%, 85%, 0.4)`
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(-t * 0.5)
      ctx.strokeStyle = `hsla(${hue}, 100%, 75%, 0.6)`
      ctx.lineWidth = 1.5
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2
        ctx.beginPath()
        ctx.arc(0, 0, rCore - 4, angle, angle + 0.4)
        ctx.stroke()
      }
      ctx.restore()

      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rCore - 5)
      coreGrad.addColorStop(0, '#ffffff')
      coreGrad.addColorStop(0.3, `hsla(${hue}, 100%, 85%, 0.95)`)
      coreGrad.addColorStop(0.8, `hsla(${hue}, 100%, 60%, 0.4)`)
      coreGrad.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`)
      ctx.beginPath()
      ctx.arc(cx, cy, rCore - 2, 0, Math.PI * 2)
      ctx.fillStyle = coreGrad
      ctx.fill()

      ctx.beginPath()
      ctx.arc(cx, cy, 4, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = `hsl(${hue}, 100%, 70%)`
      ctx.shadowBlur = 12
      ctx.fill()
      ctx.shadowBlur = 0

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animId)
  }, []) // Empty deps — loop runs once, reads state from ref

  return (
    <canvas
      ref={canvasRef}
      className="reactor-canvas"
      style={{ width: size, height: size, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}
    />
  )
}
