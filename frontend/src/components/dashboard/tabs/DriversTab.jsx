import React, { useState, useMemo } from "react";
import { MiniKPI, ScoreBadge } from "@/components/shared/UIComponents";
import { calcDriverScore, getScoreBg } from "@/lib/metrics";
import {
  Users, Truck, Award, AlertTriangle, Clock,
  Gauge, Star, ChevronRight, X, MapPin, Info
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";

const DriverKPI = ({ label, value, icon: Icon, color, explanation }) => {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className="relative">
      <div className="kpi-card bg-white rounded-xl p-5 min-h-[100px] flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5"><Icon size={13} className="text-gray-400" /><span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{label}</span></div>
          {explanation && <button onClick={() => setShowInfo(!showInfo)} className="p-1 hover:bg-gray-100 rounded-lg"><Info size={13} className={showInfo ? 'text-[#111]' : 'text-gray-300'} /></button>}
        </div>
        <div className={`text-2xl font-semibold ${color || 'text-gray-900'}`} style={{ fontFamily: 'Outfit, sans-serif' }}>{value}</div>
      </div>
      {showInfo && explanation && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white rounded-xl border border-gray-200 shadow-lg p-4">
          <div className="flex justify-between mb-2"><h4 className="text-sm font-semibold">{explanation.title}</h4><button onClick={() => setShowInfo(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={14} className="text-gray-400" /></button></div>
          <p className="text-xs text-gray-600">{explanation.description}</p>
          {explanation.tip && <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-100 text-[10px] text-blue-700">{explanation.tip}</div>}
        </div>
      )}
    </div>
  );
};

const DriverDetail = ({ driver, metrics, onClose }) => {
  const radarData = [
    { metric: 'Utilisation', value: metrics.utilization || 0 },
    { metric: 'Distance', value: Math.min(100, Math.round((metrics.distance || 0) / 10)) },
    { metric: 'Assignation', value: driver.vehicles_count > 0 ? 80 : 20 },
  ];

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white shadow-2xl z-50 overflow-y-auto" data-testid="driver-detail">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
        <h3 className="text-lg font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>{driver.driver_name}</h3>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} className="text-gray-500" /></button>
      </div>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <ScoreBadge score={metrics.score} size="lg" />
          <div>
            <div className="text-2xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>{metrics.score}%</div>
            <div className="text-xs text-gray-500">Taux d'utilisation</div>
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}><PolarGrid stroke="#e5e7eb" /><PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#5E5E62' }} /><PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} /><Radar dataKey="value" stroke="#111" fill="#111" fillOpacity={0.15} strokeWidth={2} /></RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { l: 'Utilisation', v: `${metrics.utilization || 0}%`, i: Gauge, c: (metrics.utilization || 0) >= 50 ? 'text-emerald-600' : 'text-red-500' },
            { l: 'Distance', v: `${metrics.distance || 0} km`, i: MapPin, c: 'text-gray-700' },
          ].map((item, idx) => (
            <div key={idx} className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1"><item.i size={12} className="text-gray-400" /><span className="text-[9px] text-gray-400 uppercase">{item.l}</span></div>
              <div className={`text-lg font-semibold ${item.c}`} style={{ fontFamily: 'Outfit, sans-serif' }}>{item.v}</div>
            </div>
          ))}
        </div>
        {driver.vehicles && driver.vehicles.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold uppercase text-gray-400 mb-2">Vehicules</h4>
            {driver.vehicles.map((v, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-1">
                <div className="flex items-center gap-2"><Truck size={14} className="text-gray-400" /><span className="text-sm font-medium">{v.vehicle_label}</span></div>
                <span className="text-xs text-gray-500">{v.distance || 0} km</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const DriversTab = ({ data }) => {
  const { comparison, drivers: report } = data;
  const compVehicles = comparison?.vehicles || [];
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedDriver, setSelectedDriver] = useState(null);

  const drivers = useMemo(() => (report?.drivers || []).map(d => ({
    ...d, metrics: calcDriverScore(d, compVehicles)
  })), [report, compVehicles]);

  const filtered = drivers.filter(d => {
    if (search && !d.driver_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType === 'excellent' && d.metrics.score < 70) return false;
    if (filterType === 'risk' && d.metrics.score >= 40) return false;
    return true;
  }).sort((a, b) => b.metrics.score - a.metrics.score);

  const totalDrivers = drivers.length;
  const avgScore = totalDrivers > 0 ? Math.round(drivers.reduce((s, d) => s + d.metrics.score, 0) / totalDrivers) : 0;
  const excellentDrivers = drivers.filter(d => d.metrics.score >= 70).length;
  const driversAtRisk = drivers.filter(d => d.metrics.score < 40).length;
  const totalDistance = Math.round(drivers.reduce((s, d) => s + (d.metrics.distance || 0), 0));

  const chartData = drivers.filter(d => d.metrics.score > 0).sort((a, b) => b.metrics.score - a.metrics.score).slice(0, 6)
    .map(d => ({ name: d.driver_name.length > 10 ? d.driver_name.substring(0, 10) + '...' : d.driver_name, score: d.metrics.score }));

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-[1600px] mx-auto" data-testid="drivers-tab">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <DriverKPI label="Conducteurs" value={totalDrivers} icon={Users} explanation={{ title: 'Conducteurs', description: 'Nombre total de conducteurs enregistres dans Navixy.', tip: 'Associes via cle iButton, carte RFID ou assignation manuelle.' }} />
        <DriverKPI label="Utilisation moy." value={`${avgScore}%`} icon={Gauge} color={avgScore >= 50 ? 'text-emerald-600' : 'text-red-500'} explanation={{ title: 'Utilisation Moyenne', description: 'Taux d&apos;utilisation moyen base sur les jours actifs du vehicule assigne.', tip: 'Donnee 100% Navixy.' }} />
        <DriverKPI label="Excellents" value={excellentDrivers} icon={Star} color="text-emerald-600" />
        <DriverKPI label="A risque" value={driversAtRisk} icon={AlertTriangle} color={driversAtRisk > 0 ? 'text-red-500' : 'text-gray-400'} />
        <DriverKPI label="Distance tot." value={`${totalDistance} km`} icon={MapPin} />
      </div>

      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Classement Conducteurs (Utilisation)</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#5E5E62' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} width={30} domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 11 }} />
              <Bar dataKey="score" name="Utilisation %" fill="#111" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative"><Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none w-56" data-testid="driver-search" />
        </div>
        {['all', 'excellent', 'risk'].map(f => (
          <button key={f} onClick={() => setFilterType(f)} className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${filterType === f ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            data-testid={`filter-${f}`}>
            {f === 'all' ? 'Tous' : f === 'excellent' ? 'Excellents' : 'A risque'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(driver => (
          <div key={driver.employee_id} className="bg-white rounded-xl border border-gray-200 hover:shadow-sm transition-shadow cursor-pointer"
            onClick={() => setSelectedDriver(driver)} data-testid={`driver-card-${driver.employee_id}`}>
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <ScoreBadge score={driver.metrics.score} />
                <div>
                  <div className="text-sm font-medium text-gray-900">{driver.driver_name}</div>
                  <div className="text-[10px] text-gray-400">{driver.phone && <span>{driver.phone} | </span>}N. {driver.personnel_number || driver.employee_id}</div>
                </div>
              </div>
              <div className="flex items-center gap-5">
                <div className="hidden md:block text-center"><div className="text-sm font-semibold">{driver.metrics.distance || 0}</div><div className="text-[9px] text-gray-400">km</div></div>
                <div className="hidden md:block text-center"><div className="text-sm font-semibold">{driver.vehicles_count}</div><div className="text-[9px] text-gray-400">Vehic.</div></div>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedDriver && (
        <><div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSelectedDriver(null)} /><DriverDetail driver={selectedDriver} metrics={selectedDriver.metrics} onClose={() => setSelectedDriver(null)} /></>
      )}
    </div>
  );
};
