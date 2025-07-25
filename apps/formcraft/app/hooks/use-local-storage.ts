"use client"

import { useCallback, useEffect, useState } from "react"

function getItemFromLocalStorage(key: string) {
  const item = window?.localStorage.getItem(key)
  if (item) return JSON.parse(item)

  return null
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState(initialValue)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = getItemFromLocalStorage(key)
      if (stored !== null) setStoredValue(stored)
    }
  }, [key])

  const setValue: React.Dispatch<React.SetStateAction<T>> = useCallback(
    (value) => {
      if (value instanceof Function) {
        setStoredValue((prev: T) => {
          const newValue = value(prev)

          window.localStorage.setItem(key, JSON.stringify(newValue))
          return newValue
        })
      } else {
        setStoredValue(value)

        window.localStorage.setItem(key, JSON.stringify(value))
      }
      return setStoredValue
    },
    [key, setStoredValue]
  )

  return [storedValue, setValue]
}
