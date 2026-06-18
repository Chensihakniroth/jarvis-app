import React from 'react'

// ── SVG Filter (must be in DOM for glass distortion) ───────────────────────
export const GlassFilter = () => (
  <svg style={{ position: 'absolute', width: 0, height: 0 }}>
    <filter
      id="glass-distortion"
      x="0%"
      y="0%"
      width="100%"
      height="100%"
      filterUnits="objectBoundingBox"
    >
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.001 0.005"
        numOctaves="1"
        seed="17"
        result="turbulence"
      />
      <feComponentTransfer in="turbulence" result="mapped">
        <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
        <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
        <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
      </feComponentTransfer>
      <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
      <feSpecularLighting
        in="softMap"
        surfaceScale="5"
        specularConstant="1"
        specularExponent="100"
        lightingColor="white"
        result="specLight"
      >
        <fePointLight x="-200" y="-200" z="300" />
      </feSpecularLighting>
      <feComposite
        in="specLight"
        operator="arithmetic"
        k1="0"
        k2="1"
        k3="1"
        k4="0"
        result="litImage"
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2="softMap"
        scale="200"
        xChannelSelector="R"
        yChannelSelector="G"
      />
    </filter>
  </svg>
)

// ── Glass Effect Wrapper ────────────────────────────────────────────────────
interface GlassEffectProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
  title?: string
}

const GlassEffect: React.FC<GlassEffectProps> = ({
  children,
  className = '',
  style = {},
  onClick,
  title,
}) => {
  const glassStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    overflow: 'hidden',
    cursor: onClick ? 'pointer' : 'default',
    boxShadow: '0 6px 6px rgba(0,0,0,0.2), 0 0 20px rgba(0,0,0,0.1)',
    transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 2.2)',
    transition: 'all 0.7s',
    ...style,
  }

  return (
    <div className={className} style={glassStyle} onClick={onClick} title={title}>
      {/* Glass distortion layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          overflow: 'hidden',
          borderRadius: 'inherit',
          backdropFilter: 'blur(3px)',
          filter: 'url(#glass-distortion)',
          isolation: 'isolate',
        }}
      />
      {/* Tint layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          borderRadius: 'inherit',
          background: 'rgba(255,255,255,0.08)',
        }}
      />
      {/* Highlight layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 20,
          borderRadius: 'inherit',
          overflow: 'hidden',
          boxShadow:
            'inset 2px 2px 1px 0 rgba(255,255,255,0.15), inset -1px -1px 1px 1px rgba(255,255,255,0.08)',
        }}
      />
      {/* Content */}
      <div style={{ position: 'relative', zIndex: 30 }}>{children}</div>
    </div>
  )
}

// ── Glass Button ────────────────────────────────────────────────────────────
interface GlassButtonProps {
  children: React.ReactNode
  onClick?: () => void
  className?: string
  style?: React.CSSProperties
  disabled?: boolean
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  onClick,
  className = '',
  style = {},
  disabled = false,
}) => (
  <GlassEffect
    className={className}
    onClick={disabled ? undefined : onClick}
    style={{
      borderRadius: '18px',
      padding: '8px 20px',
      background: disabled
        ? 'rgba(26,26,53,0.5)'
        : 'rgba(0,229,255,0.08)',
      border: disabled
        ? '1px solid rgba(26,26,53,0.5)'
        : '1px solid rgba(0,229,255,0.2)',
      color: disabled ? '#555' : '#00e5ff',
      fontWeight: 700,
      fontSize: '11px',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.25s ease',
      ...style,
    }}
  >
    <div
      style={{
        transition: 'all 0.7s',
        transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 2.2)',
      }}
    >
      {children}
    </div>
  </GlassEffect>
)

// ── Glass Input ─────────────────────────────────────────────────────────────
interface GlassInputProps {
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  onKeyDown?: (e: React.KeyboardEvent) => void
  id?: string
}

export const GlassInput: React.FC<GlassInputProps> = ({
  value,
  onChange,
  placeholder,
  disabled,
  className = '',
  style = {},
  onKeyDown,
  id,
}) => (
  <GlassEffect
    className={className}
    style={{
      borderRadius: '20px',
      background: 'rgba(17,17,34,0.6)',
      border: '1px solid rgba(26,26,53,0.8)',
      ...style,
    }}
  >
    <input
      id={id}
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      onKeyDown={onKeyDown}
      style={{
        background: 'transparent',
        border: 'none',
        outline: 'none',
        color: '#d0d0d0',
        fontSize: '13px',
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        padding: '10px 18px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    />
  </GlassEffect>
)

// ── Glass Icon Button ───────────────────────────────────────────────────────
interface GlassIconButtonProps {
  children: React.ReactNode
  onClick?: () => void
  active?: boolean
  className?: string
  style?: React.CSSProperties
  title?: string
}

export const GlassIconButton: React.FC<GlassIconButtonProps> = ({
  children,
  onClick,
  active = false,
  className = '',
  style = {},
  title,
}) => (
  <GlassEffect
    className={className}
    onClick={onClick}
    style={{
      borderRadius: '8px',
      padding: '6px',
      background: active ? 'rgba(0,229,255,0.08)' : 'transparent',
      border: active
        ? '1px solid rgba(0,229,255,0.25)'
        : '1px solid transparent',
      color: active ? '#00e5ff' : '#555',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.15s ease',
      ...style,
    }}
    title={title}
  >
    {children}
  </GlassEffect>
)

// ── Glass Panel ─────────────────────────────────────────────────────────────
interface GlassPanelProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  className = '',
  style = {},
}) => (
  <GlassEffect
    className={className}
    style={{
      borderRadius: '12px',
      background: 'rgba(13,13,26,0.5)',
      border: '1px solid rgba(26,26,53,0.6)',
      padding: '8px',
      ...style,
    }}
  >
    {children}
  </GlassEffect>
)

export default GlassEffect
