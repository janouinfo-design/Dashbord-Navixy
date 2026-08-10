import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Loader2 } from "lucide-react";
import { API, api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

const formatDetail = (detail) => {
  if (detail == null) return "Une erreur est survenue. Réessayez.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  return String(detail);
};

const inputCls = "w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400";

export default function ChangePasswordPage() {
  const { user, applyUser } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (next.length < 8) return setError("Le nouveau mot de passe doit contenir au moins 8 caractères");
    if (next !== confirm) return setError("La confirmation ne correspond pas");
    setLoading(true);
    try {
      const { data } = await api.post(`${API}/auth/change-password`, {
        current_password: current, new_password: next,
      });
      applyUser(data.user);
      navigate(data.user.role === "SUPER_ADMIN" ? "/super-admin" : "/", { replace: true });
    } catch (err) {
      setError(formatDetail(err.response?.data?.detail) || err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F8] px-4" data-testid="change-password-page">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo-logitrak.png" alt="LOGITRAK" className="w-14 h-14 rounded-2xl shadow-sm mb-4" />
          <h1 className="text-xl font-semibold tracking-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
            Définir votre mot de passe
          </h1>
          <p className="text-sm text-gray-400 mt-1 text-center">
            {user?.must_change_password
              ? "Votre mot de passe temporaire doit être remplacé avant d'accéder au dashboard."
              : "Changez votre mot de passe."}
          </p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Mot de passe actuel (temporaire)</label>
            <input type="password" required autoComplete="current-password" className={inputCls}
              value={current} onChange={(e) => setCurrent(e.target.value)} data-testid="cp-current-input" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Nouveau mot de passe (min. 8 caractères)</label>
            <input type="password" required autoComplete="new-password" className={inputCls}
              value={next} onChange={(e) => setNext(e.target.value)} data-testid="cp-new-input" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Confirmer le nouveau mot de passe</label>
            <input type="password" required autoComplete="new-password" className={inputCls}
              value={confirm} onChange={(e) => setConfirm(e.target.value)} data-testid="cp-confirm-input" />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2" data-testid="cp-error">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-[#111] text-white hover:bg-gray-800 disabled:opacity-60 rounded-lg py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            data-testid="cp-submit-btn">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
            Enregistrer le mot de passe
          </button>
        </form>
      </div>
    </div>
  );
}
