import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, MoreHorizontal, Eye, Pencil, Users, Satellite, Boxes, MonitorPlay, Ban, RotateCcw, ArrowUpDown } from "lucide-react";
import { API, api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { Card, StatusBadge, NavixyBadge, Spin, fmtDate, fmtDateTime, formatApiError, NAVY } from "./bits";
import ClientWizard from "./ClientWizard";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_SIZE = 10;

export default function ClientsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState({ key: "name", dir: 1 });
  const [page, setPage] = useState(0);
  const [showWizard, setShowWizard] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { startImpersonation } = useAuth();

  const load = async () => {
    setLoading(true);
    try { setData((await api.get(`${API}/admin/overview`)).data); }
    catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let rows = data?.clients || [];
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((c) => [c.name, c.company_name, c.subdomain, c.contact_email].filter(Boolean).some((v) => v.toLowerCase().includes(q)));
    if (statusFilter === "active") rows = rows.filter((c) => c.is_active);
    if (statusFilter === "suspended") rows = rows.filter((c) => !c.is_active);
    if (statusFilter === "test") rows = rows.filter((c) => c.is_test);
    rows = [...rows].sort((a, b) => {
      const va = a[sortBy.key] ?? "", vb = b[sortBy.key] ?? "";
      return (va > vb ? 1 : va < vb ? -1 : 0) * sortBy.dir;
    });
    return rows;
  }, [data, search, statusFilter, sortBy]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (key) => setSortBy((s) => ({ key, dir: s.key === key ? -s.dir : 1 }));

  const doAction = async (fn) => {
    setError("");
    try { await fn(); await load(); }
    catch (e) { setError(formatApiError(e)); }
  };

  const apercu = async (c) => {
    setError("");
    try { await startImpersonation(c.tenant, c.name); navigate("/"); }
    catch (e) { setError(formatApiError(e)); }
  };

  const goTab = (c, tab) => navigate(`/super-admin/clients/${c.id}?tab=${tab}`);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto" data-testid="sa-clients-page">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: NAVY, fontFamily: "Outfit, sans-serif" }}>Clients</h1>
          <p className="text-sm text-gray-400 mt-0.5">{data?.clients?.length ?? 0} client(s) — données réelles</p>
        </div>
        <button onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors hover:opacity-90"
          style={{ background: "#1e6ae5" }} data-testid="sa-add-client-btn">
          <Plus size={16} /> Ajouter un client
        </button>
      </div>

      {error && <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2" data-testid="sa-clients-error">{error}</div>}

      <Card className="mb-4 p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Rechercher un client, sous-domaine, email…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-400"
            data-testid="sa-clients-search" />
        </div>
        {[["all", "Tous"], ["active", "Actifs"], ["suspended", "Suspendus"], ["test", "TEST"]].map(([v, l]) => (
          <button key={v} onClick={() => { setStatusFilter(v); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              statusFilter === v ? "bg-[#10265c] text-white border-[#10265c]" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}
            data-testid={`sa-filter-${v}`}>{l}</button>
        ))}
      </Card>

      {loading && !data ? <Spin /> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="sa-clients-table">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort("name")}>
                  <span className="inline-flex items-center gap-1">Client <ArrowUpDown size={11} /></span>
                </th>
                <th className="px-3 py-3">Statut</th>
                <th className="px-3 py-3">Véhicules</th>
                <th className="px-3 py-3">Utilisateurs</th>
                <th className="px-3 py-3">Navixy</th>
                <th className="px-3 py-3">Dernière synchro</th>
                <th className="px-3 py-3">Modules</th>
                <th className="px-3 py-3 cursor-pointer" onClick={() => toggleSort("created_at")}>
                  <span className="inline-flex items-center gap-1">Créé le <ArrowUpDown size={11} /></span>
                </th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors" data-testid={`sa-client-row-${c.tenant}`}>
                  <td className="px-4 py-3">
                    <button onClick={() => navigate(`/super-admin/clients/${c.id}`)} className="text-left" data-testid={`sa-client-open-${c.tenant}`}>
                      <p className="font-semibold text-[#10265c]">{c.name}</p>
                      <p className="text-[11px] text-gray-400">{c.subdomain}.logitrak.ch</p>
                    </button>
                  </td>
                  <td className="px-3 py-3"><StatusBadge active={c.is_active} isTest={c.is_test} /></td>
                  <td className="px-3 py-3 text-gray-600">{c.navixy?.trackers ?? "—"}</td>
                  <td className="px-3 py-3 text-gray-600">{c.users_count}</td>
                  <td className="px-3 py-3"><NavixyBadge navixy={c.navixy} /></td>
                  <td className="px-3 py-3 text-xs text-gray-500">{fmtDateTime(c.last_sync_at)}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{(c.modules || []).length}/6</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{fmtDate(c.created_at)}</td>
                  <td className="px-3 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400" data-testid={`sa-client-actions-${c.tenant}`}>
                          <MoreHorizontal size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={() => navigate(`/super-admin/clients/${c.id}`)}><Eye size={14} className="mr-2" /> Ouvrir</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => goTab(c, "edit")}><Pencil size={14} className="mr-2" /> Modifier</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => goTab(c, "users")}><Users size={14} className="mr-2" /> Utilisateurs</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => goTab(c, "navixy")}><Satellite size={14} className="mr-2" /> Configuration Navixy</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => goTab(c, "modules")}><Boxes size={14} className="mr-2" /> Modules</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => apercu(c)} disabled={!c.is_active} data-testid={`sa-apercu-${c.tenant}`}>
                          <MonitorPlay size={14} className="mr-2" /> Aperçu client
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {c.is_active ? (
                          <DropdownMenuItem disabled={c.tenant === "default"} className="text-red-600"
                            onClick={() => doAction(() => api.post(`${API}/admin/clients/${c.id}/suspend`))}
                            data-testid={`sa-suspend-${c.tenant}`}>
                            <Ban size={14} className="mr-2" /> Suspendre
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem className="text-emerald-600"
                            onClick={() => doAction(() => api.post(`${API}/admin/clients/${c.id}/reactivate`))}
                            data-testid={`sa-reactivate-${c.tenant}`}>
                            <RotateCcw size={14} className="mr-2" /> Réactiver
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">Aucun client trouvé</td></tr>
              )}
            </tbody>
          </table>
          {pages > 1 && (
            <div className="flex items-center justify-end gap-2 p-3 border-t border-gray-100 text-xs text-gray-500">
              <span>Page {page + 1}/{pages}</span>
              <button disabled={page === 0} onClick={() => setPage(page - 1)} className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40">Préc.</button>
              <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40">Suiv.</button>
            </div>
          )}
        </Card>
      )}

      {showWizard && <ClientWizard onClose={() => setShowWizard(false)} onCreated={() => { setShowWizard(false); load(); }} />}
    </div>
  );
}
