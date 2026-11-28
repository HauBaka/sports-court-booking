import { Link, Outlet, useLocation } from "react-router-dom";
import Logo from "../components/ui/Logo";

/** Ảnh minh hoạ cho từng trang auth */
const ART = {
  "/login": {
    src: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=900&q=80",
    alt: "Hai người chơi pickleball trên sân ngoài trời",
    title: "Hủy trước 24 giờ, hoàn 80% tiền cọc.",
    line: "Tính tự động qua ví, không phải thương lượng.",
  },
  "/register": {
    src: "https://images.unsplash.com/photo-1577416412292-747c6607f055?w=900&q=80",
    alt: "Sân bóng đá mini ban đêm dưới đèn cao áp",
    title: "Một hệ thống chung cho người chơi và chủ sân.",
    line: "Cùng một tài khoản, cùng một ví.",
  },
};

const FALLBACK = {
  src: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=900&q=80",
  alt: "Sân thể thao",
  title: "Đặt sân dễ dàng, thanh toán minh bạch.",
  line: "Mọi giao dịch đều qua ví, rõ ràng từng đồng.",
};

export default function AuthLayout() {
  const { pathname } = useLocation();
  const art = ART[pathname] ?? FALLBACK;

  return (
    <div className="auth">
      {/* Cột trái: form */}
      <div className="auth__form">
        <Logo to="/" />
        <div className="auth__box fade-in">
          <Outlet />
        </div>
      </div>

      {/* Cột phải: ảnh + quote */}
      <div className="auth__art">
        <img src={art.src} alt={art.alt} />
        <div className="auth__quote">
          <h2>{art.title}</h2>
          <p>{art.line}</p>
        </div>
      </div>
    </div>
  );
}
