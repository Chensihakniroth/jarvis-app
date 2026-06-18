export type HapticIntent =
  | 'cancel'
  | 'close'
  | 'crisp'
  | 'error'
  | 'open'
  | 'selection'
  | 'streamDone'
  | 'streamStart'
  | 'submit'
  | 'success'
  | 'tap'
  | 'warning'

export type HapticInput = any
export type TriggerOptions = any
export type HapticTrigger = (input?: HapticInput, options?: TriggerOptions) => Promise<void> | undefined

export function registerHapticTrigger(trigger: HapticTrigger | null) {}
export function triggerHaptic(intent: HapticIntent = 'selection') {}
