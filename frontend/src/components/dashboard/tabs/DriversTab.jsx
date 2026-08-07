import React, { useState, useEffect, useMemo } from "react";
import { API, api } from "@/lib/api";
import {
  Users, Truck, Gauge, MapPin, Clock, Route, AlertTriangle, X,
  ChevronRight, Search, ExternalLink, Info, TimerOff, CornerUpRight,
  TrendingDown, TrendingUp, Zap
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

// ---- Helpers ----
const fmtDur = (sec) => {
  if (sec === null || sec === undefined) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")}`;
  return `${m} min`;
};

const fmtDurShort = (sec) => {
  if (!sec && sec !== 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m} min ${s > 0 ? s + " s" : ""}`.trim() : `${s} s`;
};

const scoreColor = (stars) => {
  if (stars === null || stars === undefined) return "text-gray-400";
  if (stars >= 4) return "text-emerald-600";
  if (stars === 3) return "text-amber-600";
  return "text-red-500";
};

const CATEGORY_LABELS = {
  braking: "Freinage brusque",
  acceleration: "Accélération brusque",
  turning: "Virage brusque",
};

const EVENT_COLORS = { speeding: "#FF807D", harsh_driving: "#3F9EDE", idling: "#8FCC74" };

const cleanAddress = (a) => (a || "").replace(/^\[[^\]]*\]\s*/, "");

const eventLabel = (ev) => {
  if (ev.kind === "idling") return "Ralenti excessif";
  if (ev.kind === "speeding") return "Excès de vitesse";
  return CATEGORY_LABELS[ev.category] || ev.type || "Événement";
};

// ---- Status badge ----
const StatusBadge = ({ driver }) => {
  if (!driver.has_vehicle)
    return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-gray-100 text-gray-500" data-testid={`status-no-vehicle-${driver.employee_id}`}>Aucun véhicule assigné</span>;
  if (!driver.has_activity)
    return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-100" data-testid={`status-no-data-${driver.employee_id}`}>Aucune donnée sur la période</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100" data-testid={`status-active-${driver.employee_id}`}>Données disponibles</span>;
};

// ---- Score display (Navixy native) ----
const ScoreDisplay = ({ score, size = "sm" }) => {
  if (!score) return <span className="text-gray-300">—</span>;
  const cls = scoreColor(score.stars);
  return (
    <span className={`font-semibold ${cls} ${size === "lg" ? "text-xl" : "text-sm"}`} style={{ fontFamily: "Outfit, sans-serif" }} title="Notation native Navixy (plugin Qualité de conduite)">
      {score.display}
    </span>
  );
};

// ---- KPI card ----
const KPI = ({ label, value, sub, icon: Icon, color, testId }) => (
  <div className="kpi-card bg-white rounded-xl p-5 border border-gray-200 min-h-[100px] flex flex-col justify-between" data-testid={testId}>
    <div className="flex items-center gap-1.5"><Icon size={13} className="text-gray-400" /><span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{label}</span></div>
    <div>
      <div className={`text-2xl font-semibold ${color || "text-gray-900"}`} style={{ fontFamily: "Outfit, sans-serif" }}>{value}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  </div>
);

// ---- "Pourquoi ce score" row ----
const ScoreReasonRow = ({ icon: Icon, label, main, sub, testId }) => (
  <div className="flex items-start justify-between p-3 bg-gray-50 rounded-lg" data-testid={testId}>
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center"><Icon size={14} className="text-gray-500" /></div>
      <div>
        <div className="text-xs font-medium text-gray-800">{label}</div>
        {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
    <div className="text-sm font-semibold text-gray-900 text-right" style={{ fontFamily: "Outfit, sans-serif" }}>{main}</div>
  </div>
);

// ---- Driver drawer ----
const DriverDrawer = ({ driver, onClose }) => {
  const ev = driver.events;
  const daily = (driver.daily || []).map((d) => ({
    ...d,
    shortLabel: (d.label || "").replace(/\s*\d{4}$/, ""),
  }));
  const hasDailyData = daily.some((d) => d.speeding + d.harsh_driving + d.idling > 0);

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[520px] bg-white shadow-2xl z-50 overflow-y-auto" data-testid="driver-drawer">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
        <div>
          <h3 className="text-lg font-semibold" style={{ fontFamily: "Outfit, sans-serif" }}>{driver.driver_name}</h3>
          <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
            <Truck size={11} />
            {driver.vehicle_label || "Aucun véhicule assigné"}
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" data-testid="drawer-close"><X size={18} className="text-gray-500" /></button>
      </div>

      <div className="p-6 space-y-6">
        {!driver.has_vehicle && (
          <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-500" data-testid="drawer-no-vehicle">
            Ce conducteur n'a aucun véhicule assigné dans Navixy. Aucune donnée de conduite ne peut lui être attribuée.
          </div>
        )}
        {driver.has_vehicle && !driver.has_activity && (
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700" data-testid="drawer-no-data">
            Véhicule assigné ({driver.vehicle_label}) mais aucune donnée de conduite sur la période sélectionnée.
          </div>
        )}

        {driver.has_activity && (
          <>
            {/* Score */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl" data-testid="drawer-score">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Score éco-conduite</div>
                <ScoreDisplay score={driver.score} size="lg" />
                <div className="text-[10px] text-gray-400 mt-1">Notation native Navixy — Rapport « Qualité de conduite » (plugin 46), affichée telle quelle</div>
              </div>
              <div className={`text-4xl font-bold ${scoreColor(driver.score?.stars)}`} style={{ fontFamily: "Outfit, sans-serif" }}>
                {driver.score ? Math.round(driver.score.raw) : "—"}<span className="text-base text-gray-400 font-normal">/100</span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { l: "Distance", v: `${Math.round(driver.distance_km)} km`, i: MapPin },
                { l: "Trajets", v: driver.trips_count, i: Route },
                { l: "Temps de conduite", v: fmtDur(driver.driving_time_sec), i: Clock },
              ].map((s, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1"><s.i size={12} className="text-gray-400" /><span className="text-[9px] text-gray-400 uppercase">{s.l}</span></div>
                  <div className="text-lg font-semibold text-gray-900" style={{ fontFamily: "Outfit, sans-serif" }}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Pourquoi ce score */}
            <div data-testid="drawer-why-score">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Pourquoi ce score ?</h4>
              <div className="space-y-2">
                <ScoreReasonRow icon={TrendingDown} label="Freinages brusques"
                  main={ev.braking.per_100km !== null ? `${ev.braking.per_100km} /100 km` : "—"}
                  sub={`${ev.braking.count} événement${ev.braking.count > 1 ? "s" : ""} sur ${Math.round(driver.distance_km)} km`}
                  testId="reason-braking" />
                <ScoreReasonRow icon={TrendingUp} label="Accélérations brusques"
                  main={ev.acceleration.per_100km !== null ? `${ev.acceleration.per_100km} /100 km` : "—"}
                  sub={`${ev.acceleration.count} événement${ev.acceleration.count > 1 ? "s" : ""} sur ${Math.round(driver.distance_km)} km`}
                  testId="reason-acceleration" />
                <ScoreReasonRow icon={CornerUpRight} label="Virages brusques"
                  main={ev.turning.per_100km !== null ? `${ev.turning.per_100km} /100 km` : "—"}
                  sub={`${ev.turning.count} événement${ev.turning.count > 1 ? "s" : ""} sur ${Math.round(driver.distance_km)} km`}
                  testId="reason-turning" />
                <ScoreReasonRow icon={TimerOff} label="Ralenti excessif (> 5 min)"
                  main={ev.idling.min_per_100km !== null ? `${ev.idling.min_per_100km} min /100 km` : "—"}
                  sub={`${ev.idling.duration_min} min au total — ${ev.idling.count} épisode${ev.idling.count > 1 ? "s" : ""}`}
                  testId="reason-idling" />
                <ScoreReasonRow icon={Zap} label="Excès de vitesse"
                  main={ev.speeding.count > 0 ? `${ev.speeding.per_100km} /100 km` : "0"}
                  sub={ev.speeding.count > 0
                    ? `${ev.speeding.count} événement${ev.speeding.count > 1 ? "s" : ""} retenu${ev.speeding.count > 1 ? "s" : ""} par Navixy`
                    : "Aucun excès de vitesse retenu par Navixy sur la période"}
                  testId="reason-speeding" />
              </div>
              <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-[10px] text-blue-700" data-testid="penalty-summary">
                Pénalité totale Navixy : <strong>{driver.penalties.total}</strong> — {driver.penalties.count} pénalités, moyenne {driver.penalties.avg} par pénalité. Le score est calculé par Navixy à partir de ces pénalités.
              </div>
            </div>

            {/* Evolution quotidienne */}
            {hasDailyData && (
              <div data-testid="drawer-daily-chart">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Pénalités par jour (Navixy)</h4>
                <div className="bg-gray-50 rounded-xl p-3">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={daily} barSize={18}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis dataKey="shortLabel" tick={{ fontSize: 9, fill: "#5E5E62" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "#8A8A8E" }} axisLine={false} tickLine={false} width={32} />
                      <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="speeding" name="Excès de vitesse" stackId="p" fill={EVENT_COLORS.speeding} />
                      <Bar dataKey="harsh_driving" name="Éco-conduite (freinage/accél./virage)" stackId="p" fill={EVENT_COLORS.harsh_driving} />
                      <Bar dataKey="idling" name="Ralenti excessif" stackId="p" fill={EVENT_COLORS.idling} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Evenements recents */}
            <div data-testid="drawer-events">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Événements récents ({driver.recent_events.length})</h4>
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                {driver.recent_events.map((e, i) => (
                  <div key={i} className="flex items-start justify-between p-2.5 bg-gray-50 rounded-lg" data-testid={`event-row-${i}`}>
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-gray-800">
                        {e.day} • {e.time} — {eventLabel(e)}
                        {e.kind === "idling" && e.duration_sec ? ` (${fmtDurShort(e.duration_sec)})` : ""}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">{cleanAddress(e.address)}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {e.penalty !== null && e.penalty !== undefined && (
                        <span className="text-[10px] font-semibold text-gray-500 bg-white border border-gray-200 rounded px-1.5 py-0.5" title="Pénalité Navixy">-{Math.round(e.penalty * 10) / 10}</span>
                      )}
                      {e.lat && e.lng && (
                        <a href={`https://www.google.com/maps?q=${e.lat},${e.lng}`} target="_blank" rel="noreferrer"
                          onClick={(ev2) => ev2.stopPropagation()}
                          className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline" data-testid={`event-map-link-${i}`}>
                          <ExternalLink size={10} />Carte
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ---- Main tab ----
export const DriversTab = ({ fromDate, toDate }) => {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortKey, setSortKey] = useState("score");
  const [sortDir, setSortDir] = useState("desc");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.get(`${API}/drivers/ecodriving`, { params: { from_date: fromDate, to_date: toDate }, timeout: 120000 })
      .then((res) => {
        if (cancelled) return;
        if (res.data.success) setPayload(res.data);
        else setError(res.data.error || "Données indisponibles");
      })
      .catch(() => { if (!cancelled) setError("Impossible de charger les données éco-conduite"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fromDate, toDate]);

  const drivers = payload?.drivers || [];
  const summary = payload?.summary || {};
  const unassigned = payload?.unassigned_vehicles || [];

  const filtered = useMemo(() => {
    let list = drivers.filter((d) => {
      if (search && !d.driver_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === "with_vehicle" && !d.has_vehicle) return false;
      if (filter === "without_vehicle" && d.has_vehicle) return false;
      if (filter === "with_activity" && !d.has_activity) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    const val = (d) => {
      if (sortKey === "name") return d.driver_name.toLowerCase();
      if (sortKey === "distance") return d.distance_km ?? -1;
      if (sortKey === "events") return d.events_per_100km ?? -1;
      return d.score?.raw ?? -1;
    };
    return list.sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [drivers, search, filter, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc"); }
  };

  const SortTh = ({ label, k, className = "" }) => (
    <th className={`px-4 py-3 text-left cursor-pointer select-none hover:text-gray-700 ${className}`} onClick={() => toggleSort(k)} data-testid={`sort-${k}`}>
      <span className="inline-flex items-center gap-1">{label}{sortKey === k && <span className="text-[9px]">{sortDir === "asc" ? "▲" : "▼"}</span>}</span>
    </th>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]" data-testid="drivers-loading">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Génération du rapport Navixy « Qualité de conduite »…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto" data-testid="drivers-error">
        <div className="p-6 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 flex items-center gap-3">
          <AlertTriangle size={18} />{error}
        </div>
      </div>
    );
  }

  const FILTERS = [
    { id: "all", label: `Tous (${drivers.length})` },
    { id: "with_vehicle", label: `Avec véhicule (${drivers.filter((d) => d.has_vehicle).length})` },
    { id: "without_vehicle", label: `Sans véhicule (${drivers.filter((d) => !d.has_vehicle).length})` },
    { id: "with_activity", label: `Avec activité (${drivers.filter((d) => d.has_activity).length})` },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-[1600px] mx-auto" data-testid="drivers-tab">
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPI label="Avec véhicule assigné" value={`${summary.drivers_with_vehicle}/${summary.drivers_total}`} sub="Affectation Navixy" icon={Users} testId="kpi-with-vehicle" />
        <KPI label="Score éco moyen" value={summary.avg_score !== null && summary.avg_score !== undefined ? summary.avg_score : "—"}
          sub={summary.avg_score !== null && summary.avg_score !== undefined ? "/100 — moyenne des notations Navixy" : "Aucune donnée"}
          icon={Gauge} color={summary.avg_score !== null && summary.avg_score !== undefined ? scoreColor(Math.ceil(summary.avg_score / 20)) : undefined} testId="kpi-avg-score" />
        <KPI label="Pénalités /100 km" value={summary.penalties_per_100km ?? "—"} sub={`${summary.total_penalties || 0} pénalités Navixy au total`} icon={AlertTriangle} testId="kpi-penalties-100km" />
        <KPI label="Distance attribuée" value={`${Math.round(summary.total_distance_km || 0)} km`} sub="Conducteurs avec activité" icon={MapPin} testId="kpi-distance" />
        <KPI label="Trajets" value={summary.total_trips || 0} sub="track/list Navixy" icon={Route} testId="kpi-trips" />
        <KPI label="Temps de conduite" value={fmtDur(summary.total_driving_time_sec)} sub="Somme des trajets" icon={Clock} testId="kpi-driving-time" />
      </div>

      {/* Filtres + recherche */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Rechercher un conducteur…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none w-56" data-testid="driver-search" />
        </div>
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${filter === f.id ? "bg-[#111] text-white border-[#111]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
            data-testid={`filter-${f.id}`}>{f.label}</button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto" data-testid="drivers-table">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-100">
              <SortTh label="Conducteur" k="name" />
              <th className="px-4 py-3 text-left">Véhicule</th>
              <SortTh label="Score éco" k="score" />
              <SortTh label="Distance" k="distance" />
              <th className="px-4 py-3 text-left">Trajets</th>
              <th className="px-4 py-3 text-left">Temps conduite</th>
              <SortTh label="Pénalités /100 km" k="events" />
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.employee_id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelected(d)} data-testid={`driver-row-${d.employee_id}`}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{d.driver_name}</div>
                  {d.phone && <div className="text-[10px] text-gray-400">{d.phone}</div>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{d.vehicle_label || <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3"><ScoreDisplay score={d.score} /></td>
                <td className="px-4 py-3 text-xs">{d.distance_km !== null ? `${Math.round(d.distance_km)} km` : <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 text-xs">{d.trips_count ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 text-xs">{d.driving_time_sec !== null ? fmtDur(d.driving_time_sec) : <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 text-xs">{d.events_per_100km ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3"><StatusBadge driver={d} /></td>
                <td className="px-2 py-3"><ChevronRight size={14} className="text-gray-300" /></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-xs text-gray-400" data-testid="empty-table">Aucun conducteur ne correspond aux critères</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Vehicules sans conducteur */}
      {unassigned.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="unassigned-vehicles">
          <div className="flex items-center gap-2 mb-1">
            <Truck size={14} className="text-gray-400" />
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Véhicules avec activité sans conducteur assigné</h4>
          </div>
          <p className="text-[11px] text-gray-400 mb-4">
            Ces événements restent au niveau véhicule et ne sont attribués à aucun conducteur — l'identité du conducteur au moment des événements n'est pas démontrable avec les données Navixy actuelles.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {unassigned.map((v) => (
              <div key={v.tracker_id} className="p-4 bg-gray-50 rounded-lg" data-testid={`unassigned-vehicle-${v.tracker_id}`}>
                <div className="text-sm font-medium text-gray-800 mb-1">{v.label}</div>
                <div className="flex items-center justify-between text-xs">
                  <ScoreDisplay score={v.score} />
                  <span className="text-gray-500">{Math.round(v.distance_km)} km · {v.penalties_count} pénalités</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source de verite */}
      <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="data-sources">
        <div className="flex items-center gap-2 mb-3">
          <Info size={14} className="text-gray-400" />
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Source de vérité — traçabilité des données</h4>
        </div>
        <div className="space-y-2">
          {(payload?.sources || []).map((s, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[11px] p-2.5 bg-gray-50 rounded-lg">
              <div className="font-medium text-gray-700">{s.data}</div>
              <div className="text-gray-500">{s.source}</div>
              <div className="text-gray-500">{s.method}</div>
              <div className="text-gray-400">{s.attribution}</div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-3">
          Période : {payload?.period?.from} → {payload?.period?.to} — 100% données Navixy, aucune estimation. Le score éco est la notation native Navixy, sans conversion ni catégorisation LOGITRAK.
        </p>
      </div>

      {selected && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSelected(null)} />
          <DriverDrawer driver={selected} onClose={() => setSelected(null)} />
        </>
      )}
    </div>
  );
};
