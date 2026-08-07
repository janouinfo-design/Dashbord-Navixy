import React, { useState, useMemo, useRef, useEffect } from "react";
import { API, api } from "@/lib/api";
import { DashboardDetailDrawer } from "@/components/shared/DashboardDetailDrawer";
import {
  Truck, Search, ChevronDown, ChevronUp, AlertTriangle, Info, X,
  Clock, Gauge, Fuel, Scale, Leaf
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
const utilBarColor = (p) => p <= 0 ? '#d1d5db' : p < 30 ? '#EF4444' : p < 60 ? '#F59E0B' : p < 85 ? '#10B981' : '#3B82F6';
const utilTextCls = (p) => p <= 0 ? 'text-gray-400' : p < 30 ? 'text-red-600' : p < 60 ? 'text-amber-600' : p < 85 ? 'text-emerald-600' : 'text-blue-600';
const DN_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
const DN = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

// ═══ Tooltip helper ═══
const Tip = ({ label, def, children }) => {
  const [s, setS] = useState(false);
  return (
    <span className="relative inline-flex items-center gap-0.5">
      {children}
      <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setS(!s); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setS(!s); } }} className="p-0.5 hover:bg-gray-100 rounded cursor-pointer"><Info size={10} className={s ? 'text-[#111]' : 'text-gray-300'} /></span>
      {s && <span className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg border border-gray-200 shadow-lg p-2.5 w-52 text-left">
        <span className="flex justify-between mb-0.5"><span className="text-[11px] font-semibold">{label}</span><span role="button" tabIndex={0} onClick={() => setS(false)} className="cursor-pointer"><X size={11} className="text-gray-400" /></span></span>
        <span className="text-[10px] text-gray-600 block">{def}</span>
      </span>}
    </span>
  );
};

