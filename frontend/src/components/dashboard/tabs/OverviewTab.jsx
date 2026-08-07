import React, { useState, useEffect, useMemo } from "react";
import { API, api } from "@/lib/api";
import {
  Truck, AlertTriangle, WifiOff, Gauge, ChevronRight, Users,
  Fuel, Zap, Clock, MapPin, Route
} from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area, PieChart, Pie, Cell
} from "recharts";

// ═══ Categories — same source of truth as Analyse flotte ═══
const CATEGORIES = [
  { id: "inactif", label: "Sans activite", color: "#9CA3AF", text: "text-gray-600", seuil: "0%" },
  { id: "sous_utilise", label: "Sous-utilise", color: "#EF4444", text: "text-red-600", seuil: "< 30%" },
  { id: "modere", label: "Modere", color: "#F59E0B", text: "text-amber-600", seuil: "30–59%" },
  { id: "bonne", label: "Bonne utilisation", color: "#10B981", text: "text-emerald-600", seuil: "60–84%" },
  { id: "tres_utilise", label: "Forte utilisation", color: "#3B82F6", text: "text-blue-600", seuil: "≥ 85%" },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const dayFR = (ds) => DAYS_FR[new Date(ds + "T00:00:00").getDay()];

// ═══ Small SVG donut ═══
const Donut = ({ pct, color, size = 56 }) => {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth="7" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${(pct / 100) * c} ${c}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
};

const Panel = ({ title, children, action, testId, className = "" }) => (
  <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 ${className}`} data-testid={testId}>
    <div className="flex items-center justify-between mb-4">
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{title}</h4>
      {action}
    </div>
    {children}
  </div>
);

const initials = (name) => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
const starColorCls = (stars) => stars >= 4 ? "text-emerald-600" : stars === 3 ? "text-amber-600" : "text-red-500";

const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Previous period of identical length, immediately before fromDate
const prevRange = (fromDate, toDate) => {
  const d1 = new Date(fromDate + "T00:00:00");
  const d2 = new Date(toDate + "T00:00:00");
  const days = Math.round((d2 - d1) / 86400000) + 1;
  const pTo = new Date(d1); pTo.setDate(pTo.getDate() - 1);
  const pFrom = new Date(d1); pFrom.setDate(pFrom.getDate() - days);
  return { from: fmtDate(pFrom), to: fmtDate(pTo) };
};

// Real delta vs previous period. goodWhenUp: true|false|undefined (neutral)
const Delta = ({ curr, prev, unit = "", goodWhenUp, prevPeriod, testId }) => {
  if (prev === null || prev === undefined) return null;
  const diff = Math.round((curr - prev) * 10) / 10;
  let cls = "text-gray-400 bg-gray-50 border-gray-200";
  if (diff !== 0 && goodWhenUp !== undefined) {
    const good = goodWhenUp ? diff > 0 : diff < 0;
    cls = good ? "text-emerald-600 bg-emerald-50 border-emerald-100" : "text-red-500 bg-red-50 border-red-100";
  } else if (diff !== 0) {
    cls = "text-gray-600 bg-gray-50 border-gray-200";
  }
  const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "=";
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[9px] font-semibold ${cls}`}
      title={`Période précédente (${prevPeriod.from} au ${prevPeriod.to}) : ${prev}${unit}`}
      data-testid={testId}>
      {arrow} {diff > 0 ? "+" : ""}{diff}{unit}
    </span>
  );
};

