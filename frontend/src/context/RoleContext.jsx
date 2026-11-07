import { createContext, useContext, useState, useEffect } from "react";

const RoleContext = createContext(null);

/** Doc role tu JWT payload (khong verify - chi de hien UI, BE van kiem tra quyen). */
function readRoleFromToken() {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload?.role ?? null;
  } catch {
    return null;
  }
}

export function RoleProvider({ children }) {
  const [role, setRoleState] = useState(() => readRoleFromToken());

  // Dong bo khi token thay doi tu tab khac
  useEffect(() => {
    const handler = () => setRoleState(readRoleFromToken());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  /** Goi sau khi login thanh cong de cap nhat role ngay lap tuc. */
  const setRole = (newRole) => setRoleState(newRole);

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole phải nằm trong RoleProvider");
  return ctx;
}
