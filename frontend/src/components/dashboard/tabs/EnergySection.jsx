import { useState, useEffect, useMemo } from "react";
import { API, api } from "@/lib/api";
import { Fuel, Zap, Leaf, HelpCircle, X, ChevronRight, WifiOff, CalendarClock, Gauge } from "lucide-react";

// Sources : GET /api/vehicles/capabilities (cache backend 6h) + GET /api/vehicles/admin (Mongo).
// Aucune donnée simulée : une valeur inconnue reste null / "—", jamais 0.

const ENERGY_META = {
  thermique: { label: "Thermique", icon: Fuel, cls: "text-gray-700" },
  electrique: { label: "Électrique", icon: Zap, cls: "text-emerald-600" },
  hybride: { label: "Hybride", icon: Leaf, cls: "text-teal-600" },
  inconnu: { label: "Inconnu", icon: HelpCircle, cls: "text-gray-400" },
};
const energyOf = (m) => {
  const n = m?.normalized;
  if (n === "diesel" || n === "petrol") return "thermique";
  if (n === "electric") return "electrique";
  if (n === "hybrid" || n === "phev") return "hybride";
  return "inconnu";
};
const within30d = (ds) => {
  if (!ds) return null;
  const days = Math.round((new Date(ds + "T00:00:00") - new Date().setHours(0, 0, 0, 0)) / 86400000);
  return days <= 30 ? days : null;
};

