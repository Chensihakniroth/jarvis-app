import React, { createContext, useContext, useMemo } from 'react'

export const EN_TRANSLATIONS = {
  common: {
    copy: 'Copy',
    copied: 'Copied!',
    copyFailed: 'Copy failed',
    failed: 'Failed',
    confirm: 'Confirm',
    cancel: 'Cancel',
    close: 'Close',
    save: 'Save',
    delete: 'Delete',
    loading: 'Loading...',
    done: 'Done',
  },
  errors: {
    genericFailure: 'Something went wrong',
  },
  ui: {
    sidebar: {
      title: 'Sidebar',
      description: 'Toggle sidebar view',
      toggle: 'Toggle Sidebar',
    },
    pagination: {
      previous: 'Previous',
      next: 'Next',
      page: 'Page',
      of: 'of',
      goToPage: 'Go to page',
    },
    search: {
      placeholder: 'Search...',
      clear: 'Clear search',
    },
  },
  assistant: {
    thread: {
      loadingSession: 'Loading session...',
      loadingResponse: 'Thinking...',
      thinking: 'Reasoning...',
      copy: 'Copy message',
      refresh: 'Regenerate response',
      moreActions: 'More actions',
      branchNewChat: 'Branch in new chat',
      readAloud: 'Read aloud',
      readAloudFailed: 'Failed to read aloud',
      preparingAudio: 'Preparing audio...',
      stopReading: 'Stop reading',
      today: (time: string) => `Today at ${time}`,
      yesterday: (time: string) => `Yesterday at ${time}`,
    },
  },
  composer: {
    newSessionPlaceholders: [
      'Ask J.A.R.V.I.S. anything...',
      'How can I help you, Sir?',
      'Awaiting your instructions, Sir...',
    ],
    followUpPlaceholders: [
      'Ask a follow-up...',
      'Any further details, Sir?',
    ],
    placeholderReconnecting: 'Reconnecting to J.A.R.V.I.S. gateway...',
    placeholderStarting: 'Starting J.A.R.V.I.S. gateway...',
    message: {
      send: 'Send message',
      stop: 'Stop generation',
    },
    editingQueuedInComposer: 'Editing queued message',
    endConversation: 'End conversation',
    endShort: 'End',
    stopDictation: 'Stop dictation',
    transcribingDictation: 'Transcribing...',
    voiceDictation: 'Voice dictation',
  },
  notifications: {
    voiceRecordingFailed: 'Voice recording failed',
    microphoneAccessDenied: 'Microphone access denied',
  },
}

export type Translations = typeof EN_TRANSLATIONS

export interface I18nContextValue {
  locale: string
  t: Translations
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  t: EN_TRANSLATIONS,
})

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => ({ locale: 'en', t: EN_TRANSLATIONS }), [])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
