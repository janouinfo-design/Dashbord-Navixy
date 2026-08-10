import { useState } from "react";
import { UserPlus, KeyRound, Copy, Check, X } from "lucide-react";
import { API, api } from "@/lib/api";
import { Card, fmtDateTime, formatApiError } from "./bits";

const ROLES = ["ADMIN", "MANAGER", "READ_ONLY", "DRIVER"];
const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-400";

const TempPassword = ({ info, onClose }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm mb-4" data-testid="temp-password-box">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-amber-800 mb-1">Mot de passe temporaire — affiché une seule fois</p>
          <p className="text-gray-700">{info.email} : <span className="font-mono bg-white border border-amber-200 rounded px-2 py-0.5" data-testid="temp-password-value">{info.password}</span>
            <button onClick={() => { navigator.clipboard?.writeText(info.password); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="ml-2 p-1 rounded hover:bg-amber-100 text-amber-700">{copied ? <Check size={13} /> : <Copy size={13} />}</button>
          </p>
        </div>
        <button onClick={onClose} className="p-1 text-amber-500 hover:text-amber-700"><X size={14} /></button>
      </div>
    </div>
  );
};

export default function UsersSection({ clientId, users, onChanged }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", role: "ADMIN" });
  const [error, setError] = useState("");
  const [tempPwd, setTempPwd] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setError(""); setBusy(true);
    try { await fn(); await onChanged(); }
    catch (e) { setError(formatApiError(e)); }
    setBusy(false);
  };

  const addUser = () => run(async () => {
    const r = await api.post(`${API}/admin/clients/${clientId}/users`, form);
    setTempPwd({ email: r.data.user.email, password: r.data.temp_password });
    setShowAdd(false);
    setForm({ first_name: "", last_name: "", email: "", role: "ADMIN" });
  });

  const resetPwd = (u) => run(async () => {
    const r = await api.post(`${API}/admin/users/${u.id}/reset-password`);
    setTempPwd({ email: u.email, password: r.data.temp_password });
  });

  return (
    <div data-testid="sa-users-section">
      {tempPwd && <TempPassword info={tempPwd} onClose={() => setTempPwd(null)} />}
      {error && <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2" data-testid="sa-users-error">{error}</div>}

      <div className="flex justify-end mb-3">
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 text-white rounded-lg px-4 py-2 text-sm font-medium" style={{ background: "#1e6ae5" }} data-testid="sa-add-user-btn">
          <UserPlus size={14} /> Ajouter utilisateur
        </button>
      </div>

      {showAdd && (
        <Card className="p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3" data-testid="sa-add-user-form">
          <input className={inputCls} placeholder="Prénom" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} data-testid="sa-user-firstname" />
          <input className={inputCls} placeholder="Nom" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} data-testid="sa-user-lastname" />
          <input className={inputCls} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="sa-user-email" />
          <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} data-testid="sa-user-role-select">
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button onClick={addUser} disabled={busy || !form.email || !form.first_name}
            className="text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: "#10265c" }} data-testid="sa-user-create-btn">
            Créer
          </button>
        </Card>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="sa-users-table">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
              <th className="px-4 py-3">Nom</th>
              <th className="px-3 py-3">Email</th>
              <th className="px-3 py-3">Rôle</th>
              <th className="px-3 py-3">Statut</th>
              <th className="px-3 py-3">Dernière connexion</th>
              <th className="px-3 py-3">Créé le</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-50" data-testid={`sa-user-row-${u.email}`}>
                <td className="px-4 py-3 font-medium text-gray-700">{u.first_name} {u.last_name}</td>
                <td className="px-3 py-3 text-gray-500">{u.email}</td>
                <td className="px-3 py-3">
                  <select value={u.role} onChange={(e) => run(() => api.put(`${API}/admin/users/${u.id}`, { role: e.target.value }))}
                    className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white" data-testid={`sa-user-role-${u.email}`}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-3 py-3">
                  <button onClick={() => run(() => api.put(`${API}/admin/users/${u.id}`, { is_active: !u.is_active }))}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                      u.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}
                    data-testid={`sa-user-toggle-${u.email}`}>
                    {u.is_active ? "Actif" : "Désactivé"}
                  </button>
                </td>
                <td className="px-3 py-3 text-xs text-gray-500">{fmtDateTime(u.last_login_at)}</td>
                <td className="px-3 py-3 text-xs text-gray-500">{fmtDateTime(u.created_at)}</td>
                <td className="px-3 py-3 text-right">
                  <button onClick={() => resetPwd(u)} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#1e6ae5]" title="Réinitialiser le mot de passe" data-testid={`sa-user-reset-${u.email}`}>
                    <KeyRound size={13} /> Réinitialiser
                  </button>
                </td>
              </tr>
            ))}
            {!users.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Aucun utilisateur</td></tr>}
          </tbody>
        </table>
      </Card>
      <p className="text-[11px] text-gray-400 mt-2">Le rôle SUPER_ADMIN n'est jamais attribuable à un utilisateur client.</p>
    </div>
  );
}