const Drawer = ({ title, items, onClose, onOpenVehicle }) => (
  <>
    <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-white shadow-2xl z-50 overflow-y-auto" data-testid="kpi-drawer">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
          <p className="text-[10px] text-gray-400">{items.length} véhicule{items.length > 1 ? "s" : ""} — cliquez pour ouvrir la fiche</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" data-testid="kpi-drawer-close"><X size={16} className="text-gray-500" /></button>
      </div>
      <div className="p-3">
        {items.map((it) => (
          <button key={it.tid} onClick={() => onOpenVehicle?.(it.tid)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 text-left transition-colors"
            data-testid={`drawer-vehicle-${it.tid}`}>
            <div>
              <div className="text-xs font-medium text-gray-900">{it.label}</div>
              {it.sub && <div className="text-[10px] text-gray-400">{it.sub}</div>}
            </div>
            <div className="flex items-center gap-2">
              {it.value != null && <span className={`text-xs font-semibold tabular-nums ${it.valueCls || "text-gray-700"}`}>{it.value}</span>}
              <ChevronRight size={13} className="text-gray-300" />
            </div>
          </button>
        ))}
        {items.length === 0 && <div className="text-xs text-gray-400 text-center py-8">Aucun véhicule</div>}
      </div>
    </div>
  </>
);

const KpiTile = ({ label, value, sub, icon: Icon, onClick, testId, accent }) => (
  <button onClick={onClick} disabled={!onClick}
    className={`text-left bg-white rounded-xl border border-gray-200 p-4 transition-all ${onClick ? "hover:border-gray-300 hover:shadow-sm cursor-pointer" : "cursor-default"}`}
    data-testid={testId}>
    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
      {Icon && <Icon size={11} className={accent || ""} />}{label}
    </div>
    <div className="text-xl font-semibold text-gray-900" style={{ fontFamily: "Outfit, sans-serif" }}>{value}</div>
    {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
  </button>
);

export const EnergySection = ({ data, onOpenVehicle }) => {
  const [caps, setCaps] = useState(null);
  const [adminRecs, setAdminRecs] = useState({});
  const [drawer, setDrawer] = useState(null);

  useEffect(() => {
    api.get(`${API}/vehicles/capabilities`).then(r => { if (r.data.success) setCaps(r.data); }).catch(() => {});
    api.get(`${API}/vehicles/admin`).then(r => { if (r.data.success) setAdminRecs(r.data.records || {}); }).catch(() => {});
  }, []);

  const vehicles = data.stats?.vehicles || [];
  const effByTid = useMemo(() => Object.fromEntries((data.efficiency?.vehicles || []).map(v => [v.tracker_id, v])), [data.efficiency]);
  const threshold = caps?.fuel_low_threshold_pct ?? 20;

  const m = useMemo(() => {
    const recs = caps?.records || {};
    const mix = { thermique: [], electrique: [], hybride: [], inconnu: [] };
    const fuelLow = [], noEnergy = [];
    for (const v of vehicles) {
      const c = recs[String(v.tracker_id)];
      const item = { tid: v.tracker_id, label: v.label };
      mix[energyOf(c?.motorisation)].push(item);
      const fl = c?.capabilities?.fuel_level;
      if (fl?.available && typeof fl.value === "number") {
        if (fl.value < threshold)
          fuelLow.push({ ...item, value: `${Math.round(fl.value)} %`, valueCls: "text-red-600",
                         sub: fl.status === "STALE" ? `Donnée ancienne (${fl.update_time})` : `MAJ ${fl.update_time}` });
      } else {
        noEnergy.push({ ...item, sub: "Aucune donnée énergie exploitable (capteur absent)" });
      }
    }
    const offline = vehicles.filter(v => v.connection_status !== "active")
      .map(v => ({ tid: v.tracker_id, label: v.label, sub: v.last_update ? `Dernier signal : ${v.last_update}` : "Jamais connecté" }));
    const byCat = (cat) => (data.efficiency?.vehicles || []).filter(v => v.category === cat)
      .map(v => ({ tid: v.tracker_id, label: v.label, value: `${v.utilization_pct} %`, sub: `${v.active_days}/${v.total_days} jours actifs · ${v.period_mileage} km` }));
    const deadlines = [];
    for (const [tid, rec] of Object.entries(adminRecs)) {
      const label = vehicles.find(v => String(v.tracker_id) === tid)?.label || `Véhicule ${tid}`;
      const push = (what, ds) => { const d = within30d(ds); if (d !== null) deadlines.push({ tid: Number(tid), label, sub: what, value: d < 0 ? "échu" : `${d} j`, valueCls: d < 0 ? "text-red-600" : "text-amber-600", _d: d }); };
      push("Fin de leasing", rec.leasing?.date_fin);
      push("Fin d'assurance", rec.assurance?.date_fin);
      (rec.controles || []).filter(ct => ct.due_date && !ct.done_date).forEach(ct => push(`Contrôle : ${ct.label}`, ct.due_date));
      push("Prochaine maintenance", rec.general?.prochaine_maintenance);
      push("Prochaine expertise", rec.general?.prochaine_expertise);
    }
    deadlines.sort((a, b) => a._d - b._d);
    return { mix, fuelLow, noEnergy, offline, sousUtilises: byCat("sous_utilise"), fortement: byCat("tres_utilise"), deadlines };
  }, [caps, vehicles, adminRecs, data.efficiency, threshold]);

  if (!vehicles.length) return null;
  const open = (title, items) => setDrawer({ title, items });

  return (
    <div className="space-y-4" data-testid="energy-section">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Énergie flotte */}
        <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="energy-mix">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Énergie flotte</div>
          {!caps ? <div className="text-xs text-gray-400">Chargement des capacités…</div> : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(ENERGY_META).map(([k, meta]) => (
                <button key={k} onClick={() => open(`Énergie : ${meta.label}`, m.mix[k])} disabled={!m.mix[k].length}
                  className={`rounded-lg border border-gray-100 bg-gray-50/60 p-3 text-left transition-colors ${m.mix[k].length ? "hover:bg-gray-100 cursor-pointer" : "opacity-50 cursor-default"}`}
                  data-testid={`energy-mix-${k}`}>
                  <meta.icon size={13} className={meta.cls} />
                  <div className="text-lg font-semibold mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>{m.mix[k].length}</div>
                  <div className="text-[10px] text-gray-500">{meta.label}</div>
                </button>
              ))}
            </div>
          )}
          <p className="text-[9px] text-gray-400 mt-2">Source : motorisation garage + correction LOGITRAK (capabilities). Aucune classification automatique par nom.</p>
        </div>

        {/* Alertes énergie */}
        <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="energy-alerts">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Alertes énergie <span className="normal-case font-normal">(seuil faible : {threshold} %)</span></div>
          {!caps ? <div className="text-xs text-gray-400">Chargement…</div> : (
            <div className="space-y-1.5">
              <button onClick={() => open(`Carburant faible (< ${threshold} %)`, m.fuelLow)} disabled={!m.fuelLow.length}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs ${m.fuelLow.length ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-gray-50 text-gray-400"}`}
                data-testid="alert-fuel-low">
                <span className="flex items-center gap-1.5"><Fuel size={12} />Carburant faible</span>
                <span className="font-semibold">{m.fuelLow.length}</span>
              </button>
              <button onClick={() => open("Sans donnée énergie exploitable", m.noEnergy)} disabled={!m.noEnergy.length}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs ${m.noEnergy.length ? "bg-gray-50 text-gray-600 hover:bg-gray-100" : "bg-gray-50 text-gray-400"}`}
                data-testid="alert-no-energy">
                <span className="flex items-center gap-1.5"><HelpCircle size={12} />Sans donnée énergie exploitable</span>
                <span className="font-semibold">{m.noEnergy.length}</span>
              </button>
              <p className="text-[9px] text-gray-400 pt-1">Niveau réel via capteur obd_fuel uniquement. Donnée absente ≠ niveau faible — jamais de 0 fabriqué. Aucune donnée EV affichée pour les véhicules qui n'en remontent pas.</p>
            </div>
          )}
        </div>
      </div>

      {/* À surveiller — populations cliquables */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="watch-kpis">
        <KpiTile label="Hors ligne" value={m.offline.length} icon={WifiOff} accent="text-red-400" testId="kpi-offline"
          onClick={m.offline.length ? () => open("Véhicules hors ligne", m.offline) : undefined} sub="instantané" />
        <KpiTile label="Sous-utilisés" value={m.sousUtilises.length} icon={Gauge} accent="text-orange-400" testId="kpi-underused"
          onClick={m.sousUtilises.length ? () => open("Véhicules sous-utilisés (< 30 %)", m.sousUtilises) : undefined} sub="sur la période" />
        <KpiTile label="Forte utilisation" value={m.fortement.length} icon={Gauge} accent="text-blue-400" testId="kpi-highuse"
          onClick={m.fortement.length ? () => open("Forte utilisation (≥ 85 %)", m.fortement) : undefined} sub="sur la période" />
        <KpiTile label="Échéances ≤ 30 j" value={m.deadlines.length} icon={CalendarClock} accent="text-amber-500" testId="kpi-deadlines"
          onClick={m.deadlines.length ? () => open("Documents & contrôles à échéance", m.deadlines) : undefined} sub="leasing · assurance · contrôles" />
      </div>

      {drawer && <Drawer title={drawer.title} items={drawer.items} onClose={() => setDrawer(null)} onOpenVehicle={(tid) => { setDrawer(null); onOpenVehicle?.(tid); }} />}
    </div>
  );
};
