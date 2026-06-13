import { useState } from 'react'
import { JewellerMarketplaceGrid } from '@/features/marketplace/JewellerMarketplaceGrid'
import { CustomerDefaultJewellerPanel } from '@/features/customer/CustomerDefaultJewellerPanel'
import type { GoldWalletDTO } from '@/lib/goldTransferApi'

export function CustomerJewellersBrowsePanel() {
  const [wallet, setWallet] = useState<GoldWalletDTO | null>(null)

  return (
    <div className="dash-panel-max">
      <CustomerDefaultJewellerPanel onWalletChange={setWallet} />
      <p className="dash-panel-lead">
        Browse verified jeweller storefronts: metal rates, sellback, and how many SKUs they publish. Use{' '}
        <strong>Buy gold</strong> on a jeweller card for counter fractional purchases. Open{' '}
        <strong>Catalogue</strong> in Marketplace for jewellery <strong>pieces</strong> only (whole-piece checkout — same as
        the public product marketplace).
      </p>
      <JewellerMarketplaceGrid
        variant="customer_dashboard"
        wallet={wallet}
        onWalletChange={setWallet}
        intro="These storefront cards mirror the public directory — filtered to approved jewellers only. Actions route inside your dashboard where noted."
      />
    </div>
  )
}
