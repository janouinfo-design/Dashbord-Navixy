import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { API, api } from "@/lib/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // null=vérification, false=anonyme, objet=connecté

  useEffect(() => {
    api.get(`${API}/auth/me`)
      .then((r) => setUser(r.data.user))
      .catch(() => setUser(false));
    const onLogout = () => setUser(false);
    window.addEventListener("logitrak:logout", onLogout);
    return () => window.removeEventListener("logitrak:logout", onLogout);
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post(`${API}/auth/login`, { email, password });
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post(`${API}/auth/logout`); } catch (e) { /* ignore */ }
    setUser(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
