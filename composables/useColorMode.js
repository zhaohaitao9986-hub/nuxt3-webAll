const STORAGE_KEY = 'ast-color-mode'

const colorModeState = () => useState('color-mode', () => 'dark')

export function useColorMode() {
  const mode = colorModeState()

  const apply = (value) => {
    if (!import.meta.client) return
    const root = document.documentElement
    if (value === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch (e) {
      // ignore
    }
  }

  const init = () => {
    if (!import.meta.client) return
    let saved = null
    try {
      saved = localStorage.getItem(STORAGE_KEY)
    } catch (e) {
      saved = null
    }
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    const initial = saved || (prefersDark ? 'dark' : 'dark')
    mode.value = initial
    apply(initial)
  }

  const toggle = () => {
    mode.value = mode.value === 'dark' ? 'light' : 'dark'
    apply(mode.value)
  }

  const set = (value) => {
    mode.value = value
    apply(value)
  }

  return { mode, toggle, set, init }
}
