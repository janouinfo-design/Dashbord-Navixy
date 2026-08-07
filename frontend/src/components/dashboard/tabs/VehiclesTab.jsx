import React, { useState } from "react";
import { MiniKPI } from "@/components/shared/UIComponents";
import { getScoreBg, getScoreColor } from "@/lib/metrics";
import {
  Truck, Wifi, WifiOff, XCircle, MapPin, Activity, DollarSign,
  Search, ChevronDown, ChevronUp, Gauge, Clock, Fuel, Navigation,
  Zap, Filter
} from "lucide-react";

const ClickKPI = ({ label, value, unit, icon: Icon, color, subtitle, filterKey, isActive, onToggle }) => (
  <div onClick={() => filterKey && onToggle(filterKey)}
    className={`kpi-card bg-white rounded-xl p-5 min-h-[100px] flex flex-col justify-between cursor-pointer transition-all ${isActive ? 'ring-2 ring-[#111] shadow-md' : ''}`}>
    <div className="flex items-center gap-1.5"><Icon size={13} className={isActive ? 'text-[#111]' : 'text-gray-400'} /><span className={`text-[10px] font-medium uppercase tracking-wider ${isActive ? 'text-[#111]' : 'text-gray-400'}`}>{label}</span></div>
    <div><div className={`text-2xl font-semibold ${color || 'text-gray-900'}`} style={{ fontFamily: 'Outfit, sans-serif' }}>{value}{unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}</div>
      {subtitle && <div className="text-[10px] text-gray-400 mt-0.5">{subtitle}</div>}
      {filterKey && <div className={`text-[9px] mt-1 ${isActive ? 'text-[#111] font-medium' : 'text-gray-300'}`}>{isActive ? 'Filtre actif' : 'Cliquer pour filtrer'}</div>}
    </div>
  </div>
);

