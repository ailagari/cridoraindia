import { useEffect } from 'react'
import { fetchPlatformBillingTax } from '@/lib/platformBillingTax'

/** Loads admin-configured GST rates once for client-side calculators. */
export function PlatformBillingTaxBootstrap() {
  useEffect(() => {
    void fetchPlatformBillingTax()
  }, [])
  return null
}
