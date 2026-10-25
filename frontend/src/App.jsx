import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RoleProvider } from "./context/RoleContext";
import MainLayout from "./layouts/MainLayout";
import HomePage from "./pages/HomePage";
import HealthCheckPage from "./pages/HealthCheckPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <RoleProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="health" element={<HealthCheckPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </RoleProvider>
  );
}