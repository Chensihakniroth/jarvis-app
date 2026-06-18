import { useRef, useEffect } from 'react';

interface MatrixCodeRainProps {
  charset?: string;
  fontSize?: number;
  speed?: number;
  density?: number;
  textColor?: string;
}

interface Strand {
  x: number;
  y: number;
  speed: number;
  length: number;
  chars: Uint16Array;
  showCursor: boolean;
  layer: number;
  scale: number;
}

function stringToUint16(str: string): { arr: Uint16Array; len: number } {
  const len = str.length;
  const arr = new Uint16Array(len);
  for (let i = 0; i < len; i++) arr[i] = str.charCodeAt(i);
  return { arr, len };
}

export const MatrixCodeRain = ({
  charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+-=[]{}|;:,./<>?',
  fontSize = 14,
  speed = 0.4,
  density = 1,
  textColor = '#00FF41',
}: MatrixCodeRainProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const animId = useRef<number>(0);
  const strands = useRef<Strand[]>([]);
  const lastTime = useRef(0);
  const cursorBlink = useRef(0);
  const resizeObs = useRef<ResizeObserver | null>(null);

  // Props as refs so the rAF loop reads latest without re-subscribing
  const props = useRef({ charset, fontSize, speed, density, textColor });
  props.current = { charset, fontSize, speed, density, textColor };

  // Charset as Uint16Array, rebuilt when charset changes
  const charsetData = useRef(stringToUint16(charset));
  if (charsetData.current.arr.length !== charset.length ||
      String.fromCharCode.apply(null, Array.from(charsetData.current.arr)) !== charset) {
    charsetData.current = stringToUint16(charset);
  }

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const w = rect.width | 0;
    const h = rect.height | 0;
    if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w;
      canvas.height = h;
    }
  };

  const animate = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dt = time - lastTime.current;
    lastTime.current = time;

    resizeCanvas();

    const W = canvas.width;
    const H = canvas.height;
    const p = props.current;
    const fSize = p.fontSize;
    const dns = p.density;
    const color = p.textColor;
    const spacing = fSize * 1.5;
    const maxStrands = ((W / spacing) | 0) * dns * 1.5;
    const { arr: charArr, len: charLen } = charsetData.current;

    // Spawn new strands
    if (strands.current.length < maxStrands && Math.random() < 0.1 * dns) {
      const slotCount = (W / spacing) | 0;
      for (let attempt = 0; attempt < 8; attempt++) {
        const idx = (Math.random() * slotCount) | 0;
        const x = idx * spacing;
        let occupied = false;
        for (let i = 0; i < strands.current.length; i++) {
          if (strands.current[i].x === x) { occupied = true; break; }
        }
        if (!occupied) {
          const layer = (Math.random() * 3) | 0;
          const scale = layer === 0 ? 0.8 : layer === 1 ? 1 : 1.2;
          const length = ((Math.random() * 15) | 0) + 15;
          const chars = new Uint16Array(length);
          for (let i = 0; i < length; i++) {
            chars[i] = charArr[(Math.random() * charLen) | 0];
          }
          strands.current.push({
            x,
            y: -length * (fSize * scale),
            speed: (Math.random() * 0.3 + 0.7) * p.speed * fSize * (layer === 2 ? 1.2 : layer === 1 ? 1 : 0.8),
            length,
            chars,
            showCursor: true,
            layer,
            scale,
          });
          break;
        }
      }
    }

    // Cursor blink
    cursorBlink.current += dt;
    if (cursorBlink.current >= 500) {
      for (let i = 0; i < strands.current.length; i++) {
        strands.current[i].showCursor = !strands.current[i].showCursor;
      }
      cursorBlink.current = 0;
    }

    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Sort by layer (back to front)
    strands.current.sort((a, b) => a.layer - b.layer);

    // Render strands in-place (no allocation)
    let writeIdx = 0;
    for (let si = 0; si < strands.current.length; si++) {
      const s = strands.current[si];
      s.y += s.speed * dt * 0.05;

      const sSize = fSize * s.scale;
      const topY = s.y;
      const botY = s.y + (s.length * sSize);

      // Cull if entire strand is off-screen bottom
      if (topY > H + sSize) continue;

      const baseOpacity = s.layer === 0 ? 0.3 : s.layer === 1 ? 0.6 : 0.9;

      ctx.font = `${sSize}px monospace`;
      ctx.fillStyle = color;
      ctx.globalAlpha = baseOpacity;

      // Render each character in this strand
      for (let ci = 0; ci < s.length; ci++) {
        const cy = s.y + (ci * sSize);
        if (cy < -sSize || cy > H + sSize) continue;

        ctx.fillText(String.fromCharCode(s.chars[ci]), s.x, cy);

        // Cursor at last character
        if (ci === s.length - 1 && s.showCursor) {
          ctx.fillStyle = '#FFFFFF';
          ctx.globalAlpha = baseOpacity;
          ctx.fillRect(s.x, cy + 2, sSize * 0.8, 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = baseOpacity;
        }
      }

      // Random char mutation
      if (Math.random() < 0.02) {
        const idx = (Math.random() * s.length) | 0;
        s.chars[idx] = charArr[(Math.random() * charLen) | 0];
      }

      // Keep strand in-place
      strands.current[writeIdx++] = s;
    }
    strands.current.length = writeIdx;

    ctx.globalAlpha = 1;

    animId.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    resizeCanvas();
    lastTime.current = performance.now();
    animId.current = requestAnimationFrame(animate);

    const container = containerRef.current;
    if (container) {
      resizeObs.current = new ResizeObserver(resizeCanvas);
      resizeObs.current.observe(container);
    }

    return () => {
      cancelAnimationFrame(animId.current);
      resizeObs.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
};
