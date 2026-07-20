import React from "react";
import { KPICard, InsightCard, RiskCard, SectionHeader } from "@/components/shared/UIComponents";
import { calcFleetSummary, generateInsights, calcFinancialRisk, FUEL_PRICE_CHF } from "@/lib/metrics";
import {
  Gauge, Truck, MapPin, Fuel, DollarSign, Clock, AlertTriangle,
  Activity, Zap, WifiOff, CheckCircle, ShieldAlert, Search, ChevronDown, ChevronUp, Navigation
} from "lucide-react";
import { calcFuelCost, getScoreColor, getScoreBg } from "@/lib/metrics";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { useState, useMemo } from "react";

export const OverviewTab = ({ data }) => {
  const { stats, trends, comparison, idleGroups } = data;
  const vehicles = stats?.vehicles || [];
  const compVehicles = comparison?.vehicles || [];
  const trendData = trends?.trends || [];

  const summary = useMemo(() => calcFleetSummary(vehicles, compVehicles, trends), [vehicles, compVehicles, trends]);
  const insights = useMemo(() => generateInsights(vehicles, compVehicles, trends), [vehicles, compVehicles, trends]);
  const risk = useMemo(() => calcFinancialRisk(compVehicles, trends), [compVehicles, trends]);

  const effSparkData = trendData.slice(-7).map(d => ({ v: d.avg_efficiency }));
  const distSparkData = trendData.slice(-7).map(d => ({ v: d.total_distance }));
  const fuelSparkData = trendData.slice(-7).map(d => ({ v: d.fuel_consumption }));

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-[1600px] mx-auto" data-testid="overview-tab">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Score Flotte" value={summary.fleetScore} unit="%" icon={Gauge}
          status={summary.fleetScore >= 60 ? 'good' : summary.fleetScore >= 40 ? 'warning' : 'danger'}
          sparkData={effSparkData} sparkColor={summary.fleetScore >= 60 ? '#10B981' : '#EF4444'}
          explanation={{ title: 'Score Flotte', description: 'Moyenne ponderee: Efficacite (30%) + Anti-ralenti (25%) + Securite (20%) + Eco-conduite (15%) + Activite (10%).', tip: '> 70% excellent, 40-70% acceptable, < 40% action requise.' }} />
        <KPICard label="Vehicules connectes" value={`${summary.active}`} unit={`/ ${summary.total}`} icon={Truck}
          status={summary.active > 0 ? 'good' : 'danger'} subtitle={`${summary.offline} offline`} />
        <KPICard label="Distance parcourue" value={summary.totalKm.toFixed(0)} unit="km" icon={MapPin}
          sparkData={distSparkData} sparkColor="#111" />
        <KPICard label="Alertes" value={summary.alertCount} icon={AlertTriangle}
          status={summary.alertCount === 0 ? 'good' : summary.alertCount <= 5 ? 'warning' : 'danger'} subtitle={`${summary.violations} exces vitesse`} />
        <KPICard label="Temps moteur" value={summary.totalEngineH.toFixed(0)} unit="h" icon={Activity} />
        <KPICard label="Vehicules actifs" value={summary.active} icon={Truck} status="good" />
      </div>

      {/* Insights */}
      <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="insights">
        <SectionHeader icon={Zap} title="Insights Intelligents" count={insights.length} />
        <div className="space-y-2.5">
          {insights.map((ins, idx) => {
            const iconMap = { AlertTriangle, WifiOff, Clock, Fuel, ShieldAlert, Truck, CheckCircle };
            return <InsightCard key={idx} {...ins} icon={iconMap[ins.icon] || AlertTriangle} />;
          })}
        </div>
      </div>

      {/* Idle by Group (Engins) */}
      {idleGroups && idleGroups.groups.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="idle-by-group">
          <SectionHeader icon={Clock} title="Ralenti Engins de Chantier" iconBg="bg-amber-100" iconColor="text-amber-600" count={`${idleGroups.total_engins} engins`} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {idleGroups.groups.map(group => {
              const colors = { 'CHARGEUSE': 'bg-blue-50 border-blue-200', 'Dumpers': 'bg-green-50 border-green-200', 'Pelles': 'bg-purple-50 border-purple-200' };
              return (
                <div key={group.name} className={`rounded-xl p-4 border ${colors[group.name] || 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>{group.name}</span>
                    <span className="text-[10px] text-gray-500">{group.total} engins</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-2">
                    <div><div className="text-lg font-bold text-emerald-600">{group.active}</div><div className="text-[9px] text-gray-500">Actifs</div></div>
                    <div><div className={`text-lg font-bold ${group.idle > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{group.idle}</div><div className="text-[9px] text-gray-500">Ralenti</div></div>
                    <div><div className="text-lg font-bold text-gray-400">{group.offline}</div><div className="text-[9px] text-gray-500">Offline</div></div>
                  </div>
                  <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-gray-200 flex">
                    <div className="h-full bg-emerald-400" style={{ width: `${(group.active / Math.max(1, group.total)) * 100}%` }} />
                    <div className="h-full bg-amber-400" style={{ width: `${(group.idle / Math.max(1, group.total)) * 100}%` }} />
                  </div>
                  <div className="text-[9px] text-gray-400 mt-1">Ralenti: {group.idle_percentage}% | ~{Math.round(group.idle * 3)} CHF/h</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Classement vehicules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart: evolution score */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Evolution Score</h4>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="day_name" tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8A8A8E' }} domain={[0, 100]} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 11 }} />
              <Area type="monotone" dataKey="avg_efficiency" stroke="#111" fill="#f3f4f6" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Distance & Carburant (7j)</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trendData} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="day_name" tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} width={35} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 11 }} />
              <Bar dataKey="total_distance" name="Distance (km)" fill="#111" radius={[3, 3, 0, 0]} />
              <Bar dataKey="fuel_consumption" name="Carburant (L)" fill="#F59E0B" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Repartition Scores</h4>
          {(() => {
            const d = [
              { name: '>70%', value: compVehicles.filter(v => v.efficiency_score >= 70).length, color: '#10B981' },
              { name: '40-70%', value: compVehicles.filter(v => v.efficiency_score >= 40 && v.efficiency_score < 70).length, color: '#F59E0B' },
              { name: '<40%', value: compVehicles.filter(v => v.efficiency_score < 40).length, color: '#EF4444' },
            ].filter(x => x.value > 0);
            return (
              <div className="flex items-center gap-4">
                <div className="w-28 h-28 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={d} cx="50%" cy="50%" innerRadius={28} outerRadius={50} dataKey="value" strokeWidth={2} stroke="#fff">
                      {d.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie></PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 flex-1">{d.map(item => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-[10px] text-gray-600">{item.name}</span></div>
                    <span className="text-xs font-bold">{item.value}</span>
                  </div>
                ))}</div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
