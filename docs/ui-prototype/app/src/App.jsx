import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { StoreProvider, useStore } from "./data/store";
import { ToastProvider } from "./components/ui";
import { ConsoleLayout, CustomerLayout, RequireRole } from "./components/layouts";
import SearchPage from "./pages/SearchPage";
import FacilityPage from "./pages/FacilityPage";
import { BookingConfirmPage, BookingPayPage, BookingResultPage } from "./pages/BookingPages";
import { BookingDetailPage, MyBookingsPage } from "./pages/MyBookingsPages";
import { ProfilePage, TeamPage, WalletPage } from "./pages/AccountPages";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import NotFoundPage from "./pages/NotFoundPage";
import { OwnerFacilitiesPage, OwnerFacilityEditPage, OwnerPricingPage, OwnerSchedulePage, OwnerServicesPage } from "./pages/owner/OwnerPages";
import { AdminBookingsPage, AdminDashboard, AdminHolidaysPage, AdminTopupPage, AdminTransactionsPage } from "./pages/admin/AdminPages";

// Ví: khách xem ở /vi, chủ sân ở /chu-san/vi
function WalletRoute() {
  const { me } = useStore();
  if (me?.role === "owner") return <Navigate to="/chu-san/vi" replace />;
  if (me?.role === "admin") return <Navigate to="/admin/giao-dich" replace />;
  return <WalletPage />;
}

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route index element={<Navigate to="/tim-san" replace />} />
            <Route path="dang-nhap" element={<LoginPage />} />
            <Route path="dang-ky" element={<RegisterPage />} />

            <Route element={<CustomerLayout />}>
              <Route path="tim-san" element={<SearchPage />} />
              <Route path="san/:id" element={<FacilityPage />} />
              <Route path="ghep-doi" element={<TeamPage />} />
              <Route path="khong-co-quyen" element={<NotFoundPage forbidden />} />
              <Route element={<RequireRole />}>
                <Route path="ho-so" element={<ProfilePage />} />
                <Route path="vi" element={<WalletRoute />} />
              </Route>
              {/* chủ sân cũng là người dùng: đặt sân như khách (đề xuất mục 3); API 3.3 cần mở quyền cho owner */}
              <Route element={<RequireRole roles={["customer", "owner"]} />}>
                <Route path="dat-san" element={<BookingConfirmPage />} />
                <Route path="dat-san/:id" element={<BookingPayPage />} />
                <Route path="dat-san/:id/xong" element={<BookingResultPage />} />
                <Route path="lich-dat" element={<MyBookingsPage />} />
                <Route path="lich-dat/:id" element={<BookingDetailPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            <Route path="chu-san" element={<RequireRole roles={["owner"]}><ConsoleLayout role="owner" /></RequireRole>}>
              <Route index element={<OwnerFacilitiesPage />} />
              <Route path="co-so/:id" element={<OwnerFacilityEditPage />} />
              <Route path="bang-gia" element={<OwnerPricingPage />} />
              <Route path="dich-vu" element={<OwnerServicesPage />} />
              <Route path="lich-dat" element={<OwnerSchedulePage />} />
              <Route path="vi" element={<WalletPage />} />
            </Route>

            <Route path="admin" element={<RequireRole roles={["admin"]}><ConsoleLayout role="admin" /></RequireRole>}>
              <Route index element={<AdminDashboard />} />
              <Route path="cap-tien" element={<AdminTopupPage />} />
              <Route path="giao-dich" element={<AdminTransactionsPage />} />
              <Route path="don-dat" element={<AdminBookingsPage />} />
              <Route path="ngay-le" element={<AdminHolidaysPage />} />
            </Route>
          </Routes>
        </HashRouter>
      </ToastProvider>
    </StoreProvider>
  );
}
