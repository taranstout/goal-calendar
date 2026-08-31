import { useState, useEffect } from 'react'
import { load, save } from '../utils/storage'

export function useTheme() {
  const [dark, setDark] = useState(() => load('theme', 'light') === 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    save('theme', dark ? 'dark' : 'light')
  }, [dark])

  return [dark, () => setDark((d) => !d)]
}