// ═══ Vehicle Drawer (inchangé — validé iter 9) ═══
const VehicleDrawer = ({ vehicle, fleetAvg, period, onClose }) => {
  if (!vehicle) return null;
  const cat = CAT_MAP[vehicle.category] || CATEGORIES[0];
  const daily = vehicle.daily_breakdown || [];
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

      {daily.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Activite par jour</div>
          <div className="grid grid-cols-7 gap-1">
            {daily.map(d => {
              const dt = new Date(d.date + 'T00:00:00');
              return (
                <div key={d.date} className={`rounded-lg p-1.5 text-center border ${d.active ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="text-[8px] text-gray-400">{DN[dt.getDay()]}</div>
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
              <XAxis dataKey="date" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} tickFormatter={v => DN[new Date(v + 'T00:00:00').getDay()]} />
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
export const AnalyseFlotteTab = ({ data, fromDate, toDate }) => {
  const { efficiency, stats } = data;
  const tableRef = useRef(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [groups, setGroups] = useState([]);
  const [groupFilter, setGroupFilter] = useState('all');

  // ─── SINGLE FILTER STATE (validé iter 9) ───
  const [filters, setFilters] = useState({ category: 'all', day: null, search: '', sortBy: 'utilization_pct', sortDir: 'asc' });

  const setCategory = (cat) => { setFilters(f => ({ ...f, category: f.category === cat ? 'all' : cat, day: null })); scrollToTable(); };
  const setDay = (day) => { setFilters(f => ({ ...f, day: f.day === day ? null : day, category: 'all' })); scrollToTable(); };
  const setSearch = (s) => setFilters(f => ({ ...f, search: s }));
  const clearDayFilter = () => setFilters(f => ({ ...f, day: null }));
  const toggleSort = (col) => setFilters(f => f.sortBy === col ? { ...f, sortDir: f.sortDir === 'asc' ? 'desc' : 'asc' } : { ...f, sortBy: col, sortDir: (col === 'utilization_pct' || col === 'label') ? 'asc' : 'desc' });
  const scrollToTable = () => setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

  const effData = efficiency || {};
  const allVehicles = effData.vehicles || [];
  const period = effData.period || {};
  const threshold = effData.active_day_threshold_km || 1;

  // ─── Groupes LOGITRAK réels ───
  useEffect(() => {
    api.get(`${API}/groups`).then(res => { if (res.data.success) setGroups(res.data.groups || []); }).catch(() => setGroups([]));
  }, []);
  const usedGroupIds = useMemo(() => new Set(allVehicles.map(v => v.group_id || 0)), [allVehicles]);
  const groupOptions = useMemo(() => {
    const opts = groups.filter(g => usedGroupIds.has(g.id));
    if (usedGroupIds.has(0)) opts.push({ id: 0, title: 'Sans groupe' });
    return opts;
  }, [groups, usedGroupIds]);

  // Reset stale group filter if the group disappears from current period options
  useEffect(() => {
    if (groupFilter !== 'all' && !groupOptions.some(g => g.id === groupFilter)) setGroupFilter('all');
  }, [groupOptions, groupFilter]);

  // ─── Scope = véhicules du groupe sélectionné ───
  const vehicles = useMemo(() =>
    groupFilter === 'all' ? allVehicles : allVehicles.filter(v => (v.group_id || 0) === groupFilter),
    [allVehicles, groupFilter]);

  // ─── Analytics (calculés sur le scope) ───
  const analytics = useMemo(() => {
    const totalV = vehicles.length;
    const used = vehicles.filter(v => v.active_days > 0).length;
    const inactive = totalV - used;
    const catCounts = {};
    CATEGORIES.forEach(c => { catCounts[c.id] = vehicles.filter(v => v.category === c.id).length; });
    const totalKm = Math.round(vehicles.reduce((s, v) => s + (v.period_mileage || 0), 0) * 10) / 10;
    const kmPerUsed = used > 0 ? Math.round(totalKm / used) : 0;
    const withEh = vehicles.filter(v => (v.engine_hours || 0) > 0).length;
    const topV = vehicles.length > 0 ? vehicles.reduce((b, v) => (v.period_mileage || 0) > (b.period_mileage || 0) ? v : b, vehicles[0]) : null;
    const topShare = topV && totalKm > 0 ? Math.round((topV.period_mileage / totalKm) * 100) : 0;
    return { totalV, used, inactive, catCounts, totalKm, kmPerUsed, withEh, topV, topShare };
  }, [vehicles]);

  const catCounts = analytics.catCounts;

  const fleetAvg = useMemo(() => {
    const n = vehicles.length || 1;
    return {
      util: Math.round(vehicles.reduce((s, v) => s + (v.utilization_pct || 0), 0) / n * 10) / 10,
      km: Math.round(analytics.totalKm / n * 10) / 10,
      eh: Math.round(vehicles.reduce((s, v) => s + (v.engine_hours || 0), 0) / n * 10) / 10,
    };
  }, [vehicles, analytics.totalKm]);

  // ─── Chart : véhicules actifs / jour (depuis daily_breakdown du scope) ───
  const chartData = useMemo(() => {
    const map = {};
    vehicles.forEach(v => (v.daily_breakdown || []).forEach(db => {
      if (!map[db.date]) map[db.date] = { date: db.date, active: 0, km: 0 };
      if (db.active) map[db.date].active += 1;
      map[db.date].km += db.km;
    }));
    const total = vehicles.length || 1;
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ ...d, total, pct: Math.round((d.active / total) * 100), km: Math.round(d.km * 10) / 10 }));
  }, [vehicles]);

  const avgActive = chartData.length > 0 ? chartData.reduce((s, d) => s + d.active, 0) / chartData.length : 0;
  const avgPct = chartData.length > 0 ? Math.round(chartData.reduce((s, d) => s + d.pct, 0) / chartData.length) : 0;
  const bestDays = useMemo(() => {
    if (chartData.length === 0) return [];
    const maxA = Math.max(...chartData.map(d => d.active));
    return maxA > 0 ? chartData.filter(d => d.active === maxA) : [];
  }, [chartData]);

  // ─── Score éco moyen du parc (rappel minimal — LOGITRAK plugin 46) ───
  const [eco, setEco] = useState({ loading: true, scores: null });
  useEffect(() => {
    let cancelled = false;
    setEco({ loading: true, scores: null });
    api.get(`${API}/drivers/ecodriving`, { params: { from_date: fromDate, to_date: toDate }, timeout: 120000 })
      .then(res => {
        if (cancelled || !res.data.success) { if (!cancelled) setEco({ loading: false, scores: null }); return; }
        const scores = [
          ...(res.data.drivers || []).filter(d => d.score && d.tracker_id).map(d => ({ tracker_id: d.tracker_id, raw: d.score.raw })),
          ...(res.data.unassigned_vehicles || []).filter(v => v.score).map(v => ({ tracker_id: v.tracker_id, raw: v.score.raw })),
        ];
        setEco({ loading: false, scores });
      })
      .catch(() => { if (!cancelled) setEco({ loading: false, scores: null }); });
    return () => { cancelled = true; };
  }, [fromDate, toDate]);

  const ecoAvg = useMemo(() => {
    if (!eco.scores) return null;
    const scopeIds = new Set(vehicles.map(v => v.tracker_id));
    const inScope = eco.scores.filter(s => scopeIds.has(s.tracker_id));
    if (inScope.length === 0) return null;
    return { avg: Math.round(inScope.reduce((s, x) => s + x.raw, 0) / inScope.length), n: inScope.length };
  }, [eco.scores, vehicles]);

  // ─── Synthèse carburant (uniquement dérivée des km + config) ───
  const fuel = useMemo(() => {
    const scopeIds = new Set(vehicles.map(v => v.tracker_id));
    const sv = (stats?.vehicles || []).filter(v => scopeIds.has(v.tracker_id));
    const available = sv.some(v => v.fuel_cost_chf !== null && v.fuel_cost_chf !== undefined);
    const liters = Math.round(sv.reduce((s, v) => s + (v.fuel_used_liters || 0), 0) * 10) / 10;
    const chf = Math.round(sv.reduce((s, v) => s + (v.fuel_cost_chf || 0), 0));
    return { available, liters, chf };
  }, [stats, vehicles]);

  // ─── Recommandations déterministes ───
  const recos = useMemo(() => {
    const list = [];
    const strong = vehicles.filter(v => v.category === 'tres_utilise');
    const low = vehicles.filter(v => v.category === 'sous_utilise');
    if (strong.length > 0 && low.length > 0)
      list.push({
        icon: Scale, tag: 'Equilibrage',
        text: `Reequilibrer la charge : ${strong.map(v => v.label).slice(0, 2).join(', ')} (forte utilisation ≥ 85%) vs ${low.map(v => v.label).slice(0, 2).join(', ')} (sous-utilise < 30%)`,
        action: () => setCategory('tres_utilise'),
      });
    if (analytics.inactive > 0)
      list.push({
        icon: Truck, tag: 'Reduction',
        text: `${analytics.inactive} vehicule${analytics.inactive > 1 ? 's' : ''} sans activite sur ${period.days || '—'} jours — evaluer restitution ou reaffectation`,
        action: () => setCategory('inactif'),
      });
    if (analytics.topV && analytics.topShare >= 25)
      list.push({
        icon: AlertTriangle, tag: 'Concentration',
        text: `${analytics.topV.label} represente ${analytics.topShare}% de la distance totale du parc`,
        action: () => setSelectedVehicle(vehicles.find(v => v.tracker_id === analytics.topV?.tracker_id)),
      });
    if (bestDays.length > 0 && bestDays[0].active > 1) {
      const names = bestDays.map(d => DN[new Date(d.date + 'T00:00:00').getDay()]);
      list.push({
        icon: Clock, tag: 'Charge',
        text: `${names.join(' et ')} : pic d'activite (${bestDays[0].active}/${analytics.totalV} vehicules)`,
        action: () => setDay(bestDays[0].date),
      });
    }
    if (analytics.withEh < analytics.totalV && analytics.withEh > 0)
      list.push({ icon: Info, tag: 'Donnees', text: `Donnees moteur disponibles pour ${analytics.withEh}/${analytics.totalV} vehicules`, action: null });
    return list.slice(0, 5);
  }, [vehicles, analytics, period.days, bestDays]);

  // ─── Filtered vehicles (table) ───
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

  const dayFilterCount = useMemo(() => {
    if (!filters.day) return 0;
    return vehicles.filter(v => (v.daily_breakdown || []).some(d => d.date === filters.day && d.active)).length;
  }, [vehicles, filters.day]);

  const isActive = (cat) => filters.category === cat && !filters.day;
  const dayLabel = filters.day ? (() => { const d = new Date(filters.day + 'T00:00:00'); return `${DN_FULL[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`; })() : null;
  const usedPct = analytics.totalV > 0 ? Math.round((analytics.used / analytics.totalV) * 1000) / 10 : 0;
  const catPct = (id) => analytics.totalV > 0 ? Math.round(((catCounts[id] || 0) / analytics.totalV) * 100) : 0;

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-[1600px] mx-auto" data-testid="analyse-flotte-tab">

      {/* ═══ EN-TÊTE DE PAGE ═══ */}
      <div className="flex flex-wrap items-end justify-between gap-3" data-testid="analyse-header">
        <div>
          <h2 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Analyse d'utilisation de la flotte</h2>
          <p className="text-xs text-gray-400 mt-0.5">Performance operationnelle et arbitrage de charge — {analytics.totalV} vehicule{analytics.totalV > 1 ? 's' : ''}{groupFilter !== 'all' ? ` (groupe filtre)` : ''}</p>
        </div>
        {groupOptions.length > 1 && (
          <select value={groupFilter === 'all' ? 'all' : String(groupFilter)}
            onChange={(e) => setGroupFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none cursor-pointer"
            data-testid="group-filter">
            <option value="all">Tous les groupes</option>
            {groupOptions.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        )}
      </div>

      {/* ═══ ZONE 1 — MÉTRIQUES D'ARBITRAGE ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" data-testid="analyse-summary">
        {/* Flotte active vs dormante */}
        <button onClick={() => setCategory('used')} data-testid="kpi-used"
          className={`bg-white rounded-xl border p-3.5 text-left transition-all hover:shadow-sm ${isActive('used') ? 'ring-2 ring-[#111]' : 'border-gray-200'}`}>
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Flotte active vs dormante</div>
          <div className="text-xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>{usedPct}%</div>
          <div className="text-[10px] text-gray-400">{analytics.used} / {analytics.totalV} vehicules</div>
          {analytics.inactive > 0 && (
            <span onClick={(e) => { e.stopPropagation(); setCategory('inactif'); }} data-testid="kpi-inactive"
              className={`inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-semibold border ${isActive('inactif') ? 'bg-[#111] text-white border-[#111]' : 'bg-red-50 text-red-600 border-red-100'}`}>
              <AlertTriangle size={9} />{analytics.inactive} immobile{analytics.inactive > 1 ? 's' : ''} (0 km)
            </span>
          )}
        </button>

        {/* 4 catégories utilisées */}
        {['sous_utilise', 'modere', 'bonne', 'tres_utilise'].map(cid => {
          const c = CAT_MAP[cid];
          const count = catCounts[cid] || 0;
          return (
            <button key={cid} onClick={() => count > 0 && setCategory(cid)} data-testid={`kpi-cat-${cid}`} disabled={count === 0}
              className={`bg-white rounded-xl border p-3.5 text-left transition-all ${isActive(cid) ? 'ring-2 ring-[#111]' : 'border-gray-200'} ${count > 0 ? 'cursor-pointer hover:shadow-sm' : 'opacity-50 cursor-default'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-2 h-2 rounded-full ${c.bg}`} />
                <Tip label={c.label} def={`${c.seuil} — ${c.def}`}>
                  <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{c.label}</span>
                </Tip>
              </div>
              <div className="text-xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>{count} <span className="text-xs font-normal text-gray-400">({catPct(cid)}%)</span></div>
              <div className="text-[10px] text-gray-400">{c.seuil} des jours actifs</div>
            </button>
          );
        })}

        {/* Intensité kilométrique */}
        <div className="bg-white rounded-xl border border-gray-200 p-3.5" data-testid="kpi-intensity">
          <div className="flex items-center gap-1 mb-1">
            <Gauge size={11} className="text-gray-400" />
            <Tip label="Intensite kilometrique" def={`Distance totale (${Math.round(analytics.totalKm)} km) divisee par le nombre de vehicules actifs (${analytics.used}). Exclut les vehicules sans activite.`}>
              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Intensite km moy.</span>
            </Tip>
          </div>
          <div className="text-xl font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>{analytics.kmPerUsed} <span className="text-xs font-normal text-gray-400">km/actif</span></div>
          <div className="text-[10px] text-gray-400">Volume total : {Math.round(analytics.totalKm).toLocaleString('fr-FR')} km</div>
        </div>
      </div>

      {/* ═══ ZONE 2 — SEGMENTATION & ACTIVITÉ ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Structure d'utilisation */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-4" data-testid="analyse-bar">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Structure d'utilisation du parc</div>
          <div className="flex h-7 rounded-lg overflow-hidden border border-gray-200 mb-3">
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
          <div className="space-y-1.5">
            {CATEGORIES.map(c => {
              const n = catCounts[c.id] || 0;
              return (
                <button key={c.id} onClick={() => n > 0 && setCategory(c.id)}
                  className={`w-full flex items-center justify-between text-[11px] px-2 py-1.5 rounded-lg border transition-colors ${isActive(c.id) ? 'bg-gray-100 border-gray-300 font-semibold' : 'border-transparent hover:bg-gray-50'} ${n === 0 ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}>
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
                    <span className="text-gray-600">{c.label}</span>
                    <span className="text-gray-300">{c.seuil}</span>
                  </span>
                  <span className="font-semibold tabular-nums" style={{ fontFamily: 'Outfit, sans-serif' }}>{n} ({catPct(c.id)}%)</span>
                </button>
              );
            })}
          </div>
          <div className="text-[9px] text-gray-400 mt-3">Legende interactive — clic = filtre la table</div>
        </div>

        {/* Activité du parc */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-8" data-testid="analyse-chart">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Activite du parc (vehicules actifs / jour)</h4>
            <Tip label="Calcul" def={`Nombre de vehicules ayant enregistre >= ${threshold} km chaque jour, sur ${analytics.totalV} vehicules au total.`}><span /></Tip>
          </div>
          {chartData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} barSize={32} onClick={(e) => { if (e?.activePayload?.[0]) setDay(e.activePayload[0].payload.date); }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#5E5E62' }} axisLine={false} tickLine={false} tickFormatter={v => DN[new Date(v + 'T00:00:00').getDay()]} />
                  <YAxis tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} width={25} domain={[0, 'auto']} allowDecimals={false} />
                  <RTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 11 }}
                    formatter={(v, n, p) => [`${p.payload.active}/${p.payload.total} vehicules (${p.payload.pct}%)${p.payload.km ? ` — ${Math.round(p.payload.km)} km` : ''}`, '']}
                    labelFormatter={(v, payload) => { const ds = payload?.[0]?.payload?.date; if (ds) { const dt = new Date(ds + 'T00:00:00'); return `${DN_FULL[dt.getDay()]} ${dt.getDate()} ${MOIS[dt.getMonth()]}`; } return v; }} />
                  <ReferenceLine y={avgActive} stroke="#999" strokeDasharray="4 4" strokeWidth={1} />
                  <Bar dataKey="active" radius={[4, 4, 0, 0]} cursor="pointer">
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={filters.day === d.date ? '#111' : utilBarColor(d.pct)} fillOpacity={filters.day === d.date ? 1 : 0.75} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
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
                Moyenne periode : {avgPct}% ({Math.round(avgActive * 10) / 10} vehicules/jour) — Couleur = intensite journaliere — Cliquer une barre pour filtrer
              </div>
            </>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-xs text-gray-400">Aucune donnee quotidienne sur la periode</div>
          )}
        </div>
      </div>

      {/* ═══ ZONE 3 — ARBITRAGE & PLAN D'ACTION ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recommandations */}
        <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="analyse-recos">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Recommandations d'optimisation du parc</div>
          <div className="space-y-1.5">
            {recos.map((r, i) => (
              <div key={i} onClick={r.action || undefined}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-lg bg-gray-50 ${r.action ? 'cursor-pointer hover:bg-gray-100' : ''} transition-colors`}
                data-testid={`reco-${i}`}>
                <r.icon size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">{r.tag}</span>
                  <div className="text-[12px] text-gray-700">{r.text}</div>
                </div>
                {r.action && <ChevronDown size={12} className="text-gray-300 ml-auto -rotate-90 shrink-0 mt-1" />}
              </div>
            ))}
            {/* Score éco moyen du parc */}
            <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100" data-testid="reco-eco">
              <Leaf size={14} className="text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-600">Eco-conduite</span>
                <div className="text-[12px] text-gray-700">
                  {eco.loading ? "Score eco du parc : calcul en cours (rapport LOGITRAK)…"
                    : ecoAvg ? <>Score eco moyen du parc : <strong>{ecoAvg.avg}/100</strong> — moyenne des notations LOGITRAK (plugin 46) sur {ecoAvg.n} vehicule{ecoAvg.n > 1 ? 's' : ''} avec donnees</>
                      : "Score eco indisponible sur la periode (aucune notation LOGITRAK)"}
                </div>
              </div>
            </div>
          </div>
          <div className="text-[9px] text-gray-400 mt-3">Regles deterministes sur donnees reelles — aucun montant ou pourcentage estime</div>
        </div>

        {/* Synthèse carburant */}
        <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="analyse-fuel">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Synthese d'impact carburant / kilometrage (CHF)</div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <div className="text-lg font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>{Math.round(analytics.totalKm).toLocaleString('fr-FR')}</div>
              <div className="text-[9px] text-gray-400 uppercase">km parcourus</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <div className="text-lg font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>{fuel.available ? `${fuel.liters}` : '—'}</div>
              <div className="text-[9px] text-gray-400 uppercase">Litres estimes</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <div className={`text-lg font-semibold ${fuel.available ? 'text-red-500' : ''}`} style={{ fontFamily: 'Outfit, sans-serif' }}>{fuel.available ? `${fuel.chf}` : '—'}</div>
              <div className="text-[9px] text-gray-400 uppercase">CHF carburant</div>
            </div>
          </div>
          {fuel.available ? (
            <div className="text-[10px] text-gray-400 flex items-center gap-1.5">
              <Fuel size={11} />Calcul : km reels LOGITRAK × taux de consommation configure × prix CHF. Aucune perte de ralenti estimee — historique ralenti non disponible.
            </div>
          ) : (
            <div className="text-[10px] text-gray-400">
              Consommation et cout indisponibles — aucun taux de consommation configure. Aucune valeur estimee ne sera affichee sans configuration.
            </div>
          )}
        </div>
      </div>

      {/* ═══ TABLE (validée iter 9) ═══ */}
      <div ref={tableRef}>
        {filters.day && (
          <div className="flex items-center gap-2 px-4 py-2.5 mb-3 bg-[#111] text-white rounded-xl text-xs font-medium" data-testid="day-filter-banner">
            <Clock size={13} />
            <span>Filtre actif : {dayLabel} — {dayFilterCount} vehicule{dayFilterCount > 1 ? 's' : ''}</span>
            <button onClick={clearDayFilter} className="ml-auto px-2 py-0.5 bg-white/20 rounded-lg hover:bg-white/30 text-[10px]">Reinitialiser</button>
          </div>
        )}

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
                  { col: 'engine_hours', label: 'Moteur (total)', tip: 'Compteur cumulatif total du moteur. Non limite a la periode selectionnee. Donnee LOGITRAK brute.' },
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
        <span className="text-[10px] text-gray-500">Jour actif = distance &ge; {threshold} km. Seuils : sous-utilise (&lt;30%) | modere (30–59%) | bonne (60–84%) | forte (&ge;85%). Moteur = compteur cumulatif total. Groupes = tracker/group/list LOGITRAK. Donnees LOGITRAK.</span>
      </div>

      {/* ═══ VEHICLE DRAWER ═══ */}
      {selectedVehicle && <VehicleDrawer vehicle={selectedVehicle} fleetAvg={fleetAvg} period={period} onClose={() => setSelectedVehicle(null)} />}
    </div>
  );
};
