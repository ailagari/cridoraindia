import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ScrollToTop } from '@/components/ScrollToTop'
import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { PublicLayout } from '@/components/PublicLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { HomePage } from '@/pages/HomePage'
import { WhyCridoraPage } from '@/pages/WhyCridoraPage'
import { FeaturesPage } from '@/pages/FeaturesPage'
import { HowItWorksPage } from '@/pages/HowItWorksPage'
import { InvestorRelationsPage } from '@/pages/InvestorRelationsPage'
import { WaitlistPage } from '@/pages/WaitlistPage'
import { ProductMarketplacePage } from '@/pages/ProductMarketplacePage'
import { MarketplaceProductDetailPage } from '@/pages/MarketplaceProductDetailPage'
import { JewellerDirectoryPage } from '@/pages/JewellerDirectoryPage'
import { JewellerPublicPage } from '@/pages/JewellerPublicPage'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { JewellerApplyPage } from '@/pages/JewellerApplyPage'
import { DiscoverPage } from '@/pages/DiscoverPage'
import { ShopHubPage } from '@/pages/ShopHubPage'
import { JoinHubPage } from '@/pages/JoinHubPage'
import { AdminDashboardPage } from '@/pages/AdminDashboardPage'
import { CustomerDashboardPage } from '@/pages/dashboard/CustomerDashboardPage'
import { JewellerDashboardPage } from '@/pages/dashboard/JewellerDashboardPage'
import { DashboardIndexRedirect } from '@/pages/dashboard/DashboardIndexRedirect'
import { RedirectPreserveSearch } from '@/pages/dashboard/RedirectPreserveSearch'
import { NativeNotificationBridge } from '@/components/NativeNotificationBridge'
import { NativeAppSplash } from '@/components/NativeAppSplash'
import { NativeAppEntryRoute } from '@/components/NativeAppEntryRoute'
import { isNativePlatform } from '@/lib/capacitorPlatform'
import '@/styles/index.css'
import '@/styles/reference-tokens.css'
import '@/styles/reference-legacy-bridge.css'
import '@/styles/reference-ui.css'
import '@/styles/jeweller-unified-desk.css'
import '@/styles/tokens.css'
import '@/styles/ds.css'
import '@/styles/reference-dashboard-panels.css'
import '@/styles/reference-index-landing.css'
import '@/styles/how-it-works-page.css'
import '@/styles/malayalam-locale.css'

const useHashRouter =
  import.meta.env.VITE_CAPACITOR_BUILD === 'true' || isNativePlatform()
const AppRouter = useHashRouter ? HashRouter : BrowserRouter

export default function App() {
  return (
    <AppRouter>
      <ScrollToTop />
      <NativeNotificationBridge />
      <ThemeProvider>
        <AuthProvider>
          <NativeAppSplash />
          <NativeAppEntryRoute />
          <Routes>
            <Route element={<PublicLayout />}>
              <Route index element={<HomePage />} />
              <Route path="discover" element={<DiscoverPage />} />
              <Route path="shop" element={<ShopHubPage />} />
              <Route path="join" element={<JoinHubPage />} />
              <Route path="why-cridora" element={<WhyCridoraPage />} />
              <Route path="features" element={<FeaturesPage />} />
              <Route path="how-it-works" element={<HowItWorksPage />} />
              <Route path="investors" element={<InvestorRelationsPage />} />
              <Route path="waitlist" element={<WaitlistPage />} />
              <Route path="verified-jewellers" element={<Navigate to="/jewellers" replace />} />
              <Route path="jewellers" element={<JewellerDirectoryPage />} />
              <Route path="jewellers/:id" element={<JewellerPublicPage />} />
              <Route path="marketplace/product/:productId" element={<MarketplaceProductDetailPage />} />
              <Route path="marketplace" element={<ProductMarketplacePage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="signup" element={<SignupPage />} />
              <Route path="jeweller/apply" element={<JewellerApplyPage />} />
            </Route>

            <Route path="dashboard" element={<DashboardIndexRedirect />} />
            <Route
              path="userdashboard"
              element={
                <ProtectedRoute allow="customer">
                  <CustomerDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="dashboard/customer" element={<RedirectPreserveSearch to="/userdashboard" />} />
            <Route
              path="dashboard/jeweller"
              element={
                <ProtectedRoute allow="jeweller">
                  <JewellerDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="dashboard/admin"
              element={
                <ProtectedRoute allow="admin">
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />

            <Route path="onboarding/kyc" element={<Navigate to="/userdashboard?section=profile_kyc" replace />} />
            <Route
              path="onboarding/jeweller-kyb"
              element={<Navigate to="/dashboard/jeweller?section=prof_kyb" replace />}
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </AppRouter>
  )
}
