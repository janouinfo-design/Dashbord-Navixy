import axios from "axios";

const getApiUrl = () => {
  if (window.location.hostname.includes('logitrak.ch')) {
    return `https://${window.location.hostname}/api`;
  }
  return process.env.REACT_APP_BACKEND_URL
    ? `${process.env.REACT_APP_BACKEND_URL}/api`
    : '/api';
};

export const API = getApiUrl();
export const api = axios.create({ withCredentials: true });

api.interceptors.request.use((config) => {
  try {
    const a = JSON.parse(localStorage.getItem("logitrak:actAs"));
    if (a?.tenant) config.headers["X-Act-As-Tenant"] = a.tenant;
  } catch (e) { /* ignore */ }
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    const detail = error.response?.data?.detail;
    if (error.response?.status === 403 && (detail === "IMPERSONATION_EXPIRED" || detail === "IMPERSONATION_INVALID")) {
      localStorage.removeItem("logitrak:actAs");
      window.dispatchEvent(new Event("logitrak:imp-ended"));
    }
    if (error.response?.status === 401 && original && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true;
      try {
        refreshPromise = refreshPromise || axios.post(`${API}/auth/refresh`, {}, { withCredentials: true });
        await refreshPromise;
        refreshPromise = null;
        return api(original);
      } catch (e) {
        refreshPromise = null;
        window.dispatchEvent(new Event('logitrak:logout'));
      }
    }
    return Promise.reject(error);
  }
);
