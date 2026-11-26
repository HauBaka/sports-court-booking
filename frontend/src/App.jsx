import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RoleProvider } from "./context/RoleContext";
import { UserProvider } from "./context/UserContext";

import CustomerLayout from "./layouts/CustomerLayout";
import ConsoleLayout from "./layouts/ConsoleLayout";
import AuthLayout from "./layouts/AuthLayout";

import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";

import HomePage from "./pages/HomePage";
import HealthCheckPage from "./pages/HealthCheckPage";
import NotFoundPage from "./pages/NotFoundPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ProfilePage from "./pages/ProfilePage";
import WalletPage from "./pages/WalletPage";
import OwnerWalletPage from "./pages/owner/OwnerWalletPage";
import OwnerPricingPage from "./pages/owner/OwnerPricingPage";
import AdminTopupPage from "./pages/admin/AdminTopupPage";
import AdminHolidaysPage from "./pages/admin/AdminHolidaysPage";
import MyFacilitiesPage from "./pages/owner/MyFacilitiesPage";
import FacilityCreatePage from "./pages/owner/FacilityCreatePage";
import FacilityDetailPage from "./pages/owner/FacilityDetailPage";
import CourtDetailPage from "./pages/owner/CourtDetailPage";
import CourtEditPage from "./pages/owner/CourtEditPage";
import FindCourtsPage from "./pages/customer/FindCourtsPage";
import CustomerCourtDetailPage from "./pages/customer/CourtDetailPage";
import BookingConfirmPage from "./pages/customer/BookingConfirmPage";
import DepositPage from "./pages/customer/DepositPage";

export default function App() {
  return (
    <RoleProvider>
      <UserProvider>
        <BrowserRouter>
          <Routes>
            {/* ── Auth pages (không có nav) ────────────────────── */}
            <Route element={<AuthLayout />}>
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="forgot-password" element={<ForgotPasswordPage />} />
            </Route>

            {/* ── Owner console (sidebar) ──────────────────────── */}
            <Route element={<RequireRole roles="owner" />}>
              <Route element={<ConsoleLayout role="owner" />}>
                <Route path="owner/facilities" element={<MyFacilitiesPage />} />
                <Route path="owner/facilities/new" element={<FacilityCreatePage />} />
                <Route path="owner/facilities/:id" element={<FacilityDetailPage />} />
                <Route path="owner/courts/:courtId" element={<CourtDetailPage />} />
                <Route path="owner/courts/:courtId/edit" element={<CourtEditPage />} />
                <Route path="owner/pricing" element={<OwnerPricingPage />} />
                <Route path="owner/wallet" element={<OwnerWalletPage />} />
              </Route>
            </Route>

            {/* ── Admin console (sidebar) ──────────────────────── */}
            <Route element={<RequireRole roles="admin" />}>
              <Route element={<ConsoleLayout role="admin" />}>
                <Route path="admin" element={<AdminTopupPage />} />
                <Route path="admin/holidays" element={<AdminHolidaysPage />} />
                <Route path="health" element={<HealthCheckPage />} />
              </Route>
            </Route>

            {/* ── Customer / public (topnav) ───────────────────── */}
            <Route element={<CustomerLayout />}>
              <Route path="unauthorized" element={<UnauthorizedPage />} />

              {/* Yêu cầu đăng nhập */}
              <Route element={<RequireAuth />}>
                <Route index element={<HomePage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="wallet" element={<WalletPage />} />
              </Route>

              {/* Chỉ customer */}
              <Route element={<RequireRole roles="customer" />}>
                <Route path="courts" element={<FindCourtsPage />} />
                <Route path="courts/:id" element={<CustomerCourtDetailPage />} />
                <Route path="booking/confirm" element={<BookingConfirmPage />} />
                <Route path="bookings/:id/deposit" element={<DepositPage />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </UserProvider>
    </RoleProvider>
  );
}
