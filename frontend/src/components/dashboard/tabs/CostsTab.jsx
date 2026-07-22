import { useMemo } from "react";
import { MiniKPI, SectionHeader } from "@/components/shared/UIComponents";
import { FUEL_PRICE_CHF } from "@/lib/metrics";
import { DollarSign, Fuel, Clock, TrendingDown, BarChart3, Settings } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export const CostsTab = ({ data }) => {
  const { stats, trends, comparison } = data;
  const compVehicles = comparison?.vehicles || [];
  const vehicles = stats?.vehicles || [];
  const totalKm = stats?.summary?.total_mileage || 0;

  // Fuel data from engine (null if no consumption rate configured)
  const hasFuelData = vehicles.some(v => v.fuel_cost_chf !== null && v.fuel_cost_chf !== undefined);
  const totalFuelCost = hasFuelData ? Math.round(vehicles.reduce((s, v) => s + (v.fuel_cost_chf || 0), 0)) : null;
  const totalFuelL = hasFuelData ? Math.round(vehicles.reduce((s, v) => s + (v.fuel_used_liters || 0), 0) * 10) / 10 : null;

  // Top consumers by distance (real data — fuel cost per vehicle if available)
  const topByDistance = [...compVehicles]
    .filter(v => (v.total_distance_week || 0) > 0)
    .sort((a, b) => (b.total_distance_week || 0) - (a.total_distance_week || 0))
    .slice(0, 8)
    .map(v => ({
      name: v.label.length > 14 ? v.label.substring(0, 14) + '...' : v.label,
      distance: v.total_distance_week || 0,
    }));

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-[1600px] mx-auto" data-testid="costs-tab">
      {/* Config prompt if no fuel data */}
      {!hasFuelData && (
        <div className="flex items-start gap-3 px-5 py-4 bg-amber-50 rounded-xl border border-amber-200">
          <Settings size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-amber-800">Configuration carburant requise</div>
            <div className="text-xs text-amber-700 mt-1">
              Pour afficher les couts carburant, configurez un taux de consommation moyen via l&apos;API :<br />
              <code className="text-[10px] bg-amber-100 px-1.5 py-0.5 rounded mt-1 inline-block">
                PUT /api/config/fuel {`{"default_consumption_rate": 8.5}`}
              </code>
            </div>
            <div className="text-[10px] text-amber-600 mt-2">Prix par defaut: {FUEL_PRICE_CHF} CHF/L (configurable)</div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniKPI label="Distance totale" value={Math.round(totalKm).toLocaleString('fr-FR')} unit="km" icon={BarChart3} />
        <MiniKPI label="Vehicules actifs" value={compVehicles.filter(v => v.is_active).length} unit={`/ ${compVehicles.length}`} icon={Clock} />
        {hasFuelData ? (
          <>
            <MiniKPI label="Carburant estime" value={totalFuelCost?.toLocaleString('fr-FR') || 'N/A'} unit="CHF" icon={Fuel} color="text-amber-600" subtitle={`${totalFuelL || 0} L`} />
            <MiniKPI label="Prix carburant" value={FUEL_PRICE_CHF} unit="CHF/L" icon={DollarSign} />
          </>
        ) : (
          <>
            <MiniKPI label="Carburant" value="N/A" icon={Fuel} color="text-gray-400" subtitle="Taux non configure" />
            <MiniKPI label="Cout mensuel" value="N/A" icon={DollarSign} color="text-gray-400" />
          </>
        )}
      </div>

      {hasFuelData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Repartition des Couts</h4>
            <div className="flex items-center gap-6">
              <div className="w-36 h-36 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={[{ name: 'Carburant', value: totalFuelCost, color: '#F59E0B' }]} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" strokeWidth={2} stroke="#fff">
                    <Cell fill="#F59E0B" />
                  </Pie></PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-amber-500" /><span className="text-xs text-gray-600">Carburant estime</span></div>
                  <span className="text-sm font-bold tabular-nums">{totalFuelCost} CHF</span>
                </div>
                <div className="text-[10px] text-gray-400 mt-2">Calcule: (km / 100) × taux × prix</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <SectionHeader icon={TrendingDown} title="Economies Possibles" iconBg="bg-emerald-100" iconColor="text-emerald-600" />
            <div className="text-xs text-gray-500 mt-2">
              Les economies detaillees seront disponibles avec la configuration des capteurs de carburant et des seuils de ralenti.
            </div>
          </div>
        </div>
      )}

      {/* Top vehicles by distance */}
      {topByDistance.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Vehicules les plus actifs (distance 7j)</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topByDistance} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} unit=" km" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#5E5E62' }} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 11 }} formatter={(v) => [`${v} km`, 'Distance']} />
              <Bar dataKey="distance" fill="#111" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