export const OverviewTab = ({ data, fromDate, toDate, onNavigate }) => {
  const { stats, trends, efficiency } = data;
  const vehicles = stats?.vehicles || [];
  const effVehicles = efficiency?.vehicles || [];
  const effSummary = efficiency?.summary || {};
  const trendData = trends?.trends || [];

  // ---- Eco-driving (lazy, shares backend cache with Conducteurs) ----
  const [eco, setEco] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    let cancelled = false;
    setEco({ loading: true, data: null, error: null });
    api.get(`${API}/drivers/ecodriving`, { params: { from_date: fromDate, to_date: toDate }, timeout: 120000 })
      .then(res => { if (!cancelled) setEco({ loading: false, data: res.data.success ? res.data : null, error: res.data.success ? null : "indisponible" }); })
      .catch(() => { if (!cancelled) setEco({ loading: false, data: null, error: "indisponible" }); });
    return () => { cancelled = true; };
  }, [fromDate, toDate]);

  // ---- Previous period (real Navixy data via /fleet/efficiency) ----
  const prevPeriod = useMemo(() => prevRange(fromDate, toDate), [fromDate, toDate]);
  const [prevEff, setPrevEff] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setPrevEff(null);
    api.get(`${API}/fleet/efficiency`, { params: { from_date: prevPeriod.from, to_date: prevPeriod.to } })
      .then(res => { if (!cancelled) setPrevEff(res.data.success ? res.data : null); })
      .catch(() => { if (!cancelled) setPrevEff(null); });
    return () => { cancelled = true; };
  }, [prevPeriod]);

  const pm = useMemo(() => {
    if (!prevEff) return null;
    const pv = prevEff.vehicles || [];
    const used = pv.filter(v => v.active_days > 0).length;
    const catCounts = {};
    CATEGORIES.forEach(c => { catCounts[c.id] = pv.filter(v => v.category === c.id).length; });
    const totalKm = prevEff.summary?.total_mileage || 0;
    const kmPerUsed = used > 0 ? Math.round(totalKm / used) : 0;
    return { used, catCounts, totalKm: Math.round(totalKm), kmPerUsed };
  }, [prevEff]);

  // ---- Core computations (all from real endpoints) ----
  const m = useMemo(() => {
    const total = effVehicles.length;
    const used = effVehicles.filter(v => v.active_days > 0);
    const inactive = effVehicles.filter(v => v.active_days === 0);
    const catCounts = {};
    CATEGORIES.forEach(c => { catCounts[c.id] = effVehicles.filter(v => v.category === c.id).length; });
    const totalKm = Math.round((effSummary.total_mileage || 0) * 10) / 10;
    const kmPerUsed = used.length > 0 ? Math.round(totalKm / used.length) : 0;

    const offline = vehicles.filter(v => v.connection_status !== "active");
    const now = Date.now();
    const offline24h = offline.filter(v => v.last_update && (now - new Date(v.last_update).getTime()) > 86400000);
    const strongUtil = effVehicles.filter(v => v.category === "tres_utilise");
    const lowUtil = effVehicles.filter(v => v.category === "sous_utilise");

    // Fuel (only if consumption rate configured — engine returns null otherwise)
    const fuelL = vehicles.reduce((s, v) => v.fuel_used_liters !== null && v.fuel_used_liters !== undefined ? s + v.fuel_used_liters : s, 0);
    const fuelCHF = vehicles.reduce((s, v) => v.fuel_cost_chf !== null && v.fuel_cost_chf !== undefined ? s + v.fuel_cost_chf : s, 0);
    const fuelAvailable = vehicles.some(v => v.fuel_cost_chf !== null && v.fuel_cost_chf !== undefined);

    // Daily distance per category (from real daily_breakdown)
    const dailyMap = {};
    effVehicles.forEach(v => {
      (v.daily_breakdown || []).forEach(db => {
        if (!dailyMap[db.date]) {
          dailyMap[db.date] = { date: db.date, day: dayFR(db.date), total: 0, actifs: 0 };
          CATEGORIES.forEach(c => { dailyMap[db.date][c.id] = 0; });
        }
        dailyMap[db.date][v.category] = Math.round((dailyMap[db.date][v.category] + db.km) * 10) / 10;
        dailyMap[db.date].total = Math.round((dailyMap[db.date].total + db.km) * 10) / 10;
        if (db.active) dailyMap[db.date].actifs += 1;
      });
    });
    const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    const topByKm = [...effVehicles].sort((a, b) => b.period_mileage - a.period_mileage).slice(0, 5);

    return { total, used, inactive, catCounts, totalKm, kmPerUsed, offline, offline24h, strongUtil, lowUtil, fuelL, fuelCHF, fuelAvailable, daily, topByKm };
  }, [effVehicles, effSummary, vehicles]);

  // ---- Deterministic anomalies (documented rules, real data only) ----
  const anomalies = useMemo(() => {
    const list = [];
    if (m.inactive.length > 0) list.push({
      id: "inactive", sev: "red",
      title: `${m.inactive.length} vehicule${m.inactive.length > 1 ? "s" : ""} sans activite sur la periode`,
      detail: m.inactive.slice(0, 3).map(v => v.label).join(", ") + (m.inactive.length > 3 ? "…" : ""),
      nav: "analyse",
    });
    if (m.offline.length > 0) list.push({
      id: "offline", sev: "red",
      title: `${m.offline.length} vehicule${m.offline.length > 1 ? "s" : ""} hors ligne`,
      detail: m.offline24h.length > 0 ? `dont ${m.offline24h.length} depuis plus de 24 h` : "Perte de signal GPS",
      nav: "vehicles",
    });
    if (m.lowUtil.length > 0) list.push({
      id: "lowutil", sev: "amber",
      title: `${m.lowUtil.length} vehicule${m.lowUtil.length > 1 ? "s" : ""} sous-utilise${m.lowUtil.length > 1 ? "s" : ""} (< 30%)`,
      detail: m.lowUtil.slice(0, 3).map(v => v.label).join(", "),
      nav: "analyse",
    });
    if (m.strongUtil.length > 0) list.push({
      id: "strong", sev: "blue",
      title: `${m.strongUtil.length} vehicule${m.strongUtil.length > 1 ? "s" : ""} en forte utilisation (≥ 85%)`,
      detail: m.strongUtil.slice(0, 3).map(v => v.label).join(", "),
      nav: "analyse",
    });
    const lowEco = (eco.data?.drivers || []).filter(d => d.score && d.score.stars <= 2);
    if (lowEco.length > 0) list.push({
      id: "loweco", sev: "red",
      title: `${lowEco.length} conducteur${lowEco.length > 1 ? "s" : ""} avec notation eco faible (≤ 2 etoiles Navixy)`,
      detail: lowEco.map(d => d.driver_name).join(", "),
      nav: "drivers",
    });
    return list;
  }, [m, eco.data]);

  const actions = useMemo(() => {
    const list = [];
    if (m.inactive.length > 0) list.push({ t: `Evaluer la reaffectation des ${m.inactive.length} vehicules sans activite`, nav: "analyse" });
    if (m.offline.length > 0) list.push({ t: `Verifier alimentation et connectivite des ${m.offline.length} trackers hors ligne`, nav: "vehicles" });
    if (m.lowUtil.length > 0) list.push({ t: `Analyser le besoin reel des vehicules sous-utilises (${m.lowUtil.length})`, nav: "analyse" });
    const lowEco = (eco.data?.drivers || []).filter(d => d.score && d.score.stars <= 2);
    if (lowEco.length > 0) list.push({ t: `Revoir la conduite de ${lowEco.map(d => d.driver_name).join(", ")} (score eco faible)`, nav: "drivers" });
    if (list.length === 0) list.push({ t: "Aucune action requise — flotte conforme aux seuils", nav: null });
    return list;
  }, [m, eco.data]);

  const ecoDrivers = (eco.data?.drivers || []).filter(d => d.score).sort((a, b) => b.score.raw - a.score.raw).slice(0, 5);

  const usedPct = m.total > 0 ? Math.round((m.used.length / m.total) * 1000) / 10 : 0;
  const inactivePct = m.total > 0 ? Math.round((m.inactive.length / m.total) * 1000) / 10 : 0;

  const donutData = CATEGORIES.map(c => ({ name: c.label, value: m.catCounts[c.id] || 0, color: c.color })).filter(d => d.value > 0);

  const sevCls = { red: "bg-red-50 border-red-100 text-red-600", amber: "bg-amber-50 border-amber-100 text-amber-700", blue: "bg-blue-50 border-blue-100 text-blue-700" };

  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-[1600px] mx-auto" data-testid="overview-tab">

      {/* ═══ ROW 1 — KPI band ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1 — fleet summary + sparkline */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 relative overflow-hidden col-span-2 md:col-span-1" data-testid="kpi-fleet-summary">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{m.total} vehicules</div>
          <div className="mt-2 space-y-1 relative z-10">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-gray-600">Flotte active ({usedPct}%) :</span>
              <span className="font-semibold" style={{ fontFamily: "Outfit, sans-serif" }}>{m.used.length}/{m.total}</span>
              {pm && <Delta curr={m.used.length} prev={pm.used} goodWhenUp={true} prevPeriod={prevPeriod} testId="delta-active" />}
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-gray-300" />
              <span className="text-gray-600">Sans activite ({inactivePct}%) :</span>
              <span className="font-semibold" style={{ fontFamily: "Outfit, sans-serif" }}>{m.inactive.length}/{m.total}</span>
            </div>
            {m.offline.length > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-red-500 font-medium pt-1">
                <AlertTriangle size={11} /> {m.offline.length} hors ligne
              </div>
            )}
          </div>
          {m.daily.length > 1 && (
            <div className="absolute bottom-0 left-0 right-0 h-10 opacity-40">
              <ResponsiveContainer width="100%" height={40}>
                <AreaChart data={m.daily}><Area type="monotone" dataKey="total" stroke="#10B981" fill="#10B981" fillOpacity={0.25} strokeWidth={1.5} /></AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Cards 2-5 — category donuts */}
        {["sous_utilise", "modere", "bonne", "tres_utilise"].map(cid => {
          const c = CAT_MAP[cid];
          const count = m.catCounts[cid] || 0;
          const pct = m.total > 0 ? (count / m.total) * 100 : 0;
          return (
            <button key={cid} onClick={() => onNavigate?.("analyse")}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-left hover:shadow-md transition-shadow"
              data-testid={`kpi-cat-${cid}`}>
              <div className={`text-[10px] font-semibold uppercase tracking-wider ${count > 0 ? c.text : "text-gray-400"}`}>
                {c.label} ({Math.round(pct)}%)
              </div>
              <div className="flex items-center gap-3 mt-2">
                <Donut pct={pct} color={count > 0 ? c.color : "#e5e7eb"} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xl font-semibold" style={{ fontFamily: "Outfit, sans-serif" }}>{count}</span>
                    {pm && <Delta curr={count} prev={pm.catCounts[cid]}
                      goodWhenUp={cid === "sous_utilise" ? false : (cid === "bonne" || cid === "tres_utilise") ? true : undefined}
                      prevPeriod={prevPeriod} testId={`delta-cat-${cid}`} />}
                  </div>
                  <div className="text-[10px] text-gray-400">vehicule{count > 1 ? "s" : ""} · {c.seuil}</div>
                </div>
              </div>
            </button>
          );
        })}

        {/* Card 6 — km / vehicule utilise */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4" data-testid="kpi-km-per-used">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Km moy. / utilise</div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-2xl font-semibold" style={{ fontFamily: "Outfit, sans-serif" }}>{m.kmPerUsed}</span>
            {pm && <Delta curr={m.kmPerUsed} prev={pm.kmPerUsed} unit=" km" prevPeriod={prevPeriod} testId="delta-km-per-used" />}
          </div>
          <div className="text-[10px] text-gray-400">{Math.round(m.totalKm)} km / {m.used.length} vehicule{m.used.length > 1 ? "s" : ""} utilise{m.used.length > 1 ? "s" : ""}
            {pm && <> <Delta curr={Math.round(m.totalKm)} prev={pm.totalKm} unit=" km" prevPeriod={prevPeriod} testId="delta-total-km" /></>}
          </div>
          {m.daily.length > 1 && (
            <div className="h-9 mt-1">
              <ResponsiveContainer width="100%" height={36}>
                <ComposedChart data={m.daily}><Bar dataKey="total" fill="#3B82F6" radius={[2, 2, 0, 0]} /></ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ═══ ROW 2 — repartition / statut & finance / activite quotidienne ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Repartition */}
        <Panel title="Repartition des vehicules" testId="panel-repartition" className="lg:col-span-3">
          <div className="w-full h-4 rounded-full overflow-hidden flex mb-4">
            {CATEGORIES.map(c => {
              const count = m.catCounts[c.id] || 0;
              if (count === 0) return null;
              return <div key={c.id} style={{ width: `${(count / Math.max(1, m.total)) * 100}%`, background: c.color }}
                className="h-full first:rounded-l-full last:rounded-r-full" title={`${c.label} : ${count}`} />;
            })}
          </div>
          <div className="space-y-2">
            {CATEGORIES.map(c => (
              <div key={c.id} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c.color }} />
                  <span className="text-gray-600">{c.label}</span>
                  <span className="text-gray-300">{c.seuil}</span>
                </div>
                <span className="font-semibold" style={{ fontFamily: "Outfit, sans-serif" }}>{m.catCounts[c.id] || 0}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Statut & impact financier */}
        <Panel title="Statut & impact financier" testId="panel-finance" className="lg:col-span-3">
          <div className="flex items-center justify-center">
            <div className="relative">
              <PieChart width={150} height={150}>
                <Pie data={donutData.length > 0 ? donutData : [{ name: "Aucune donnee", value: 1, color: "#f3f4f6" }]}
                  dataKey="value" innerRadius={45} outerRadius={65} paddingAngle={2} startAngle={90} endAngle={-270}>
                  {(donutData.length > 0 ? donutData : [{ color: "#f3f4f6" }]).map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 11 }} />
              </PieChart>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-semibold" style={{ fontFamily: "Outfit, sans-serif" }}>{m.total}</span>
                <span className="text-[9px] text-gray-400 uppercase">vehicules</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5" data-testid="fuel-impact">
            {m.fuelAvailable ? (
              <>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-gray-600"><Fuel size={12} className="text-gray-400" />Carburant estime</span>
                  <span className="font-semibold" style={{ fontFamily: "Outfit, sans-serif" }}>{Math.round(m.fuelL * 10) / 10} L</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-600">Cout carburant (periode)</span>
                  <span className="font-semibold text-red-500" style={{ fontFamily: "Outfit, sans-serif" }}>{Math.round(m.fuelCHF)} CHF</span>
                </div>
                <div className="text-[9px] text-gray-400">Base : km reels × taux configure (onglet Couts)</div>
              </>
            ) : (
              <div className="text-[10px] text-gray-400">
                Cout carburant indisponible — configurer un taux de consommation dans l'onglet <button onClick={() => onNavigate?.("costs")} className="text-blue-600 hover:underline" data-testid="link-configure-fuel">Couts</button>.
              </div>
            )}
          </div>
        </Panel>

        {/* Activite quotidienne */}
        <Panel title="Activite quotidienne" testId="panel-daily-activity" className="lg:col-span-6">
          {m.daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={m.daily} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(v) => dayFR(v)} tick={{ fontSize: 10, fill: "#5E5E62" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#8A8A8E" }} axisLine={false} tickLine={false} width={40} unit=" km" />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 11 }}
                  labelFormatter={(v) => { const d = new Date(v + "T00:00:00"); return `${dayFR(v)} ${d.getDate()}/${d.getMonth() + 1} — km par categorie de vehicule`; }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {CATEGORIES.filter(c => c.id !== "inactif").map(c => (
                  <Bar key={c.id} dataKey={c.id} name={c.label} stackId="km" fill={c.color} />
                ))}
                <Line type="monotone" dataKey="total" name="Total km/jour" stroke="#111" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-xs text-gray-400">Aucune donnee quotidienne sur la periode</div>
          )}
          <div className="text-[9px] text-gray-400 mt-1">Barres : km/jour repartis selon la categorie d'utilisation du vehicule sur la periode — Source : tracker/stats/mileage/read</div>
        </Panel>
      </div>

      {/* ═══ ROW 3 — anomalies / conducteurs eco / actions + snapshot ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Anomalies */}
        <Panel title="Anomalies & alertes" testId="panel-anomalies" className="lg:col-span-4">
          {anomalies.length === 0 ? (
            <div className="text-xs text-gray-400 py-6 text-center">Aucune anomalie detectee sur la periode</div>
          ) : (
            <div className="space-y-2">
              {anomalies.map(a => (
                <button key={a.id} onClick={() => a.nav && onNavigate?.(a.nav)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors hover:brightness-95 ${sevCls[a.sev]}`}
                  data-testid={`anomaly-${a.id}`}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[11px] font-semibold">{a.title}</div>
                      <div className="text-[10px] opacity-70 mt-0.5">{a.detail}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="text-[9px] text-gray-400 mt-3">Regles deterministes sur donnees Navixy — aucun seuil arbitraire non documente</div>
        </Panel>

        {/* Conducteurs & score eco */}
        <Panel title="Conducteurs & score eco" testId="panel-eco-drivers" className="lg:col-span-4"
          action={<button onClick={() => onNavigate?.("drivers")} className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5" data-testid="link-drivers">Detail<ChevronRight size={11} /></button>}>
          {eco.loading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
              <span className="text-[10px] text-gray-400">Rapport Navixy « Qualite de conduite »…</span>
            </div>
          ) : ecoDrivers.length === 0 ? (
            <div className="text-xs text-gray-400 py-6 text-center">Aucune donnee eco-conduite attribuable sur la periode</div>
          ) : (
            <div className="space-y-2">
              {ecoDrivers.map((d, i) => (
                <button key={d.employee_id} onClick={() => onNavigate?.("drivers")}
                  className="w-full flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                  data-testid={`eco-driver-${d.employee_id}`}>
                  <span className="text-[10px] font-semibold text-gray-400 w-3">{i + 1}</span>
                  <span className="w-8 h-8 rounded-full bg-[#111] text-white flex items-center justify-center text-[10px] font-semibold shrink-0">{initials(d.driver_name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-gray-900 truncate">{d.driver_name}</div>
                    <div className="text-[10px] text-gray-400">{Math.round(d.distance_km)} km · {d.trips_count} trajets</div>
                  </div>
                  <span className={`text-xs font-semibold ${starColorCls(d.score.stars)}`} style={{ fontFamily: "Outfit, sans-serif" }} title="Notation native Navixy">{d.score.display}</span>
                </button>
              ))}
            </div>
          )}
          <div className="text-[9px] text-gray-400 mt-3">Score natif Navixy — Rapport « Qualite de conduite » (plugin 46)</div>
        </Panel>

        {/* Actions + snapshot */}
        <div className="lg:col-span-4 space-y-4">
          <Panel title="Actions recommandees" testId="panel-actions">
            <div className="space-y-1.5">
              {actions.map((a, i) => (
                <button key={i} onClick={() => a.nav && onNavigate?.(a.nav)} disabled={!a.nav}
                  className="w-full flex items-center justify-between gap-2 p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left disabled:hover:bg-gray-50"
                  data-testid={`action-${i}`}>
                  <span className="text-[11px] text-gray-700">{a.t}</span>
                  {a.nav && <ChevronRight size={13} className="text-gray-300 shrink-0" />}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Vehicule snapshot" testId="panel-snapshot"
            action={<button onClick={() => onNavigate?.("vehicles")} className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5" data-testid="link-vehicles">Tous<ChevronRight size={11} /></button>}>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                  <th className="text-left py-1.5">Vehicule</th>
                  <th className="text-left py-1.5">Statut</th>
                  <th className="text-right py-1.5">Km</th>
                </tr>
              </thead>
              <tbody>
                {m.topByKm.map(v => {
                  const sv = vehicles.find(x => x.tracker_id === v.tracker_id);
                  const online = sv?.connection_status === "active";
                  return (
                    <tr key={v.tracker_id} className="border-b border-gray-50" data-testid={`snapshot-${v.tracker_id}`}>
                      <td className="py-2 font-medium text-gray-800 truncate max-w-[120px]" title={v.label}>{v.label}</td>
                      <td className="py-2">
                        <span className={`inline-flex items-center gap-1 ${online ? "text-emerald-600" : "text-gray-400"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-gray-300"}`} />
                          {online ? "Actif" : "Hors ligne"}
                        </span>
                      </td>
                      <td className="py-2 text-right font-semibold tabular-nums" style={{ fontFamily: "Outfit, sans-serif" }}>{Math.round(v.period_mileage)} km</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        </div>
      </div>

      {/* ═══ Source footer ═══ */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-200">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-[10px] text-gray-500">Donnees 100% Navixy — aucune estimation. Categories : sans activite 0% · sous-utilise &lt;30% · modere 30–59% · bonne 60–84% · forte ≥85% (jours actifs / jours periode).{pm ? ` Comparaison vs periode precedente : ${prevPeriod.from} au ${prevPeriod.to}.` : ""}</span>
        <span className="text-[10px] text-gray-400 ml-auto">{fromDate} au {toDate}</span>
      </div>
    </div>
  );
};
