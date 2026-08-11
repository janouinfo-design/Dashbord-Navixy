import { useSearchParams } from "react-router-dom";
import { XCircle } from "lucide-react";

const MESSAGES = {
  suspendu: "Cet accès est temporairement suspendu.",
  domaine: "Ce lien n'est pas valable sur ce domaine.",
};

export default function AccessPage() {
  const [params] = useSearchParams();
  const message = MESSAGES[params.get("motif")] || "Lien d'accès invalide ou révoqué.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F8] px-4" data-testid="access-page">
      <div className="text-center">
        <img src="/logo-logitrak.png" alt="LOGITRAK" className="w-14 h-14 rounded-2xl shadow-sm mx-auto mb-4" />
        <div className="flex flex-col items-center gap-2" data-testid="access-error">
          <XCircle className="text-red-500" size={22} />
          <p className="text-sm text-gray-600">{message}</p>
          <p className="text-xs text-gray-400">Contactez LOGITRAK pour obtenir un nouveau lien d'accès.</p>
        </div>
      </div>
    </div>
  );
}
