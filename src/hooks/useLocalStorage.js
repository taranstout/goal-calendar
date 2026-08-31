import { useState, useCallback } from 'react'
import { load, save } from '../utils/storage'

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => load(key, initialValue))

  const set = useCallback((v) => {
    setValue((prev) => {
      const next = typeof v === 'function' ? v(prev) : v
      save(key, next)
      return next
    })
  }, [key])

  return [value, set]
}
