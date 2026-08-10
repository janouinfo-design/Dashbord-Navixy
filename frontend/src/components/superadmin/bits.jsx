import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";

export const NAVY = "#10265c";

export const Card = ({ children, className = "", ...props }) => (
  <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`} {...props}>
    {children}
  </div>
);

export const KpiCard = ({ label, value, tone = "default", testId }) => {
  const tones = {
    default: "text-[#10265c]",
    green: "text-emerald-600",
    orange: "text-amber-600",
    red: "text-red-600",
    gray: "text-gray-400",
  };
  return (
    <Card className="p-4" data-testid={testId}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${tones[tone]}`} style={{ fontFamily: "Outfit, sans-serif" }}>
        {value}
      </p>
    </Card>
  );
};

export const StatusBadge = ({ active, isTest }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
      active ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
             : "bg-red-50 text-red-700 border border-red-200"}`}>
      {active ? "Actif" : "Suspendu"}
    </span>
    {isTest && (
      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-200">
        TEST
      </span>
    )}
  </span>
);

export const NavixyBadge = ({ navixy }) => {
  if (!navixy) return <span className="text-xs text-gray-400">—</span>;
  if (navixy.status === "ok")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700" title={`${navixy.trackers} trackers`}>
        <CheckCircle2 size={13} /> Opérationnelle
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-red-600" title={navixy.error || ""}>
      <XCircle size={13} /> En erreur
    </span>
  );
};

export const AnomalyList = ({ anomalies }) => {
  if (!anomalies?.length)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
        <CheckCircle2 size={13} /> Aucune anomalie
      </span>
    );
  return (
    <div className="flex flex-wrap gap-1">
      {anomalies.map((a, i) => (
        <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${
          a.includes("suspendu") || a.includes("erreur")
            ? "bg-red-50 text-red-700 border-red-200"
            : "bg-amber-50 text-amber-700 border-amber-200"}`}>
          <AlertTriangle size={11} /> {a}
        </span>
      ))}
    </div>
  );
};

export const Spin = () => (
  <div className="flex items-center justify-center py-16">
    <Loader2 className="animate-spin text-gray-300" size={24} />
  </div>
);

export const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return "—"; }
};

export const fmtDateTime = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
};

export const formatApiError = (err) => {
  const detail = err?.response?.data?.detail;
  if (detail == null) return err?.message || "Erreur inattendue";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  return String(detail);
};
