export {}

declare global {
  interface Window {
    jarvisAPI?: {
      onGatewayReady: (callback: (result: any) => void) => void
      onGatewayExit: (callback: (data: any) => void) => void
      onMainLog: (callback: (entry: any) => void) => void
      minimize: () => void
      maximize: () => void
      close: () => void
      zoomIn: () => void
      zoomOut: () => void
      zoomReset: () => void
      speakTextFiltered: (text: string, voice?: string) => Promise<any>
    }
  }
}
