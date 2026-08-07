import React, { useState, useMemo } from "react";
import { KPICard, InsightCard, SectionHeader } from "@/components/shared/UIComponents";
import { DashboardDetailDrawer } from "@/components/shared/DashboardDetailDrawer";
import {
  Gauge, Truck, MapPin, Activity, Zap, WifiOff, CheckCircle,
  Clock, AlertTriangle, ChevronRight, Navigation
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

// ─── Duration helper ───
const fmtDuration = (ms) => {
  if (ms == null || isNaN(ms)) return null;
  if (ms < 0) return null;
  const min = Math.floor(ms / 60000);
  if (min < 1) return '< 1 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rm = min % 60;
  if (h < 24) return rm > 0 ? `${h} h ${rm} min` : `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} jour${d > 1 ? 's' : ''}`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} mois`;
  const y = Math.floor(mo / 12);
  return `${y} an${y > 1 ? 's' : ''}`;
};

const severityOf = (hoursAgo) => {
  if (hoursAgo == null) return { level: 'unknown', color: 'text-gray-400', bg: 'bg-gray-100', dot: 'bg-gray-300', label: 'Inconnue' };
  if (hoursAgo < 6) return { level: 'recent', color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-400', label: '< 6 h' };
  if (hoursAgo < 24) return { level: 'watch', color: 'text-orange-600', bg: 'bg-orange-50', dot: 'bg-orange-400', label: '6–24 h' };
  return { level: 'critical', color: 'text-red-600', bg: 'bg-red-50', dot: 'bg-red-500', label: '> 24 h' };
};

// ─── Stat ───
const Stat = ({ label, value, sub }) => (
  <div className="text-center">
    <div className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>{value}</div>
    <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">{label}</div>
    {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
  </div>
);

export const OverviewTab = ({ data, debugMode, fromDate, toDate, onNavigate }) => {
  const { stats, trends, comparison, idleGroups } = data;
  const vehicles = stats?.vehicles || [];
  const compVehicles = comparison?.vehicles || [];
  const trendData = trends?.trends || [];
  const [activeDrawer, setActiveDrawer] = useState(null);

  const kpis = useMemo(() => {
    const total = vehicles.length;
    const active = vehicles.filter(v => v.connection_status === 'active');
    const moving = vehicles.filter(v => v.movement_status === 'moving');
    const offline = vehicles.filter(v => v.connection_status !== 'active');
    const totalKm = Math.round(vehicles.reduce((s, v) => s + (v.mileage || 0), 0) * 10) / 10;
    const totalEh = Math.round(vehicles.reduce((s, v) => s + (v.engine_hours || 0), 0) * 10) / 10;
    const avgUtil = compVehicles.length > 0
      ? Math.round(compVehicles.reduce((s, v) => s + (v.utilization_score || 0), 0) / compVehicles.length) : 0;
    const zeroKm = compVehicles.filter(v => (v.total_distance_week || 0) === 0);
    const lowUtil = compVehicles.filter(v => (v.utilization_score || 0) > 0 && (v.utilization_score || 0) < 30);
    const topVehicle = compVehicles.length > 0 ? compVehicles.reduce((best, v) =>
      (v.total_distance_week || 0) > (best.total_distance_week || 0) ? v : best, compVehicles[0]) : null;

    // Offline severity breakdown
    const now = Date.now();
    const offlineEnriched = offline.map(v => {
      const lastComm = v.last_update ? new Date(v.last_update) : null;
      const msAgo = lastComm ? now - lastComm.getTime() : null;
      const hAgo = msAgo != null ? msAgo / 3600000 : null;
      return { ...v, msAgo, hAgo, severity: severityOf(hAgo), durationLabel: fmtDuration(msAgo) };
    }).sort((a, b) => {
      if (a.msAgo == null && b.msAgo == null) return 0;
      if (a.msAgo == null) return -1;
      if (b.msAgo == null) return 1;
      return b.msAgo - a.msAgo;
    });

    const critCount = offlineEnriched.filter(v => v.severity.level === 'critical').length;
    const watchCount = offlineEnriched.filter(v => v.severity.level === 'watch').length;
    const recentCount = offlineEnriched.filter(v => v.severity.level === 'recent').length;
    const unknownCount = offlineEnriched.filter(v => v.severity.level === 'unknown').length;

    return { total, active, moving, offline, offlineEnriched, totalKm, totalEh, avgUtil, zeroKm, lowUtil, topVehicle,
      critCount, watchCount, recentCount, unknownCount };
  }, [vehicles, compVehicles]);

  // Offline counts for severity breakdown
  const offCritical = kpis.critCount + kpis.unknownCount;

  // Insights - enriched with stats
  const insights = useMemo(() => {
    const list = [];
    if (kpis.offline.length > 0) {
      const pct = kpis.total > 0 ? Math.round((kpis.offline.length / kpis.total) * 100) : 0;
      const critDesc = kpis.critCount > 0 ? `${kpis.critCount} depuis plus de 24 h` : '';
      list.push({ id: 'offline', type: 'warning', icon: 'WifiOff',
        title: `${kpis.offline.length} vehicule${kpis.offline.length > 1 ? 's' : ''} hors ligne`,
        detail: `${pct}% de la flotte${critDesc ? ` • ${critDesc}` : ''}` });
    }
    if (kpis.zeroKm.length > 0)
      list.push({ id: 'zero_km', type: 'info', icon: 'Truck',
        title: `${kpis.zeroKm.length} vehicule${kpis.zeroKm.length > 1 ? 's' : ''} sans activite`,
        detail: `0 km sur ${fromDate} au ${toDate}` });
    if (kpis.lowUtil.length > 0)
      list.push({ id: 'low_util', type: 'danger', icon: 'AlertTriangle',
        title: `${kpis.lowUtil.length} vehicule${kpis.lowUtil.length > 1 ? 's' : ''} sous-utilise${kpis.lowUtil.length > 1 ? 's' : ''}`,
        detail: `Utilisation inferieure a 30% de la flotte` });
    if (kpis.topVehicle && (kpis.topVehicle.total_distance_week || 0) > 0)
      list.push({ id: 'top', type: 'success', icon: 'CheckCircle',
        title: `Vehicule le plus utilise : ${kpis.topVehicle.label}`,
        detail: `${kpis.topVehicle.total_distance_week} km — Utilisation ${kpis.topVehicle.utilization_score}%` });
    return list;
  }, [kpis, fromDate, toDate]);

  const audit = stats?._audit;
  const avgMs = audit?.navixy_calls?.length > 0 ? Math.round(audit.navixy_calls.reduce((s, c) => s + (c.response_time_ms || 0), 0) / audit.navixy_calls.length) : null;
  const cacheAge = audit?.cache?.hit ? audit.cache.age_seconds : null;
  const dbg = (src, field) => debugMode ? { source: src, field, responseTime: avgMs, cacheAge } : undefined;

  // Offline drawer filter
  const [offlineFilter, setOfflineFilter] = useState('all');
  const filteredOffline = useMemo(() => {
    if (offlineFilter === 'all') return kpis.offlineEnriched;
    if (offlineFilter === 'critical') return kpis.offlineEnriched.filter(v => v.severity.level === 'critical' || v.severity.level === 'unknown');
    if (offlineFilter === 'watch') return kpis.offlineEnriched.filter(v => v.severity.level === 'watch');
    if (offlineFilter === 'recent') return kpis.offlineEnriched.filter(v => v.severity.level === 'recent');
    return kpis.offlineEnriched;
  }, [kpis.offlineEnriched, offlineFilter]);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-[1600px] mx-auto" data-testid="overview-tab">

      {/* ═══ KPI GRID — no "Cliquer pour le detail" ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div onClick={() => setActiveDrawer('utilization')} className="cursor-pointer" data-testid="kpi-click-utilization">
          <KPICard label="Utilisation Flotte" value={kpis.avgUtil} unit="%" icon={Gauge}
            status={kpis.avgUtil >= 60 ? 'good' : kpis.avgUtil >= 30 ? 'warning' : 'danger'}
            debugInfo={dbg('vehicle-comparison', 'utilization_score')} />
        </div>
        <div onClick={() => setActiveDrawer('active')} className="cursor-pointer" data-testid="kpi-click-active">
          <KPICard label="Vehicules actifs" value={`${kpis.active.length}`} unit={`/ ${kpis.total}`} icon={Truck}
            status={kpis.active.length > 0 ? 'good' : 'danger'}
            debugInfo={dbg('tracker/get_state', 'connection_status')} />
        </div>
        <div onClick={() => setActiveDrawer('distance')} className="cursor-pointer" data-testid="kpi-click-distance">
          <KPICard label="Distance parcourue" value={Math.round(kpis.totalKm).toLocaleString('fr-FR')} unit="km" icon={MapPin}
            debugInfo={dbg('tracker/stats/mileage', 'mileage')} />
        </div>
        <div onClick={() => setActiveDrawer('engine')} className="cursor-pointer" data-testid="kpi-click-engine">
          <KPICard label="Heures moteur" value={Math.round(kpis.totalEh).toLocaleString('fr-FR')} unit="h" icon={Activity}
            debugInfo={dbg('tracker/counter', 'engine_hours')} />
        </div>
        <div onClick={() => setActiveDrawer('moving')} className="cursor-pointer" data-testid="kpi-click-moving">
          <KPICard label="En mouvement" value={kpis.moving.length} icon={Navigation}
            status={kpis.moving.length > 0 ? 'good' : undefined}
            debugInfo={dbg('tracker/get_state', 'movement_status')} />
        </div>
        <div onClick={() => setActiveDrawer('offline')} className="cursor-pointer" data-testid="kpi-click-offline">
          <KPICard label="Hors ligne" value={kpis.offline.length} icon={WifiOff}
            status={kpis.offline.length > 0 ? 'danger' : 'good'}
            debugInfo={dbg('tracker/get_state', 'connection_status')} />
        </div>
      </div>

      {/* ═══ DATA SOURCE ═══ */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-200">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-[10px] text-gray-500">Donnees Navixy — aucune estimation</span>
        {audit && <span className="text-[10px] text-gray-400 ml-auto">v{audit.engine_version} | {fromDate} au {toDate}{audit.cache?.hit ? ` | cache ${audit.cache.age_seconds}s` : ''}</span>}
      </div>

      {/* ═══ INSIGHTS — full card clickable ═══ */}
      {insights.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="insights">
          <SectionHeader icon={Zap} title="Insights" count={insights.length} />
          <div className="space-y-2">
            {insights.map((ins) => {
              const iconMap = { AlertTriangle, WifiOff, Clock, Truck, CheckCircle };
              return (
                <InsightCard key={ins.id} {...ins} icon={iconMap[ins.icon] || AlertTriangle}
                  onClick={() => setActiveDrawer(`insight_${ins.id}`)}
                  data-testid={`insight-${ins.id}`} />
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ IDLE BY GROUP ═══ */}
      {idleGroups && idleGroups.groups?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="idle-by-group">
          <SectionHeader icon={Clock} title="Ralenti Engins de Chantier" iconBg="bg-amber-100" iconColor="text-amber-600" count={`${idleGroups.total_engins} engins`} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {idleGroups.groups.map(g => (
              <div key={g.name} className="rounded-xl p-4 border bg-gray-50 border-gray-200">
                <div className="flex justify-between mb-2"><span className="text-sm font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>{g.name}</span><span className="text-[10px] text-gray-500">{g.total}</span></div>
                <div className="grid grid-cols-3 gap-2 text-center mb-2">
                  <div><div className="text-lg font-bold text-emerald-600">{g.active}</div><div className="text-[9px] text-gray-500">Actifs</div></div>
                  <div><div className={`text-lg font-bold ${g.idle > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{g.idle}</div><div className="text-[9px] text-gray-500">Ralenti</div></div>
                  <div><div className="text-lg font-bold text-gray-400">{g.offline}</div><div className="text-[9px] text-gray-500">Offline</div></div>
                </div>
                <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-gray-200 flex">
                  <div className="h-full bg-emerald-400" style={{ width: `${(g.active / Math.max(1, g.total)) * 100}%` }} />
                  <div className="h-full bg-amber-400" style={{ width: `${(g.idle / Math.max(1, g.total)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ CHART ═══ */}
      {trendData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Distance quotidienne</h4>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={trendData} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="day_name" tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} width={40} unit=" km" />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 11 }} formatter={(v) => [`${v} km`, 'Distance']} />
              <Bar dataKey="total_distance" fill="#111" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ═══════════════════ DRAWERS ═══════════════════ */}

      {/* ──── OFFLINE ──── */}
      {(activeDrawer === 'offline' || activeDrawer === 'insight_offline') && (
        <DashboardDetailDrawer
          title={`${kpis.offline.length} vehicule${kpis.offline.length > 1 ? 's' : ''} hors ligne`}
          subtitle={`${kpis.offline.length} sur ${kpis.total} vehicules • ${kpis.total > 0 ? Math.round((kpis.offline.length / kpis.total) * 100) : 0}% de la flotte`}
          badge={kpis.critCount > 0 ? `${kpis.critCount} hors ligne depuis plus de 24 h` : undefined}
          onClose={() => { setActiveDrawer(null); setOfflineFilter('all'); }}>
          {/* Severity summary */}
          <div className="flex gap-2 mb-4">
            {[
              { color: 'bg-red-500', label: '> 24 h', count: offCritical },
              { color: 'bg-orange-400', label: '6–24 h', count: kpis.watchCount },
              { color: 'bg-amber-400', label: '< 6 h', count: kpis.recentCount },
            ].filter(s => s.count > 0).map(s => (
              <div key={s.label} className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-lg border border-gray-200">
                <div className={`w-2 h-2 rounded-full ${s.color}`} />
                <span className="text-[11px] text-gray-600 font-medium">{s.count}</span>
                <span className="text-[10px] text-gray-400">{s.label}</span>
              </div>
            ))}
          </div>
          {/* Filter tabs */}
          <div className="flex gap-1.5 mb-4">
            {[
              { id: 'all', label: `Tous`, count: kpis.offline.length },
              { id: 'critical', label: '> 24 h', count: offCritical },
              { id: 'watch', label: '6–24 h', count: kpis.watchCount },
              { id: 'recent', label: '< 6 h', count: kpis.recentCount },
            ].filter(f => f.count > 0 || f.id === 'all').map(f => (
              <button key={f.id} onClick={() => setOfflineFilter(f.id)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors ${
                  offlineFilter === f.id ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                {f.label} {f.count}
              </button>
            ))}
          </div>
          {/* Vehicle list */}
          <div className="space-y-2">
            {filteredOffline.map(v => {
              const lastComm = v.last_update ? new Date(v.last_update) : null;
              return (
                <div key={v.tracker_id} className={`rounded-xl border p-3.5 ${v.severity.bg} border-gray-200`} data-testid={`offline-vehicle-${v.tracker_id}`}>
                  <div className="flex items-start justify-between mb-1.5">
                    <div>
                      <div className="text-[13px] font-semibold text-gray-900">{v.label}</div>
                      <div className="text-[10px] text-gray-400">{v.model || '—'}</div>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full mt-1 ${v.severity.dot}`} title={v.severity.label} />
                  </div>
                  <div className={`text-xs font-semibold mb-2 ${v.severity.color}`}>
                    Hors ligne depuis {v.durationLabel || 'duree inconnue'}
                  </div>
                  <div className="space-y-0.5 text-[11px] text-gray-500">
                    <div>Derniere communication : {lastComm ? lastComm.toLocaleString('fr-FR') : <span className="text-gray-400 italic">inconnue</span>}</div>
                    <div>Derniere position : {v.location?.lat && v.location.lat !== 0 ? `${v.location.lat.toFixed(4)}, ${v.location.lng.toFixed(4)}` : <span className="text-gray-400 italic">inconnue</span>}</div>
                    <div>Mouvement : {v.movement_status === 'moving' ? 'En route' : v.movement_status === 'idle' ? 'Ralenti' : 'Arrete'} • Vitesse : {v.speed || 0} km/h</div>
                  </div>
                  {!lastComm && (
                    <div className="mt-2 text-[10px] text-gray-400 italic bg-white/60 rounded-lg px-2 py-1 border border-gray-200">
                      Etat a verifier — aucune donnee de communication disponible
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DashboardDetailDrawer>
      )}

      {/* ──── ACTIVE ──── */}
      {activeDrawer === 'active' && (
        <DashboardDetailDrawer
          title={`${kpis.active.length} vehicule${kpis.active.length > 1 ? 's' : ''} actif${kpis.active.length > 1 ? 's' : ''}`}
          subtitle={`${kpis.total > 0 ? Math.round((kpis.active.length / kpis.total) * 100) : 0}% de la flotte`}
          onClose={() => setActiveDrawer(null)} linkLabel="Tous les vehicules" onLinkClick={() => { setActiveDrawer(null); onNavigate?.('vehicles'); }}>
          <div className="space-y-2">
            {kpis.active.map(v => {
              const isMoving = v.movement_status === 'moving';
              return (
                <div key={v.tracker_id} className="rounded-xl border border-gray-200 bg-white p-3.5">
                  <div className="flex items-start justify-between mb-1">
                    <div className="text-[13px] font-semibold text-gray-900">{v.label}</div>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
                  </div>
                  <div className={`text-xs font-medium mb-1.5 ${isMoving ? 'text-emerald-600' : 'text-gray-500'}`}>
                    {isMoving ? `En mouvement • ${v.speed} km/h` : v.movement_status === 'idle' ? 'Au ralenti • moteur allume' : 'Arrete'}
                  </div>
                  <div className="text-[11px] text-gray-500 space-y-0.5">
                    <div>Distance : {(v.mileage || 0).toFixed(0)} km (periode)</div>
                    {v.last_update && <div>Dern. comm. : {new Date(v.last_update).toLocaleString('fr-FR')}</div>}
                    {v.location?.lat !== 0 && <div>Position : {v.location.lat?.toFixed(4)}, {v.location.lng?.toFixed(4)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </DashboardDetailDrawer>
      )}

      {/* ──── DISTANCE ──── */}
      {(activeDrawer === 'distance') && (() => {
        const sorted = [...vehicles].sort((a, b) => (b.mileage || 0) - (a.mileage || 0));
        const maxKm = sorted.length > 0 ? (sorted[0].mileage || 0) : 1;
        return (
          <DashboardDetailDrawer
            title={`${Math.round(kpis.totalKm).toLocaleString('fr-FR')} km parcourus`}
            subtitle={`${(new Date(toDate) - new Date(fromDate)) / 86400000 + 1} jours • ${kpis.total} vehicules`}
            onClose={() => setActiveDrawer(null)} linkLabel="Analyse complete (Performance)" onLinkClick={() => { setActiveDrawer(null); onNavigate?.('performance'); }}>
            <div className="grid grid-cols-2 gap-3 mb-5 p-3 bg-gray-50 rounded-xl">
              <Stat label="Distance totale" value={`${Math.round(kpis.totalKm).toLocaleString('fr-FR')} km`} />
              <Stat label="Moy. / vehicule" value={`${kpis.total > 0 ? Math.round(kpis.totalKm / kpis.total) : 0} km`} />
            </div>
            <div className="space-y-1.5">
              {sorted.map(v => {
                const pct = kpis.totalKm > 0 ? Math.round((v.mileage || 0) / kpis.totalKm * 100) : 0;
                const barW = maxKm > 0 ? Math.max(1, ((v.mileage || 0) / maxKm) * 100) : 0;
                return (
                  <div key={v.tracker_id} className="flex items-center gap-3 py-1.5">
                    <div className="w-32 lg:w-40 truncate text-xs font-medium text-gray-800" title={v.label}>{v.label}</div>
                    <div className="flex-1 h-5 bg-gray-100 rounded relative overflow-hidden">
                      <div className="h-full bg-[#111] rounded transition-all" style={{ width: `${barW}%` }} />
                    </div>
                    <div className="w-20 text-right text-[11px] tabular-nums">
                      <span className="font-semibold">{(v.mileage || 0).toFixed(0)} km</span>
                      <span className="text-gray-400 ml-1">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </DashboardDetailDrawer>
        );
      })()}

      {/* ──── ENGINE HOURS ──── */}
      {activeDrawer === 'engine' && (() => {
        const sorted = [...vehicles].sort((a, b) => (b.engine_hours || 0) - (a.engine_hours || 0));
        const maxEh = sorted.length > 0 ? (sorted[0].engine_hours || 1) : 1;
        return (
          <DashboardDetailDrawer
            title={`${Math.round(kpis.totalEh).toLocaleString('fr-FR')} h moteur`}
            subtitle="Compteurs cumulatifs totaux"
            onClose={() => setActiveDrawer(null)}>
            <div className="text-xs text-gray-500 mb-4 p-2.5 bg-amber-50 rounded-lg border border-amber-200">
              Les heures moteur sont des compteurs totaux (non periodiques).
            </div>
            <div className="space-y-1.5">
              {sorted.map(v => {
                const barW = maxEh > 0 ? Math.max(1, ((v.engine_hours || 0) / maxEh) * 100) : 0;
                return (
                  <div key={v.tracker_id} className="flex items-center gap-3 py-1.5">
                    <div className="w-32 lg:w-40 truncate text-xs font-medium text-gray-800">{v.label}</div>
                    <div className="flex-1 h-5 bg-gray-100 rounded relative overflow-hidden">
                      <div className="h-full bg-purple-400 rounded transition-all" style={{ width: `${barW}%` }} />
                    </div>
                    <span className="w-16 text-right text-[11px] font-semibold tabular-nums">{(v.engine_hours || 0).toFixed(0)} h</span>
                  </div>
                );
              })}
            </div>
          </DashboardDetailDrawer>
        );
      })()}

      {/* ──── MOVING ──── */}
      {activeDrawer === 'moving' && (
        <DashboardDetailDrawer
          title={`${kpis.moving.length} vehicule${kpis.moving.length > 1 ? 's' : ''} en mouvement`}
          subtitle="Etat instantane"
          onClose={() => setActiveDrawer(null)}>
          {kpis.moving.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Aucun vehicule en mouvement</div>
          ) : (
            <div className="space-y-2">
              {kpis.moving.map(v => (
                <div key={v.tracker_id} className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
                  <div className="text-[13px] font-semibold text-gray-900 mb-1">{v.label}</div>
                  <div className="text-xs font-medium text-emerald-600 mb-1.5">En mouvement • {v.speed} km/h</div>
                  <div className="text-[11px] text-gray-500">
                    {v.location?.lat !== 0 && <span>Position : {v.location.lat?.toFixed(4)}, {v.location.lng?.toFixed(4)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashboardDetailDrawer>
      )}

      {/* ──── UTILIZATION ──── */}
      {activeDrawer === 'utilization' && (
        <DashboardDetailDrawer
          title={`Utilisation flotte : ${kpis.avgUtil}%`}
          subtitle={`${fromDate} au ${toDate}`}
          onClose={() => setActiveDrawer(null)} linkLabel="Analyse complete (Efficacite)" onLinkClick={() => { setActiveDrawer(null); onNavigate?.('efficiency'); }}>
          <div className="grid grid-cols-3 gap-3 mb-5 p-3 bg-gray-50 rounded-xl">
            <Stat label="Utilisation moy." value={`${kpis.avgUtil}%`} />
            <Stat label="Utilises" value={compVehicles.filter(v => (v.total_distance_week || 0) > 0).length} />
            <Stat label="Non utilises" value={kpis.zeroKm.length} />
          </div>
          <div className="space-y-1.5">
            {[...compVehicles].sort((a, b) => (b.utilization_score || 0) - (a.utilization_score || 0)).map(v => {
              const u = v.utilization_score || 0;
              return (
                <div key={v.tracker_id} className="flex items-center gap-3 py-1.5">
                  <div className="w-32 lg:w-40 truncate text-xs font-medium text-gray-800">{v.label}</div>
                  <div className="flex-1 h-5 bg-gray-100 rounded relative overflow-hidden">
                    <div className={`h-full rounded transition-all ${u >= 85 ? 'bg-blue-500' : u >= 60 ? 'bg-emerald-400' : u >= 30 ? 'bg-amber-400' : u > 0 ? 'bg-red-400' : 'bg-gray-200'}`} style={{ width: `${Math.max(1, u)}%` }} />
                  </div>
                  <div className="w-24 text-right text-[11px] tabular-nums">
                    <span className="font-semibold">{u}%</span>
                    <span className="text-gray-400 ml-1">{v.active_days || 0}j</span>
                    <span className="text-gray-400 ml-1">{v.total_distance_week} km</span>
                  </div>
                </div>
              );
            })}
          </div>
        </DashboardDetailDrawer>
      )}

      {/* ──── INSIGHT: ZERO KM ──── */}
      {activeDrawer === 'insight_zero_km' && (
        <DashboardDetailDrawer
          title={`${kpis.zeroKm.length} vehicule${kpis.zeroKm.length > 1 ? 's' : ''} sans activite`}
          subtitle={`0 km enregistres du ${fromDate} au ${toDate}`}
          onClose={() => setActiveDrawer(null)}>
          <div className="space-y-2">
            {kpis.zeroKm.map(v => {
              const sv = vehicles.find(x => x.tracker_id === v.tracker_id);
              const isOnline = sv?.connection_status === 'active';
              return (
                <div key={v.tracker_id} className="rounded-xl border border-gray-200 bg-white p-3.5">
                  <div className="flex items-start justify-between mb-1">
                    <div className="text-[13px] font-semibold text-gray-900">{v.label}</div>
                    <span className={`w-2 h-2 rounded-full mt-1.5 ${isOnline ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  </div>
                  <div className="text-xs text-gray-500 mb-1">
                    {isOnline ? 'Connecte mais aucun deplacement' : 'Hors ligne — aucun deplacement'}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {sv?.last_update ? `Dern. comm. : ${new Date(sv.last_update).toLocaleString('fr-FR')}` : 'Dern. comm. : inconnue'}
                  </div>
                </div>
              );
            })}
          </div>
        </DashboardDetailDrawer>
      )}

      {/* ──── INSIGHT: LOW UTIL ──── */}
      {activeDrawer === 'insight_low_util' && (
        <DashboardDetailDrawer
          title={`${kpis.lowUtil.length} vehicule${kpis.lowUtil.length > 1 ? 's' : ''} sous-utilise${kpis.lowUtil.length > 1 ? 's' : ''}`}
          subtitle={`Utilisation < 30% (moy. flotte : ${kpis.avgUtil}%)`}
          onClose={() => setActiveDrawer(null)} linkLabel="Analyse (Efficacite)" onLinkClick={() => { setActiveDrawer(null); onNavigate?.('efficiency'); }}>
          <div className="space-y-2">
            {kpis.lowUtil.map(v => (
              <div key={v.tracker_id} className="rounded-xl border border-gray-200 bg-white p-3.5">
                <div className="flex items-start justify-between mb-1">
                  <div className="text-[13px] font-semibold text-gray-900">{v.label}</div>
                  <span className="text-xs font-semibold text-amber-600">{v.utilization_score}%</span>
                </div>
                <div className="text-[11px] text-gray-500 space-y-0.5">
                  <div>Jours actifs : {v.active_days || 0} / {v.total_days || '—'}</div>
                  <div>Distance : {v.total_distance_week} km</div>
                  <div>Ecart moy. flotte : <span className="text-red-500 font-medium">{Math.round((v.utilization_score || 0) - kpis.avgUtil)} pts</span></div>
                </div>
              </div>
            ))}
          </div>
        </DashboardDetailDrawer>
      )}

      {/* ──── INSIGHT: TOP ──── */}
      {activeDrawer === 'insight_top' && kpis.topVehicle && (() => {
        const v = kpis.topVehicle;
        const sv = vehicles.find(x => x.tracker_id === v.tracker_id);
        return (
          <DashboardDetailDrawer title="Vehicule le plus utilise" subtitle={v.label}
            onClose={() => setActiveDrawer(null)} linkLabel="Voir dans Vehicules" onLinkClick={() => { setActiveDrawer(null); onNavigate?.('vehicles'); }}>
            <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl mb-4">
              <Stat label="Distance" value={`${v.total_distance_week} km`} />
              <Stat label="Utilisation" value={`${v.utilization_score}%`} />
              <Stat label="Jours actifs" value={`${v.active_days || 0}/${v.total_days || '—'}`} />
              <Stat label="Moteur" value={`${(sv?.engine_hours || 0).toFixed(0)} h`} />
            </div>
            <div className="text-xs text-gray-500 p-2.5 bg-gray-50 rounded-lg">
              Moy. flotte : {kpis.avgUtil}% utilisation — {kpis.total > 0 ? Math.round(kpis.totalKm / kpis.total) : 0} km/vehicule
            </div>
          </DashboardDetailDrawer>
        );
      })()}
    </div>
  );
};
