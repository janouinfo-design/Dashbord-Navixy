import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Lock, Mail, Loader2 } from "lucide-react";

const formatApiErrorDetail = (detail) => {
  if (detail == null) return "Une erreur est survenue. Réessayez.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
};

export const LoginPage = ({ clientInfo }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F8] px-4" data-testid="login-page">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo-logitrak.png" alt="LOGITRAK" className="w-16 h-16 rounded-2xl shadow-sm mb-4" />
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
            {clientInfo?.name && clientInfo.name !== "Default" ? clientInfo.name : "LOGITRAK"}
          </h1>
          <p className="text-sm text-gray-400 mt-1">Fleet Dashboard — Connexion</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Email</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email" required autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@entreprise.ch"
                data-testid="login-email-input"
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Mot de passe</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password" required autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                data-testid="login-password-input"
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition"
              />
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2" data-testid="login-error">
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            data-testid="login-submit-btn"
            className="w-full bg-[#111] text-white hover:bg-gray-800 disabled:opacity-60 rounded-lg py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Se connecter
          </button>
        </form>

        <p className="text-center text-[11px] text-gray-400 mt-6">
          Accès sécurisé — données 100% réelles LOGITRAK
        </p>
      </div>
    </div>
  );
};
