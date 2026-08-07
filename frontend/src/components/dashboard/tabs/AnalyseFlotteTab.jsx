import React, { useState, useMemo, useRef } from "react";
import { DashboardDetailDrawer } from "@/components/shared/DashboardDetailDrawer";
import {
  Truck, MapPin, Zap, Search, ChevronDown, ChevronUp,
  Activity, AlertTriangle, TrendingUp, XCircle, Info, X,
  BarChart3, Clock
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, ReferenceLine, Cell
} from "recharts";

// ═══ CATEGORIES — single source of truth ═══
const CATEGORIES = [
  { id: "inactif", label: "Sans activite", color: "#9CA3AF", bg: "bg-gray-400", text: "text-gray-600", border: "border-gray-300", seuil: "0%", def: "Aucun jour d'activite sur la periode" },
  { id: "sous_utilise", label: "Sous-utilise", color: "#EF4444", bg: "bg-red-500", text: "text-red-600", border: "border-red-300", seuil: "< 30%", def: "Moins de 30% des jours avec activite" },
  { id: "modere", label: "Modere", color: "#F59E0B", bg: "bg-amber-500", text: "text-amber-600", border: "border-amber-300", seuil: "30–59%", def: "Activite entre 30% et 59% de la periode" },
  { id: "bonne", label: "Bonne utilisation", color: "#10B981", bg: "bg-emerald-500", text: "text-emerald-600", border: "border-emerald-300", seuil: "60–84%", def: "Activite reguliere sur 60% a 84% de la periode" },
  { id: "tres_utilise", label: "Forte utilisation", color: "#3B82F6", bg: "bg-blue-500", text: "text-blue-600", border: "border-blue-300", seuil: "≥ 85%", def: "Actif quasiment tous les jours de la periode" },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const USED_CATS = CATEGORIES.filter(c => c.id !== 'inactif');
const utilBarColor = (p) => p <= 0 ? '#d1d5db' : p < 30 ? '#EF4444' : p < 60 ? '#F59E0B' : p < 85 ? '#10B981' : '#3B82F6';
const utilTextCls = (p) => p <= 0 ? 'text-gray-400' : p < 30 ? 'text-red-600' : p < 60 ? 'text-amber-600' : p < 85 ? 'text-emerald-600' : 'text-blue-600';
const DN_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];

// ═══ Tooltip helper ═══
const Tip = ({ label, def, children }) => {
  const [s, setS] = useState(false);
  return (
    <span className="relative inline-flex items-center gap-0.5">
      {children}
      <button onClick={(e) => { e.stopPropagation(); setS(!s); }} className="p-0.5 hover:bg-gray-100 rounded"><Info size={10} className={s ? 'text-[#111]' : 'text-gray-300'} /></button>
      {s && <span className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg border border-gray-200 shadow-lg p-2.5 w-52 text-left">
        <span className="flex justify-between mb-0.5"><span className="text-[11px] font-semibold">{label}</span><button onClick={() => setS(false)}><X size={11} className="text-gray-400" /></button></span>
        <span className="text-[10px] text-gray-600 block">{def}</span>
      </span>}
    </span>
  );
};

