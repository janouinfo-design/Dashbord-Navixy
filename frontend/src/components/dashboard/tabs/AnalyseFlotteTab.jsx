import React, { useState, useMemo } from "react";
import { DashboardDetailDrawer } from "@/components/shared/DashboardDetailDrawer";
import {
  Truck, MapPin, Zap, Search, ChevronDown, ChevronUp,
  Activity, AlertTriangle, TrendingUp, XCircle, Info, X,
  BarChart3, Clock
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer
} from "recharts";

// ─── Category config (centralized thresholds) ───
const CATEGORIES = [
  { id: "inactif", label: "Inactif", color: "bg-gray-400", text: "text-gray-600", border: "border-gray-300", def: "0% — aucune activite sur la periode" },
  { id: "sous_utilise", label: "Sous-utilise", color: "bg-red-500", text: "text-red-600", border: "border-red-300", def: "1% a 29% — activite faible" },
  { id: "modere", label: "Modere", color: "bg-amber-500", text: "text-amber-600", border: "border-amber-300", def: "30% a 59% — utilisation partielle" },
  { id: "bonne", label: "Bonne", color: "bg-emerald-500", text: "text-emerald-600", border: "border-emerald-300", def: "60% a 84% — bonne utilisation" },
  { id: "tres_utilise", label: "Forte", color: "bg-blue-500", text: "text-blue-600", border: "border-blue-300", def: "85% et plus — forte utilisation" },
];
const getCat = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[0];
const utilColor = (p) => p <= 0 ? 'bg-gray-300' : p < 30 ? 'bg-red-500' : p < 60 ? 'bg-amber-500' : p < 85 ? 'bg-emerald-500' : 'bg-blue-500';
const utilText = (p) => p <= 0 ? 'text-gray-400' : p < 30 ? 'text-red-600' : p < 60 ? 'text-amber-600' : p < 85 ? 'text-emerald-600' : 'text-blue-600';

// ─── Tooltip component ───
const DefTooltip = ({ label, def, children }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        {children}
        <button onClick={(e) => { e.stopPropagation(); setShow(!show); }} className="p-0.5 hover:bg-gray-100 rounded">
          <Info size={10} className={show ? 'text-[#111]' : 'text-gray-300'} />
        </button>
      </div>
      {show && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg border border-gray-200 shadow-lg p-3 w-56">
          <div className="flex justify-between mb-1"><span className="text-xs font-semibold">{label}</span>
            <button onClick={() => setShow(false)}><X size={12} className="text-gray-400" /></button></div>
          <p className="text-[10px] text-gray-600">{def}</p>
        </div>
      )}
    </div>
  );
};

