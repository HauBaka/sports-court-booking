export const PASSWORD_RULE_MESSAGE =
  "Mật khẩu cần tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.";

// Cùng luật với backend (docs/api-endpoints.md mục 1.2 và 1.6).
export function validateNewPassword(password) {
  const ok =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
  return ok ? "" : PASSWORD_RULE_MESSAGE;
}
