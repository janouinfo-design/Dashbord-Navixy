import { useState, useEffect } from "react";
import { MiniKPI, SectionHeader } from "@/components/shared/UIComponents";
import { API, api } from "@/lib/api";
import { DollarSign, Fuel, Clock, TrendingDown, BarChart3, Settings, Save, Check, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export const CostsTab = ({ data, onRefresh }) => {
  const { stats, comparison } = data;
  const compVehicles = comparison?.vehicles || [];
  const vehicles = stats?.vehicles || [];
  const totalKm = stats?.summary?.total_mileage || 0;

  // Fuel config state
  const [fuelConfig, setFuelConfig] = useState(null);
  const [editPrice, setEditPrice] = useState('');
  const [editRate, setEditRate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get(`${API}/config/fuel`).then(res => {
      if (res.data.success) {
        const cfg = res.data.fuel_config;
        setFuelConfig(cfg);
        setEditPrice(String(cfg.default_fuel_price || 2.0));
        setEditRate(cfg.default_consumption_rate != null ? String(cfg.default_consumption_rate) : '');
      }
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { default_fuel_price: parseFloat(editPrice) || 2.0 };
      if (editRate.trim() !== '') body.default_consumption_rate = parseFloat(editRate);
      else body.default_consumption_rate = null;
      const res = await api.put(`${API}/config/fuel`, body);
      if (res.data.success) {
        setFuelConfig(res.data.fuel_config);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        if (onRefresh) onRefresh();
      }
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const hasFuelData = vehicles.some(v => v.fuel_cost_chf != null);
  const totalFuelCost = hasFuelData ? Math.round(vehicles.reduce((s, v) => s + (v.fuel_cost_chf || 0), 0)) : null;
  const totalFuelL = hasFuelData ? Math.round(vehicles.reduce((s, v) => s + (v.fuel_used_liters || 0), 0) * 10) / 10 : null;
  const fuelPrice = fuelConfig?.default_fuel_price || 2.0;

  const topByDistance = [...compVehicles]
    .filter(v => (v.total_distance_week || 0) > 0)
    .sort((a, b) => (b.total_distance_week || 0) - (a.total_distance_week || 0))
    .slice(0, 8)
    .map(v => ({ name: v.label.length > 14 ? v.label.substring(0, 14) + '...' : v.label, distance: v.total_distance_week || 0 }));

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-[1600px] mx-auto" data-testid="costs-tab">
      {/* Fuel Config Panel */}
      <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="fuel-config-panel">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-100 rounded-lg"><Settings size={14} className="text-amber-600" /></div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-800" style={{ fontFamily: 'Outfit, sans-serif' }}>Configuration Carburant</h3>
          </div>
          {saved && <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><Check size={14} /> Sauvegarde</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1.5">Prix carburant (CHF/L)</label>
            <input
              type="number" step="0.01" min="0" value={editPrice}
              onChange={e => setEditPrice(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#111]/10 focus:border-gray-400"
              data-testid="fuel-price-input"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1.5">Taux consommation (L/100km)</label>
            <input
              type="number" step="0.1" min="0" value={editRate}
              onChange={e => setEditRate(e.target.value)}
              placeholder="Ex: 8.5"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#111]/10 focus:border-gray-400"
              data-testid="fuel-rate-input"
            />
            <div className="text-[9px] text-gray-400 mt-1">Laisser vide pour desactiver le calcul carburant</div>
          </div>
          <button
            onClick={handleSave} disabled={saving}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-[#111] text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors h-[38px]"
            data-testid="fuel-save-btn"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Sauvegarder
          </button>
        </div>
        {fuelConfig?.fuel_types && (
          <div className="mt-3 flex items-center gap-4 text-[10px] text-gray-400">
            <span>Diesel: {fuelConfig.fuel_types.diesel} CHF/L</span>
            <span>Essence: {fuelConfig.fuel_types.essence} CHF/L</span>
            <span>Electrique: {fuelConfig.fuel_types.electric_kwh} CHF/kWh</span>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniKPI label="Distance totale" value={Math.round(totalKm).toLocaleString('fr-FR')} unit="km" icon={BarChart3} />
        <MiniKPI label="Vehicules actifs" value={compVehicles.filter(v => v.is_active).length} unit={`/ ${compVehicles.length}`} icon={Clock} />
        {hasFuelData ? (
          <>
            <MiniKPI label="Carburant estime" value={totalFuelCost?.toLocaleString('fr-FR') || 'N/A'} unit="CHF" icon={Fuel} color="text-amber-600" subtitle={`${totalFuelL || 0} L`} />
            <MiniKPI label="Prix carburant" value={fuelPrice} unit="CHF/L" icon={DollarSign} />
          </>
        ) : (
          <>
            <MiniKPI label="Carburant" value="N/A" icon={Fuel} color="text-gray-400" subtitle="Taux non configure" />
            <MiniKPI label="Cout estime" value="N/A" icon={DollarSign} color="text-gray-400" />
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
                <div className="text-[10px] text-gray-400 mt-2">Calcule: (km / 100) x {fuelConfig?.default_consumption_rate || '?'} L x {fuelPrice} CHF</div>
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
