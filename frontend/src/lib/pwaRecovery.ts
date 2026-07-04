/** Clear service worker + Cache Storage so the next load fetches fresh assets from the network. */
export async function clearPwaCachesForRecovery(): Promise<void> {
  const tasks: Promise<unknown>[] = []
  if (typeof caches !== 'undefined') {
    tasks.push(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
    )
  }
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    tasks.push(
      navigator.serviceWorker.getRegistrations().then((regs) =>
        Promise.all(regs.map((reg) => reg.unregister())),
      ),
    )
  }
  await Promise.all(tasks)
}

export function cacheBustUrl(path: string): string {
  const url = new URL(path, window.location.origin)
  url.searchParams.set('_fresh', String(Date.now()))
  return `${url.pathname}${url.search}${url.hash}`
}
