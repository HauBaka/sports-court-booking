import { Link } from "react-router-dom";

export default function NotFoundPage({ forbidden }) {
  return (
    <main className="page"><div className="wrap" style={{ textAlign: "center", paddingTop: 80 }}>
      <h1>{forbidden ? "Trang này dành cho vai trò khác" : "Không tìm thấy sân này"}</h1>
      <p className="ink2" style={{ margin: "12px auto 28px", maxWidth: "48ch" }}>{forbidden ? "Đổi vai trò trong menu tài khoản để xem." : "Đường dẫn đã cũ hoặc cơ sở đã ngừng."}</p>
      <Link className="btn btn--primary" to="/tim-san">Tìm sân trống</Link>
    </div></main>
  );
}
