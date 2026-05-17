import { JewellerMarketplaceGrid } from '@/features/marketplace/JewellerMarketplaceGrid'

export function CustomerJewellersBrowsePanel() {
  return (
    <div className="dash-panel-max">
      <p className="dash-panel-lead">
        Browse verified jeweller storefronts: metal rates, sellback, and how many SKUs they publish. Use{' '}
        <strong>Buy gold</strong> on a jeweller card for counter fractional purchases. Open{' '}
        <strong>Catalogue</strong> in Marketplace for jewellery <strong>pieces</strong> only (whole-piece checkout — same as
        the public product marketplace).
      </p>
      <JewellerMarketplaceGrid
        variant="customer_dashboard"
        intro="These storefront cards mirror the public directory — filtered to approved jewellers only. Actions route inside your dashboard where noted."
      />
    </div>
  )
}
