import React, { useState, useMemo } from "react";
import { KPICard } from "@/components/shared/UIComponents";
import { DashboardDetailDrawer } from "@/components/shared/DashboardDetailDrawer";
import {
  Gauge, MapPin, Truck, Zap, Clock, Activity, Search,
  ChevronDown, ChevronUp, Navigation, Filter, CheckCircle,
  AlertTriangle, XCircle, TrendingUp, Info, X
} from "lucide-react";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";

// ─── Category config (centralized) ───
const CATEGORIES = [
  { id: "inactif", label: "Inactif", color: "bg-gray-400", text: "text-gray-600", border: "border-gray-300", min: 0, max: 0 },
  { id: "sous_utilise", label: "Sous-utilise", color: "bg-red-500", text: "text-red-600", border: "border-red-300", min: 0.01, max: 30 },
  { id: "modere", label: "Modere", color: "bg-amber-500", text: "text-amber-600", border: "border-amber-300", min: 30, max: 60 },
  { id: "bonne", label: "Bonne", color: "bg-emerald-500", text: "text-emerald-600", border: "border-emerald-300", min: 60, max: 85 },
  { id: "tres_utilise", label: "Tres utilise", color: "bg-blue-500", text: "text-blue-600", border: "border-blue-300", min: 85, max: 101 },
];
const getCatConfig = (cat) => CATEGORIES.find(c => c.id === cat) || CATEGORIES[0];
const getUtilColor = (pct) => {
  if (pct <= 0) return 'bg-gray-400';
  if (pct < 30) return 'bg-red-500';
  if (pct < 60) return 'bg-amber-500';
  if (pct < 85) return 'bg-emerald-500';
  return 'bg-blue-500';
};
const getUtilText = (pct) => {
  if (pct <= 0) return 'text-gray-500';
  if (pct < 30) return 'text-red-600';
  if (pct < 60) return 'text-amber-600';
  if (pct < 85) return 'text-emerald-600';
  return 'text-blue-600';
};

