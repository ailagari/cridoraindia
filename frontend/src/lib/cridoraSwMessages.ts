/** Posted by `sw.ts` when a Web Push is handled so SPA bells refresh without reload. */
export const CRIDORA_PUSH_REFRESH_MESSAGE_TYPE = 'cridora-push-refresh' as const

/** Service worker lost push subscription — client should re-register. */
export const CRIDORA_PUSH_RESUBSCRIBE_MESSAGE_TYPE = 'cridora-push-resubscribe' as const
