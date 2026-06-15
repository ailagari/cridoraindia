import { Route } from 'react-router-dom'
import { MalayalamLocaleLayout } from '@/components/MalayalamLocaleLayout'
import { GoldRatesPage } from '@/pages/GoldRatesPage'
import { GoldCalculatorPage } from '@/pages/GoldCalculatorPage'
import { GoldRatesIndiaPage } from '@/pages/GoldRatesIndiaPage'
import { GoldRatesCityPage } from '@/pages/GoldRatesCityPage'

/** Malayalam hreflang routes under `/ml/gold-rates/...` (Route JSX for use inside `<Routes>`). */
export const goldRatesMalayalamRoutes = (
  <Route path="ml" element={<MalayalamLocaleLayout />}>
    <Route path="gold-rates/kerala" element={<GoldRatesPage />} />
    <Route path="gold-rates/india" element={<GoldRatesIndiaPage />} />
    <Route path="gold-rates/:citySlug" element={<GoldRatesCityPage />} />
    <Route path="gold-calculator" element={<GoldCalculatorPage />} />
  </Route>
)
