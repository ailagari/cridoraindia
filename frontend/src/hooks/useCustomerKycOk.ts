import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { fetchPlatformPublicConfig, getCachedPlatformPublicConfig } from '@/lib/platformPublicConfig'

/** True when customer may use KYC-gated flows (invest, redeem, etc.). */
export function useCustomerKycOk(): boolean {
  const { user } = useAuth()
  const [kycRequired, setKycRequired] = useState(
    () => getCachedPlatformPublicConfig().customer_kyc_required,
  )

  useEffect(() => {
    void fetchPlatformPublicConfig().then((cfg) => {
      if (cfg) setKycRequired(cfg.customer_kyc_required)
    })
  }, [])

  if (!user || user.user_type !== 'customer') return true
  if (!kycRequired) return true
  return user.kyc_status === 'verified'
}