// ─── Summary indicator ───
const AnalyticStat = ({ label, value, def, sub }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
    <div className="text-2xl font-semibold text-gray-900 tabular-nums" style={{ fontFamily: 'Outfit, sans-serif' }}>{value}</div>
    <DefTooltip label={label} def={def}>
      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{label}</span>
    </DefTooltip>
    {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
  </div>
);

// ─── Vehicle Detail Drawer ───
const VehicleDrawer = ({ vehicle, fleetAvg, period, onClose }) => {
  if (!vehicle) return null;
  const cat = getCat(vehicle.category);
  const daily = vehicle.daily_breakdown || [];
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  return (
    <DashboardDetailDrawer title={vehicle.label} subtitle={`${period.from || ''} au ${period.to || ''}`} onClose={onClose}>
      {/* 1. Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
        <div className="text-center"><div className="text-lg font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>{vehicle.utilization_pct}%</div><div className="text-[9px] text-gray-400 uppercase">Utilisation</div></div>
        <div className="text-center"><div className="text-lg font-semibold">{vehicle.active_days}/{vehicle.total_days}</div><div className="text-[9px] text-gray-400 uppercase">Jours actifs</div></div>
        <div className="text-center"><div className="text-lg font-semibold">{vehicle.period_mileage} km</div><div className="text-[9px] text-gray-400 uppercase">Distance</div></div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
        <div className="text-center"><div className="text-lg font-semibold">{vehicle.km_per_active_day || '—'}</div><div className="text-[9px] text-gray-400 uppercase">km/jour actif</div></div>
        <div className="text-center"><div className="text-lg font-semibold">{vehicle.engine_hours > 0 ? `${vehicle.engine_hours} h` : '—'}</div><div className="text-[9px] text-gray-400 uppercase">Moteur {vehicle.engine_hours > 0 ? '(total)' : ''}</div></div>
        <div className="text-center"><div className="text-lg font-semibold">{vehicle.connection_status === 'active' ? 'Oui' : 'Non'}</div><div className="text-[9px] text-gray-400 uppercase">Connecte</div></div>
      </div>
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium mb-4 ${cat.text} ${cat.border}`}>
        <span className={`w-2 h-2 rounded-full ${cat.color}`} />{cat.label} — {cat.def}
      </div>

      {/* 2. Fleet comparison */}
      <div className="mb-4">
        <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">vs moyenne flotte</div>
        <div className="bg-gray-50 rounded-xl p-3 space-y-2">
          {[
            { l: 'Utilisation', v: `${vehicle.utilization_pct}%`, avg: `${fleetAvg.util}%`, diff: Math.round(vehicle.utilization_pct - fleetAvg.util) },
            { l: 'Distance', v: `${vehicle.period_mileage} km`, avg: `${fleetAvg.km} km`, diff: null },
            ...(vehicle.engine_hours > 0 ? [{ l: 'Moteur', v: `${vehicle.engine_hours} h`, avg: `${fleetAvg.eh} h (total)`, diff: null }] : []),
          ].map(r => (
            <div key={r.l} className="flex items-center justify-between text-xs">
              <span className="text-gray-500">{r.l}</span>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{r.v}</span>
                <span className="text-gray-300">vs</span>
                <span className="text-gray-500">{r.avg}</span>
                {r.diff != null && <span className={`text-[10px] font-medium ${r.diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{r.diff >= 0 ? '+' : ''}{r.diff} pts</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Activity calendar */}
      {daily.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Activite par jour</div>
          <div className="grid grid-cols-7 gap-1">
            {daily.map(d => {
              const dt = new Date(d.date + 'T00:00:00');
              return (
                <div key={d.date} className={`rounded-lg p-2 text-center border ${d.active ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="text-[9px] text-gray-400">{dayNames[dt.getDay()]}</div>
                  <div className="text-[10px] font-mono text-gray-600">{dt.getDate()}</div>
                  <div className={`text-[10px] font-bold mt-0.5 ${d.active ? 'text-emerald-700' : 'text-gray-300'}`}>{d.active ? `${d.km} km` : '—'}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Daily chart */}
      {daily.length > 1 && (
        <div>
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Distance quotidienne</div>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={daily} barSize={18}>
              <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={false} tickLine={false}
                tickFormatter={v => dayNames[new Date(v + 'T00:00:00').getDay()]} />
              <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={28} />
              <RTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 11 }} formatter={v => [`${v} km`]} />
              <Bar dataKey="km" fill="#111" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardDetailDrawer>
  );
};

// ═══════════════ MAIN ═══════════════
export const AnalyseFlotteTab = ({ data, debugMode }) => {
  const { efficiency, trends } = data;
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('utilization_pct');
  const [sortDir, setSortDir] = useState('asc');
  const [search, setSearch] = useState('');

  const effData = efficiency || {};
  const vehicles = effData.vehicles || [];
  const summary = effData.summary || {};
  const period = effData.period || {};
  const trendData = trends?.trends || [];
  const catCounts = summary.categories || {};
  const threshold = effData.active_day_threshold_km || 1;

  // ─── Analytical metrics (NOT duplicating Vue gen.) ───
  const analytics = useMemo(() => {
    const used = summary.used_vehicles || 0;
    const inactive = summary.inactive_vehicles || 0;
    const sousUtilise = (catCounts.sous_utilise || 0);
    const fortUtilise = (catCounts.bonne || 0) + (catCounts.tres_utilise || 0);
    const totalKm = summary.total_mileage || 0;
    const kmPerUsed = used > 0 ? Math.round(totalKm / used) : 0;
    const withEh = vehicles.filter(v => (v.engine_hours || 0) > 0).length;
    const totalVehicles = summary.total_vehicles || 0;

    // Top vehicle share
    const topV = vehicles.length > 0 ? vehicles.reduce((b, v) => (v.period_mileage || 0) > (b.period_mileage || 0) ? v : b, vehicles[0]) : null;
    const topShare = topV && totalKm > 0 ? Math.round((topV.period_mileage / totalKm) * 100) : 0;

    // Full utilization count
    const fullUtil = vehicles.filter(v => v.utilization_pct >= 100 || (v.active_days === v.total_days && v.active_days > 0)).length;

    // Very low utilization (< 20%)
    const veryLow = vehicles.filter(v => v.utilization_pct > 0 && v.utilization_pct < 20).length;

    return { used, inactive, sousUtilise, fortUtilise, kmPerUsed, withEh, totalVehicles, topV, topShare, fullUtil, veryLow };
  }, [summary, catCounts, vehicles]);

  // Fleet averages for drawer
  const fleetAvg = useMemo(() => ({
    util: summary.average_utilization_pct || 0,
    km: summary.avg_mileage_per_vehicle || 0,
    eh: summary.avg_engine_hours_per_vehicle || 0,
  }), [summary]);

  // Utilization over time
  const utilChart = useMemo(() => {
    const total = summary.total_vehicles || 1;
    return trendData.map(t => ({
      date: t.date, day_name: t.day_name,
      pct: Math.round((t.active_vehicles / total) * 100),
      active: t.active_vehicles, total,
    }));
  }, [trendData, summary.total_vehicles]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = [...vehicles];
    if (search) list = list.filter(v => v.label.toLowerCase().includes(search.toLowerCase()));
    if (filter === 'used') list = list.filter(v => v.active_days > 0);
    if (filter === 'inactif') list = list.filter(v => v.category === 'inactif');
    if (filter === 'sous_utilise') list = list.filter(v => v.category === 'sous_utilise');
    if (filter === 'modere') list = list.filter(v => v.category === 'modere');
    if (filter === 'bonne' || filter === 'fort') list = list.filter(v => v.category === 'bonne' || v.category === 'tres_utilise');
    if (filter === 'tres_utilise') list = list.filter(v => v.category === 'tres_utilise');
    list.sort((a, b) => {
      const va = a[sortBy] ?? 0, vb = b[sortBy] ?? 0;
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
    return list;
  }, [vehicles, filter, sortBy, sortDir, search]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir(col === 'utilization_pct' ? 'asc' : 'desc'); }
  };

  const renderSortTh = (col, label, cls) => (
    <th key={col} onClick={() => toggleSort(col)} className={`px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-gray-400 cursor-pointer hover:text-gray-600 select-none ${cls || ''}`}>
      <span className="flex items-center gap-1">{label}{sortBy === col && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}</span>
    </th>
  );

  // ─── Insights (actionable, NOT repeating KPIs) ───
  const insights = useMemo(() => {
    const list = [];
    if (analytics.inactive > 0)
      list.push({ text: `${analytics.inactive} vehicule${analytics.inactive > 1 ? 's' : ''} sans aucune activite sur ${period.days || 7} jours`, icon: XCircle, color: 'text-red-500', filter: 'inactif' });
    if (analytics.topV && analytics.topShare >= 25)
      list.push({ text: `${analytics.topV.label} represente ${analytics.topShare}% de la distance totale`, icon: TrendingUp, color: 'text-blue-500' });
    if (analytics.veryLow > 0)
      list.push({ text: `${analytics.veryLow} vehicule${analytics.veryLow > 1 ? 's ont' : ' a'} une utilisation inferieure a 20%`, icon: AlertTriangle, color: 'text-amber-500', filter: 'sous_utilise' });
    if (analytics.fullUtil > 0)
      list.push({ text: `${analytics.fullUtil} vehicule${analytics.fullUtil > 1 ? 's' : ''} actif${analytics.fullUtil > 1 ? 's' : ''} chaque jour de la periode`, icon: Activity, color: 'text-emerald-500', filter: 'fort' });
    if (analytics.withEh < analytics.totalVehicles && analytics.totalVehicles > 0)
      list.push({ text: `Heures moteur disponibles pour ${analytics.withEh}/${analytics.totalVehicles} vehicules`, icon: Zap, color: 'text-gray-400' });
    return list;
  }, [analytics, period.days]);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-[1600px] mx-auto" data-testid="analyse-flotte-tab">

      {/* ═══ ANALYTICAL SUMMARY (not duplicating Vue gen.) ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <AnalyticStat label="Vehicules utilises" value={`${analytics.used} / ${analytics.totalVehicles}`}
          def={`Vehicule ayant eu au moins 1 jour d'activite (distance >= ${threshold} km) sur la periode selectionnee`} />
        <AnalyticStat label="Sans activite" value={analytics.inactive}
          def="Vehicule avec 0 km enregistre sur toute la periode" />
        <AnalyticStat label="Sous-utilises" value={analytics.sousUtilise}
          def="Utilisation entre 1% et 29% — activite faible par rapport a la periode" />
        <AnalyticStat label="Fortement utilises" value={analytics.fortUtilise}
          def="Utilisation >= 60% — vehicules avec une activite reguliere" />
        <AnalyticStat label="Km moy. / vehicule utilise" value={`${analytics.kmPerUsed}`}
          def="Distance totale divisee par le nombre de vehicules ayant roule (exclut les vehicules inactifs du calcul)"
          sub="km" />
      </div>

      {/* ═══ CATEGORY BAR (interactive) ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-3">Repartition des vehicules</div>
        <div className="flex h-8 rounded-lg overflow-hidden border border-gray-200 cursor-pointer">
          {CATEGORIES.filter(c => (catCounts[c.id] || 0) > 0).map(c => (
            <div key={c.id} onClick={() => setFilter(filter === c.id ? 'all' : c.id)}
              className={`${c.color} flex items-center justify-center text-white text-[10px] font-bold transition-all hover:opacity-80 ${filter === c.id ? 'ring-2 ring-offset-1 ring-gray-800' : ''}`}
              style={{ width: `${((catCounts[c.id] || 0) / (analytics.totalVehicles || 1)) * 100}%` }}
              title={`${c.label}: ${catCounts[c.id]} — Cliquer pour filtrer`}
              data-testid={`cat-bar-${c.id}`}>
              {catCounts[c.id]}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mt-2.5">
          {CATEGORIES.map(c => {
            const n = catCounts[c.id] || 0;
            if (n === 0) return null;
            return (
              <button key={c.id} onClick={() => setFilter(filter === c.id ? 'all' : c.id)}
                className={`flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border transition-colors ${filter === c.id ? 'bg-gray-100 border-gray-400 font-semibold' : 'border-transparent'}`}>
                <span className={`w-2 h-2 rounded-full ${c.color}`} />{c.label}: {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ CHART — Vehicules utilises par jour ═══ */}
      {utilChart.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Vehicules utilises par jour (%)</h4>
            <DefTooltip label="Calcul" def={`Pourcentage des vehicules ayant enregistre une activite (>= ${threshold} km) au cours de chaque journee, sur ${analytics.totalVehicles} vehicules.`}>
              <span />
            </DefTooltip>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={utilChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="day_name" tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} width={35} unit="%" domain={[0, 100]} />
              <RTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 11 }}
                formatter={(v, n, p) => [`${v}% (${p.payload.active}/${p.payload.total} vehicules)`, '']}
                labelFormatter={(v, payload) => payload?.[0]?.payload?.date || v} />
              <Area type="monotone" dataKey="pct" stroke="#111" fill="#f3f4f6" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ═══ FILTERS + SEARCH ═══ */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Rechercher un vehicule..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none w-52" data-testid="analyse-search" />
        </div>
        {[
          { id: 'all', label: 'Tous', count: vehicles.length },
          { id: 'used', label: 'Utilises', count: analytics.used },
          { id: 'inactif', label: 'Sans activite', count: analytics.inactive },
          { id: 'sous_utilise', label: 'Sous-utilises', count: analytics.sousUtilise },
          { id: 'fort', label: 'Fortement utilises', count: analytics.fortUtilise },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} data-testid={`analyse-filter-${f.id}`}
            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
              filter === f.id ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* ═══ VEHICLE TABLE ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid="analyse-table">
        <div className="px-6 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-800" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Utilisation des vehicules ({filtered.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100">
              {renderSortTh("label", "Vehicule", "w-40")}
              {renderSortTh("utilization_pct", "Utilisation")}
              {renderSortTh("active_days", "Jours actifs")}
              {renderSortTh("period_mileage", "Distance")}
              {renderSortTh("km_per_active_day", "km/jour actif")}
              {renderSortTh("engine_hours", "Moteur (h)")}
              <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-gray-400">
                <DefTooltip label="vs moy. flotte" def={`Ecart en points de pourcentage par rapport a l'utilisation moyenne de la flotte (${fleetAvg.util}%)`}>
                  <span>vs moy. flotte</span>
                </DefTooltip>
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-gray-400">Categorie</th>
            </tr></thead>
            <tbody>
              {filtered.map(v => {
                const cat = getCat(v.category);
                const ecart = Math.round((v.utilization_pct || 0) - fleetAvg.util);
                return (
                  <tr key={v.tracker_id} className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer transition-colors"
                    onClick={() => setSelectedVehicle(v)} data-testid={`analyse-row-${v.tracker_id}`}>
                    <td className="px-3 py-2.5">
                      <div className="text-sm font-medium text-gray-900 truncate max-w-[160px]">{v.label}</div>
                      <div className="text-[10px] text-gray-400">{v.model}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${utilColor(v.utilization_pct)}`} style={{ width: `${Math.min(100, v.utilization_pct)}%` }} />
                        </div>
                        <span className={`text-xs font-semibold tabular-nums ${utilText(v.utilization_pct)}`}>{v.utilization_pct}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{v.active_days}/{v.total_days}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-700 tabular-nums">{v.period_mileage} km</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 tabular-nums">{v.km_per_active_day || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 tabular-nums">{(v.engine_hours || 0) > 0 ? v.engine_hours : '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs font-medium ${ecart > 0 ? 'text-emerald-600' : ecart < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {ecart > 0 ? '+' : ''}{ecart} pts
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${cat.text} ${cat.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cat.color}`} />{cat.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">Aucun vehicule ne correspond aux filtres</div>}
      </div>

      {/* ═══ INSIGHTS (actionable) ═══ */}
      {insights.length > 0 && (
        <div className="space-y-2" data-testid="analyse-insights">
          {insights.map((ins, idx) => (
            <div key={idx} onClick={() => ins.filter && setFilter(ins.filter)}
              className={`flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200 ${ins.filter ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors`}
              data-testid={`analyse-insight-${idx}`}>
              <ins.icon size={15} className={`flex-shrink-0 ${ins.color}`} />
              <span className="text-[13px] text-gray-700">{ins.text}</span>
              {ins.filter && <ChevronDown size={13} className="text-gray-300 ml-auto flex-shrink-0 -rotate-90" />}
            </div>
          ))}
        </div>
      )}

      {/* ═══ DATA SOURCE ═══ */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-200">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-[10px] text-gray-500">
          Jour actif = distance &ge; {threshold} km. Categories : inactif (0%) | sous-utilise (&lt;30%) | modere (30-59%) | bonne (60-84%) | forte (&ge;85%). Donnees Navixy.
        </span>
      </div>

      {/* ═══ VEHICLE DRAWER ═══ */}
      {selectedVehicle && (
        <VehicleDrawer vehicle={selectedVehicle} fleetAvg={fleetAvg} period={period} onClose={() => setSelectedVehicle(null)} />
      )}
    </div>
  );
};
