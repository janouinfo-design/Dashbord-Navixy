import React, { useState } from "react";
import { MiniKPI } from "@/components/shared/UIComponents";
import {
  Truck, Clock, Activity, Gauge, MapPin, Zap,
  ChevronDown, Navigation, Info, X
} from "lucide-react";

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
          {explanation.formula && <div className="mt-2 p-2 bg-gray-50 rounded-lg text-xs font-mono text-gray-700">{explanation.formula}</div>}
          {explanation.tip && <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-100 text-[10px] text-blue-700">{explanation.tip}</div>}
        </div>
      )}
    </div>
  );
};

export const EfficiencyTab = ({ data }) => {
  const { stats, efficiency } = data;
  const [expandedVehicle, setExpandedVehicle] = useState(null);

  const effVehicles = efficiency?.vehicles || [];
  const statsMap = {};
  (stats?.vehicles || []).forEach(v => { statsMap[v.tracker_id] = v; });

  const summary = efficiency?.summary || {};
  const avgUtil = summary.average_utilization_pct || 0;
  const totalKm = stats?.summary?.total_mileage || 0;
  const totalEngineH = stats?.summary?.total_engine_hours || 0;
  const currentlyMoving = summary.currently_moving || 0;
  const currentlyIdle = summary.currently_idle || 0;
  const currentlyStopped = summary.currently_stopped || 0;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-[1600px] mx-auto" data-testid="efficiency-tab">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <EffKPI label="Utilisation moy." value={`${avgUtil}%`} icon={Gauge}
          color={avgUtil >= 50 ? 'text-emerald-600' : 'text-red-500'}
          explanation={{ title: 'Taux d&apos;utilisation', description: 'Pourcentage moyen de jours ou les vehicules ont roule (km &gt; 0).', formula: '(jours_actifs / jours_total) × 100', tip: 'Donnee 100% Navixy via tracker/stats/mileage.' }} />
        <EffKPI label="Distance totale" value={totalKm.toFixed(0)} unit="km" icon={MapPin} />
        <EffKPI label="En mouvement" value={currentlyMoving} icon={Activity} color="text-emerald-600"
          explanation={{ title: 'En mouvement', description: 'Nombre de vehicules actuellement en deplacement (instantane).', tip: 'Etat temps reel via tracker/get_state.' }} />
        <EffKPI label="Au ralenti" value={currentlyIdle} icon={Clock} color={currentlyIdle > 3 ? 'text-amber-600' : 'text-gray-700'}
          explanation={{ title: 'Au ralenti', description: 'Nombre de vehicules actuellement au ralenti (moteur allume, vitesse < 5 km/h).', tip: 'Etat instantane. Historique non disponible via cette API.' }} />
        <EffKPI label="Arretes" value={currentlyStopped} icon={Truck} />
        <EffKPI label="Heures moteur" value={totalEngineH.toFixed(0)} unit="h" icon={Zap} />
      </div>

      {/* Data source note */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-[10px] text-gray-500">Utilisation basee sur le kilometrage reel Navixy. L'etat mouvement/ralenti/arrete est un instantane.</span>
      </div>

      {/* Vehicle Utilization List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-800" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Utilisation par vehicule ({effVehicles.length})
          </h3>
          <div className="flex items-center gap-4 text-[10px] text-gray-500">
            <div className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-emerald-400" /> Jours actifs</div>
            <div className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-gray-200" /> Jours inactifs</div>
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {effVehicles.map((vehicle) => {
            const vStats = statsMap[vehicle.tracker_id] || {};
            const isExpanded = expandedVehicle === vehicle.tracker_id;
            const util = vehicle.utilization_pct || 0;

            return (
              <div key={vehicle.tracker_id}>
                <div
                  className={`px-6 py-3 flex items-center cursor-pointer transition-colors ${isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50/50'}`}
                  onClick={() => setExpandedVehicle(isExpanded ? null : vehicle.tracker_id)}
                  data-testid={`eff-row-${vehicle.tracker_id}`}
                >
                  <div className="w-36 lg:w-48 flex items-center gap-2">
                    <ChevronDown size={12} className={`text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                    <span className={`inline-flex items-center justify-center w-12 h-7 rounded-lg text-[10px] font-bold text-white flex-shrink-0 ${
                      util >= 70 ? 'bg-emerald-500' : util >= 30 ? 'bg-amber-500' : 'bg-red-500'
                    }`}>
                      {util}%
                    </span>
                    <div className="flex items-center gap-1 text-xs text-gray-700 truncate min-w-0">
                      <Truck size={11} className="text-gray-400 flex-shrink-0" />
                      <span className="truncate font-medium" title={vehicle.label}>{vehicle.label}</span>
                    </div>
                  </div>
                  <div className="flex-1 h-7 bg-gray-100 rounded-lg relative overflow-hidden flex">
                    <div className="h-full rounded-l-lg bg-emerald-400 transition-all" style={{ width: `${util}%` }} title={`${vehicle.active_days || 0}/${vehicle.total_days || 7} jours actifs`} />
                  </div>
                  <div className="w-24 text-right text-xs text-gray-500 ml-3">
                    {vehicle.active_days || 0}/{vehicle.total_days || 7}j | {(vehicle.period_mileage || 0).toFixed(0)} km
                  </div>
                </div>

                {isExpanded && (
                  <div className="bg-gray-50 border-t border-gray-100 px-6 py-5">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      {[
                        { label: 'Distance periode', value: `${(vehicle.period_mileage || 0).toFixed(1)} km`, icon: MapPin, ic: 'text-blue-500' },
                        { label: 'Jours actifs', value: `${vehicle.active_days || 0} / ${vehicle.total_days || 7}`, icon: Activity, ic: 'text-emerald-500' },
                        { label: 'Odometre total', value: `${Math.round(vStats.total_odometer || 0).toLocaleString('fr-FR')} km`, icon: Navigation, ic: 'text-gray-500' },
                        { label: 'Vitesse actuelle', value: `${vehicle.speed || 0} km/h`, icon: Gauge, ic: 'text-blue-500' },
                        { label: 'Moteur total', value: `${(vStats.engine_hours || 0).toFixed(0)} h`, icon: Zap, ic: 'text-purple-500' },
                        { label: 'Connexion', value: vehicle.connection_status === 'active' ? 'Connecte' : 'Hors ligne', icon: Truck, ic: vehicle.connection_status === 'active' ? 'text-emerald-500' : 'text-gray-400' },
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
                    <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-gray-400">
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
