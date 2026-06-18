import { useCallback } from 'react'

// ── TTS Hook ─────────────────────────────────────────────────────────────────

export function useTTS() {
  const speak = useCallback(async (text: string, voice = 'en-US-AndrewNeural') => {
    try {
      const result = await window.jarvisAPI?.speakTextFiltered(text, voice) as { ok: boolean; audio?: string; format?: string; error?: string; filtered?: string }
      if (!result?.ok) {
        console.error('[TTS] Failed:', result?.error)
        return { ok: false, error: result?.error }
      }

      // Play the audio
      if (result.audio) {
        const audioData = `data:audio/${result.format || 'mp3'};base64,${result.audio}`
        const audio = new Audio(audioData)
        await audio.play()
      }

      return { ok: true }
    } catch (err) {
      console.error('[TTS] Error:', err)
      return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }, [])

  return { speak }
}