const Stat = ({ label, value, sub }) => (
  <div className="text-center">
    <div className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>{value}</div>
    <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">{label}</div>
    {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
  </div>
);

// ─── Vehicle Detail Drawer ───
const VehicleDetailDrawer = ({ vehicle, fleetAvg, fromDate, toDate, onClose }) => {
  if (!vehicle) return null;
  const cat = getCatConfig(vehicle.category);
  const daily = vehicle.daily_breakdown || [];
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  return (
    <DashboardDetailDrawer
      title={vehicle.label}
      subtitle={`${fromDate} au ${toDate}`}
      onClose={onClose}
    >
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-5 p-4 bg-gray-50 rounded-xl">
        <Stat label="Utilisation" value={`${vehicle.utilization_pct}%`} />
        <Stat label="Jours actifs" value={`${vehicle.active_days} / ${vehicle.total_days}`} />
        <Stat label="Distance" value={`${vehicle.period_mileage} km`} />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-5 p-4 bg-gray-50 rounded-xl">
        <Stat label="km / jour actif" value={vehicle.km_per_active_day || '—'} />
        <Stat label="Heures moteur" value={`${vehicle.engine_hours} h`} sub="total cumulatif" />
        <Stat label="Etat" value={vehicle.connection_status === 'active' ? 'Connecte' : 'Hors ligne'} />
      </div>

      {/* Category badge */}
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium mb-5 ${cat.text} ${cat.border} bg-white`}>
        <div className={`w-2 h-2 rounded-full ${cat.color}`} /> {cat.label}
      </div>

      {/* Fleet comparison */}
      <div className="mb-5">
        <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Comparaison avec la flotte</div>
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          {[
            { l: 'Utilisation', v: `${vehicle.utilization_pct}%`, avg: `${fleetAvg.util}%` },
            { l: 'Distance', v: `${vehicle.period_mileage} km`, avg: `${fleetAvg.km} km` },
            { l: 'Heures moteur', v: `${vehicle.engine_hours} h`, avg: `${fleetAvg.eh} h` },
          ].map(row => (
            <div key={row.l} className="flex items-center justify-between text-xs">
              <span className="text-gray-500">{row.l}</span>
              <div className="flex items-center gap-4">
                <span className="font-semibold">{row.v}</span>
                <span className="text-gray-400">vs</span>
                <span className="text-gray-500">{row.avg} moy.</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity calendar */}
      <div className="mb-5">
        <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Calendrier d&apos;activite</div>
        <div className="grid grid-cols-7 gap-1">
          {daily.map(day => {
            const d = new Date(day.date + 'T00:00:00');
            const dayLabel = dayNames[d.getDay()];
            return (
              <div key={day.date} className={`rounded-lg p-2 text-center border ${day.active ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="text-[9px] text-gray-400">{dayLabel}</div>
                <div className="text-[10px] font-mono text-gray-600">{d.getDate()}</div>
                <div className={`text-[10px] font-bold mt-0.5 ${day.active ? 'text-emerald-700' : 'text-gray-300'}`}>
                  {day.active ? `${day.km} km` : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily chart */}
      {daily.length > 1 && (
        <div>
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Distance quotidienne</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={daily} barSize={20}>
              <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={false} tickLine={false}
                tickFormatter={v => { const d = new Date(v + 'T00:00:00'); return dayNames[d.getDay()]; }} />
              <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 11 }}
                formatter={v => [`${v} km`, 'Distance']} labelFormatter={v => v} />
              <Bar dataKey="km" fill="#111" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardDetailDrawer>
  );
};

// ─── MAIN COMPONENT ───
export const EfficiencyTab = ({ data, debugMode }) => {
  const { stats, efficiency, trends } = data;
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('utilization_pct');
  const [sortDir, setSortDir] = useState('asc'); // show needs-attention first
  const [search, setSearch] = useState('');

  const effData = efficiency || {};
  const vehicles = effData.vehicles || [];
  const summary = effData.summary || {};
  const period = effData.period || {};
  const trendData = trends?.trends || [];

  // Fleet averages (for drawer comparison)
  const fleetAvg = useMemo(() => ({
    util: summary.average_utilization_pct || 0,
    km: summary.avg_mileage_per_vehicle || 0,
    eh: summary.avg_engine_hours_per_vehicle || 0,
  }), [summary]);

  // Utilization over time: % vehicles active per day (from trends)
  const utilChartData = useMemo(() => {
    const total = summary.total_vehicles || 1;
    return trendData.map(t => ({
      date: t.date, day_name: t.day_name,
      pct: Math.round((t.active_vehicles / total) * 100),
      active: t.active_vehicles, total,
    }));
  }, [trendData, summary.total_vehicles]);

  // Sorted + filtered vehicles
  const filtered = useMemo(() => {
    let list = [...vehicles];
    if (search) list = list.filter(v => v.label.toLowerCase().includes(search.toLowerCase()));
    if (filter === 'used') list = list.filter(v => v.active_days > 0);
    if (filter === 'inactive') list = list.filter(v => v.category === 'inactif');
    if (filter === 'sous_utilise') list = list.filter(v => v.category === 'sous_utilise');
    if (filter === 'tres_utilise') list = list.filter(v => v.category === 'tres_utilise' || v.category === 'bonne');
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

  const renderSortHeader = (col, label, w) => (
    <th key={col} onClick={() => toggleSort(col)} className={`px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-gray-400 cursor-pointer hover:text-gray-600 select-none ${w || ''}`}>
      <span className="flex items-center gap-1">{label}
        {sortBy === col && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
      </span>
    </th>
  );

  // Category bar data for distribution
  const catCounts = summary.categories || {};

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-[1600px] mx-auto" data-testid="efficiency-tab">

      {/* ═══ KPI ROW ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard label="Utilisation moyenne" value={summary.average_utilization_pct || 0} unit="%" icon={Gauge}
          status={(summary.average_utilization_pct || 0) >= 50 ? 'good' : (summary.average_utilization_pct || 0) >= 25 ? 'warning' : 'danger'} />
        <KPICard label="Distance totale" value={Math.round(summary.total_mileage || 0).toLocaleString('fr-FR')} unit="km" icon={MapPin} />
        <KPICard label="Vehicules utilises" value={`${summary.used_vehicles || 0}`} unit={`/ ${summary.total_vehicles || 0}`} icon={Truck}
          status={(summary.used_vehicles || 0) > (summary.total_vehicles || 0) / 2 ? 'good' : 'warning'} />
        <KPICard label="Heures moteur" value={Math.round(summary.total_engine_hours || 0).toLocaleString('fr-FR')} unit="h" icon={Zap} subtitle="total cumulatif" />
        <KPICard label="Ralenti" value={summary.currently_idle || 0} unit="instant." icon={Clock}
          subtitle="Etat instantane uniquement" />
        <KPICard label="Sans activite" value={summary.inactive_vehicles || 0} icon={XCircle}
          status={(summary.inactive_vehicles || 0) > 0 ? 'danger' : 'good'} />
      </div>

      {/* ═══ EFFICIENCY SUMMARY ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Efficacite de la flotte</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <Stat label="Vehicules utilises" value={summary.used_vehicles || 0} />
          <Stat label="Non utilises" value={summary.inactive_vehicles || 0} />
          <Stat label="Utilisation moy." value={`${summary.average_utilization_pct || 0}%`} />
          <Stat label="Distance moy." value={`${summary.avg_mileage_per_vehicle || 0} km`} />
          <Stat label="Moteur moy." value={`${summary.avg_engine_hours_per_vehicle || 0} h`} sub="total cumulatif" />
        </div>
        {/* Category distribution bar */}
        <div className="flex h-6 rounded-lg overflow-hidden border border-gray-200">
          {CATEGORIES.filter(c => (catCounts[c.id] || 0) > 0).map(c => (
            <div key={c.id} className={`${c.color} flex items-center justify-center text-white text-[9px] font-bold transition-all`}
              style={{ width: `${((catCounts[c.id] || 0) / (summary.total_vehicles || 1)) * 100}%` }}
              title={`${c.label}: ${catCounts[c.id]}`}>
              {catCounts[c.id]}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mt-2">
          {CATEGORIES.filter(c => (catCounts[c.id] || 0) > 0).map(c => (
            <div key={c.id} className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <div className={`w-2 h-2 rounded-full ${c.color}`} /> {c.label}: {catCounts[c.id]}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ CHARTS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Utilization % over time */}
        {utilChartData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Utilisation de la flotte</h4>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={utilChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="day_name" tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} width={35} unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 11 }}
                  formatter={(v, name, props) => [`${v}% (${props.payload.active}/${props.payload.total})`, '% actifs']}
                  labelFormatter={(v, payload) => payload?.[0]?.payload?.date || v} />
                <Area type="monotone" dataKey="pct" stroke="#111" fill="#f3f4f6" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Distance daily */}
        {trendData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Distance quotidienne</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trendData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="day_name" tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} width={40} unit=" km" />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 11 }}
                  formatter={(v, name, props) => [`${v} km | ${props.payload.active_vehicles} vehicules`, 'Distance']}
                  labelFormatter={(v, payload) => payload?.[0]?.payload?.date || v} />
                <Bar dataKey="total_distance" fill="#111" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ═══ FILTERS + SEARCH ═══ */}
      <div className="flex flex-wrap items-center gap-2" data-testid="eff-filters">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Rechercher un vehicule..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none w-52" data-testid="eff-search" />
        </div>
        {[
          { id: 'all', label: `Tous (${vehicles.length})` },
          { id: 'used', label: `Utilises (${summary.used_vehicles || 0})` },
          { id: 'inactive', label: `Sans activite (${summary.inactive_vehicles || 0})` },
          { id: 'sous_utilise', label: `Sous-utilises (${catCounts.sous_utilise || 0})` },
          { id: 'tres_utilise', label: `Fortement utilises (${(catCounts.tres_utilise || 0) + (catCounts.bonne || 0)})` },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} data-testid={`eff-filter-${f.id}`}
            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
              filter === f.id ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* ═══ VEHICLE TABLE ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid="eff-table">
        <div className="px-6 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-800" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Utilisation des vehicules ({filtered.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100">
              {renderSortHeader("label", "Vehicule", "w-40")}
              {renderSortHeader("utilization_pct", "Utilisation")}
              {renderSortHeader("active_days", "Jours actifs")}
              {renderSortHeader("period_mileage", "Distance")}
              {renderSortHeader("km_per_active_day", "km/jour actif")}
              {renderSortHeader("engine_hours", "Moteur (h)")}
              <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-gray-400">Ecart moy.</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-gray-400">Etat</th>
            </tr></thead>
            <tbody>
              {filtered.map(v => {
                const cat = getCatConfig(v.category);
                const ecart = Math.round((v.utilization_pct || 0) - (summary.average_utilization_pct || 0));
                return (
                  <tr key={v.tracker_id} className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer transition-colors"
                    onClick={() => setSelectedVehicle(v)} data-testid={`eff-row-${v.tracker_id}`}>
                    <td className="px-3 py-2.5">
                      <div className="text-sm font-medium text-gray-900 truncate max-w-[160px]">{v.label}</div>
                      <div className="text-[10px] text-gray-400">{v.model}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${getUtilColor(v.utilization_pct)}`} style={{ width: `${Math.min(100, v.utilization_pct)}%` }} />
                        </div>
                        <span className={`text-xs font-semibold tabular-nums ${getUtilText(v.utilization_pct)}`}>{v.utilization_pct}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{v.active_days}/{v.total_days}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-700 tabular-nums">{v.period_mileage} km</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 tabular-nums">{v.km_per_active_day || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 tabular-nums">{v.engine_hours}</td>
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

      {/* ═══ INSIGHTS ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="eff-insights">
        {(summary.inactive_vehicles || 0) > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:shadow-sm transition-shadow"
            onClick={() => setFilter('inactive')} data-testid="eff-insight-inactive">
            <div className="flex items-center gap-2 mb-2"><XCircle size={16} className="text-red-500" />
              <span className="text-sm font-semibold">{summary.inactive_vehicles} vehicules sans activite</span></div>
            <p className="text-xs text-gray-500">Aucun trajet enregistre sur cette periode</p>
          </div>
        )}
        {(catCounts.sous_utilise || 0) > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:shadow-sm transition-shadow"
            onClick={() => setFilter('sous_utilise')} data-testid="eff-insight-underused">
            <div className="flex items-center gap-2 mb-2"><AlertTriangle size={16} className="text-amber-500" />
              <span className="text-sm font-semibold">{catCounts.sous_utilise} vehicules sous-utilises</span></div>
            <p className="text-xs text-gray-500">Utilisation inferieure a 30%</p>
          </div>
        )}
        {((catCounts.tres_utilise || 0) + (catCounts.bonne || 0)) > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:shadow-sm transition-shadow"
            onClick={() => setFilter('tres_utilise')} data-testid="eff-insight-heavy">
            <div className="flex items-center gap-2 mb-2"><TrendingUp size={16} className="text-blue-500" />
              <span className="text-sm font-semibold">{(catCounts.tres_utilise || 0) + (catCounts.bonne || 0)} vehicules fortement utilises</span></div>
            <p className="text-xs text-gray-500">Utilisation superieure a 60%</p>
          </div>
        )}
      </div>

      {/* ═══ DATA SOURCE ═══ */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-200">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-[10px] text-gray-500">
          Utilisation = jours avec distance &ge; {effData.active_day_threshold_km || 1} km / jours periode. Donnees 100% Navixy.
          Ralenti = instantane (snapshot). Heures moteur = compteur cumulatif total.
        </span>
      </div>

      {/* ═══ VEHICLE DRAWER ═══ */}
      {selectedVehicle && (
        <VehicleDetailDrawer
          vehicle={selectedVehicle}
          fleetAvg={fleetAvg}
          fromDate={period.from || ''}
          toDate={period.to || ''}
          onClose={() => setSelectedVehicle(null)}
        />
      )}
    </div>
  );
};