export const VehiclesTab = ({ data }) => {
  const { stats, comparison } = data;
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('mileage');
  const [sortDir, setSortDir] = useState('desc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedVehicle, setExpandedVehicle] = useState(null);
  const [activeKPI, setActiveKPI] = useState(null);

  const compMap = {};
  (comparison?.vehicles || []).forEach(v => { compMap[v.tracker_id] = v; });

  const vehicles = (stats?.vehicles || []).map(v => ({
    ...v,
    utilization_score: compMap[v.tracker_id]?.utilization_score || 0,
    total_distance_week: compMap[v.tracker_id]?.total_distance_week || 0,
    active_days: compMap[v.tracker_id]?.active_days || 0,
  }));

  const totalV = vehicles.length;
  const activeV = vehicles.filter(v => v.connection_status === 'active').length;
  const offlineV = totalV - activeV;
  const underUsedList = vehicles.filter(v => v.mileage < 10 && v.connection_status !== 'active');
  const totalKm = stats?.summary?.total_mileage || 0;
  const totalEngineH = stats?.summary?.total_engine_hours || 0;

  const handleKPI = (key) => setActiveKPI(activeKPI === key ? null : key);

  const kpiIds = (() => {
    if (!activeKPI) return null;
    switch (activeKPI) {
      case 'active': return vehicles.filter(v => v.connection_status === 'active').map(v => v.tracker_id);
      case 'offline': return vehicles.filter(v => v.connection_status !== 'active').map(v => v.tracker_id);
      case 'underused': return underUsedList.map(v => v.tracker_id);
      default: return null;
    }
  })();

  const filtered = vehicles.filter(v => {
    if (kpiIds && !kpiIds.includes(v.tracker_id)) return false;
    if (search && !v.label.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus === 'active' && v.connection_status !== 'active') return false;
    if (filterStatus === 'offline' && v.connection_status === 'active') return false;
    return true;
  }).sort((a, b) => {
    let va = a[sortBy] || 0, vb = b[sortBy] || 0;
    if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
    return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  const toggleSort = (col) => { if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(col); setSortDir('desc'); } };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-[1600px] mx-auto" data-testid="vehicles-tab">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MiniKPI label="Total" value={totalV} icon={Truck} />
        <ClickKPI label="Actifs" value={activeV} icon={Wifi} color="text-emerald-600" filterKey="active" isActive={activeKPI === 'active'} onToggle={handleKPI} />
        <ClickKPI label="Hors ligne" value={offlineV} icon={WifiOff} color={offlineV > 0 ? 'text-red-500' : 'text-gray-400'} filterKey="offline" isActive={activeKPI === 'offline'} onToggle={handleKPI} />
        <ClickKPI label="Sous-utilises" value={underUsedList.length} icon={XCircle} color={underUsedList.length > 0 ? 'text-amber-600' : 'text-gray-400'} subtitle="< 10 km" filterKey="underused" isActive={activeKPI === 'underused'} onToggle={handleKPI} />
        <MiniKPI label="Distance" value={totalKm.toFixed(0)} unit="km" icon={MapPin} />
        <MiniKPI label="Moteur" value={totalEngineH.toFixed(0)} unit="h" icon={Activity} />
      </div>

      {activeKPI && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#111] text-white rounded-xl text-xs font-medium">
          <Filter size={13} /><span>{activeKPI === 'active' ? 'Actifs' : activeKPI === 'offline' ? 'Hors ligne' : 'Sous-utilises'} — {kpiIds?.length || 0} vehicules</span>
          <button onClick={() => setActiveKPI(null)} className="ml-auto px-2 py-0.5 bg-white/20 rounded-lg hover:bg-white/30 text-[10px]">Retirer</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-800" style={{ fontFamily: 'Outfit, sans-serif' }}>Vehicules ({filtered.length})</h3>
          <div className="flex items-center gap-2">
            <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none w-44" data-testid="vehicle-search" /></div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none" data-testid="vehicle-filter"><option value="all">Tous</option><option value="active">Actifs</option><option value="offline">Offline</option></select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-100">
              {[{ k: 'label', l: 'Vehicule' }, { k: 'connection_status', l: 'Etat GPS' }, { k: 'mileage', l: 'Km (periode)' }, { k: 'engine_hours', l: 'Moteur (h)' }, { k: 'total_odometer', l: 'Odometre' }, { k: 'last_update', l: 'Dern. comm.' }, { k: 'utilization_score', l: 'Utilisation' }].map(col => (
                <th key={col.k} onClick={() => toggleSort(col.k)} className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-gray-400 cursor-pointer hover:text-gray-600 select-none whitespace-nowrap">
                  <span className="flex items-center gap-1">{col.l}{sortBy === col.k && (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}</span>
                </th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(v => (
                <React.Fragment key={v.tracker_id}>
                  <tr className={`fleet-row border-b border-gray-50 cursor-pointer ${expandedVehicle === v.tracker_id ? 'bg-gray-50' : ''}`} onClick={() => setExpandedVehicle(expandedVehicle === v.tracker_id ? null : v.tracker_id)} data-testid={`vehicle-row-${v.tracker_id}`}>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><ChevronDown size={12} className={`text-gray-400 transition-transform ${expandedVehicle === v.tracker_id ? 'rotate-180' : ''}`} /><div><div className="text-sm font-medium text-gray-900">{v.label}</div><div className="text-[10px] text-gray-400">{v.model || '-'}</div></div></div></td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${v.connection_status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}><span className={`w-1.5 h-1.5 rounded-full ${v.connection_status === 'active' ? 'bg-emerald-500 pulse-dot' : 'bg-gray-400'}`} />{v.connection_status === 'active' ? 'Actif' : 'Offline'}</span></td>
                    <td className="px-4 py-3"><span className="text-xs font-medium text-gray-700">{(v.mileage || 0).toFixed(1)} km</span></td>
                    <td className="px-4 py-3"><span className="text-xs text-gray-600">{(v.engine_hours || 0).toFixed(0)}h</span></td>
                    <td className="px-4 py-3"><span className="text-xs text-gray-600">{Math.round(v.total_odometer || 0).toLocaleString('fr-FR')} km</span></td>
                    <td className="px-4 py-3"><span className="text-[10px] text-gray-400">{v.last_update ? new Date(v.last_update).toLocaleDateString('fr-FR') : '-'}</span></td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-10 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${getScoreBg(v.utilization_score)}`} style={{ width: `${Math.min(100, v.utilization_score)}%` }} /></div><span className={`text-xs font-semibold ${getScoreColor(v.utilization_score)}`}>{v.utilization_score}%</span></div></td>
                  </tr>
                  {expandedVehicle === v.tracker_id && (
                    <tr><td colSpan={7} className="px-0 py-0">
                      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                          {[
                            { l: 'Distance', v: `${(v.mileage || 0).toFixed(1)} km`, i: MapPin, c: 'text-blue-500' },
                            { l: 'Odometre', v: `${Math.round(v.total_odometer || 0).toLocaleString('fr-FR')} km`, i: Navigation, c: 'text-gray-500' },
                            { l: 'Moteur', v: `${(v.engine_hours || 0).toFixed(0)} h`, i: Zap, c: 'text-purple-500' },
                            { l: 'Vitesse', v: `${v.speed || 0} km/h`, i: Gauge, c: 'text-blue-500' },
                            { l: 'Mouvement', v: v.movement_status === 'moving' ? 'En route' : v.movement_status === 'idle' ? 'Ralenti' : 'Arrete', i: Clock, c: v.movement_status === 'moving' ? 'text-emerald-500' : 'text-gray-500' },
                            { l: 'Carburant', v: v.fuel_cost_chf != null ? `${v.fuel_cost_chf} CHF` : 'N/A', i: Fuel, c: 'text-amber-500' },
                          ].map((item, idx) => (
                            <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200">
                              <div className="flex items-center gap-1 mb-1"><item.i size={11} className={item.c} /><span className="text-[9px] text-gray-400 uppercase">{item.l}</span></div>
                              <div className="text-base font-semibold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>{item.v}</div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 text-[10px] text-gray-400">{v.last_update && `MAJ: ${new Date(v.last_update).toLocaleString('fr-FR')}`}{v.location && v.location.lat !== 0 && ` | GPS: ${v.location.lat?.toFixed(4)}, ${v.location.lng?.toFixed(4)}`}</div>
                      </div>
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
