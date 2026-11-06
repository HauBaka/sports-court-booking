import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Chạy qua api.js thật với VITE_USE_MOCK=true để kiểm tra mockAdapter đúng format backend.
let auth;

beforeEach(async () => {
  vi.stubEnv("VITE_USE_MOCK", "true");
  vi.resetModules();
  auth = await import("./authService");
});

afterEach(() => {
  vi.unstubAllEnvs();
  localStorage.clear();
});

const newUser = {
  name: "Nguyễn Văn A",
  email: "a@example.com",
  phone: "0912345678",
  password: "SecurePassword123@",
  role: "customer",
};

describe("authService với dữ liệu giả", () => {
  it("đăng nhập thành công trả đúng envelope", async () => {
    const res = await auth.login({ email: "customer.a@scb.vn", password: "TestPass123@" });
    expect(res.success).toBe(true);
    expect(res.data.token_type).toBe("bearer");
    expect(res.data.user).toMatchObject({ name: "Khách Mẫu A", role: "customer" });
  });

  it("sai mật khẩu trả AUTH_INVALID_CREDENTIALS và không xóa token cũ", async () => {
    localStorage.setItem("access_token", "mock-token-1");
    await expect(auth.login({ email: "customer.a@scb.vn", password: "sai" })).rejects.toMatchObject({
      code: "AUTH_INVALID_CREDENTIALS",
    });
    expect(localStorage.getItem("access_token")).toBe("mock-token-1");
  });

  it("đăng ký thành công rồi đăng nhập được, ví có số dư 0", async () => {
    const res = await auth.register(newUser);
    expect(res.data).toMatchObject({ email: "a@example.com", role: "customer", balance: 0 });
    expect(res.data.wallet_id).toBe(res.data.id);
    const loggedIn = await auth.login({ email: newUser.email, password: newUser.password });
    expect(loggedIn.data.user.name).toBe("Nguyễn Văn A");
  });

  it("đăng ký trùng email, trùng số điện thoại", async () => {
    await expect(auth.register({ ...newUser, email: "owner@scb.vn" })).rejects.toMatchObject({
      code: "AUTH_EMAIL_EXISTS",
    });
    await expect(auth.register({ ...newUser, phone: "0901000001" })).rejects.toMatchObject({
      code: "AUTH_PHONE_EXISTS",
    });
  });

  it("đăng ký sai định dạng trả VALIDATION_ERROR kèm details", async () => {
    const err = await auth.register({ ...newUser, phone: "123" }).catch((e) => e);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.details).toEqual([{ field: "phone", issue: "Số điện thoại phải có 10 chữ số." }]);
  });

  it("lấy hồ sơ bằng token, có ví", async () => {
    const { data } = await auth.login({ email: "customer.a@scb.vn", password: "TestPass123@" });
    localStorage.setItem("access_token", data.access_token);
    const me = await auth.getMe();
    expect(me.data.wallet.balance).toBe(500000);
  });
});
