import { useNavigate } from "react-router-dom";
import { MonitorPlay } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export const ImpersonationBanner = () => {
  const { actAs, endImpersonation } = useAuth();
  const navigate = useNavigate();
  if (!actAs) return null;

  const exit = async () => {
    await endImpersonation();
    navigate("/super-admin");
  };

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-4 px-4 py-2.5 text-sm font-medium text-white"
      style={{ background: "#b45309" }} data-testid="impersonation-banner">
      <MonitorPlay size={16} />
      <span className="uppercase tracking-wide text-xs font-bold">Aperçu client</span>
      <span>Vous consultez : <strong data-testid="impersonation-client-name">{actAs.name}</strong></span>
      <button onClick={exit}
        className="bg-white/15 hover:bg-white/25 border border-white/30 rounded-lg px-3 py-1 text-xs font-semibold transition-colors"
        data-testid="impersonation-exit-btn">
        Retour Super Admin
      </button>
    </div>
  );
};
