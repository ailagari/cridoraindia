import { useEffect } from 'react'

/** Scroll reveal for `.ref-landing .reveal` blocks (prototype index.html parity). */
export function useRefLandingReveal(): void {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll('.ref-landing .reveal'))
    if (!nodes.length) return

    const ro = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('in')
          ro.unobserve(entry.target)
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    nodes.forEach((node) => ro.observe(node))

    return () => {
      nodes.forEach((node) => ro.unobserve(node))
      ro.disconnect()
    }
  }, [])
}
