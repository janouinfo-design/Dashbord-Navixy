import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { API, api } from "@/lib/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const readActAs = () => {
  try { return JSON.parse(localStorage.getItem("logitrak:actAs")) || null; }
  catch { return null; }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // null=vérification, false=anonyme, objet=connecté
  const [actAs, setActAs] = useState(readActAs);

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
    localStorage.removeItem("logitrak:actAs");
    setActAs(null);
    try { await api.post(`${API}/auth/logout`); } catch (e) { /* ignore */ }
    setUser(false);
  }, []);

  const startImpersonation = useCallback(async (tenant, name) => {
    const { data } = await api.post(`${API}/admin/impersonation/start`, { tenant });
    const info = { tenant, name: data.client?.name || name, logId: data.log_id };
    localStorage.setItem("logitrak:actAs", JSON.stringify(info));
    setActAs(info);
    return info;
  }, []);

  const endImpersonation = useCallback(async () => {
    const current = readActAs();
    localStorage.removeItem("logitrak:actAs");
    setActAs(null);
    if (current?.logId) {
      try { await api.post(`${API}/admin/impersonation/end`, { log_id: current.logId }); } catch (e) { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    const onImpEnded = () => setActAs(null);
    window.addEventListener("logitrak:imp-ended", onImpEnded);
    return () => window.removeEventListener("logitrak:imp-ended", onImpEnded);
  }, []);

  const applyUser = useCallback((u) => setUser(u), []);

  return (
    <AuthContext.Provider value={{ user, login, logout, actAs, startImpersonation, endImpersonation, applyUser }}>
      {children}
    </AuthContext.Provider>
  );
};
