import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getMe } from "../services/authService";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);   // { id, name, email, phone, role, wallet }
  const [loading, setLoading] = useState(false);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) { setUser(null); return; }
    setLoading(true);
    try {
      const res = await getMe();
      setUser(res.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Goi khi mount (da co token tu phien truoc)
  useEffect(() => { fetchUser(); }, [fetchUser]);

  // Dong bo khi token thay doi (login/logout o tab khac)
  useEffect(() => {
    const handler = () => fetchUser();
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [fetchUser]);

  const clearUser = () => setUser(null);

  return (
    <UserContext.Provider value={{ user, loading, fetchUser, clearUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser phải nằm trong UserProvider");
  return ctx;
}
