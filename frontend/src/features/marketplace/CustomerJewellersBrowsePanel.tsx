import { JewellerMarketplaceGrid } from '@/features/marketplace/JewellerMarketplaceGrid'

export function CustomerJewellersBrowsePanel() {
  return (
    <div className="dash-panel-max">
      <p className="dash-panel-lead">
        KYB-verified jewellers on Cridora: compare indicative metal rates, sellback, and listings. Use <strong>Buy gold</strong>{' '}
        for counter fractional purchases from your dashboard, or browse their approved catalogue here first.
      </p>
      <JewellerMarketplaceGrid
        variant="customer_dashboard"
        intro="These storefront cards mirror the public directory — filtered to approved jewellers only. Actions route inside your dashboard where noted."
      />
    </div>
  )
}
