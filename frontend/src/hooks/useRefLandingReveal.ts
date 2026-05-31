import { useEffect } from 'react'

function revealIfVisible(node: Element, ro: IntersectionObserver): void {
  const rect = node.getBoundingClientRect()
  const vh = window.innerHeight || document.documentElement.clientHeight
  if (rect.top < vh - 40 && rect.bottom > 0) {
    node.classList.add('in')
    ro.unobserve(node)
  }
}

/** Scroll reveal for `.ref-landing .reveal` blocks (prototype index.html parity). */
export function useRefLandingReveal(resetKey?: string): void {
  useEffect(() => {
    let ro: IntersectionObserver | null = null
    let raf = 0

    const bind = () => {
      const nodes = Array.from(document.querySelectorAll('.ref-landing .reveal'))
      if (!nodes.length) return

      nodes.forEach((node) => node.classList.remove('in'))

      ro?.disconnect()
      ro = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            entry.target.classList.add('in')
            ro?.unobserve(entry.target)
          })
        },
        { threshold: 0, rootMargin: '0px 0px -40px 0px' },
      )

      nodes.forEach((node) => {
        ro!.observe(node)
        revealIfVisible(node, ro!)
      })
    }

    bind()
    raf = window.requestAnimationFrame(bind)

    return () => {
      window.cancelAnimationFrame(raf)
      ro?.disconnect()
    }
  }, [resetKey])
}