// ═══ Vehicle Drawer ═══
const VehicleDrawer = ({ vehicle, fleetAvg, period, onClose }) => {
  if (!vehicle) return null;
  const cat = CAT_MAP[vehicle.category] || CATEGORIES[0];
  const daily = vehicle.daily_breakdown || [];
  const dn = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const ecart = Math.round(vehicle.utilization_pct - fleetAvg.util);

  return (
    <DashboardDetailDrawer title={vehicle.label} subtitle={`${period.from || ''} au ${period.to || ''}`} onClose={onClose}>
      <div className="grid grid-cols-3 gap-2.5 mb-4 p-3 bg-gray-50 rounded-xl text-center">
        <div><div className="text-lg font-semibold">{vehicle.utilization_pct}%</div><div className="text-[9px] text-gray-400 uppercase">Utilisation</div></div>
        <div><div className="text-lg font-semibold">{vehicle.active_days}/{vehicle.total_days}</div><div className="text-[9px] text-gray-400 uppercase">Jours actifs</div></div>
        <div><div className="text-lg font-semibold">{vehicle.period_mileage} km</div><div className="text-[9px] text-gray-400 uppercase">Distance</div></div>
      </div>
      <div className="grid grid-cols-3 gap-2.5 mb-4 p-3 bg-gray-50 rounded-xl text-center">
        <div><div className="text-lg font-semibold">{vehicle.km_per_active_day || '—'}</div><div className="text-[9px] text-gray-400 uppercase">km/jour actif</div></div>
        <div><div className="text-lg font-semibold">{vehicle.engine_hours > 0 ? `${vehicle.engine_hours} h` : '—'}</div><div className="text-[9px] text-gray-400 uppercase">Moteur{vehicle.engine_hours > 0 ? ' (total)' : ''}</div></div>
        <div><div className={`text-lg font-semibold ${ecart >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{ecart >= 0 ? '+' : ''}{ecart} pts</div><div className="text-[9px] text-gray-400 uppercase">vs flotte</div></div>
      </div>
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium mb-4 ${cat.text} ${cat.border}`}>
        <span className={`w-2 h-2 rounded-full ${cat.bg}`} />{cat.label} ({cat.seuil})
      </div>

      {/* Fleet comparison */}
      <div className="mb-4">
        <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">vs moyenne flotte</div>
        <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-xs">
          {[
            { l: 'Utilisation', v: `${vehicle.utilization_pct}%`, a: `${fleetAvg.util}%` },
            { l: 'Distance', v: `${vehicle.period_mileage} km`, a: `${fleetAvg.km} km` },
            ...(vehicle.engine_hours > 0 ? [{ l: 'Moteur (total)', v: `${vehicle.engine_hours} h`, a: `${fleetAvg.eh} h` }] : []),
          ].map(r => (
            <div key={r.l} className="flex items-center justify-between">
              <span className="text-gray-500">{r.l}</span>
              <span><span className="font-semibold">{r.v}</span> <span className="text-gray-300 mx-1">vs</span> <span className="text-gray-500">{r.a}</span></span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar */}
      {daily.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Activite par jour</div>
          <div className="grid grid-cols-7 gap-1">
            {daily.map(d => {
              const dt = new Date(d.date + 'T00:00:00');
              return (
                <div key={d.date} className={`rounded-lg p-1.5 text-center border ${d.active ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="text-[8px] text-gray-400">{dn[dt.getDay()]}</div>
                  <div className="text-[10px] font-mono text-gray-600">{dt.getDate()}</div>
                  <div className={`text-[9px] font-bold ${d.active ? 'text-emerald-700' : 'text-gray-300'}`}>{d.active ? `${d.km}` : '—'}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {daily.length > 1 && (
        <div>
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Distance quotidienne</div>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={daily} barSize={18}>
              <XAxis dataKey="date" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} tickFormatter={v => dn[new Date(v + 'T00:00:00').getDay()]} />
              <YAxis tick={{ fontSize: 8 }} axisLine={false} tickLine={false} width={25} />
              <RTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 10 }} formatter={v => [`${v} km`]} />
              <Bar dataKey="km" fill="#111" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardDetailDrawer>
  );
};

// ═══════════════ MAIN ═══════════════
export const AnalyseFlotteTab = ({ data }) => {
  const { efficiency, trends } = data;
  const tableRef = useRef(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  // ─── SINGLE FILTER STATE ───
  const [filters, setFilters] = useState({ category: 'all', day: null, search: '', sortBy: 'utilization_pct', sortDir: 'asc' });

  const setCategory = (cat) => { setFilters(f => ({ ...f, category: f.category === cat ? 'all' : cat, day: null })); scrollToTable(); };
  const setDay = (day) => { setFilters(f => ({ ...f, day: f.day === day ? null : day, category: 'all' })); scrollToTable(); };
  const setSearch = (s) => setFilters(f => ({ ...f, search: s }));
  const clearDayFilter = () => setFilters(f => ({ ...f, day: null }));
  const toggleSort = (col) => setFilters(f => f.sortBy === col ? { ...f, sortDir: f.sortDir === 'asc' ? 'desc' : 'asc' } : { ...f, sortBy: col, sortDir: (col === 'utilization_pct' || col === 'label') ? 'asc' : 'desc' });
  const scrollToTable = () => setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

  const effData = efficiency || {};
  const vehicles = effData.vehicles || [];
  const summary = effData.summary || {};
  const period = effData.period || {};
  const trendData = trends?.trends || [];
  const catCounts = summary.categories || {};
  const threshold = effData.active_day_threshold_km || 1;

  // ─── Analytics ───
  const analytics = useMemo(() => {
    const used = summary.used_vehicles || 0;
    const inactive = summary.inactive_vehicles || 0;
    const totalV = summary.total_vehicles || 0;
    const totalKm = summary.total_mileage || 0;
    const kmPerUsed = used > 0 ? Math.round(totalKm / used) : 0;
    const withEh = vehicles.filter(v => (v.engine_hours || 0) > 0).length;

    const topV = vehicles.length > 0 ? vehicles.reduce((b, v) => (v.period_mileage || 0) > (b.period_mileage || 0) ? v : b, vehicles[0]) : null;
    const topShare = topV && totalKm > 0 ? Math.round((topV.period_mileage / totalKm) * 100) : 0;

    return { used, inactive, totalV, totalKm, kmPerUsed, withEh, topV, topShare };
  }, [summary, vehicles]);

  const fleetAvg = useMemo(() => ({
    util: summary.average_utilization_pct || 0,
    km: summary.avg_mileage_per_vehicle || 0,
    eh: summary.avg_engine_hours_per_vehicle || 0,
  }), [summary]);

  // ─── Chart data ───
  const chartData = useMemo(() => {
    const total = analytics.totalV || 1;
    return trendData.map(t => ({
      date: t.date, day_name: t.day_name,
      active: t.active_vehicles, total,
      pct: Math.round((t.active_vehicles / total) * 100),
      km: t.total_distance,
    }));
  }, [trendData, analytics.totalV]);

  const avgPct = useMemo(() => {
    if (chartData.length === 0) return 0;
    return Math.round(chartData.reduce((s, d) => s + d.pct, 0) / chartData.length);
  }, [chartData]);

  // Best days
  const bestDays = useMemo(() => {
    if (chartData.length === 0) return [];
    const maxActive = Math.max(...chartData.map(d => d.active));
    return chartData.filter(d => d.active === maxActive);
  }, [chartData]);

  // ─── Filtered vehicles ───
  const filtered = useMemo(() => {
    let list = [...vehicles];
    const f = filters;

    if (f.search) list = list.filter(v => v.label.toLowerCase().includes(f.search.toLowerCase()));

    if (f.day) {
      list = list.filter(v => (v.daily_breakdown || []).some(d => d.date === f.day && d.active));
    } else if (f.category !== 'all') {
      if (f.category === 'used') list = list.filter(v => v.active_days > 0);
      else list = list.filter(v => v.category === f.category);
    }

    list.sort((a, b) => {
      let va = a[f.sortBy] ?? -1, vb = b[f.sortBy] ?? -1;
      if (typeof va === 'string') return f.sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return f.sortDir === 'asc' ? va - vb : vb - va;
    });
    return list;
  }, [vehicles, filters]);

  // Count for day filter
  const dayFilterCount = useMemo(() => {
    if (!filters.day) return 0;
    return vehicles.filter(v => (v.daily_breakdown || []).some(d => d.date === filters.day && d.active)).length;
  }, [vehicles, filters.day]);

  // ─── "À retenir" insights ───
  const insights = useMemo(() => {
    const list = [];
    if (analytics.inactive > 0)
      list.push({ text: `${analytics.inactive} vehicule${analytics.inactive > 1 ? 's' : ''} sans aucune activite sur ${period.days || 7} jours`, action: () => setCategory('inactif') });
    if (analytics.topV && analytics.topShare >= 25)
      list.push({ text: `${analytics.topV.label} represente ${analytics.topShare}% de la distance totale`, action: () => setSelectedVehicle(vehicles.find(v => v.tracker_id === analytics.topV?.tracker_id)) });
    if (bestDays.length > 0 && bestDays[0].active > 1) {
      const bestNames = bestDays.map(d => { const dt = new Date(d.date + 'T00:00:00'); return ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][dt.getDay()]; });
      list.push({ text: `${bestNames.join(' et ')} : meilleur${bestDays.length > 1 ? 's' : ''} jour${bestDays.length > 1 ? 's' : ''} (${bestDays[0].active}/${analytics.totalV} vehicules)`, action: () => setDay(bestDays[0].date) });
    }
    if (analytics.withEh < analytics.totalV && analytics.withEh > 0)
      list.push({ text: `Donnees moteur disponibles pour ${analytics.withEh}/${analytics.totalV} vehicules`, action: null });
    return list.slice(0, 4);
  }, [analytics, period.days, bestDays, vehicles]);

  // ─── Render helpers ───
  const isActive = (cat) => filters.category === cat && !filters.day;

  const dn = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const dayLabel = filters.day ? (() => { const d = new Date(filters.day + 'T00:00:00'); return `${DN_FULL[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`; })() : null;

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-[1600px] mx-auto" data-testid="analyse-flotte-tab">

      {/* ═══ 1. SUMMARY ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="analyse-summary">
        {/* Total → Used / Inactive */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-2xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>{analytics.totalV} vehicules</span>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setCategory('used')} className={`text-sm font-medium transition-colors ${isActive('used') ? 'text-[#111] underline' : 'text-gray-700 hover:text-[#111]'}`} data-testid="kpi-used">
            {analytics.used} utilises
          </button>
          <span className="text-gray-300">•</span>
          <button onClick={() => setCategory('inactif')} className={`text-sm font-medium transition-colors ${isActive('inactif') ? 'text-[#111] underline' : 'text-gray-500 hover:text-[#111]'}`} data-testid="kpi-inactive">
            {analytics.inactive} sans activite
          </button>
        </div>

        {/* Sub-categories of USED vehicles */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {USED_CATS.map(cat => {
            const count = catCounts[cat.id] || 0;
            const active = isActive(cat.id);
            return (
              <button key={cat.id} onClick={() => count > 0 && setCategory(cat.id)} data-testid={`kpi-cat-${cat.id}`}
                className={`rounded-xl border p-3 text-left transition-all ${active ? 'ring-2 ring-[#111] shadow-sm' : ''} ${count > 0 ? 'cursor-pointer hover:shadow-sm' : 'opacity-50 cursor-default'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${cat.bg}`} />
                  <Tip label={cat.label} def={`${cat.seuil} — ${cat.def}`}>
                    <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{cat.label}</span>
                  </Tip>
                </div>
                <div className="text-xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>{count}</div>
              </button>
            );
          })}
          {/* Km moy / véhicule utilisé */}
          <div className="rounded-xl border border-gray-200 p-3 text-left">
            <div className="flex items-center gap-1 mb-1">
              <Tip label="Km moy. / vehicule utilise" def={`Distance totale des vehicules utilises (${Math.round(analytics.totalKm)} km) divisee par le nombre de vehicules utilises (${analytics.used}). Exclut les vehicules sans activite.`}>
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Km moy./utilise</span>
              </Tip>
            </div>
            <div className="text-xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>{analytics.kmPerUsed} <span className="text-sm font-normal text-gray-400">km</span></div>
          </div>
        </div>
      </div>

      {/* ═══ 2. CATEGORY BAR ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 p-4" data-testid="analyse-bar">
        <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Repartition des vehicules</div>
        <div className="flex h-7 rounded-lg overflow-hidden border border-gray-200">
          {CATEGORIES.filter(c => (catCounts[c.id] || 0) > 0).map(c => {
            const w = ((catCounts[c.id] || 0) / (analytics.totalV || 1)) * 100;
            return (
              <div key={c.id} onClick={() => setCategory(c.id)}
                className={`flex items-center justify-center text-white text-[10px] font-bold cursor-pointer transition-all hover:opacity-80 ${isActive(c.id) ? 'ring-2 ring-inset ring-white/60' : ''}`}
                style={{ width: `${w}%`, backgroundColor: c.color }}
                title={`${c.label}: ${catCounts[c.id]}`}
                data-testid={`cat-bar-${c.id}`}>
                {catCounts[c.id]}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-2">
          {CATEGORIES.map(c => {
            const n = catCounts[c.id] || 0;
            return (
              <button key={c.id} onClick={() => n > 0 && setCategory(c.id)}
                className={`flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border transition-colors ${isActive(c.id) ? 'bg-gray-100 border-gray-400 font-semibold' : 'border-transparent'} ${n === 0 ? 'opacity-40' : 'cursor-pointer'}`}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.label}: {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ 3. CHART ═══ */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="analyse-chart">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Activite quotidienne</h4>
            <Tip label="Calcul" def={`Nombre de vehicules ayant enregistre >= ${threshold} km chaque jour, sur ${analytics.totalV} vehicules au total.`}><span /></Tip>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} barSize={32} onClick={(e) => { if (e?.activePayload?.[0]) setDay(e.activePayload[0].payload.date); }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#5E5E62' }} axisLine={false} tickLine={false} tickFormatter={v => { const d = new Date(v + 'T00:00:00'); return ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][d.getDay()]; }} />
              <YAxis tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} width={25} domain={[0, 'auto']} allowDecimals={false} />
              <RTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 11 }}
                formatter={(v, n, p) => [`${p.payload.active}/${p.payload.total} vehicules (${p.payload.pct}%)${p.payload.km ? ` — ${Math.round(p.payload.km)} km` : ''}`, '']}
                labelFormatter={(v, payload) => { const ds = payload?.[0]?.payload?.date; if (ds) { const dt = new Date(ds + 'T00:00:00'); return `${DN_FULL[dt.getDay()]} ${dt.getDate()} ${MOIS[dt.getMonth()]}`; } return v; }} />
              <ReferenceLine y={chartData.reduce((s, d) => s + d.active, 0) / (chartData.length || 1)} stroke="#999" strokeDasharray="4 4" strokeWidth={1} />
              <Bar dataKey="active" radius={[4, 4, 0, 0]} cursor="pointer">
                {chartData.map((d, i) => (
                  <Cell key={i} fill={filters.day === d.date ? '#111' : '#cbd5e1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Labels below */}
          <div className="flex justify-around mt-1 px-6">
            {chartData.map(d => (
              <button key={d.date} onClick={() => setDay(d.date)}
                className={`text-center transition-colors ${filters.day === d.date ? 'text-[#111] font-semibold' : 'text-gray-400 hover:text-gray-600'}`}>
                <div className="text-[10px]">{d.active}/{d.total}</div>
                <div className="text-[9px]">{d.pct}%</div>
              </button>
            ))}
          </div>
          <div className="text-[10px] text-gray-400 text-center mt-1">
            Moyenne periode : {avgPct}% ({Math.round(chartData.reduce((s, d) => s + d.active, 0) / (chartData.length || 1) * 10) / 10} vehicules/jour) — Cliquer une barre pour filtrer
          </div>
        </div>
      )}

      {/* ═══ 4. À RETENIR ═══ */}
      {insights.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="analyse-retenir">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">A retenir</div>
          <div className="space-y-1.5">
            {insights.map((ins, i) => (
              <div key={i} onClick={ins.action || undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg ${ins.action ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors`}
                data-testid={`retenir-${i}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#111] flex-shrink-0" />
                <span className="text-[13px] text-gray-700">{ins.text}</span>
                {ins.action && <ChevronDown size={12} className="text-gray-300 ml-auto -rotate-90 flex-shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ 5. TABLE ═══ */}
      <div ref={tableRef}>
        {/* Day filter banner */}
        {filters.day && (
          <div className="flex items-center gap-2 px-4 py-2.5 mb-3 bg-[#111] text-white rounded-xl text-xs font-medium" data-testid="day-filter-banner">
            <Clock size={13} />
            <span>Filtre actif : {dayLabel} — {dayFilterCount} vehicule{dayFilterCount > 1 ? 's' : ''}</span>
            <button onClick={clearDayFilter} className="ml-auto px-2 py-0.5 bg-white/20 rounded-lg hover:bg-white/30 text-[10px]">Reinitialiser</button>
          </div>
        )}

        {/* Filter buttons */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Rechercher..." value={filters.search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none w-48" data-testid="analyse-search" />
          </div>
          {[
            { id: 'all', label: 'Tous', count: vehicles.length },
            { id: 'used', label: 'Utilises', count: analytics.used },
            { id: 'inactif', label: 'Sans activite', count: analytics.inactive },
            { id: 'sous_utilise', label: 'Sous-utilise', count: catCounts.sous_utilise || 0 },
            { id: 'modere', label: 'Modere', count: catCounts.modere || 0 },
            { id: 'bonne', label: 'Bonne utilisation', count: catCounts.bonne || 0 },
            { id: 'tres_utilise', label: 'Forte utilisation', count: catCounts.tres_utilise || 0 },
          ].map(f => (
            <button key={f.id} onClick={() => { if (f.count > 0 || f.id === 'all') setFilters(prev => ({ ...prev, category: prev.category === f.id ? 'all' : f.id, day: null })); }}
              data-testid={`analyse-filter-${f.id}`}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                isActive(f.id) ? 'bg-[#111] text-white border-[#111]' : f.count === 0 && f.id !== 'all' ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-default' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid="analyse-table">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-800" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Vehicules ({filtered.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-100">
                {[
                  { col: 'label', label: 'Vehicule', cls: 'w-40' },
                  { col: 'utilization_pct', label: 'Utilisation' },
                  { col: 'active_days', label: 'Jours actifs' },
                  { col: 'period_mileage', label: 'Distance' },
                  { col: 'km_per_active_day', label: 'km/jour actif' },
                  { col: 'engine_hours', label: 'Moteur (total)', tip: 'Compteur cumulatif total du moteur. Non limite a la periode selectionnee. Donnee Navixy brute.' },
                ].map(h => (
                  <th key={h.col} onClick={() => toggleSort(h.col)} className={`px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-gray-400 cursor-pointer hover:text-gray-600 select-none ${h.cls || ''}`}>
                    <span className="flex items-center gap-1">{h.tip ? <Tip label={h.label} def={h.tip}><span>{h.label}</span></Tip> : h.label}{filters.sortBy === h.col && (filters.sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}</span>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-gray-400">
                  <Tip label="vs moy. flotte" def={`Ecart en points de pourcentage entre l'utilisation de ce vehicule et la moyenne flotte (${fleetAvg.util}%).`}>
                    <span>vs moy.</span>
                  </Tip>
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-gray-400">Categorie</th>
              </tr></thead>
              <tbody>
                {filtered.map(v => {
                  const cat = CAT_MAP[v.category] || CATEGORIES[0];
                  const ecart = Math.round((v.utilization_pct || 0) - fleetAvg.util);
                  return (
                    <tr key={v.tracker_id} className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer transition-colors"
                      onClick={() => setSelectedVehicle(v)} data-testid={`analyse-row-${v.tracker_id}`}>
                      <td className="px-3 py-2.5"><div className="text-sm font-medium text-gray-900 truncate max-w-[160px]">{v.label}</div><div className="text-[10px] text-gray-400">{v.model}</div></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-14 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, v.utilization_pct)}%`, backgroundColor: utilBarColor(v.utilization_pct) }} /></div>
                          <span className={`text-[11px] font-semibold tabular-nums ${utilTextCls(v.utilization_pct)}`}>{v.utilization_pct}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 tabular-nums">{v.active_days}/{v.total_days}</td>
                      <td className="px-3 py-2.5 text-xs font-medium text-gray-700 tabular-nums">{v.period_mileage} km</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 tabular-nums">{v.km_per_active_day > 0 ? v.km_per_active_day : '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 tabular-nums">
                        {(v.engine_hours || 0) > 0 ? `${v.engine_hours} h` : <Tip label="Moteur" def="Donnee non disponible pour ce vehicule"><span className="text-gray-300">—</span></Tip>}
                      </td>
                      <td className="px-3 py-2.5"><span className={`text-xs font-medium ${ecart > 0 ? 'text-emerald-600' : ecart < 0 ? 'text-red-500' : 'text-gray-400'}`}>{ecart > 0 ? '+' : ''}{ecart} pts</span></td>
                      <td className="px-3 py-2.5"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${cat.text} ${cat.border}`}><span className={`w-1.5 h-1.5 rounded-full ${cat.bg}`} />{cat.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">Aucun vehicule ne correspond aux filtres</div>}
        </div>
      </div>

      {/* ═══ DATA SOURCE ═══ */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-200">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-[10px] text-gray-500">Jour actif = distance &ge; {threshold} km. Seuils : sous-utilise (&lt;30%) | modere (30–59%) | bonne (60–84%) | forte (&ge;85%). Moteur = compteur cumulatif total. Donnees Navixy.</span>
      </div>

      {/* ═══ VEHICLE DRAWER ═══ */}
      {selectedVehicle && <VehicleDrawer vehicle={selectedVehicle} fleetAvg={fleetAvg} period={period} onClose={() => setSelectedVehicle(null)} />}
    </div>
  );
};
