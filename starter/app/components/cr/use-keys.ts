"use client"

import { useEffect, useRef } from "react"

/** Single-key shortcuts that stay out of the way while someone is typing. */
export function useKeys(map: Record<string, (event: KeyboardEvent) => void>) {
  const ref = useRef(map)
  ref.current = map
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const handler = ref.current[event.key] ?? ref.current[event.key.toLowerCase()]
      if (handler) {
        event.preventDefault()
        handler(event)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
}
