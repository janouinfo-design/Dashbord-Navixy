import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, ChevronRight } from "lucide-react";
import { API, api } from "@/lib/api";
import { Card, KpiCard, StatusBadge, NavixyBadge, AnomalyList, Spin, fmtDateTime, NAVY } from "./bits";

export default function SuperAdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`${API}/admin/overview`);
      setData(r.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading && !data) return <Spin />;
  const k = data?.kpis || {};

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto" data-testid="sa-dashboard">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: NAVY, fontFamily: "Outfit, sans-serif" }}>Dashboard Super Admin</h1>
          <p className="text-sm text-gray-400 mt-0.5">État réel des clients LOGITRAK — aucune donnée simulée</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg px-3.5 py-2 text-sm text-gray-600 transition-colors" data-testid="sa-refresh-btn">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        <KpiCard label="Clients totaux" value={k.clients_total ?? "—"} testId="kpi-clients-total" />
        <KpiCard label="Clients actifs" value={k.clients_active ?? "—"} tone="green" testId="kpi-clients-active" />
        <KpiCard label="Suspendus" value={k.clients_suspended ?? "—"} tone={k.clients_suspended ? "red" : "gray"} testId="kpi-clients-suspended" />
        <KpiCard label="Véhicules totaux" value={k.vehicles_total ?? "—"} testId="kpi-vehicles-total" />
        <KpiCard label="Utilisateurs" value={k.users_total ?? "—"} testId="kpi-users-total" />
        <KpiCard label="Navixy OK" value={k.navixy_ok ?? "—"} tone="green" testId="kpi-navixy-ok" />
        <KpiCard label="Navixy en erreur" value={k.navixy_error ?? "—"} tone={k.navixy_error ? "red" : "gray"} testId="kpi-navixy-error" />
      </div>

      <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: NAVY }}>État des clients</h2>
      <div className="space-y-2" data-testid="sa-clients-state">
        {(data?.clients || []).map((c) => (
          <Card key={c.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3 hover:border-gray-300 transition-colors cursor-pointer"
            onClick={() => navigate(`/super-admin/clients/${c.id}`)}
            data-testid={`sa-client-state-${c.tenant}`}>
            <div className="min-w-[200px]">
              <p className="text-sm font-semibold text-[#10265c]">{c.name}</p>
              <p className="text-[11px] text-gray-400">{c.subdomain}.logitrak.ch</p>
            </div>
            <StatusBadge active={c.is_active} isTest={c.is_test} />
            <NavixyBadge navixy={c.navixy} />
            <span className="text-xs text-gray-500">{c.navixy?.trackers != null ? `${c.navixy.trackers} véhicules` : "véhicules —"}</span>
            <span className="text-xs text-gray-500">{c.users_count} utilisateur{c.users_count > 1 ? "s" : ""}</span>
            <span className="text-xs text-gray-400">Synchro : {fmtDateTime(c.last_sync_at)}</span>
            <div className="flex-1"><AnomalyList anomalies={c.anomalies} /></div>
            <ChevronRight size={16} className="text-gray-300 shrink-0" />
          </Card>
        ))}
        {!data?.clients?.length && <Card className="p-8 text-center text-sm text-gray-400">Aucun client</Card>}
      </div>
    </div>
  );
}
