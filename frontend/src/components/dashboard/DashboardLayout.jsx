import { useState, useEffect, useCallback } from "react";
import { API, api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { Header } from "@/components/layout/Header";
import { PeriodSelector } from "@/components/shared/PeriodSelector";
import {
  BarChart3, Gauge, Users, Truck, Activity,
  ShieldCheck, Code, FileText
} from "lucide-react";

import { OverviewTab } from "@/components/dashboard/tabs/OverviewTab";
import { AnalyseFlotteTab } from "@/components/dashboard/tabs/AnalyseFlotteTab";
import { DriversTab } from "@/components/dashboard/tabs/DriversTab";
import { VehiclesTab } from "@/components/dashboard/tabs/VehiclesTab";
import { AuditTab } from "@/components/dashboard/tabs/AuditTab";

const fmt = (d) => d.toISOString().split('T')[0];
const initFrom = () => { const d = new Date(); d.setDate(d.getDate() - 6); return fmt(d); };

const TABS = [
  { id: "overview", label: "Vue generale", icon: BarChart3 },
  { id: "analyse", label: "Analyse flotte", icon: Gauge },
  { id: "drivers", label: "Conducteurs", icon: Users },
  { id: "vehicles", label: "Vehicules", icon: Truck },
];
const ADMIN_TAB = { id: "audit", label: "Audit", icon: ShieldCheck };

export const DashboardLayout = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [vehicleToOpen, setVehicleToOpen] = useState(null);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [period, setPeriod] = useState("week");
  const [fromDate, setFromDate] = useState(initFrom);
  const [toDate, setToDate] = useState(() => fmt(new Date()));
  const [debugMode, setDebugMode] = useState(false);
  const { user, actAs } = useAuth();
  const isAdmin = user?.role === "SUPER_ADMIN";
  const [modules, setModules] = useState(null);

  useEffect(() => {
    api.get(`${API}/tenant/context`)
      .then((r) => setModules(r.data.modules))
      .catch(() => setModules(null));
  }, [actAs?.tenant]);

  const MODULE_BY_TAB = { overview: "dashboard", analyse: "analyse", drivers: "conducteurs", vehicles: "vehicules" };
  const baseTabs = modules ? TABS.filter((t) => modules.includes(MODULE_BY_TAB[t.id])) : TABS;
  const visibleTabs = isAdmin && !actAs ? [...baseTabs, ADMIN_TAB] : baseTabs;

  useEffect(() => {
    if (modules && visibleTabs.length && !visibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [modules]);

  const fetchAll = useCallback(async (from, to) => {
    const f = from || fromDate;
    const t = to || toDate;
    setLoading(true);
    try {
      const params = { from_date: f, to_date: t };
      const [statsRes, trendsRes, compRes, idleRes, effRes] = await Promise.all([
        api.get(`${API}/fleet/stats`, { params }),
        api.get(`${API}/analytics/trends`, { params }),
        api.get(`${API}/analytics/vehicle-comparison`, { params }),
        api.get(`${API}/fleet/idle-by-group`).catch(() => ({ data: { success: false } })),
        api.get(`${API}/fleet/efficiency`, { params }),
      ]);
      setData({
        stats: statsRes.data.success ? statsRes.data : null,
        trends: trendsRes.data.success ? trendsRes.data : null,
        comparison: compRes.data.success ? compRes.data : null,
        idleGroups: idleRes.data.success && idleRes.data.groups?.length > 0 ? idleRes.data : null,
        efficiency: effRes.data.success ? effRes.data : null,
      });
      setLastUpdate(new Date().toISOString());
    } catch (error) {
      console.error("Data fetch error:", error);
    }
    setLoading(false);
  }, [fromDate, toDate]);

  useEffect(() => { fetchAll(); }, []);

  const handlePeriodApply = (from, to) => fetchAll(from, to);

  const handleExportPDF = async () => {
    try {
      const res = await api.get(`${API}/export/pdf`, {
        params: { from_date: fromDate, to_date: toDate },
        responseType: 'blob',
        timeout: 120000,
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport_flotte_${fromDate}_${toDate}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("PDF export failed:", e);
    }
  };

  const handleTabNavigate = (tabId) => setActiveTab(tabId);

  const vehicles = data.stats?.vehicles || [];
  const activeVehicles = vehicles.filter(v => v.connection_status === "active").length;
  const totalKm = (data.stats?.summary?.total_mileage || 0).toFixed(0);

  return (
    <div data-testid="dashboard-layout">
      <Header title="Dashboard"
        subtitle={`${vehicles.length} vehicules — ${activeVehicles} en ligne — ${totalKm} km`}
        onRefresh={() => fetchAll()} lastUpdate={lastUpdate} alertCount={0}
        debugMode={debugMode} onDebugToggle={() => setDebugMode(d => !d)}
        onExportPDF={!modules || modules.includes("rapports") ? handleExportPDF : undefined}>
        <PeriodSelector period={period} setPeriod={setPeriod}
          fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate}
          onApply={handlePeriodApply} />
      </Header>

      <div className="sticky top-16 z-20 bg-white border-b border-gray-200" data-testid="dashboard-tabs">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-8">
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide -mb-px">
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} data-testid={`tab-${tab.id}`} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition-all duration-200
                    ${isActive
                      ? tab.id === 'audit' ? "border-red-500 text-red-600" : "border-[#111] text-[#111]"
                      : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300"}`}>
                  <tab.icon size={15} className={isActive ? (tab.id === 'audit' ? "text-red-500" : "text-[#111]") : "text-gray-400"} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {(() => {
        const ds = { ...(data.stats?.data_status || {}), ...(data.efficiency?.data_status || {}) };
        const issues = Object.entries(ds).filter(([, s]) => s !== "ok");
        if (!issues.length || loading) return null;
        return (
          <div className="bg-amber-50 border-b border-amber-200" data-testid="partial-data-banner">
            <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-2 text-xs text-amber-800">
              ⚠ Données partielles — sources en {issues.some(([, s]) => s === "error") ? "erreur" : "réponse incomplète"} :{" "}
              {issues.map(([k, s]) => `${k} (${s === "error" ? "échec" : "partiel"})`).join(", ")}. Les totaux affichés peuvent être incomplets.
            </div>
          </div>
        );
      })()}

      <div className="transition-opacity duration-200">
      {loading ? (
          <div className="flex items-center justify-center h-[calc(100vh-140px)]" data-testid="loading">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
              <span className="text-sm text-gray-400">Chargement des donnees...</span>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "overview" && <OverviewTab data={data} debugMode={debugMode} fromDate={fromDate} toDate={toDate} onNavigate={handleTabNavigate}
              onOpenVehicle={(tid) => { setVehicleToOpen(tid); setActiveTab("vehicles"); }} />}
            {activeTab === "analyse" && <AnalyseFlotteTab data={data} fromDate={fromDate} toDate={toDate} debugMode={debugMode} />}
            {activeTab === "drivers" && <DriversTab data={data} fromDate={fromDate} toDate={toDate} debugMode={debugMode} />}
            {activeTab === "vehicles" && <VehiclesTab data={data} debugMode={debugMode} initialSelected={vehicleToOpen} onConsumedInitial={() => setVehicleToOpen(null)} />}
            {activeTab === "audit" && <AuditTab fromDate={fromDate} toDate={toDate} />}
          </>
        )}
      </div>
    </div>
  );
};
