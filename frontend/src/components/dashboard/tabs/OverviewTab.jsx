import React, { useState, useMemo } from "react";
import { KPICard, InsightCard, SectionHeader } from "@/components/shared/UIComponents";
import { DashboardDetailDrawer } from "@/components/shared/DashboardDetailDrawer";
import {
  Gauge, Truck, MapPin, Activity, Zap, WifiOff, CheckCircle,
  Clock, AlertTriangle, ChevronRight, Navigation, Eye
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

// ─── Vehicle row reused across drawers ───
const VehicleRow = ({ v, extra, onClick }) => (
  <div className="flex items-center justify-between py-3 px-4 border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer transition-colors"
    onClick={onClick} data-testid={`drawer-vehicle-${v.tracker_id}`}>
    <div className="flex items-center gap-3 min-w-0">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
        v.connection_status === 'active' ? 'bg-emerald-500' : 'bg-gray-300'
      }`} />
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">{v.label}</div>
        <div className="text-[10px] text-gray-400">{v.model || ''}</div>
      </div>
    </div>
    <div className="flex items-center gap-4 flex-shrink-0">
      {extra}
      <ChevronRight size={14} className="text-gray-300" />
    </div>
  </div>
);

// ─── Summary stat ───
const Stat = ({ label, value }) => (
  <div className="text-center">
    <div className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>{value}</div>
    <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">{label}</div>
  </div>
);

export const OverviewTab = ({ data, debugMode, fromDate, toDate, onNavigate }) => {
  const { stats, trends, comparison, idleGroups } = data;
  const vehicles = stats?.vehicles || [];
  const compVehicles = comparison?.vehicles || [];
  const trendData = trends?.trends || [];

  const [activeDrawer, setActiveDrawer] = useState(null);

  // ─── KPI computations (single source of truth) ───
  const kpis = useMemo(() => {
    const total = vehicles.length;
    const active = vehicles.filter(v => v.connection_status === 'active');
    const moving = vehicles.filter(v => v.movement_status === 'moving');
    const offline = vehicles.filter(v => v.connection_status !== 'active');
    const totalKm = vehicles.reduce((s, v) => s + (v.mileage || 0), 0);
    const totalEh = vehicles.reduce((s, v) => s + (v.engine_hours || 0), 0);
    const avgUtil = compVehicles.length > 0
      ? Math.round(compVehicles.reduce((s, v) => s + (v.utilization_score || 0), 0) / compVehicles.length) : 0;
    const zeroKm = compVehicles.filter(v => (v.total_distance_week || 0) === 0);
    const lowUtil = compVehicles.filter(v => (v.utilization_score || 0) > 0 && (v.utilization_score || 0) < 30);
    const topVehicle = compVehicles.length > 0 ? compVehicles.reduce((best, v) =>
      (v.total_distance_week || 0) > (best.total_distance_week || 0) ? v : best, compVehicles[0]) : null;

    return { total, active, moving, offline, totalKm: Math.round(totalKm * 10) / 10, totalEh: Math.round(totalEh * 10) / 10, avgUtil, zeroKm, lowUtil, topVehicle };
  }, [vehicles, compVehicles]);

  // ─── Insights ───
  const insights = useMemo(() => {
    const list = [];
    if (kpis.offline.length > 0)
      list.push({ id: 'offline', type: 'warning', icon: 'WifiOff',
        title: `${kpis.offline.length} vehicule${kpis.offline.length > 1 ? 's' : ''} hors ligne`,
        detail: 'Derniere communication indisponible ou ancienne',
        cta: `Voir les ${kpis.offline.length} vehicules` });
    if (kpis.zeroKm.length > 0)
      list.push({ id: 'zero_km', type: 'info', icon: 'Truck',
        title: `${kpis.zeroKm.length} vehicule${kpis.zeroKm.length > 1 ? 's' : ''} sans activite`,
        detail: `0 km sur la periode selectionnee`,
        cta: `Voir les ${kpis.zeroKm.length} vehicules` });
    if (kpis.lowUtil.length > 0)
      list.push({ id: 'low_util', type: 'danger', icon: 'AlertTriangle',
        title: `${kpis.lowUtil.length} vehicule${kpis.lowUtil.length > 1 ? 's' : ''} sous-utilise${kpis.lowUtil.length > 1 ? 's' : ''}`,
        detail: 'Utilisation inferieure a 30%',
        cta: `Voir le detail` });
    if (kpis.topVehicle && (kpis.topVehicle.total_distance_week || 0) > 0)
      list.push({ id: 'top', type: 'success', icon: 'CheckCircle',
        title: `Vehicule le plus utilise : ${kpis.topVehicle.label}`,
        detail: `${kpis.topVehicle.total_distance_week} km — Utilisation ${kpis.topVehicle.utilization_score}%`,
        cta: 'Voir le detail' });
    return list;
  }, [kpis]);

  // ─── Debug info helper ───
  const audit = stats?._audit;
  const avgMs = audit?.navixy_calls?.length > 0 ? Math.round(audit.navixy_calls.reduce((s, c) => s + (c.response_time_ms || 0), 0) / audit.navixy_calls.length) : null;
  const cacheAge = audit?.cache?.hit ? audit.cache.age_seconds : null;
  const dbg = (src, field) => debugMode ? { source: src, field, responseTime: avgMs, cacheAge } : undefined;

  // Helper to get comparison data for a vehicle
  const compMap = useMemo(() => {
    const m = {};
    compVehicles.forEach(v => { m[v.tracker_id] = v; });
    return m;
  }, [compVehicles]);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-[1600px] mx-auto" data-testid="overview-tab">

      {/* ═══ KPI GRID ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div onClick={() => setActiveDrawer('utilization')} className="cursor-pointer group" data-testid="kpi-click-utilization">
          <KPICard label="Utilisation Flotte" value={kpis.avgUtil} unit="%" icon={Gauge}
            status={kpis.avgUtil >= 60 ? 'good' : kpis.avgUtil >= 30 ? 'warning' : 'danger'}
            subtitle="Cliquer pour le detail" debugInfo={dbg('vehicle-comparison', 'utilization_score')} />
        </div>
        <div onClick={() => setActiveDrawer('active')} className="cursor-pointer" data-testid="kpi-click-active">
          <KPICard label="Vehicules actifs" value={`${kpis.active.length}`} unit={`/ ${kpis.total}`} icon={Truck}
            status={kpis.active.length > 0 ? 'good' : 'danger'} subtitle="Cliquer pour le detail"
            debugInfo={dbg('tracker/get_state', 'connection_status')} />
        </div>
        <div onClick={() => setActiveDrawer('distance')} className="cursor-pointer" data-testid="kpi-click-distance">
          <KPICard label="Distance parcourue" value={Math.round(kpis.totalKm).toLocaleString('fr-FR')} unit="km" icon={MapPin}
            subtitle="Cliquer pour le detail" debugInfo={dbg('tracker/stats/mileage', 'mileage')} />
        </div>
        <div onClick={() => setActiveDrawer('engine')} className="cursor-pointer" data-testid="kpi-click-engine">
          <KPICard label="Heures moteur" value={Math.round(kpis.totalEh).toLocaleString('fr-FR')} unit="h" icon={Activity}
            subtitle="Cliquer pour le detail" debugInfo={dbg('tracker/counter', 'engine_hours')} />
        </div>
        <div onClick={() => setActiveDrawer('moving')} className="cursor-pointer" data-testid="kpi-click-moving">
          <KPICard label="En mouvement" value={kpis.moving.length} icon={Navigation}
            status={kpis.moving.length > 0 ? 'good' : undefined} subtitle="Instantane"
            debugInfo={dbg('tracker/get_state', 'movement_status')} />
        </div>
        <div onClick={() => setActiveDrawer('offline')} className="cursor-pointer" data-testid="kpi-click-offline">
          <KPICard label="Hors ligne" value={kpis.offline.length} icon={WifiOff}
            status={kpis.offline.length > 0 ? 'danger' : 'good'} subtitle="Cliquer pour le detail"
            debugInfo={dbg('tracker/get_state', 'connection_status')} />
        </div>
      </div>

      {/* ═══ DATA SOURCE BANNER ═══ */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-200">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-[10px] text-gray-500">Donnees Navixy — aucune estimation</span>
        {audit && <span className="text-[10px] text-gray-400 ml-auto">v{audit.engine_version} | {audit.navixy_calls?.length || 0} appels | {fromDate} au {toDate}{audit.cache?.hit ? ` | cache ${audit.cache.age_seconds}s` : ''}</span>}
      </div>

      {/* ═══ INSIGHTS ═══ */}
      {insights.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="insights">
          <SectionHeader icon={Zap} title="Insights" count={insights.length} />
          <div className="space-y-2.5">
            {insights.map((ins) => {
              const iconMap = { AlertTriangle, WifiOff, Clock, Truck, CheckCircle };
              return (
                <div key={ins.id} className="cursor-pointer" onClick={() => setActiveDrawer(`insight_${ins.id}`)}
                  data-testid={`insight-${ins.id}`}>
                  <InsightCard {...ins} icon={iconMap[ins.icon] || AlertTriangle} />
                  <div className="text-xs font-medium text-[#111] mt-1 ml-8 hover:underline">{ins.cta}</div>
                </div>
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
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>{g.name}</span>
                  <span className="text-[10px] text-gray-500">{g.total} engins</span>
                </div>
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

      {/* ═══ DISTANCE CHART ═══ */}
      {trendData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Distance quotidienne</h4>
          <ResponsiveContainer width="100%" height={200}>
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

      {/* ═══════════ DRAWERS ═══════════ */}

      {/* UTILISATION */}
      {activeDrawer === 'utilization' && (
        <DashboardDetailDrawer title="Utilisation Flotte" subtitle={`${kpis.avgUtil}% — ${fromDate} au ${toDate}`}
          onClose={() => setActiveDrawer(null)} linkLabel="Voir l'analyse complete (Efficacite)" onLinkClick={() => { setActiveDrawer(null); onNavigate?.('efficiency'); }}>
          <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
            <Stat label="Utilisation moy." value={`${kpis.avgUtil}%`} />
            <Stat label="Vehicules utilises" value={compVehicles.filter(v => (v.total_distance_week || 0) > 0).length} />
            <Stat label="Non utilises" value={kpis.zeroKm.length} />
          </div>
          <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
            <Stat label="Distance totale" value={`${Math.round(kpis.totalKm)} km`} />
            <Stat label="Moy. / vehicule" value={`${kpis.total > 0 ? Math.round(kpis.totalKm / kpis.total) : 0} km`} />
            <Stat label="Jours periode" value={comparison?.vehicles?.[0]?.total_days || '—'} />
          </div>
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Par vehicule</div>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {[...compVehicles].sort((a, b) => (b.utilization_score || 0) - (a.utilization_score || 0)).map(v => (
              <VehicleRow key={v.tracker_id} v={v} extra={
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-semibold">{v.utilization_score}%</span>
                  <span className="text-gray-400">{v.active_days || 0}j</span>
                  <span className="text-gray-400">{v.total_distance_week} km</span>
                </div>
              } />
            ))}
          </div>
        </DashboardDetailDrawer>
      )}

      {/* VEHICULES ACTIFS */}
      {activeDrawer === 'active' && (
        <DashboardDetailDrawer title={`Vehicules actifs : ${kpis.active.length} / ${kpis.total}`}
          subtitle={`${kpis.offline.length} hors ligne`}
          onClose={() => setActiveDrawer(null)} linkLabel="Voir tous les vehicules" onLinkClick={() => { setActiveDrawer(null); onNavigate?.('vehicles'); }}>
          <div className="flex gap-2 mb-4">
            {[{ l: 'Tous', c: kpis.total }, { l: 'Actifs', c: kpis.active.length }, { l: 'Hors ligne', c: kpis.offline.length }].map(f => (
              <span key={f.l} className="text-[10px] px-2.5 py-1 rounded-full border border-gray-200 text-gray-600">{f.l} ({f.c})</span>
            ))}
          </div>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {vehicles.map(v => (
              <VehicleRow key={v.tracker_id} v={v} extra={
                <div className="flex items-center gap-3 text-xs">
                  <span className={v.connection_status === 'active' ? 'text-emerald-600 font-medium' : 'text-gray-400'}>{v.connection_status === 'active' ? 'Actif' : 'Offline'}</span>
                  <span className="text-gray-400">{v.last_update ? new Date(v.last_update).toLocaleDateString('fr-FR') : '—'}</span>
                  <span className="text-gray-500">{(v.mileage || 0).toFixed(0)} km</span>
                </div>
              } />
            ))}
          </div>
        </DashboardDetailDrawer>
      )}

      {/* DISTANCE */}
      {activeDrawer === 'distance' && (() => {
        const sorted = [...vehicles].sort((a, b) => (b.mileage || 0) - (a.mileage || 0));
        const withKm = sorted.filter(v => (v.mileage || 0) > 0);
        const top = withKm[0];
        const bottom = withKm.length > 1 ? withKm[withKm.length - 1] : null;
        return (
          <DashboardDetailDrawer title={`Distance parcourue : ${Math.round(kpis.totalKm).toLocaleString('fr-FR')} km`}
            subtitle={`${fromDate} au ${toDate}`}
            onClose={() => setActiveDrawer(null)} linkLabel="Voir l'analyse complete (Performance)" onLinkClick={() => { setActiveDrawer(null); onNavigate?.('performance'); }}>
            <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-xl">
              <Stat label="Distance totale" value={`${Math.round(kpis.totalKm)} km`} />
              <Stat label="Moy. / vehicule" value={`${kpis.total > 0 ? Math.round(kpis.totalKm / kpis.total) : 0} km`} />
            </div>
            {top && (
              <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
                <div><div className="text-[10px] text-gray-400 uppercase">Plus actif</div><div className="text-sm font-semibold mt-1">{top.label}</div><div className="text-xs text-gray-500">{(top.mileage || 0).toFixed(0)} km</div></div>
                {bottom && <div><div className="text-[10px] text-gray-400 uppercase">Moins actif (avec km)</div><div className="text-sm font-semibold mt-1">{bottom.label}</div><div className="text-xs text-gray-500">{(bottom.mileage || 0).toFixed(0)} km</div></div>}
              </div>
            )}
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Ventilation par vehicule</div>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              {sorted.map(v => (
                <VehicleRow key={v.tracker_id} v={v} extra={
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-semibold tabular-nums">{(v.mileage || 0).toFixed(1)} km</span>
                    <span className="text-gray-400">{kpis.totalKm > 0 ? Math.round((v.mileage || 0) / kpis.totalKm * 100) : 0}%</span>
                  </div>
                } />
              ))}
            </div>
          </DashboardDetailDrawer>
        );
      })()}

      {/* HEURES MOTEUR */}
      {activeDrawer === 'engine' && (
        <DashboardDetailDrawer title={`Heures moteur : ${Math.round(kpis.totalEh).toLocaleString('fr-FR')} h`}
          subtitle="Compteur total (non periodique)"
          onClose={() => setActiveDrawer(null)}>
          <div className="text-xs text-gray-500 mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
            Les heures moteur sont des compteurs totaux cumulatifs (odometre moteur). La valeur affichee est le total actuel, pas la consommation sur la periode.
          </div>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {[...vehicles].sort((a, b) => (b.engine_hours || 0) - (a.engine_hours || 0)).map(v => (
              <VehicleRow key={v.tracker_id} v={v} extra={
                <span className="text-xs font-semibold tabular-nums">{(v.engine_hours || 0).toFixed(0)} h</span>
              } />
            ))}
          </div>
        </DashboardDetailDrawer>
      )}

      {/* EN MOUVEMENT */}
      {activeDrawer === 'moving' && (
        <DashboardDetailDrawer title={`En mouvement : ${kpis.moving.length} vehicule${kpis.moving.length > 1 ? 's' : ''}`}
          subtitle="Etat instantane"
          onClose={() => setActiveDrawer(null)}>
          {kpis.moving.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Aucun vehicule en mouvement actuellement</div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              {kpis.moving.map(v => (
                <VehicleRow key={v.tracker_id} v={v} extra={
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-semibold text-emerald-600">{v.speed} km/h</span>
                    {v.location?.lat !== 0 && <span className="text-gray-400">{v.location.lat?.toFixed(3)}, {v.location.lng?.toFixed(3)}</span>}
                  </div>
                } />
              ))}
            </div>
          )}
        </DashboardDetailDrawer>
      )}

      {/* HORS LIGNE */}
      {activeDrawer === 'offline' && (
        <DashboardDetailDrawer title={`Hors ligne : ${kpis.offline.length} vehicule${kpis.offline.length > 1 ? 's' : ''}`}
          subtitle="Vehicules sans communication active"
          onClose={() => setActiveDrawer(null)}>
          {kpis.offline.length === 0 ? (
            <div className="text-center py-12 text-emerald-600 text-sm font-medium">Tous les vehicules sont connectes</div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              {kpis.offline.map(v => {
                const lastComm = v.last_update ? new Date(v.last_update) : null;
                const hoursAgo = lastComm ? Math.round((Date.now() - lastComm.getTime()) / 3600000) : null;
                const durationLabel = hoursAgo === null ? 'Inconnue' : hoursAgo < 1 ? '< 1h' : hoursAgo < 6 ? '1-6h' : hoursAgo < 24 ? '6-24h' : hoursAgo < 72 ? '1-3 jours' : '> 3 jours';
                const durationColor = hoursAgo === null ? 'text-gray-400' : hoursAgo < 6 ? 'text-amber-600' : 'text-red-600';
                return (
                  <div key={v.tracker_id} className="py-3 px-4 border-b border-gray-50">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-gray-300" />
                        <span className="text-sm font-medium text-gray-900">{v.label}</span>
                      </div>
                      <span className={`text-xs font-semibold ${durationColor}`}>{durationLabel}</span>
                    </div>
                    <div className="ml-4 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-gray-500">
                      <span>Modele: {v.model || '—'}</span>
                      <span>Mouvement: {v.movement_status}</span>
                      <span>Dern. comm: {lastComm ? lastComm.toLocaleString('fr-FR') : '—'}</span>
                      <span>Vitesse: {v.speed || 0} km/h</span>
                      {v.location?.lat !== 0 && <span>GPS: {v.location.lat?.toFixed(4)}, {v.location.lng?.toFixed(4)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DashboardDetailDrawer>
      )}

      {/* INSIGHT: OFFLINE */}
      {activeDrawer === 'insight_offline' && (
        <DashboardDetailDrawer title={`${kpis.offline.length} vehicules hors ligne`}
          subtitle="Derniere communication indisponible ou ancienne"
          onClose={() => setActiveDrawer(null)}>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {kpis.offline.map(v => (
              <VehicleRow key={v.tracker_id} v={v} extra={
                <span className="text-[10px] text-gray-400">{v.last_update ? new Date(v.last_update).toLocaleDateString('fr-FR') : '—'}</span>
              } />
            ))}
          </div>
        </DashboardDetailDrawer>
      )}

      {/* INSIGHT: ZERO KM */}
      {activeDrawer === 'insight_zero_km' && (
        <DashboardDetailDrawer title={`${kpis.zeroKm.length} vehicules sans activite`}
          subtitle={`0 km sur la periode ${fromDate} au ${toDate}`}
          onClose={() => setActiveDrawer(null)}>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {kpis.zeroKm.map(v => {
              const sv = vehicles.find(x => x.tracker_id === v.tracker_id);
              return (
                <div key={v.tracker_id} className="py-3 px-4 border-b border-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${v.connection_status === 'active' ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      <span className="text-sm font-medium">{v.label}</span>
                    </div>
                    <span className="text-[10px] text-gray-400">{v.connection_status}</span>
                  </div>
                  <div className="ml-4 mt-1 text-[10px] text-gray-500">
                    Dern. comm: {sv?.last_update ? new Date(sv.last_update).toLocaleString('fr-FR') : '—'} | Mouvement: {sv?.movement_status || '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </DashboardDetailDrawer>
      )}

      {/* INSIGHT: LOW UTIL */}
      {activeDrawer === 'insight_low_util' && (
        <DashboardDetailDrawer title={`${kpis.lowUtil.length} vehicules sous-utilises`}
          subtitle="Utilisation inferieure a 30%"
          onClose={() => setActiveDrawer(null)}>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {kpis.lowUtil.map(v => (
              <div key={v.tracker_id} className="py-3 px-4 border-b border-gray-50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{v.label}</span>
                  <span className="text-xs font-semibold text-amber-600">{v.utilization_score}%</span>
                </div>
                <div className="ml-0 grid grid-cols-3 gap-2 text-[10px] text-gray-500">
                  <span>Jours actifs: {v.active_days || 0}/{v.total_days || '—'}</span>
                  <span>Distance: {v.total_distance_week} km</span>
                  <span>Moy. flotte: {kpis.avgUtil}%</span>
                </div>
              </div>
            ))}
          </div>
        </DashboardDetailDrawer>
      )}

      {/* INSIGHT: TOP VEHICLE */}
      {activeDrawer === 'insight_top' && kpis.topVehicle && (() => {
        const v = kpis.topVehicle;
        const sv = vehicles.find(x => x.tracker_id === v.tracker_id);
        return (
          <DashboardDetailDrawer title={`Vehicule le plus utilise`} subtitle={v.label}
            onClose={() => setActiveDrawer(null)} linkLabel="Voir dans Vehicules" onLinkClick={() => { setActiveDrawer(null); onNavigate?.('vehicles'); }}>
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl mb-4">
              <Stat label="Distance" value={`${v.total_distance_week} km`} />
              <Stat label="Utilisation" value={`${v.utilization_score}%`} />
              <Stat label="Jours actifs" value={`${v.active_days || 0}/${v.total_days || '—'}`} />
              <Stat label="Heures moteur" value={`${(sv?.engine_hours || 0).toFixed(0)} h`} />
            </div>
            <div className="text-xs text-gray-500 p-3 bg-gray-50 rounded-lg">
              Moy. flotte: {kpis.avgUtil}% utilisation — {kpis.total > 0 ? Math.round(kpis.totalKm / kpis.total) : 0} km/vehicule
            </div>
          </DashboardDetailDrawer>
        );
      })()}
    </div>
  );
};
