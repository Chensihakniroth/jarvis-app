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
  aurora: {
    primary: [0.1, 0.3, 0.7],
    secondary: [0.3, 0.5, 0.3],
    clearColor: 0x0a0a14,
    speed: 1.0,
    intensity: 1.5,
    opacity: 0.5,
  },
  ember: {
    primary: [0.7, 0.15, 0.05],
    secondary: [0.5, 0.3, 0.1],
    clearColor: 0x0e0806,
    speed: 0.7,
    intensity: 1.8,
    opacity: 0.55,
  },
  void: {
    primary: [0.35, 0.05, 0.6],
    secondary: [0.2, 0.1, 0.5],
    clearColor: 0x080610,
    speed: 0.5,
    intensity: 1.3,
    opacity: 0.45,
  },
  matrix: {
    primary: [0.05, 0.65, 0.15],
    secondary: [0.1, 0.45, 0.1],
    clearColor: 0x040e06,
    speed: 1.2,
    intensity: 1.6,
    opacity: 0.5,
  },
  nebula: {
    primary: [0.5, 0.1, 0.55],
    secondary: [0.3, 0.2, 0.6],
    clearColor: 0x0a060e,
    speed: 0.6,
    intensity: 1.7,
    opacity: 0.5,
  },
  arctic: {
    primary: [0.15, 0.45, 0.6],
    secondary: [0.3, 0.55, 0.5],
    clearColor: 0x060a0e,
    speed: 0.8,
    intensity: 1.4,
    opacity: 0.45,
  },
  'static-dark': {
    primary: [0.0, 0.0, 0.0],
    secondary: [0.0, 0.0, 0.0],
    clearColor: 0x06060e,
    speed: 0.0,
    intensity: 0.0,
    opacity: 0.0,
  },
  'matrix-code-rain': {
    primary: [0.0, 0.0, 0.0],
    secondary: [0.0, 0.0, 0.0],
    clearColor: 0x000000,
    speed: 0.0,
    intensity: 0.0,
    opacity: 0.0,
  },
}

interface Props {
  theme?: BackgroundTheme
}

const AuroraShaderBackground = ({ theme = 'aurora' }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const themeRef = useRef(theme)

  useEffect(() => {
    themeRef.current = theme
  }, [theme])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    // Cap DPR — shader is a background, no need for 2x+ render
    const dpr = Math.min(window.devicePixelRatio, 1.5)

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(dpr)

    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h)
    renderer.setClearColor(THEMES[themeRef.current].clearColor, 1)
    container.appendChild(renderer.domElement)

    const material = new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2(w * dpr, h * dpr) },
        iOpacity: { value: THEMES[themeRef.current].opacity },
        iPrimary: { value: new THREE.Vector3(...THEMES[themeRef.current].primary) },
        iSecondary: { value: new THREE.Vector3(...THEMES[themeRef.current].secondary) },
        iSpeed: { value: THEMES[themeRef.current].speed },
        iIntensity: { value: THEMES[themeRef.current].intensity },
      },
      vertexShader: `
        void main() {
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float iTime;
        uniform vec2 iResolution;
        uniform float iOpacity;
        uniform vec3 iPrimary;
        uniform vec3 iSecondary;
        uniform float iSpeed;
        uniform float iIntensity;

        #define NUM_OCTAVES 3

        float rand(vec2 n) {
          return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 ip = floor(p);
          vec2 u = fract(p);
          u = u*u*(3.0-2.0*u);
          float res = mix(
            mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
            mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x), u.y);
          return res * res;
        }

        float fbm(vec2 x) {
          float v = 0.0;
          float a = 0.3;
          vec2 shift = vec2(100);
          mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
          for (int i = 0; i < NUM_OCTAVES; ++i) {
            v += a * noise(x);
            x = rot * x * 2.0 + shift;
            a *= 0.4;
          }
          return v;
        }

        void main() {
          vec2 shake = vec2(sin(iTime * 1.2) * 0.005, cos(iTime * 2.1) * 0.005);
          vec2 p = ((gl_FragCoord.xy + shake * iResolution.xy) - iResolution.xy * 0.5) / iResolution.y * mat2(6.0, -4.0, 4.0, 6.0);
          vec2 v;
          vec4 o = vec4(0.0);

          float f = 2.0 + fbm(p + vec2(iTime * 5.0 * iSpeed, 0.0)) * 0.5;

          for (float i = 0.0; i < 35.0; i++) {
            v = p + cos(i * i + (iTime * iSpeed + p.x * 0.08) * 0.025 + i * vec2(13.0, 11.0)) * 3.5 + vec2(sin(iTime * 3.0 * iSpeed + i) * 0.003, cos(iTime * 3.5 * iSpeed - i) * 0.003);
            float tailNoise = fbm(v + vec2(iTime * 0.5 * iSpeed, i)) * 0.3 * (1.0 - (i / 35.0));
            vec4 auroraColors = vec4(
              iPrimary.r + iSecondary.r * sin(i * 0.2 + iTime * 0.4 * iSpeed),
              iPrimary.g + iSecondary.g * cos(i * 0.3 + iTime * 0.5 * iSpeed),
              iPrimary.b + iSecondary.b * sin(i * 0.4 + iTime * 0.3 * iSpeed),
              1.0
            );
            vec4 currentContribution = auroraColors * exp(sin(i * i + iTime * 0.8 * iSpeed)) / length(max(v, vec2(v.x * f * 0.015, v.y * 1.5)));
            float thinnessFactor = smoothstep(0.0, 1.0, i / 35.0) * 0.6;
            o += currentContribution * (1.0 + tailNoise * 0.8) * thinnessFactor;
          }

          o = tanh(pow(o / 100.0, vec4(1.6)));
          o *= iIntensity;
          o.a *= iOpacity;
          gl_FragColor = o;
        }
      `,
    })

    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    // Animation loop using refs — never restarts, reads latest theme from ref
    let frameId: number
    let lastTime = performance.now()
    const currentClear = new THREE.Color()
    const targetClear = new THREE.Color()

    const animate = (now: number) => {
      const dt = (now - lastTime) / 1000.0
      lastTime = now

      const cfg = THEMES[themeRef.current]
      const lerpRate = 0.03
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
      frameId = requestAnimationFrame(animate)
    }
    frameId = requestAnimationFrame(animate)

    // Debounced resize — fullscreen toggle fires multiple resize events
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const handleResize = () => {
      if (resizeTimer !== null) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        const nw = window.innerWidth
        const nh = window.innerHeight
        renderer.setSize(nw, nh)
        material.uniforms.iResolution.value.set(nw * dpr, nh * dpr)
        resizeTimer = null
      }, 100)
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
  }, []) // Empty deps — loop runs once, reads theme from ref

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  )
}

export default AuroraShaderBackground
