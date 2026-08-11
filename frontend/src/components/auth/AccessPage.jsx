import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, XCircle } from "lucide-react";
import { API, api } from "@/lib/api";

export default function AccessPage() {
  const { token } = useParams();
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`${API}/access/${token}`)
      .then(() => { window.location.replace("/"); })
      .catch((err) => {
        const d = err.response?.data?.detail;
        setError(typeof d === "string" ? d : "Lien d'accès invalide ou révoqué");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F8] px-4" data-testid="access-page">
      <div className="text-center">
        <img src="/logo-logitrak.png" alt="LOGITRAK" className="w-14 h-14 rounded-2xl shadow-sm mx-auto mb-4" />
        {error ? (
          <div className="flex flex-col items-center gap-2" data-testid="access-error">
            <XCircle className="text-red-500" size={22} />
            <p className="text-sm text-gray-600">{error}</p>
            <p className="text-xs text-gray-400">Contactez LOGITRAK pour obtenir un nouveau lien d'accès.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="animate-spin text-gray-400" size={22} />
            <p className="text-sm text-gray-500">Ouverture de votre dashboard…</p>
          </div>
        )}
      </div>
    </div>
  );
}
