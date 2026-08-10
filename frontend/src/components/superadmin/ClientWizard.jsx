import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, CheckCircle2, XCircle, Loader2, Copy, Check } from "lucide-react";
import { API, api } from "@/lib/api";
import { formatApiError, NAVY } from "./bits";

const STEPS = ["Entreprise", "Administrateur", "Navixy", "Modules", "Validation"];

const slugify = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
   .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);

const Field = ({ label, children, required }) => (
  <div>
    <label className="text-xs font-medium text-gray-500 mb-1 block">{label}{required && <span className="text-red-500"> *</span>}</label>
    {children}
  </div>
);

const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-400";

export default function ClientWizard({ onClose, onCreated }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [company, setCompany] = useState({ name: "", display_name: "", subdomain: "", contact_email: "", phone: "", address: "", country: "Suisse", timezone: "Europe/Zurich", is_test: false });
  const [slugTouched, setSlugTouched] = useState(false);
  const [adminUser, setAdminUser] = useState({ first_name: "", last_name: "", email: "" });
  const [navixyHash, setNavixyHash] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [allModules, setAllModules] = useState([]);
  const [modules, setModules] = useState([]);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get(`${API}/admin/modules`).then((r) => {
      setAllModules(r.data.modules);
      setModules(r.data.modules.map((m) => m.id));
    }).catch(() => {});
  }, []);

  const setName = (name) => setCompany((c) => ({ ...c, name, subdomain: slugTouched ? c.subdomain : slugify(name) }));

  const validateStep = () => {
    setError("");
    if (step === 0) {
      if (!company.name.trim()) return setError("Raison sociale requise"), false;
      if (!/^[a-z0-9](?:[a-z0-9-]{1,30})[a-z0-9]$/.test(company.subdomain)) return setError("Identifiant invalide : minuscules, chiffres et tirets (3-32 caractères)"), false;
    }
    if (step === 1) {
      if (!adminUser.first_name.trim() || !adminUser.last_name.trim()) return setError("Prénom et nom requis"), false;
      if (!/^\S+@\S+\.\S+$/.test(adminUser.email)) return setError("Email administrateur invalide"), false;
    }
    if (step === 2 && !navixyHash.trim()) return setError("Configuration Navixy requise"), false;
    if (step === 3 && !modules.length) return setError("Sélectionnez au moins un module"), false;
    return true;
  };

  const next = () => { if (validateStep()) setStep((s) => s + 1); };

  const testConnection = async () => {
    setError(""); setTestResult(null); setTesting(true);
    try {
      const r = await api.post(`${API}/admin/navixy/test`, { navixy_hash: navixyHash.trim() });
      setTestResult(r.data.result);
    } catch (e) { setError(formatApiError(e)); }
    setTesting(false);
  };

  const create = async () => {
    setError(""); setCreating(true);
    try {
      const r = await api.post(`${API}/admin/clients/full`, {
        company, admin_user: adminUser, navixy_hash: navixyHash.trim(), modules,
      });
      setCreated(r.data);
    } catch (e) { setError(formatApiError(e)); }
    setCreating(false);
  };

  const copyPwd = () => {
    navigator.clipboard?.writeText(created.admin_user.temp_password);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" data-testid="client-wizard">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-semibold" style={{ color: NAVY, fontFamily: "Outfit, sans-serif" }}>
            {created ? "Client créé" : "Ajouter un client"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400" data-testid="wizard-close-btn"><X size={16} /></button>
        </div>

        {!created && (
          <div className="flex items-center gap-1 px-6 pt-4">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1 flex-1">
                <div className={`flex items-center gap-1.5 text-[11px] font-medium ${i <= step ? "text-[#1e6ae5]" : "text-gray-300"}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${i <= step ? "bg-[#1e6ae5] text-white" : "bg-gray-100 text-gray-400"}`}>{i + 1}</span>
                  <span className="hidden sm:inline">{s}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < step ? "bg-[#1e6ae5]" : "bg-gray-100"}`} />}
              </div>
            ))}
          </div>
        )}

        <div className="p-6 space-y-4">
          {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2" data-testid="wizard-error">{error}</div>}

          {created ? (
            <div className="space-y-4" data-testid="wizard-success">
              <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                <CheckCircle2 size={18} /> Le client « {created.client.name} » a été créé.
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
                <p className="font-medium text-amber-800 mb-2">Identifiants administrateur — affichés une seule fois</p>
                <p className="text-gray-700">Email : <span className="font-mono">{created.admin_user.email}</span></p>
                <p className="text-gray-700 flex items-center gap-2">Mot de passe temporaire :
                  <span className="font-mono bg-white border border-amber-200 rounded px-2 py-0.5" data-testid="wizard-temp-password">{created.admin_user.temp_password}</span>
                  <button onClick={copyPwd} className="p-1 rounded hover:bg-amber-100 text-amber-700" title="Copier">
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </p>
              </div>
              <p className="text-xs text-gray-400">URL dashboard (production) : {created.dashboard_url}</p>
              <button onClick={onCreated} className="w-full text-white rounded-lg py-2.5 text-sm font-medium" style={{ background: "#1e6ae5" }} data-testid="wizard-done-btn">Terminer</button>
            </div>
          ) : (
            <>
              {step === 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Raison sociale" required>
                    <input className={inputCls} value={company.name} onChange={(e) => setName(e.target.value)} data-testid="wizard-company-name" />
                  </Field>
                  <Field label="Nom affiché">
                    <input className={inputCls} value={company.display_name} onChange={(e) => setCompany({ ...company, display_name: e.target.value })} placeholder={company.name} data-testid="wizard-display-name" />
                  </Field>
                  <Field label="Identifiant / sous-domaine" required>
                    <input className={inputCls} value={company.subdomain}
                      onChange={(e) => { setSlugTouched(true); setCompany({ ...company, subdomain: slugify(e.target.value) || e.target.value.toLowerCase() }); }}
                      data-testid="wizard-subdomain" />
                    <p className="text-[10px] text-gray-400 mt-1">{company.subdomain || "…"}.logitrak.ch</p>
                  </Field>
                  <Field label="Email">
                    <input className={inputCls} value={company.contact_email} onChange={(e) => setCompany({ ...company, contact_email: e.target.value })} data-testid="wizard-company-email" />
                  </Field>
                  <Field label="Téléphone">
                    <input className={inputCls} value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} data-testid="wizard-company-phone" />
                  </Field>
                  <Field label="Pays">
                    <input className={inputCls} value={company.country} onChange={(e) => setCompany({ ...company, country: e.target.value })} data-testid="wizard-company-country" />
                  </Field>
                  <Field label="Adresse">
                    <input className={inputCls} value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} data-testid="wizard-company-address" />
                  </Field>
                  <Field label="Timezone">
                    <input className={inputCls} value={company.timezone} onChange={(e) => setCompany({ ...company, timezone: e.target.value })} data-testid="wizard-company-timezone" />
                  </Field>
                  <label className="flex items-center gap-2 text-xs text-gray-500 sm:col-span-2">
                    <input type="checkbox" checked={company.is_test} onChange={(e) => setCompany({ ...company, is_test: e.target.checked })} data-testid="wizard-is-test" />
                    Marquer comme client de TEST
                  </label>
                </div>
              )}

              {step === 1 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Prénom" required>
                    <input className={inputCls} value={adminUser.first_name} onChange={(e) => setAdminUser({ ...adminUser, first_name: e.target.value })} data-testid="wizard-admin-firstname" />
                  </Field>
                  <Field label="Nom" required>
                    <input className={inputCls} value={adminUser.last_name} onChange={(e) => setAdminUser({ ...adminUser, last_name: e.target.value })} data-testid="wizard-admin-lastname" />
                  </Field>
                  <Field label="Email" required>
                    <input className={inputCls} type="email" value={adminUser.email} onChange={(e) => setAdminUser({ ...adminUser, email: e.target.value })} data-testid="wizard-admin-email" />
                  </Field>
                  <div className="sm:col-span-2 text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
                    Rôle : <span className="font-medium text-gray-600">ADMIN</span> — un mot de passe temporaire sécurisé sera généré et affiché une seule fois à la création.
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <Field label="Clé API Navixy (hash)" required>
                    <input className={inputCls} type="password" value={navixyHash}
                      onChange={(e) => { setNavixyHash(e.target.value); setTestResult(null); }}
                      placeholder="Clé du compte Navixy du client" data-testid="wizard-navixy-hash" />
                  </Field>
                  <button onClick={testConnection} disabled={testing || !navixyHash.trim()}
                    className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
                    data-testid="wizard-test-navixy-btn">
                    {testing && <Loader2 size={14} className="animate-spin" />} Tester la connexion
                  </button>
                  {testResult && (
                    testResult.ok ? (
                      <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3" data-testid="wizard-navixy-ok">
                        <CheckCircle2 size={16} className="mt-0.5" />
                        <div>
                          <p className="font-medium">Connexion réussie</p>
                          {testResult.account && <p className="text-xs">Compte : {testResult.account}</p>}
                          <p className="text-xs">{testResult.trackers} tracker(s) accessible(s)</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3" data-testid="wizard-navixy-fail">
                        <XCircle size={16} className="mt-0.5" />
                        <p>{testResult.message}</p>
                      </div>
                    )
                  )}
                  <p className="text-[11px] text-gray-400">La clé est chiffrée au repos et n'est jamais renvoyée au navigateur.</p>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-2">
                  {allModules.map((m) => (
                    <label key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 cursor-pointer">
                      <input type="checkbox" checked={modules.includes(m.id)}
                        onChange={(e) => setModules((prev) => e.target.checked ? [...prev, m.id] : prev.filter((x) => x !== m.id))}
                        data-testid={`wizard-module-${m.id}`} />
                      <span className="text-sm text-gray-700">{m.label}</span>
                    </label>
                  ))}
                </div>
              )}

              {step === 4 && (
                <div className="space-y-3 text-sm" data-testid="wizard-summary">
                  {[
                    ["Entreprise", `${company.name}${company.display_name ? ` (${company.display_name})` : ""} — ${company.subdomain}.logitrak.ch${company.is_test ? " — TEST" : ""}`],
                    ["Administrateur", `${adminUser.first_name} ${adminUser.last_name} — ${adminUser.email} (ADMIN)`],
                    ["Navixy", testResult?.ok ? `✓ Connexion vérifiée — ${testResult.trackers} tracker(s)` : "⚠ Connexion non vérifiée"],
                    ["Modules", allModules.filter((m) => modules.includes(m.id)).map((m) => m.label).join(", ")],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      <span className="w-32 shrink-0 text-xs font-medium text-gray-400 uppercase">{k}</span>
                      <span className="text-gray-700">{v}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40" data-testid="wizard-prev-btn">
                  <ChevronLeft size={15} /> Précédent
                </button>
                {step < 4 ? (
                  <button onClick={next} className="flex items-center gap-1.5 text-white rounded-lg px-5 py-2.5 text-sm font-medium" style={{ background: "#1e6ae5" }} data-testid="wizard-next-btn">
                    Suivant <ChevronRight size={15} />
                  </button>
                ) : (
                  <button onClick={create} disabled={creating}
                    className="flex items-center gap-2 text-white rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-60" style={{ background: "#1e6ae5" }} data-testid="wizard-create-btn">
                    {creating && <Loader2 size={14} className="animate-spin" />} Créer le client
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
