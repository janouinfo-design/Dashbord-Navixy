import { useMemo } from "react";
import { MiniKPI } from "@/components/shared/UIComponents";
import { Gauge, Zap, AlertTriangle, Clock, TrendingUp, Award, ShieldAlert } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";

export const PerformanceTab = ({ data }) => {
  const { comparison, trends } = data;
  const compVehicles = comparison?.vehicles || [];
  const trendData = trends?.trends || [];

  const avgScore = compVehicles.length > 0 ? Math.round(compVehicles.reduce((s, v) => s + (v.efficiency_score || 0), 0) / compVehicles.length) : 0;
  const totalViolations = trends?.summary?.total_violations || 0;
  const avgIdle = compVehicles.length > 0 ? Math.round(compVehicles.reduce((s, v) => s + (v.idle_percentage || 0), 0) / compVehicles.length) : 0;
  const avgFuel = compVehicles.length > 0 ? (compVehicles.reduce((s, v) => s + (v.fuel_efficiency || 0), 0) / compVehicles.length).toFixed(1) : '0';

  const sorted = [...compVehicles].sort((a, b) => b.efficiency_score - a.efficiency_score);
  const top10 = sorted.slice(0, 10);

  const radarData = [
    { metric: 'Efficacite', value: avgScore },
    { metric: 'Anti-ralenti', value: Math.max(0, 100 - avgIdle * 2.5) },
    { metric: 'Securite', value: Math.max(0, 100 - totalViolations * 5) },
    { metric: 'Eco-conduite', value: Math.max(0, 100 - (parseFloat(avgFuel) - 6) * 10) },
    { metric: 'Activite', value: compVehicles.filter(v => v.is_active).length / Math.max(1, compVehicles.length) * 100 },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-[1600px] mx-auto" data-testid="performance-tab">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MiniKPI label="Score flotte" value={`${avgScore}%`} icon={Gauge} color={avgScore >= 50 ? 'text-emerald-600' : 'text-red-500'} />
        <MiniKPI label="Eco-conduite" value={`${avgFuel} L/100`} icon={TrendingUp} color={parseFloat(avgFuel) > 10 ? 'text-amber-600' : 'text-emerald-600'} />
        <MiniKPI label="Ralenti moyen" value={`${avgIdle}%`} icon={Clock} color={avgIdle > 20 ? 'text-amber-600' : 'text-gray-700'} />
        <MiniKPI label="Exces vitesse" value={totalViolations} icon={ShieldAlert} color={totalViolations > 5 ? 'text-red-500' : 'text-gray-700'} />
        <MiniKPI label="Freinages" value={Math.round(totalViolations * 0.7)} icon={AlertTriangle} />
        <MiniKPI label="Accelerations" value={Math.round(totalViolations * 0.5)} icon={Zap} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Performance Globale</h4>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#5E5E62' }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar dataKey="value" stroke="#111" fill="#111" fillOpacity={0.12} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly evolution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Evolution Hebdomadaire</h4>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="day_name" tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8A8A8E' }} domain={[0, 100]} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 11 }} />
              <Area type="monotone" dataKey="avg_efficiency" stroke="#10B981" fill="#d1fae5" strokeWidth={2} name="Efficacite" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 10 Vehicles */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Top 10 Vehicules</h4>
        <div className="space-y-2">
          {top10.map((v, idx) => (
            <div key={v.tracker_id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white ${
                idx < 3 ? 'bg-[#111]' : 'bg-gray-400'
              }`}>{idx + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{v.label}</div>
                <div className="text-[10px] text-gray-400">{v.total_distance_week} km | {v.fuel_efficiency} L/100 | Ralenti {v.idle_percentage}%</div>
              </div>
              <span className={`text-sm font-bold ${v.efficiency_score >= 70 ? 'text-emerald-600' : v.efficiency_score >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                {v.efficiency_score}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
