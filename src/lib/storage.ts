export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key)
      }
    } catch (e) {
      console.warn('localStorage.getItem is blocked or not available:', e)
    }
    return null
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value)
      }
    } catch (e) {
      console.warn('localStorage.setItem is blocked or not available:', e)
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key)
      }
    } catch (e) {
      console.warn('localStorage.removeItem is blocked or not available:', e)
    }
  }
}
