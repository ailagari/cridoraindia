import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ScrollToTop } from '@/components/ScrollToTop'
import { AuthProvider } from '@/context/AuthContext'
import { PublicLayout } from '@/components/PublicLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { HomePage } from '@/pages/HomePage'
import { WhyCridoraPage } from '@/pages/WhyCridoraPage'
import { FeaturesPage } from '@/pages/FeaturesPage'
import { ProductMarketplacePage } from '@/pages/ProductMarketplacePage'
import { JewellerDirectoryPage } from '@/pages/JewellerDirectoryPage'
import { JewellerPublicPage } from '@/pages/JewellerPublicPage'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { JewellerApplyPage } from '@/pages/JewellerApplyPage'
import { AdminDashboardPage } from '@/pages/AdminDashboardPage'
import { CustomerDashboardPage } from '@/pages/dashboard/CustomerDashboardPage'
import { JewellerDashboardPage } from '@/pages/dashboard/JewellerDashboardPage'
import { DashboardIndexRedirect } from '@/pages/dashboard/DashboardIndexRedirect'
import { RedirectPreserveSearch } from '@/pages/dashboard/RedirectPreserveSearch'
import '@/styles/index.css'

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="why-cridora" element={<WhyCridoraPage />} />
            <Route path="features" element={<FeaturesPage />} />
            <Route path="verified-jewellers" element={<Navigate to="/jewellers" replace />} />
            <Route path="jewellers" element={<JewellerDirectoryPage />} />
            <Route path="jewellers/:id" element={<JewellerPublicPage />} />
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
    </BrowserRouter>
  )
}
