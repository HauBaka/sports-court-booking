import { Link } from "react-router-dom";
import { CourtArt } from "../components/ui";

export default function NotFoundPage({ forbidden }) {
  return (
    <main className="page"><div className="wrap nf">
      <CourtArt size={200} />
      <h1>{forbidden ? "Trang này dành cho vai trò khác" : "Không tìm thấy sân này"}</h1>
      <p className="ink2">{forbidden ? "Đổi vai trò trong menu tài khoản để xem." : "Đường dẫn đã cũ hoặc cơ sở đã ngừng."}</p>
      <Link className="btn btn--primary" to="/tim-san">Tìm sân trống</Link>
    </div></main>
  );
}
