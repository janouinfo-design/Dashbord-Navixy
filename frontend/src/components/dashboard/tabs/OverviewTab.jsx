import React, { useState, useMemo } from "react";
import { KPICard, InsightCard, SectionHeader } from "@/components/shared/UIComponents";
import { calcFleetSummary, generateInsights } from "@/lib/metrics";
import {
  Gauge, Truck, MapPin, AlertTriangle, Activity, Zap,
  WifiOff, CheckCircle, Clock, Navigation
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

export const OverviewTab = ({ data, debugMode }) => {
  const { stats, trends, comparison, idleGroups } = data;
  const vehicles = stats?.vehicles || [];
  const compVehicles = comparison?.vehicles || [];
  const trendData = trends?.trends || [];

  const summary = useMemo(() => calcFleetSummary(vehicles, compVehicles, trends), [vehicles, compVehicles, trends]);
  const insights = useMemo(() => generateInsights(vehicles, compVehicles), [vehicles, compVehicles]);

  const distSparkData = trendData.slice(-7).map(d => ({ v: d.total_distance || 0 }));

  // Debug info from _audit
  const audit = stats?._audit;
  const avgResponseTime = audit?.navixy_calls?.length > 0
    ? Math.round(audit.navixy_calls.reduce((s, c) => s + (c.response_time_ms || 0), 0) / audit.navixy_calls.length) : null;
  const cacheAge = audit?.cache?.hit ? audit.cache.age_seconds : null;
  const mkDebug = (source, field) => debugMode ? { source, field, responseTime: avgResponseTime, cacheAge } : undefined;

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-[1600px] mx-auto" data-testid="overview-tab">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Utilisation Flotte" value={summary.fleetScore} unit="%" icon={Gauge}
          status={summary.fleetScore >= 60 ? 'good' : summary.fleetScore >= 40 ? 'warning' : 'danger'}
          debugInfo={mkDebug('vehicle-comparison', 'utilization_score')}
          explanation={{ title: 'Utilisation Flotte', description: 'Pourcentage moyen de jours actifs (avec km &gt; 0) sur les 7 derniers jours. Donnee 100% Navixy.', formula: '(jours_actifs / 7) × 100', tip: '&gt; 70% = bonne utilisation. &lt; 30% = vehicules potentiellement sous-exploites.' }} />
        <KPICard label="Vehicules connectes" value={`${summary.active}`} unit={`/ ${summary.total}`} icon={Truck}
          status={summary.active > 0 ? 'good' : 'danger'} subtitle={`${summary.offline} hors ligne`}
          debugInfo={mkDebug('tracker/get_state', 'connection_status')} />
        <KPICard label="Distance parcourue" value={summary.totalKm.toFixed(0)} unit="km" icon={MapPin}
          sparkData={distSparkData} sparkColor="#111"
          debugInfo={mkDebug('tracker/stats/mileage/read', 'mileage')} />
        <KPICard label="Temps moteur" value={summary.totalEngineH.toFixed(0)} unit="h" icon={Activity}
          debugInfo={mkDebug('tracker/counter/value/list', 'engine_hours')} />
      </div>

      {/* Data source banner */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-[10px] text-gray-500">Toutes les donnees proviennent directement de l'API Navixy — aucune estimation.</span>
        {stats?._audit && (
          <span className="text-[10px] text-gray-400 ml-auto">
            Engine v{stats._audit.engine_version} | {stats._audit.navixy_calls?.length || 0} appels API
            {stats._audit.cache?.hit && ` | Cache ${stats._audit.cache.age_seconds}s`}
          </span>
        )}
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="insights">
          <SectionHeader icon={Zap} title="Insights" count={insights.length} />
          <div className="space-y-2.5">
            {insights.map((ins, idx) => {
              const iconMap = { AlertTriangle, WifiOff, Clock, Truck, CheckCircle };
              return <InsightCard key={idx} {...ins} icon={iconMap[ins.icon] || AlertTriangle} />;
            })}
          </div>
        </div>
      )}

      {/* Idle by Group (Engins) */}
      {idleGroups && idleGroups.groups && idleGroups.groups.length > 0 && (
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
                  <div className="text-[9px] text-gray-400 mt-1">Ralenti: {group.idle_percentage}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distance quotidienne */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Distance Quotidienne (7j)</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trendData} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="day_name" tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} width={40} unit=" km" />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 11 }} formatter={(v) => [`${v} km`, 'Distance']} />
              <Bar dataKey="total_distance" name="Distance (km)" fill="#111" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Vehicules actifs par jour */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Vehicules Actifs / Jour</h4>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="day_name" tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 11 }} />
              <Area type="monotone" dataKey="active_vehicles" stroke="#10B981" fill="#d1fae5" strokeWidth={2} name="Vehicules actifs" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Repartition Utilisation */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Repartition Utilisation</h4>
          {(() => {
            const d = [
              { name: '>70%', value: compVehicles.filter(v => (v.utilization_score || 0) >= 70).length, color: '#10B981' },
              { name: '30-70%', value: compVehicles.filter(v => (v.utilization_score || 0) >= 30 && (v.utilization_score || 0) < 70).length, color: '#F59E0B' },
              { name: '<30%', value: compVehicles.filter(v => (v.utilization_score || 0) < 30).length, color: '#EF4444' },
            ].filter(x => x.value > 0);
            if (d.length === 0) d.push({ name: 'Aucun', value: 1, color: '#d1d5db' });
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
