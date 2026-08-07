import { useMemo } from "react";
import { MiniKPI } from "@/components/shared/UIComponents";
import { Gauge, TrendingUp, Clock, Award } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";

export const PerformanceTab = ({ data }) => {
  const { comparison, trends } = data;
  const compVehicles = comparison?.vehicles || [];
  const trendData = trends?.trends || [];

  const avgUtil = compVehicles.length > 0
    ? Math.round(compVehicles.reduce((s, v) => s + (v.utilization_score || 0), 0) / compVehicles.length) : 0;
  const activeCount = compVehicles.filter(v => v.is_active).length;
  const activeRatio = compVehicles.length > 0 ? Math.round((activeCount / compVehicles.length) * 100) : 0;
  const totalDistWeek = Math.round(compVehicles.reduce((s, v) => s + (v.total_distance_week || 0), 0));
  const avgDist = compVehicles.length > 0 ? Math.round(totalDistWeek / compVehicles.length) : 0;

  const sorted = [...compVehicles].sort((a, b) => (b.total_distance_week || 0) - (a.total_distance_week || 0));
  const top10 = sorted.slice(0, 10);

  const radarData = [
    { metric: 'Utilisation', value: avgUtil },
    { metric: 'Connectivite', value: activeRatio },
    { metric: 'Activite', value: Math.min(100, Math.round(avgDist / 5)) },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-[1600px] mx-auto" data-testid="performance-tab">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniKPI label="Utilisation moy." value={`${avgUtil}%`} icon={Gauge} color={avgUtil >= 50 ? 'text-emerald-600' : 'text-red-500'} />
        <MiniKPI label="Connectes" value={`${activeCount}/${compVehicles.length}`} icon={TrendingUp} color="text-gray-700" />
        <MiniKPI label="Distance totale" value={`${totalDistWeek}`} icon={Award} subtitle="km (7 jours)" />
        <MiniKPI label="Moy. / vehicule" value={`${avgDist} km`} icon={Clock} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar — real data */}
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

        {/* Distance trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Distance Quotidienne</h4>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="day_name" tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} width={40} unit=" km" />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 11 }} />
              <Area type="monotone" dataKey="total_distance" stroke="#111" fill="#f3f4f6" strokeWidth={2} name="Distance (km)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 10 — sorted by real distance */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Top 10 Vehicules (Distance 7j)</h4>
        <div className="space-y-2">
          {top10.map((v, idx) => (
            <div key={v.tracker_id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white ${idx < 3 ? 'bg-[#111]' : 'bg-gray-400'}`}>{idx + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{v.label}</div>
                <div className="text-[10px] text-gray-400">
                  {v.total_distance_week} km | Util. {v.utilization_score}% | {v.active_days || 0}j actifs
                </div>
              </div>
              <span className={`text-sm font-bold ${(v.utilization_score || 0) >= 70 ? 'text-emerald-600' : (v.utilization_score || 0) >= 30 ? 'text-amber-600' : 'text-red-500'}`}>
                {v.utilization_score}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
