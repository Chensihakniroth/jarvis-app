import { useEffect, useRef, useCallback } from 'react';

interface ArcReactorProps {
  state?: 'booting' | 'ready' | 'listening' | 'speaking' | 'thinking' | 'error';
  size?: number;
}

const STATE_CONFIG = {
  booting:   { hue: 42,  amp: 0.5,  speed: 1.5, brightness: 1.0, label: 'BOOTING' },
  ready:     { hue: 185, amp: 0.12, speed: 0.4, brightness: 1.0, label: 'ONLINE' },
  listening: { hue: 185, amp: 0.25, speed: 1.0, brightness: 1.0, label: 'LISTENING' },
  speaking:  { hue: 165, amp: 0.95, speed: 3.5, brightness: 1.4, label: 'SPEAKING' },
  thinking:  { hue: 42,  amp: 0.35, speed: 2.0, brightness: 1.0, label: 'PROCESSING' },
  error:     { hue: 0,   amp: 0.15, speed: 4.0, brightness: 1.0, label: 'ERROR' },
};

export function ArcReactor({ state = 'ready', size = 200 }: ArcReactorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = size;
    const h = size;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const t = performance.now() / 1000;
    const cfg = STATE_CONFIG[stateRef.current] || STATE_CONFIG.ready;
    const hue = cfg.hue;
    const amp = cfg.amp * cfg.brightness;
    const spd = cfg.speed;

    // Smooth global pulse — stronger during speaking
    const pulseStrength = stateRef.current === 'speaking' ? 0.15 : 0.06;
    const pulse = 1 + Math.sin(t * spd * 2) * pulseStrength * amp;

    // ── 1. Outer ambient glow ──
    const ambientR = w * 0.48;
    const ambGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, ambientR);
    ambGrad.addColorStop(0, `hsla(${hue}, 100%, 60%, ${0.08 * amp * pulse})`);
    ambGrad.addColorStop(0.5, `hsla(${hue}, 100%, 50%, ${0.02 * amp})`);
    ambGrad.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
    ctx.fillStyle = ambGrad;
    ctx.fillRect(0, 0, w, h);

    // ── 2. Outer casing ring (static) ──
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.46, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${hue}, 60%, 40%, 0.25)`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Outer tick marks (static ring of small lines)
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const isMajor = i % 5 === 0;
      const r1 = w * 0.44;
      const r2 = w * 0.46 + (isMajor ? 4 : 0);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.strokeStyle = `hsla(${hue}, 80%, 55%, ${isMajor ? 0.35 : 0.12})`;
      ctx.lineWidth = isMajor ? 1.5 : 0.5;
      ctx.stroke();
    }

    // ── 3. Rotating middle ring ──
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * spd * 0.15);
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.40, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${hue}, 80%, 50%, ${0.2 + amp * 0.15})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 16]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // ── 4. The 10 triangular segments ──
    const segCount = 10;
    const rInner = w * 0.22;
    const rOuter = w * 0.38;
    const rGap = w * 0.012;

    for (let i = 0; i < segCount; i++) {
      const baseAngle = (i / segCount) * Math.PI * 2 - Math.PI / 2;
      const rotOffset = t * spd * 0.08;
      const angle = baseAngle + rotOffset;

      const halfWidth = (Math.PI / segCount) * 0.72;
      const a1 = angle - halfWidth;
      const a2 = angle + halfWidth;

      // Inner edge (closer to center)
      const gapAngle = rGap / rInner;
      const ix1 = cx + Math.cos(a1 + gapAngle) * rInner;
      const iy1 = cy + Math.sin(a1 + gapAngle) * rInner;
      const ix2 = cx + Math.cos(a2 - gapAngle) * rInner;
      const iy2 = cy + Math.sin(a2 - gapAngle) * rInner;

      // Outer edge
      const ox1 = cx + Math.cos(a1) * rOuter;
      const oy1 = cy + Math.sin(a1) * rOuter;
      const ox2 = cx + Math.cos(a2) * rOuter;
      const oy2 = cy + Math.sin(a2) * rOuter;

      // Segment fill
      ctx.beginPath();
      ctx.moveTo(ix1, iy1);
      ctx.lineTo(ox1, oy1);
      ctx.lineTo(ox2, oy2);
      ctx.lineTo(ix2, iy2);
      ctx.closePath();

      const segPulse = 0.5 + Math.sin(t * spd * 3 + i * 1.2) * 0.4;
      const segGrad = ctx.createLinearGradient(ix1, iy1, ox1, oy1);
      segGrad.addColorStop(0, `hsla(${hue}, 90%, 65%, ${0.08 * segPulse * amp})`);
      segGrad.addColorStop(0.5, `hsla(${hue}, 100%, 75%, ${0.25 * segPulse * amp})`);
      segGrad.addColorStop(1, `hsla(${hue}, 90%, 55%, ${0.04 * segPulse * amp})`);
      ctx.fillStyle = segGrad;
      ctx.fill();

      // Segment border
      ctx.strokeStyle = `hsla(${hue}, 100%, 70%, ${0.3 + segPulse * 0.3})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Inner wire detail — 3 lines across each segment
      for (let w2 = 0.25; w2 <= 0.75; w2 += 0.25) {
        const rCur = rInner + (rOuter - rInner) * w2;
        const wHalf = halfWidth * (1 - Math.abs(w2 - 0.5) * 1.2);
        const wa1 = angle - wHalf;
        const wa2 = angle + wHalf;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(wa1) * rCur, cy + Math.sin(wa1) * rCur);
        ctx.lineTo(cx + Math.cos(wa2) * rCur, cy + Math.sin(wa2) * rCur);
        ctx.strokeStyle = `hsla(${hue}, 80%, 45%, ${0.15 * segPulse})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    // ── 5. Inner rotating ring (counter-spin) ──
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-t * spd * 0.25);
    ctx.beginPath();
    ctx.arc(0, 0, rInner - 2, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${hue}, 100%, 70%, ${0.3 + amp * 0.2})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 8, 1, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // ── 6. Inner core ring ──
    const rCore = w * 0.14;
    ctx.beginPath();
    ctx.arc(cx, cy, rCore, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${hue}, 100%, 80%, ${0.4 + amp * 0.3})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Core teeth (rotating)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-t * spd * 0.5);
    const toothCount = 6;
    for (let i = 0; i < toothCount; i++) {
      const a = (i / toothCount) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(0, 0, rCore - 5, a, a + 0.35);
      ctx.strokeStyle = `hsla(${hue}, 100%, 75%, ${0.5 + amp * 0.3})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

    // ── 7. Core glow ──
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rCore - 3);
    coreGrad.addColorStop(0, `hsla(${hue}, 100%, 95%, ${0.95 * pulse})`);
    coreGrad.addColorStop(0.2, `hsla(${hue}, 100%, 80%, ${0.8 * pulse})`);
    coreGrad.addColorStop(0.6, `hsla(${hue}, 100%, 60%, ${0.3 * pulse})`);
    coreGrad.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
    ctx.beginPath();
    ctx.arc(cx, cy, rCore - 2, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // ── 8. Center spark ──
    const sparkR = 3 + amp * 3;
    const sparkGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, sparkR * 3);
    sparkGrad.addColorStop(0, '#ffffff');
    sparkGrad.addColorStop(0.4, `hsla(${hue}, 100%, 90%, 0.8)`);
    sparkGrad.addColorStop(1, `hsla(${hue}, 100%, 70%, 0)`);
    ctx.beginPath();
    ctx.arc(cx, cy, sparkR * 3, 0, Math.PI * 2);
    ctx.fillStyle = sparkGrad;
    ctx.fill();

    // ── 9. Visualizer bars (outer ring) ──
    const barCount = 60;
    const rBarBase = w * 0.39;
    const maxBarLen = w * 0.07;

    for (let i = 0; i < barCount; i++) {
      const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
      const phase = (i / barCount) * Math.PI * 2;

      let val = 0.03;
      switch (stateRef.current) {
        case 'ready':
          val = 0.04 + Math.sin(t * 2 + phase) * 0.03;
          break;
        case 'listening':
          val = 0.12 + Math.sin(t * 6 + phase * 3) * 0.08 + Math.random() * 0.04;
          break;
        case 'thinking':
          val = 0.18 + Math.sin(t * 8 + phase * 5) * 0.10 + Math.random() * 0.05;
          break;
        case 'booting':
          val = 0.25 + Math.sin(t * 3 + phase) * 0.15;
          break;
        case 'speaking':
          val = 0.35 + Math.sin(t * 12 + phase * 2) * 0.25 + Math.random() * 0.25;
          break;
        case 'error':
          val = 0.05 + Math.sin(t * 15 + phase) * 0.03;
          break;
      }

      const len = Math.max(2, val * maxBarLen * (amp * 3 + 0.5));
      const x1 = cx + Math.cos(angle) * rBarBase;
      const y1 = cy + Math.sin(angle) * rBarBase;
      const x2 = cx + Math.cos(angle) * (rBarBase + len);
      const y2 = cy + Math.sin(angle) * (rBarBase + len);

      const barGrad = ctx.createLinearGradient(x1, y1, x2, y2);
      barGrad.addColorStop(0, `hsla(${hue}, 100%, 75%, 0.7)`);
      barGrad.addColorStop(0.5, `hsla(${hue}, 100%, 60%, 0.4)`);
      barGrad.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = barGrad;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    animRef.current = requestAnimationFrame(draw);
  }, [size]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
        display: 'block',
        pointerEvents: 'none',
      }}
    />
  );
}
