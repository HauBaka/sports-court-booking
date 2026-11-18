import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RoleProvider } from "./context/RoleContext";
import { UserProvider } from "./context/UserContext";
import MainLayout from "./layouts/MainLayout";
import HomePage from "./pages/HomePage";
import RequireAuth from "./components/RequireAuth";
import HealthCheckPage from "./pages/HealthCheckPage";
import NotFoundPage from "./pages/NotFoundPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import AuthLayout from "./layouts/AuthLayout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import RequireRole from "./components/RequireRole";
import MyFacilitiesPage from "./pages/owner/MyFacilitiesPage";
import ProfilePage from "./pages/ProfilePage";
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
          <Route element={<MainLayout />}>
            <Route element={<RequireAuth />}>
              <Route index element={<HomePage />} />
            </Route>
            <Route path="health" element={<HealthCheckPage />} />
            <Route path="unauthorized" element={<UnauthorizedPage />} />
            <Route path="profile" element={<ProfilePage />} />

            {/* Khách hàng */}
            <Route element={<RequireRole roles="customer" />}>
              <Route path="courts" element={<FindCourtsPage />} />
              <Route path="courts/:id" element={<CustomerCourtDetailPage />} />
              <Route path="booking/confirm" element={<BookingConfirmPage />} />
              <Route path="bookings/:id/deposit" element={<DepositPage />} />
            </Route>

            {/* Chủ sân */}
            <Route element={<RequireRole roles="owner" />}>
              <Route path="owner/facilities" element={<MyFacilitiesPage />} />
              <Route path="owner/facilities/new" element={<FacilityCreatePage />} />
              <Route path="owner/facilities/:id" element={<FacilityDetailPage />} />
              <Route path="owner/courts/:courtId" element={<CourtDetailPage />} />
              <Route path="owner/courts/:courtId/edit" element={<CourtEditPage />} />
            </Route>

            {/* Admin */}
            <Route element={<RequireRole roles="admin" />}>
              <Route path="admin" element={<AdminPlaceholderPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route element={<AuthLayout />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </UserProvider>
    </RoleProvider>
  );
}

// Placeholder cho /admin cho den khi co trang that
function AdminPlaceholderPage() {
  return <div style={{ padding: 24 }}><h2>Trang quản trị viên</h2></div>;
}
