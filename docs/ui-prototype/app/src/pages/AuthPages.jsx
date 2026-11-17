import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../data/store";
import { PHOTOS } from "../data/mock";
import { Icon, Logo, useCountdown } from "../components/ui";

const HOME = { customer: "/tim-san", owner: "/chu-san", admin: "/admin" };

function AuthShell({ photo, title, line, children }) {
  return (
    <div className="auth">
      <div className="auth__form">
        <Logo />
        <div className="auth__box fade-in">{children}</div>
      </div>
      <div className="auth__art">
        <img src={photo} alt="" />
        <div className="auth__quote"><h2>{title}</h2><p>{line}</p></div>
      </div>
    </div>
  );
}

const EMAIL = /^\S+@\S+\.\S+$/;
const Req = () => <span className="req" aria-hidden="true">*</span>;

export function LoginPage() {
  const { api } = useStore();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState({});
  const next = params.get("next");

  const submit = (e) => {
    e.preventDefault();
    const er = {};
    if (!EMAIL.test(email)) er.email = "Nhập email có dấu @, ví dụ minh@gmail.com.";
    if (!pw) er.pw = "Nhập mật khẩu.";
    setErr(er);
    if (Object.keys(er).length) return;
    const r = api.login(email);
    if (r.error) return setErr({ form: r.error });
    nav(next || HOME[r.user.role], { replace: true });
  };
  const demo = (role) => { api.loginAs(role); nav(next || HOME[role], { replace: true }); };

  return (
    <AuthShell photo={PHOTOS.pickleDoubles} title="Hủy trước 24 giờ, hoàn 80% tiền cọc." line="Quy định hoàn cọc công khai, tính tự động qua ví. Không phải nhắn tin thương lượng với chủ sân.">
      <h1>Đăng nhập</h1>
      <p className="auth__lead">Chưa có tài khoản? <Link className="link" to="/dang-ky">Tạo tài khoản mới</Link></p>
      <form className="stack" onSubmit={submit} noValidate>
        {err.form && <div className="notice notice--danger"><Icon name="alert" />{err.form}</div>}
        <div className="field"><label htmlFor="em">Email<Req /></label><input id="em" className="input" type="email" autoComplete="email" placeholder="ten@gmail.com" required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!err.email} />{err.email && <span className="field__err">{err.email}</span>}</div>
        <div className="field"><label htmlFor="pw">Mật khẩu<Req /></label>
          <div className="input-group"><input id="pw" className="input" type={show ? "text" : "password"} autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={!!err.pw} /><button type="button" className="btn btn--ghost btn--sm input-act" onClick={() => setShow(!show)}>{show ? "Ẩn" : "Hiện"}</button></div>
          {err.pw && <span className="field__err">{err.pw}</span>}</div>
        <button className="btn btn--primary btn--lg btn--block">Đăng nhập</button>
      </form>
      <div className="or">Hoặc vào nhanh bằng tài khoản mẫu</div>
      <div className="demo-accounts">
        <button onClick={() => demo("customer")}>Khách hàng<small>Nguyễn Minh</small></button>
        <button onClick={() => demo("owner")}>Chủ sân<small>Hoàng Long</small></button>
        <button onClick={() => demo("admin")}>Admin<small>Quản trị viên</small></button>
      </div>
    </AuthShell>
  );
}

const RULES = [
  ["8 ký tự trở lên", (p) => p.length >= 8],
  ["Chữ hoa", (p) => /[A-Z]/.test(p)],
  ["Chữ thường", (p) => /[a-z]/.test(p)],
  ["Số", (p) => /\d/.test(p)],
  ["Ký tự đặc biệt", (p) => /[^A-Za-z0-9]/.test(p)],
];
const DEMO_OTP = "246810";

