import { JewellerMarketplaceGrid } from '@/features/marketplace/JewellerMarketplaceGrid'

export function CustomerJewellersBrowsePanel() {
  return (
    <div className="dash-panel-max">
      <p className="dash-panel-lead">
        Browse verified jeweller storefronts: metal rates, sellback, and how many SKUs they publish. Open{' '}
        <strong>Catalogue</strong> in Marketplace to shop admin-approved jewellery pieces (whole-piece checkout like the
        public site). Use <strong>Buy gold</strong> under Invest for counter fractional purchases.
      </p>
      <JewellerMarketplaceGrid
        variant="customer_dashboard"
        intro="These storefront cards mirror the public directory — filtered to approved jewellers only. Actions route inside your dashboard where noted."
      />
    </div>
  )
}
