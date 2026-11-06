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
import RequireRole from "./components/RequireRole";
import MyFacilitiesPage from "./pages/owner/MyFacilitiesPage";
import ProfilePage from "./pages/ProfilePage";
import FacilityCreatePage from "./pages/owner/FacilityCreatePage";

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

            {/* Chủ sân */}
            <Route element={<RequireRole roles="owner" />}>
              <Route path="owner/facilities" element={<MyFacilitiesPage />} />
              <Route path="owner/facilities/new" element={<FacilityCreatePage />} />
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
