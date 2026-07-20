import React, { useState, useMemo } from "react";
import { MiniKPI } from "@/components/shared/UIComponents";
import { formatTime, FUEL_PRICE_CHF } from "@/lib/metrics";
import {
  Truck, Clock, Activity, Gauge, MapPin, Fuel, Zap,
  ChevronDown, Navigation, DollarSign, ShieldAlert,
  Download, Award, AlertTriangle, Info, X
} from "lucide-react";

// ============ KPI WITH INFO ============
const EffKPI = ({ label, value, unit, icon: Icon, color, explanation }) => {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className="relative">
      <div className="kpi-card bg-white rounded-xl p-5 min-h-[100px] flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Icon size={13} className="text-gray-400" />
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{label}</span>
          </div>
          {explanation && (
            <button onClick={() => setShowInfo(!showInfo)} className="p-1 hover:bg-gray-100 rounded-lg">
              <Info size={13} className={showInfo ? 'text-[#111]' : 'text-gray-300'} />
            </button>
          )}
        </div>
        <div className={`text-2xl font-semibold tracking-tight ${color || 'text-gray-900'}`} style={{ fontFamily: 'Outfit, sans-serif' }}>
          {value}{unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
        </div>
      </div>
      {showInfo && explanation && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white rounded-xl border border-gray-200 shadow-lg p-4 min-w-[250px]">
          <div className="flex justify-between mb-2">
            <h4 className="text-sm font-semibold">{explanation.title}</h4>
            <button onClick={() => setShowInfo(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={14} className="text-gray-400" /></button>
          </div>
          <p className="text-xs text-gray-600">{explanation.description}</p>
          {explanation.tip && <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-100 text-[10px] text-blue-700">{explanation.tip}</div>}
        </div>
      )}
    </div>
  );
};

export const EfficiencyTab = ({ data }) => {
  const { stats, efficiency, comparison } = data;
  const [expandedVehicle, setExpandedVehicle] = useState(null);

  const vehicles = stats?.vehicles || [];
  const effVehicles = efficiency?.vehicles || [];
  const compMap = {};
  (comparison?.vehicles || []).forEach(v => { compMap[v.tracker_id] = v; });

  // Stats map for enrichment
  const statsMap = {};
  vehicles.forEach(v => { statsMap[v.tracker_id] = v; });

  // Summary
  const avgEff = efficiency?.summary?.average_efficiency || 0;
  const totalKm = stats?.summary?.total_mileage || 0;
  const totalEngineH = stats?.summary?.total_engine_hours || 0;
  const activeCount = vehicles.filter(v => v.connection_status === 'active').length;
  const avgDrivingTime = efficiency?.summary?.avg_driving_time_per_day || 0;
  const avgIdleTime = efficiency?.summary?.avg_idle_time_per_day || 0;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-[1600px] mx-auto" data-testid="efficiency-tab">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <EffKPI label="Efficacite moy." value={`${avgEff}%`} icon={Gauge}
          color={avgEff >= 50 ? 'text-emerald-600' : 'text-red-500'}
          explanation={{ title: 'Efficacite Moyenne', description: 'Rapport entre le temps de conduite et le temps total. Plus un vehicule roule par rapport a son temps moteur, plus il est efficace.', tip: '> 50% bon, < 30% action requise.' }} />
        <EffKPI label="Distance totale" value={totalKm.toFixed(0)} unit="km" icon={MapPin}
          explanation={{ title: 'Distance Totale', description: 'Kilometres parcourus par toute la flotte sur la periode.' }} />
        <EffKPI label="Vehicules actifs" value={`${activeCount} / ${vehicles.length}`} icon={Truck} />
        <EffKPI label="Temps conduite moy." value={formatTime(avgDrivingTime)} icon={Activity} color="text-emerald-600"
          explanation={{ title: 'Temps Conduite Moyen', description: 'Duree moyenne quotidienne de conduite par vehicule. Le vehicule roule reellement (vitesse > 5 km/h).', tip: 'Un temps de conduite faible peut indiquer des vehicules sous-utilises ou trop de temps au ralenti.' }} />
        <EffKPI label="Temps ralenti moy." value={formatTime(avgIdleTime)} icon={Clock} color={avgIdleTime > 3600 ? 'text-amber-600' : 'text-gray-700'}
          explanation={{ title: 'Temps Ralenti Moyen', description: 'Duree moyenne quotidienne ou le moteur tourne a l\'arret (vitesse < 5 km/h). Carburant gaspille.', tip: 'Chaque heure de ralenti = ~1.5L de carburant brule inutilement = ~3 CHF.' }} />
        <EffKPI label="Heures moteur" value={totalEngineH.toFixed(0)} unit="h" icon={Zap} />
      </div>

      {/* Vehicle Efficiency Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-800" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Timeline d'activite ({effVehicles.length} vehicules)
          </h3>
          <div className="flex items-center gap-4 text-[10px] text-gray-500">
            <div className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-emerald-400" /> Conduite</div>
            <div className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-amber-400" /> Ralenti</div>
            <div className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-gray-200" /> Arrete</div>
          </div>
        </div>

        {/* Time header */}
        <div className="px-6 py-2 border-b border-gray-50 flex items-center">
          <div className="w-36 lg:w-48 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Vehicule</div>
          <div className="flex-1 flex justify-between text-[9px] text-gray-400 px-2">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i}>{String(i * 3).padStart(2, '0')}:00</span>
            ))}
          </div>
        </div>

        {/* Vehicle rows */}
        <div className="divide-y divide-gray-50">
          {effVehicles.map((vehicle) => {
            const vStats = statsMap[vehicle.tracker_id] || {};
            const vComp = compMap[vehicle.tracker_id] || {};
            const isExpanded = expandedVehicle === vehicle.tracker_id;

            return (
              <div key={vehicle.tracker_id}>
                <div
                  className={`px-6 py-3 flex items-center cursor-pointer transition-colors ${isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50/50'}`}
                  onClick={() => setExpandedVehicle(isExpanded ? null : vehicle.tracker_id)}
                  data-testid={`eff-row-${vehicle.tracker_id}`}
                >
                  <div className="w-36 lg:w-48 flex items-center gap-2">
                    <ChevronDown size={12} className={`text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                    <span className={`inline-flex items-center justify-center w-9 h-7 rounded-lg text-[10px] font-bold text-white flex-shrink-0 ${
                      vehicle.efficiency >= 50 ? 'bg-emerald-500' : vehicle.efficiency >= 20 ? 'bg-amber-500' : 'bg-red-500'
                    }`}>
                      {vehicle.efficiency}%
                    </span>
                    <div className="flex items-center gap-1 text-xs text-gray-700 truncate min-w-0">
                      <Truck size={11} className="text-gray-400 flex-shrink-0" />
                      <span className="truncate font-medium" title={vehicle.label}>{vehicle.label}</span>
                    </div>
                  </div>
                  <div className="flex-1 h-7 bg-gray-100 rounded-lg relative overflow-hidden">
                    <div className="absolute left-0 top-0 h-full rounded-lg bg-emerald-400"
                      style={{ width: `${Math.min(100, Math.max(1, (vehicle.driving_time / 864) || vehicle.efficiency))}%` }} title="Conduite" />
                    <div className="absolute top-0 h-full bg-amber-400"
                      style={{ left: `${Math.min(100, Math.max(1, (vehicle.driving_time / 864) || vehicle.efficiency))}%`, width: `${Math.min(50, (vehicle.idle_time / 864) || 0)}%` }} title="Ralenti" />
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="bg-gray-50 border-t border-gray-100 px-6 py-5">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                      {[
                        { label: 'Distance', value: `${(vStats.mileage || 0).toFixed(1)} km`, icon: MapPin, ic: 'text-blue-500' },
                        { label: 'Odometre total', value: `${(vStats.total_odometer || 0).toLocaleString('fr-FR')} km`, icon: Navigation, ic: 'text-gray-500' },
                        { label: 'Conduite', value: formatTime(vehicle.driving_time), icon: Activity, ic: 'text-emerald-500' },
                        { label: 'Ralenti', value: formatTime(vehicle.idle_time), icon: Clock, ic: 'text-amber-500' },
                        { label: 'Vitesse', value: `${vStats.speed || vehicle.speed || 0} km/h`, icon: Gauge, ic: 'text-blue-500' },
                        { label: 'Moteur', value: `${(vStats.engine_hours || 0).toFixed(0)} h`, icon: Zap, ic: 'text-purple-500' },
                        { label: 'Cout carburant', value: `${Math.round((vStats.mileage || 0) * (vComp.fuel_efficiency || 8) / 100 * FUEL_PRICE_CHF)} CHF`, icon: DollarSign, ic: 'text-gray-500' },
                      ].map((item, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center gap-1 mb-1">
                            <item.icon size={11} className={item.ic} />
                            <span className="text-[9px] text-gray-400 uppercase tracking-wider">{item.label}</span>
                          </div>
                          <div className="text-base font-semibold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>{item.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Efficiency breakdown bar */}
                    <div className="mt-3 bg-white rounded-lg border border-gray-200 p-3">
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-400" /><span className="text-gray-600">Conduite: {formatTime(vehicle.driving_time)}</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-400" /><span className="text-gray-600">Ralenti: {formatTime(vehicle.idle_time)}</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gray-300" /><span className="text-gray-600">Arrete: {formatTime(vehicle.stopped_time)}</span></div>
                      </div>
                      <div className="mt-2 w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
                        <div className="h-full bg-emerald-400" style={{ width: `${(vehicle.driving_time / 864) || 0}%` }} />
                        <div className="h-full bg-amber-400" style={{ width: `${(vehicle.idle_time / 864) || 0}%` }} />
                        <div className="h-full bg-gray-300 flex-1" />
                      </div>
                    </div>

                    {/* Additional info */}
                    <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-gray-400">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${
                        vehicle.movement_status === 'moving' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : vehicle.movement_status === 'idle' ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          vehicle.movement_status === 'moving' ? 'bg-emerald-500' : vehicle.movement_status === 'idle' ? 'bg-amber-500' : 'bg-gray-400'
                        }`} />
                        {vehicle.movement_status === 'moving' ? 'En mouvement' : vehicle.movement_status === 'idle' ? 'Au ralenti' : 'Arrete'}
                      </span>
                      {vStats.model && <span>Modele: <strong className="text-gray-700">{vStats.model}</strong></span>}
                      {vStats.last_update && <span>MAJ: <strong className="text-gray-700">{new Date(vStats.last_update).toLocaleString('fr-FR')}</strong></span>}
                      {vStats.location && vStats.location.lat !== 0 && <span>GPS: <strong className="text-gray-700">{vStats.location.lat?.toFixed(4)}, {vStats.location.lng?.toFixed(4)}</strong></span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {effVehicles.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">Aucun vehicule trouve</div>
        )}
      </div>
    </div>
  );
};
