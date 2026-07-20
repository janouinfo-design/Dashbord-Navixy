import { useMemo } from "react";
import { MiniKPI, SectionHeader } from "@/components/shared/UIComponents";
import { FUEL_PRICE_CHF, calcFinancialRisk } from "@/lib/metrics";
import { DollarSign, Fuel, Clock, TrendingDown, BarChart3, AlertTriangle, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export const CostsTab = ({ data }) => {
  const { stats, trends, comparison } = data;
  const compVehicles = comparison?.vehicles || [];
  const vehicles = stats?.vehicles || [];
  const totalKm = stats?.summary?.total_mileage || 0;
  const totalFuelL = trends?.summary?.total_fuel || 0;
  const totalFuelCost = Math.round(totalFuelL * FUEL_PRICE_CHF);
  const risk = useMemo(() => calcFinancialRisk(compVehicles, trends), [compVehicles, trends]);

  const maintenanceCostEstimate = Math.round(totalKm * 0.05);
  const annualEstimate = Math.round((totalFuelCost + risk.idleCost + risk.fuelWaste + maintenanceCostEstimate) * 52 / 7);
  const monthlyEstimate = Math.round(annualEstimate / 12);

  // Savings potential
  const idleSaving = Math.round(risk.idleCost * 0.6);
  const fuelSaving = Math.round(risk.fuelWaste * 0.5);
  const totalSaving = idleSaving + fuelSaving;

  // Cost breakdown pie
  const costBreakdown = [
    { name: 'Carburant', value: totalFuelCost, color: '#F59E0B' },
    { name: 'Ralenti', value: risk.idleCost, color: '#EF4444' },
    { name: 'Surconsommation', value: risk.fuelWaste, color: '#F97316' },
    { name: 'Maintenance', value: maintenanceCostEstimate, color: '#8B5CF6' },
  ].filter(d => d.value > 0);

  // Top consumers
  const topConsumers = [...compVehicles].filter(v => v.fuel_efficiency > 0).sort((a, b) => b.fuel_efficiency - a.fuel_efficiency).slice(0, 8)
    .map(v => ({ name: v.label.length > 14 ? v.label.substring(0, 14) + '...' : v.label, conso: v.fuel_efficiency, cost: Math.round((v.total_distance_week || 0) * v.fuel_efficiency / 100 * FUEL_PRICE_CHF) }));

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-[1600px] mx-auto" data-testid="costs-tab">
      {/* KPIs - ONLY financial */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MiniKPI label="Carburant" value={totalFuelCost.toLocaleString('fr-FR')} unit="CHF" icon={Fuel} color="text-amber-600" subtitle={`${totalFuelL.toFixed(0)} L`} />
        <MiniKPI label="Perte ralenti" value={risk.idleCost} unit="CHF" icon={Clock} color="text-red-500" />
        <MiniKPI label="Surconsommation" value={risk.fuelWaste} unit="CHF" icon={AlertTriangle} color="text-orange-500" />
        <MiniKPI label="Maintenance est." value={maintenanceCostEstimate} unit="CHF" icon={Zap} subtitle="~0.05 CHF/km" />
        <MiniKPI label="Cout mensuel" value={monthlyEstimate.toLocaleString('fr-FR')} unit="CHF" icon={DollarSign} color="text-gray-900" />
        <MiniKPI label="Cout annuel" value={annualEstimate.toLocaleString('fr-FR')} unit="CHF" icon={BarChart3} color="text-gray-900" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Repartition des Couts</h4>
          <div className="flex items-center gap-6">
            <div className="w-36 h-36 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={costBreakdown} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" strokeWidth={2} stroke="#fff">
                  {costBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie></PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 flex-1">
              {costBreakdown.map(item => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} /><span className="text-xs text-gray-600">{item.name}</span></div>
                  <span className="text-sm font-bold tabular-nums">{item.value} CHF</span>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-200 flex justify-between"><span className="text-xs font-medium text-gray-600">Total semaine</span><span className="text-sm font-bold">{(totalFuelCost + risk.idleCost + risk.fuelWaste + maintenanceCostEstimate)} CHF</span></div>
            </div>
          </div>
        </div>

        {/* Savings */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionHeader icon={TrendingDown} title="Economies Possibles" iconBg="bg-emerald-100" iconColor="text-emerald-600" />
          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-2"><Clock size={14} className="text-emerald-600" /><div><div className="text-xs font-medium text-emerald-800">Reduire le ralenti de 60%</div><div className="text-[10px] text-emerald-600">Couper le moteur a l'arret, formation conducteurs</div></div></div>
              <span className="text-sm font-bold text-emerald-700">-{idleSaving} CHF</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-2"><Fuel size={14} className="text-emerald-600" /><div><div className="text-xs font-medium text-emerald-800">Reduire la surconsommation de 50%</div><div className="text-[10px] text-emerald-600">Eco-conduite, pression pneus, chargement</div></div></div>
              <span className="text-sm font-bold text-emerald-700">-{fuelSaving} CHF</span>
            </div>
            <div className="pt-3 border-t border-gray-200 flex justify-between">
              <span className="text-sm font-medium text-gray-700">Economie potentielle / semaine</span>
              <span className="text-lg font-bold text-emerald-600" style={{ fontFamily: 'Outfit, sans-serif' }}>{totalSaving} CHF</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Par mois: ~{Math.round(totalSaving * 4.3)} CHF</span>
              <span>Par an: ~{Math.round(totalSaving * 52).toLocaleString('fr-FR')} CHF</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top consumers */}
      {topConsumers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-4">Vehicules les plus couteux (carburant)</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topConsumers} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#8A8A8E' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#5E5E62' }} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 11 }} formatter={(v) => [`${v} L/100km`, 'Conso']} />
              <Bar dataKey="conso" fill="#F59E0B" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
