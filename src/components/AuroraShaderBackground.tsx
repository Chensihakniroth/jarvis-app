import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export type BackgroundTheme =
  | 'aurora'
  | 'ember'
  | 'void'
  | 'matrix'
  | 'nebula'
  | 'arctic'
  | 'static-dark'
  | 'matrix-code-rain'

interface ThemeConfig {
  primary: [number, number, number]
  secondary: [number, number, number]
  clearColor: number
  speed: number
  intensity: number
  opacity: number
}

const THEMES: Record<BackgroundTheme, ThemeConfig> = {
  aurora: { primary: [0.1, 0.3, 0.7], secondary: [0.3, 0.5, 0.3], clearColor: 0x0a0a14, speed: 1.0, intensity: 1.5, opacity: 0.5 },
  ember: { primary: [0.7, 0.15, 0.05], secondary: [0.5, 0.3, 0.1], clearColor: 0x0e0806, speed: 0.7, intensity: 1.8, opacity: 0.55 },
  void: { primary: [0.35, 0.05, 0.6], secondary: [0.2, 0.1, 0.5], clearColor: 0x080610, speed: 0.5, intensity: 1.3, opacity: 0.45 },
  matrix: { primary: [0.05, 0.65, 0.15], secondary: [0.1, 0.45, 0.1], clearColor: 0x040e06, speed: 1.2, intensity: 1.6, opacity: 0.5 },
  nebula: { primary: [0.5, 0.1, 0.55], secondary: [0.3, 0.2, 0.6], clearColor: 0x0a060e, speed: 0.6, intensity: 1.7, opacity: 0.5 },
  arctic: { primary: [0.15, 0.45, 0.6], secondary: [0.3, 0.55, 0.5], clearColor: 0x060a0e, speed: 0.8, intensity: 1.4, opacity: 0.45 },
  'static-dark': { primary: [0, 0, 0], secondary: [0, 0, 0], clearColor: 0x06060e, speed: 0, intensity: 0, opacity: 0 },
  'matrix-code-rain': { primary: [0, 0, 0], secondary: [0, 0, 0], clearColor: 0x000000, speed: 0, intensity: 0, opacity: 0 },
}

interface Props {
  theme?: BackgroundTheme
}

const AuroraShaderBackground = ({ theme = 'aurora' }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const themeRef = useRef(theme)

  useEffect(() => { themeRef.current = theme }, [theme])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Skip WebGL entirely for static themes
    const cfg = THEMES[themeRef.current]
    if (cfg.speed === 0 && cfg.intensity === 0) {
      container.style.background = `#${cfg.clearColor.toString(16).padStart(6, '0')}`
      return
    }

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    // Low DPR for background shader — big perf win
    const dpr = 1

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'low-power', // Prefer efficiency over performance for background
    })
    renderer.setPixelRatio(dpr)

    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h)
    renderer.setClearColor(cfg.clearColor, 1)
    container.appendChild(renderer.domElement)

    const material = new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2(w, h) },
        iOpacity: { value: cfg.opacity },
        iPrimary: { value: new THREE.Vector3(...cfg.primary) },
        iSecondary: { value: new THREE.Vector3(...cfg.secondary) },
        iSpeed: { value: cfg.speed },
        iIntensity: { value: cfg.intensity },
      },
      vertexShader: `void main() { gl_Position = vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float iTime;
        uniform vec2 iResolution;
        uniform float iOpacity;
        uniform vec3 iPrimary;
        uniform vec3 iSecondary;
        uniform float iSpeed;
        uniform float iIntensity;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                     mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
        }

        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p *= 2.0;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec2 uv = (gl_FragCoord.xy - iResolution.xy * 0.5) / iResolution.y;
          vec2 p = uv * 3.0;

          float t = iTime * 0.15 * iSpeed;

          // 2 layers instead of 35 iterations — massive perf gain
          float n1 = fbm(p + vec2(t * 0.8, t * 0.3));
          float n2 = fbm(p * 1.5 + vec2(-t * 0.5, t * 0.7));

          vec3 col = iPrimary * n1 + iSecondary * n2;
          col *= smoothstep(0.0, 0.8, n1 + n2) * iIntensity;

          float alpha = smoothstep(0.0, 0.5, (n1 + n2) * 0.5) * iOpacity;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    })

    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    // Throttled animation — target 30fps for background
    let frameId: number
    let lastTime = 0
    const TARGET_FPS = 30
    const FRAME_INTERVAL = 1000 / TARGET_FPS
    const currentClear = new THREE.Color()
    const targetClear = new THREE.Color()

    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate)

      // Skip frames to maintain target FPS
      const elapsed = now - lastTime
      if (elapsed < FRAME_INTERVAL) return
      lastTime = now - (elapsed % FRAME_INTERVAL)

      const cfg = THEMES[themeRef.current]
      const dt = elapsed / 1000.0
      const lerpRate = 0.02
      const u = material.uniforms

      u.iOpacity.value += (cfg.opacity - u.iOpacity.value) * lerpRate
      u.iSpeed.value += (cfg.speed - u.iSpeed.value) * lerpRate
      u.iIntensity.value += (cfg.intensity - u.iIntensity.value) * lerpRate
      ;(u.iPrimary.value as THREE.Vector3).lerp(new THREE.Vector3(...cfg.primary), lerpRate)
      ;(u.iSecondary.value as THREE.Vector3).lerp(new THREE.Vector3(...cfg.secondary), lerpRate)

      targetClear.set(cfg.clearColor)
      renderer.getClearColor(currentClear)
      currentClear.lerp(targetClear, lerpRate)
      renderer.setClearColor(currentClear, 1)

      u.iTime.value += dt
      renderer.render(scene, camera)
    }
    frameId = requestAnimationFrame(animate)

    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const handleResize = () => {
      if (resizeTimer !== null) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        const nw = window.innerWidth
        const nh = window.innerHeight
        renderer.setSize(nw, nh)
        material.uniforms.iResolution.value.set(nw, nh)
        resizeTimer = null
      }, 150)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', handleResize)
      if (resizeTimer !== null) clearTimeout(resizeTimer)
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        zIndex: 0, pointerEvents: 'none',
      }}
    />
  )
}

export default AuroraShaderBackground