// Đăng ký một bước: email hợp lệ thì gửi được mã; mã đúng thì email được đánh dấu đã xác minh.
export function RegisterPage() {
  const { api } = useStore();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "customer" });
  const [err, setErr] = useState({});
  const [show, setShow] = useState(false);
  const [otp, setOtp] = useState(Array(6).fill(""));
  const [sentTo, setSentTo] = useState("");
  const [verified, setVerified] = useState("");
  const [tries, setTries] = useState(0);
  const [until, setUntil] = useState(0);
  const refs = useRef([]);
  const { left, text } = useCountdown(until);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const emailOk = EMAIL.test(form.email.trim());
  const isVerified = verified && verified === form.email.trim();
  const codeOpen = sentTo && sentTo === form.email.trim() && !isVerified;

  const sendCode = () => {
    if (!emailOk) return setErr({ ...err, email: "Nhập email có dấu @, ví dụ minh@gmail.com." });
    setSentTo(form.email.trim()); setOtp(Array(6).fill("")); setTries(0); setUntil(Date.now() + 5 * 60000);
    setErr({ ...err, email: undefined, otp: undefined });
    setTimeout(() => refs.current[0]?.focus(), 50);
  };
  // đủ 6 số thì kiểm tra ngay, không cần thêm nút
  useEffect(() => {
    const code = otp.join("");
    if (!codeOpen || code.length < 6) return;
    if (left === 0) return setErr((e) => ({ ...e, otp: "Mã đã hết hạn. Bấm gửi lại mã." }));
    if (tries >= 5) return setErr((e) => ({ ...e, otp: "Sai quá 5 lần. Bấm gửi lại để nhận mã mới." }));
    if (code === DEMO_OTP) { setVerified(sentTo); setErr((e) => ({ ...e, otp: undefined, email: undefined })); return; }
    setTries((t) => t + 1);
    setErr((e) => ({ ...e, otp: `Mã chưa đúng. Còn ${4 - tries} lần thử.` }));
    setOtp(Array(6).fill("")); refs.current[0]?.focus();
  }, [otp]); // eslint-disable-line react-hooks/exhaustive-deps

  const typeOtp = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...otp]; next[i] = v; setOtp(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
  };
  const submit = (e) => {
    e.preventDefault();
    const er = {};
    if (form.name.trim().length < 2) er.name = "Nhập họ và tên.";
    if (!/^0\d{9}$/.test(form.phone)) er.phone = "Gồm 10 số, bắt đầu bằng 0.";
    if (!emailOk) er.email = "Nhập email có dấu @, ví dụ minh@gmail.com.";
    else if (!isVerified) er.email = "Bấm Gửi mã và nhập mã 6 số để xác minh email.";
    if (!RULES.every(([, t]) => t(form.password))) er.password = "Mật khẩu chưa đủ các điều kiện bên dưới.";
    setErr(er);
    if (Object.keys(er).length) return;
    const r = api.register({ name: form.name.trim(), email: form.email.trim(), phone: form.phone, role: form.role });
    if (r.error) return setErr({ form: r.error });
    nav(HOME[form.role], { replace: true });
  };

  return (
    <AuthShell photo={PHOTOS.futsalNight} title="Một hệ thống chung cho người chơi và chủ sân." line="Người chơi tìm và đặt sân. Chủ sân đăng sân, đặt giá và nhận cọc. Cùng một tài khoản, cùng một ví.">
      <h1>Tạo tài khoản</h1>
      <p className="auth__lead">Đã có tài khoản? <Link className="link" to="/dang-nhap">Đăng nhập</Link><span className="form-note" style={{ marginLeft: 12 }}><span className="req">*</span> là ô bắt buộc</span></p>
      <form className="reg" onSubmit={submit} noValidate>
        {err.form && <div className="notice notice--danger wide"><Icon name="alert" />{err.form}</div>}
          <div className="field"><label htmlFor="nm">Họ và tên<Req /></label><input id="nm" className="input" autoComplete="name" placeholder="Nguyễn Văn Minh" required value={form.name} onChange={set("name")} aria-invalid={!!err.name} />{err.name && <span className="field__err">{err.name}</span>}</div>
          <div className="field"><label htmlFor="ph">Số điện thoại<Req /></label><input id="ph" className="input" inputMode="numeric" autoComplete="tel" placeholder="0901234567" required value={form.phone} onChange={set("phone")} aria-invalid={!!err.phone} />{err.phone && <span className="field__err">{err.phone}</span>}</div>
        <div className="field wide">
          <div className="row between"><label htmlFor="em2">Email<Req /></label>{isVerified && <span className="verified"><i><Icon name="check" size={12} /></i>Đã xác minh</span>}</div>
          <div className="input-group">
            <input id="em2" className="input" type="email" autoComplete="email" placeholder="ten@gmail.com" required value={form.email} onChange={set("email")} aria-invalid={!!err.email} aria-describedby="em2-h" />
            {!isVerified && <button type="button" className={"btn btn--sm input-act" + (emailOk ? " btn--primary" : "")} disabled={!emailOk || (codeOpen && left > 0 && tries < 5)} onClick={sendCode}>{codeOpen ? "Đã gửi" : "Gửi mã"}</button>}
          </div>
          {err.email ? <span className="field__err">{err.email}</span> : !isVerified && !codeOpen && <span className="form-note" id="em2-h">Nhập email đúng định dạng để nhận mã xác minh 6 số.</span>}
          {codeOpen && (
            <div className="verify">
              <div className="verify__row">
                <div className="otp" role="group" aria-label="Mã xác minh 6 số" onPaste={(e) => { const v = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6); if (v) { setOtp(v.padEnd(6, " ").split("").map((x) => x.trim())); e.preventDefault(); } }}>
                  {otp.map((v, i) => <input key={i} ref={(el) => (refs.current[i] = el)} value={v} inputMode="numeric" maxLength={1} aria-label={`Số thứ ${i + 1}`} onChange={(e) => typeOtp(i, e.target.value)} onKeyDown={(e) => e.key === "Backspace" && !v && i && refs.current[i - 1]?.focus()} />)}
                </div>
                <div style={{ textAlign: "right" }}><div className="mono">{left ? text : "Hết hạn"}</div><button type="button" className="link small" onClick={sendCode}>Gửi lại mã</button></div>
              </div>
              {err.otp && <span className="field__err">{err.otp}</span>}
              <span className="form-note">Mã 6 số đã gửi tới {sentTo}. Bản mẫu không gửi email thật, dùng mã <b className="mono" style={{ color: "var(--accent)" }}>{DEMO_OTP}</b>.</span>
            </div>
          )}
        </div>
        <div className="field"><label htmlFor="pw2">Mật khẩu<Req /></label>
          <div className="input-group"><input id="pw2" className="input" type={show ? "text" : "password"} autoComplete="new-password" required value={form.password} onChange={set("password")} aria-invalid={!!err.password} /><button type="button" className="btn btn--ghost btn--sm input-act" onClick={() => setShow(!show)}>{show ? "Ẩn" : "Hiện"}</button></div>
          {err.password && <span className="field__err">{err.password}</span>}
          <div className="pw-rules" aria-label="Điều kiện mật khẩu">{RULES.map(([l, t]) => <span key={l} className={t(form.password) ? "ok" : ""}><Icon name={t(form.password) ? "check" : "x"} size={12} />{l}</span>)}</div>
        </div>
        <div className="field"><span className="label" id="role-l">Bạn là<Req /></span>
          <div className="role-pick" role="radiogroup" aria-labelledby="role-l">
            {[["customer", "Người chơi", "Tìm sân, đặt và cọc"], ["owner", "Chủ sân", "Đăng sân, đặt giá, nhận cọc"]].map(([v, l, d]) => <button type="button" role="radio" aria-checked={form.role === v} key={v} onClick={() => setForm({ ...form, role: v })}>{l}<small>{d}</small></button>)}
          </div></div>
        <button className="btn btn--primary btn--lg btn--block wide">Tạo tài khoản</button>
      </form>
    </AuthShell>
  );
}
