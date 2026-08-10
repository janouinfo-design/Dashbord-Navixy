import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, MonitorPlay, Pencil, Ban, RotateCcw, Trash2, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { API, api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { Card, StatusBadge, NavixyBadge, Spin, fmtDateTime, formatApiError, NAVY } from "./bits";
import UsersSection from "./UsersSection";

const SECTIONS = [
  { id: "overview", label: "Vue générale" },
  { id: "users", label: "Utilisateurs" },
  { id: "navixy", label: "Connexion Navixy" },
  { id: "modules", label: "Modules" },
  { id: "activity", label: "Activité" },
];

const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-400";

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "edit" ? "overview" : (params.get("tab") || "overview");
  const editMode = params.get("tab") === "edit";
  const { startImpersonation } = useAuth();

  const [data, setData] = useState(null);
  const [allModules, setAllModules] = useState([]);
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(editMode);
  const [form, setForm] = useState({});
  const [modules, setModules] = useState([]);
  const [newHash, setNewHash] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`${API}/admin/clients/${id}/detail`);
      setData(r.data);
      setModules(r.data.client.modules || []);
      setForm(r.data.client);
    } catch (e) { setError(formatApiError(e)); }
  }, [id]);

  useEffect(() => { load(); api.get(`${API}/admin/modules`).then((r) => setAllModules(r.data.modules)).catch(() => {}); }, [load]);
  useEffect(() => {
    if (tab === "activity") api.get(`${API}/admin/clients/${id}/activity`).then((r) => setActivity(r.data)).catch(() => {});
  }, [tab, id]);

  const run = async (fn, okMsg) => {
    setError(""); setNotice(""); setBusy(true);
    try { await fn(); if (okMsg) setNotice(okMsg); await load(); }
    catch (e) { setError(formatApiError(e)); }
    setBusy(false);
  };

  if (!data) return <Spin />;
  const c = data.client;
  const setTab = (t) => setParams({ tab: t });

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto" data-testid="sa-client-detail">
      <button onClick={() => navigate("/super-admin/clients")} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-4" data-testid="sa-back-clients">
        <ArrowLeft size={13} /> Super Admin / Clients
      </button>

      <Card className="p-5 mb-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-xl font-semibold" style={{ color: NAVY, fontFamily: "Outfit, sans-serif" }} data-testid="sa-detail-name">{c.name}</h1>
            <p className="text-xs text-gray-400">{c.subdomain}.logitrak.ch — tenant « {data.tenant} »</p>
          </div>
          <StatusBadge active={c.is_active} isTest={c.is_test} />
          <span className="text-sm text-gray-600">{data.navixy?.trackers ?? "—"} véhicules</span>
          <span className="text-sm text-gray-600">{data.users.length} utilisateur{data.users.length > 1 ? "s" : ""}</span>
          <NavixyBadge navixy={data.navixy} />
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button onClick={() => run(async () => { await startImpersonation(data.tenant, c.name); navigate("/"); })}
            disabled={!c.is_active || busy}
            className="flex items-center gap-2 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: "#1e6ae5" }}
            data-testid="sa-detail-apercu-btn">
            <MonitorPlay size={14} /> Aperçu client
          </button>
          <button onClick={() => { setEditing(true); setTab("overview"); }} className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 rounded-lg px-4 py-2 text-sm text-gray-700" data-testid="sa-detail-edit-btn">
            <Pencil size={14} /> Modifier
          </button>
          {c.is_active ? (
            <button onClick={() => run(() => api.post(`${API}/admin/clients/${c.id}/suspend`), "Client suspendu")}
              disabled={data.tenant === "default" || busy}
              className="flex items-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg px-4 py-2 text-sm disabled:opacity-40" data-testid="sa-detail-suspend-btn">
              <Ban size={14} /> Suspendre
            </button>
          ) : (
            <button onClick={() => run(() => api.post(`${API}/admin/clients/${c.id}/reactivate`), "Client réactivé")}
              className="flex items-center gap-2 border border-emerald-200 text-emerald-600 hover:bg-emerald-50 rounded-lg px-4 py-2 text-sm" data-testid="sa-detail-reactivate-btn">
              <RotateCcw size={14} /> Réactiver
            </button>
          )}
          {c.is_test && (
            <button onClick={() => { if (window.confirm(`Supprimer définitivement « ${c.name} » et toutes ses données ?`)) run(async () => { await api.delete(`${API}/admin/clients/${c.id}/purge`); navigate("/super-admin/clients"); }); }}
              className="flex items-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg px-4 py-2 text-sm" data-testid="sa-detail-purge-btn">
              <Trash2 size={14} /> Purger (TEST)
            </button>
          )}
        </div>
      </Card>

      {error && <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2" data-testid="sa-detail-error">{error}</div>}
      {notice && <div className="mb-4 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2" data-testid="sa-detail-notice">{notice}</div>}

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {SECTIONS.map((s) => (
          <button key={s.id} onClick={() => setTab(s.id)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              tab === s.id ? "border-[#1e6ae5] text-[#1e6ae5]" : "border-transparent text-gray-400 hover:text-gray-600"}`}
            data-testid={`sa-detail-tab-${s.id}`}>{s.label}</button>
        ))}
      </div>

      {tab === "overview" && (
        <Card className="p-5">
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="sa-detail-edit-form">
              {[["name", "Nom affiché"], ["company_name", "Raison sociale"], ["contact_email", "Email"], ["phone", "Téléphone"], ["address", "Adresse"], ["country", "Pays"], ["timezone", "Timezone"], ["primary_color", "Couleur principale"]].map(([k, l]) => (
                <div key={k}>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">{l}</label>
                  <input className={inputCls} value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} data-testid={`sa-edit-${k}`} />
                </div>
              ))}
              <div className="sm:col-span-2 flex gap-2">
                <button onClick={() => run(() => api.put(`${API}/admin/clients/${c.id}`, {
                  name: form.name, company_name: form.company_name, contact_email: form.contact_email,
                  phone: form.phone, address: form.address, country: form.country,
                  timezone: form.timezone, primary_color: form.primary_color,
                }), "Client mis à jour").then(() => setEditing(false))}
                  disabled={busy} className="text-white rounded-lg px-4 py-2 text-sm font-medium" style={{ background: "#1e6ae5" }} data-testid="sa-edit-save-btn">Enregistrer</button>
                <button onClick={() => setEditing(false)} className="border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-500">Annuler</button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm" data-testid="sa-detail-overview">
              {[["Raison sociale", c.company_name || c.name], ["Nom affiché", c.name], ["Email", c.contact_email], ["Téléphone", c.phone], ["Adresse", c.address], ["Pays", c.country], ["Timezone", c.timezone], ["Créé le", fmtDateTime(c.created_at)], ["Dernière synchro", fmtDateTime(data.last_sync_at)]].map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <dt className="w-36 shrink-0 text-xs text-gray-400 uppercase pt-0.5">{k}</dt>
                  <dd className="text-gray-700">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      )}

      {tab === "users" && <UsersSection clientId={c.id} users={data.users} onChanged={load} />}

      {tab === "navixy" && (
        <Card className="p-5 space-y-4" data-testid="sa-detail-navixy">
          <div className="flex items-center gap-3">
            <NavixyBadge navixy={data.navixy} />
            {data.navixy?.status === "ok" && <span className="text-sm text-gray-600">{data.navixy.trackers} tracker(s) accessible(s)</span>}
            {data.navixy?.error && <span className="text-xs text-red-500">{data.navixy.error}</span>}
          </div>
          <p className="text-xs text-gray-400">La clé actuelle est chiffrée au repos et n'est jamais affichée. Pour la remplacer :</p>
          <div className="flex flex-wrap gap-2 items-center">
            <input className={`${inputCls} max-w-sm`} type="password" placeholder="Nouvelle clé API Navixy"
              value={newHash} onChange={(e) => { setNewHash(e.target.value); setTestResult(null); }} data-testid="sa-navixy-new-hash" />
            <button onClick={() => run(async () => {
              const r = await api.post(`${API}/admin/navixy/test`, { navixy_hash: newHash.trim() });
              setTestResult(r.data.result);
            })} disabled={!newHash.trim() || busy}
              className="border border-gray-200 hover:bg-gray-50 rounded-lg px-4 py-2 text-sm text-gray-700 disabled:opacity-50" data-testid="sa-navixy-test-btn">
              {busy ? <Loader2 size={14} className="animate-spin" /> : "Tester la connexion"}
            </button>
            <button onClick={() => run(() => api.put(`${API}/admin/clients/${c.id}`, { navixy_hash: newHash.trim() }), "Clé Navixy remplacée").then(() => setNewHash(""))}
              disabled={!newHash.trim() || busy}
              className="text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: "#1e6ae5" }} data-testid="sa-navixy-save-btn">
              Enregistrer
            </button>
          </div>
          {testResult && (testResult.ok ? (
            <p className="flex items-center gap-1.5 text-sm text-emerald-700" data-testid="sa-navixy-test-ok"><CheckCircle2 size={15} /> Connexion réussie — {testResult.trackers} tracker(s){testResult.account ? ` — compte ${testResult.account}` : ""}</p>
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-red-600" data-testid="sa-navixy-test-fail"><XCircle size={15} /> {testResult.message}</p>
          ))}
        </Card>
      )}

      {tab === "modules" && (
        <Card className="p-5 space-y-3" data-testid="sa-detail-modules">
          {allModules.map((m) => (
            <label key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 cursor-pointer">
              <input type="checkbox" checked={modules.includes(m.id)}
                onChange={(e) => setModules((prev) => e.target.checked ? [...prev, m.id] : prev.filter((x) => x !== m.id))}
                data-testid={`sa-module-${m.id}`} />
              <span className="text-sm text-gray-700">{m.label}</span>
            </label>
          ))}
          <button onClick={() => run(() => api.put(`${API}/admin/clients/${c.id}/modules`, { modules }), "Modules mis à jour")}
            disabled={busy || !modules.length}
            className="text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: "#1e6ae5" }} data-testid="sa-modules-save-btn">
            Enregistrer les modules
          </button>
        </Card>
      )}

      {tab === "activity" && (
        <div className="space-y-4" data-testid="sa-detail-activity">
          <Card className="p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Synchronisation</h3>
            <p className="text-sm text-gray-700">Dernière synchronisation Navixy : {fmtDateTime(activity?.last_sync_at)}</p>
          </Card>
          <Card className="p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Aperçus client (impersonation)</h3>
            {activity?.impersonations?.length ? activity.impersonations.map((l) => (
              <div key={l.id} className="flex flex-wrap gap-3 text-xs text-gray-600 py-1.5 border-b border-gray-50">
                <span className="font-medium">{l.email}</span>
                <span>Début : {fmtDateTime(l.started_at)}</span>
                <span>Fin : {l.ended_at ? fmtDateTime(l.ended_at) : "en cours"}</span>
                {l.ip && <span className="text-gray-400">IP {l.ip}</span>}
              </div>
            )) : <p className="text-sm text-gray-400">Aucun aperçu enregistré</p>}
          </Card>
          <Card className="p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Journal d'administration</h3>
            {activity?.audit?.length ? activity.audit.map((a, i) => (
              <div key={i} className="flex flex-wrap gap-3 text-xs text-gray-600 py-1.5 border-b border-gray-50">
                <span className="font-medium">{a.action}</span>
                <span>{a.by}</span>
                {a.detail && <span className="text-gray-400 truncate max-w-[300px]">{a.detail}</span>}
                <span className="ml-auto text-gray-400">{fmtDateTime(a.at)}</span>
              </div>
            )) : <p className="text-sm text-gray-400">Aucune action enregistrée</p>}
          </Card>
        </div>
      )}
    </div>
  );
}
