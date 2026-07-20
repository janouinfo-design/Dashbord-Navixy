import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { API, api } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { PeriodSelector } from "@/components/shared/PeriodSelector";
import {
  BarChart3, Gauge, Users, Truck, DollarSign, Cpu, Activity,
  RefreshCw, Menu
} from "lucide-react";

import { OverviewTab } from "@/components/dashboard/tabs/OverviewTab";
import { PerformanceTab } from "@/components/dashboard/tabs/PerformanceTab";
import { EfficiencyTab } from "@/components/dashboard/tabs/EfficiencyTab";
import { DriversTab } from "@/components/dashboard/tabs/DriversTab";
import { VehiclesTab } from "@/components/dashboard/tabs/VehiclesTab";
import { CostsTab } from "@/components/dashboard/tabs/CostsTab";
import { IoTTab } from "@/components/dashboard/tabs/IoTTab";

const TABS = [
  { id: "overview", label: "Vue generale", icon: BarChart3 },
  { id: "performance", label: "Performance", icon: Gauge },
  { id: "efficiency", label: "Efficacite", icon: Activity },
  { id: "drivers", label: "Conducteurs", icon: Users },
  { id: "vehicles", label: "Vehicules", icon: Truck },
  { id: "costs", label: "Couts", icon: DollarSign },
  { id: "iot", label: "IoT", icon: Cpu },
];

export const DashboardLayout = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [data, setData] = useState({ stats: null, trends: null, comparison: null, idleGroups: null });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [period, setPeriod] = useState("week");
  const [fromDate, setFromDate] = useState(new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);

  const fetchAll = useCallback(async (from, to) => {
    setLoading(true);
    try {
      const [statsRes, trendsRes, compRes, idleRes, effRes, driversRes] = await Promise.all([
        api.get(`${API}/fleet/stats`, { params: { from_date: from || fromDate, to_date: to || toDate } }),
        api.get(`${API}/analytics/trends`, { params: { period: "week" } }),
        api.get(`${API}/analytics/vehicle-comparison`),
        api.get(`${API}/fleet/idle-by-group`).catch(() => ({ data: { success: false } })),
        api.get(`${API}/fleet/efficiency`, { params: { date: from || fromDate, period: period === "today" ? "day" : period } }),
        api.get(`${API}/reports/driver`, { params: { from_date: from || fromDate, to_date: to || toDate } }).catch(() => ({ data: { success: false } })),
      ]);

      setData({
        stats: statsRes.data.success ? statsRes.data : null,
        trends: trendsRes.data.success ? trendsRes.data : null,
        comparison: compRes.data.success ? compRes.data : null,
        idleGroups: idleRes.data.success && idleRes.data.groups?.length > 0 ? idleRes.data : null,
        efficiency: effRes.data.success ? effRes.data : null,
        drivers: driversRes.data.success ? driversRes.data : null,
      });
      setLastUpdate(new Date().toISOString());
    } catch (error) {
      console.error("Data fetch error:", error);
    }
    setLoading(false);
  }, [fromDate, toDate, period]);

  useEffect(() => { fetchAll(); }, []);

  const handlePeriodApply = (from, to) => fetchAll(from, to);

  const vehicles = data.stats?.vehicles || [];
  const activeVehicles = vehicles.filter(v => v.connection_status === "active").length;
  const totalKm = (data.stats?.summary?.total_mileage || 0).toFixed(0);

  return (
    <div data-testid="dashboard-layout">
      {/* Header */}
      <Header
        title="Dashboard"
        subtitle={`${vehicles.length} vehicules — ${activeVehicles} actifs — ${totalKm} km`}
        onRefresh={() => fetchAll()}
        lastUpdate={lastUpdate}
        alertCount={0}
      >
        <PeriodSelector
          period={period} setPeriod={setPeriod}
          fromDate={fromDate} setFromDate={setFromDate}
          toDate={toDate} setToDate={setToDate}
          onApply={handlePeriodApply}
        />
      </Header>

      {/* Horizontal Tabs */}
      <div className="sticky top-16 z-20 bg-white border-b border-gray-200" data-testid="dashboard-tabs">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-8">
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide -mb-px">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  data-testid={`tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-5 py-3.5 text-[13px] font-medium whitespace-nowrap
                    border-b-2 transition-all duration-200
                    ${isActive
                      ? "border-[#111] text-[#111]"
                      : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300"
                    }
                  `}
                >
                  <tab.icon size={15} className={isActive ? "text-[#111]" : "text-gray-400"} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
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
            {activeTab === "overview" && <OverviewTab data={data} />}
            {activeTab === "performance" && <PerformanceTab data={data} />}
            {activeTab === "efficiency" && <EfficiencyTab data={data} />}
            {activeTab === "drivers" && <DriversTab data={data} fromDate={fromDate} toDate={toDate} />}
            {activeTab === "vehicles" && <VehiclesTab data={data} />}
            {activeTab === "costs" && <CostsTab data={data} />}
            {activeTab === "iot" && <IoTTab />}
          </>
        )}
      </div>
    </div>
  );
};
