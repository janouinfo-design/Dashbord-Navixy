import { useState, useEffect } from "react";
import { API, api } from "@/lib/api";
import {
  ShieldCheck, CheckCircle, AlertTriangle, RefreshCw, Loader2, Clock, Zap
} from "lucide-react";

export const AuditTab = ({ fromDate, toDate }) => {
  const [auditData, setAuditData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`${API}/audit/compare`, {
        params: { from_date: fromDate, to_date: toDate },
      });
      setAuditData(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    }
    setLoading(false);
  };

  useEffect(() => { runAudit(); }, [fromDate, toDate]);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-[1600px] mx-auto" data-testid="audit-tab">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-50 rounded-xl border border-red-200">
            <ShieldCheck size={20} className="text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>Page Audit</h2>
            <p className="text-xs text-gray-500">Comparaison Dashboard vs donnees brutes Navixy</p>
          </div>
        </div>
        <button onClick={runAudit} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          data-testid="audit-refresh">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Relancer
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          Erreur: {error}
        </div>
      )}

      {loading && !auditData && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={24} className="animate-spin text-gray-400" />
            <span className="text-sm text-gray-400">Audit en cours... (appels Navixy directs)</span>
          </div>
        </div>
      )}

      {auditData && (
        <>
          {/* Summary */}
          <div className={`flex items-center gap-4 px-5 py-4 rounded-xl border ${
            auditData.all_valid
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-amber-50 border-amber-200'
          }`} data-testid="audit-summary">
            {auditData.all_valid
              ? <CheckCircle size={22} className="text-emerald-600" />
              : <AlertTriangle size={22} className="text-amber-600" />
            }
            <div>
              <div className="text-sm font-semibold">
                {auditData.all_valid
                  ? 'Toutes les donnees correspondent parfaitement'
                  : `${auditData.mismatches} ecart${auditData.mismatches > 1 ? 's' : ''} detecte${auditData.mismatches > 1 ? 's' : ''}`
                }
              </div>
              <div className="text-xs text-gray-500">
                {auditData.total_vehicles} vehicules verifies | Periode: {auditData.period?.from} au {auditData.period?.to}
              </div>
            </div>
          </div>

          {/* API calls info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-1.5 mb-1"><Zap size={12} className="text-gray-400" /><span className="text-[10px] text-gray-400 uppercase">Appels Engine</span></div>
              <div className="text-xl font-semibold">{auditData.engine_audit?.navixy_calls?.length || 0}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-1.5 mb-1"><Zap size={12} className="text-violet-400" /><span className="text-[10px] text-gray-400 uppercase">Appels Bruts</span></div>
              <div className="text-xl font-semibold">{auditData.raw_navixy_calls?.length || 0}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-1.5 mb-1"><Clock size={12} className="text-gray-400" /><span className="text-[10px] text-gray-400 uppercase">Cache Engine</span></div>
              <div className="text-xl font-semibold">{auditData.engine_audit?.cache?.hit ? `${auditData.engine_audit.cache.age_seconds}s` : 'Direct'}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-1.5 mb-1"><ShieldCheck size={12} className="text-gray-400" /><span className="text-[10px] text-gray-400 uppercase">Version</span></div>
              <div className="text-xl font-semibold">{auditData.engine_audit?.engine_version || '?'}</div>
            </div>
          </div>

          {/* Comparison table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-800" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Comparaison vehicule par vehicule
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="audit-table">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] font-medium uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3 text-left">Vehicule</th>
                    <th className="px-3 py-3 text-center" colSpan={2}>Kilometrage</th>
                    <th className="px-3 py-3 text-center" colSpan={2}>Odometre</th>
                    <th className="px-3 py-3 text-center" colSpan={2}>Heures moteur</th>
                    <th className="px-3 py-3 text-center">Statut</th>
                  </tr>
                  <tr className="border-b border-gray-100 text-[9px] text-gray-400">
                    <th></th>
                    <th className="px-2 py-1 text-center">Navixy</th>
                    <th className="px-2 py-1 text-center">Engine</th>
                    <th className="px-2 py-1 text-center">Navixy</th>
                    <th className="px-2 py-1 text-center">Engine</th>
                    <th className="px-2 py-1 text-center">Navixy</th>
                    <th className="px-2 py-1 text-center">Engine</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {auditData.vehicles?.map(v => {
                    const val = v.validation;
                    const cellClass = (ok) => ok ? '' : 'bg-red-50 text-red-700 font-semibold';
                    return (
                      <tr key={v.tracker_id} className="border-b border-gray-50 hover:bg-gray-50/50" data-testid={`audit-row-${v.tracker_id}`}>
                        <td className="px-4 py-2.5 text-xs font-medium text-gray-800">{v.label}</td>
                        <td className={`px-2 py-2.5 text-xs text-center ${cellClass(val.mileage)}`}>{v.navixy_raw.mileage}</td>
                        <td className={`px-2 py-2.5 text-xs text-center ${cellClass(val.mileage)}`}>{v.engine_computed.mileage}</td>
                        <td className={`px-2 py-2.5 text-xs text-center ${cellClass(val.odometer)}`}>{v.navixy_raw.odometer}</td>
                        <td className={`px-2 py-2.5 text-xs text-center ${cellClass(val.odometer)}`}>{v.engine_computed.odometer}</td>
                        <td className={`px-2 py-2.5 text-xs text-center ${cellClass(val.engine_hours)}`}>{v.navixy_raw.engine_hours}</td>
                        <td className={`px-2 py-2.5 text-xs text-center ${cellClass(val.engine_hours)}`}>{v.engine_computed.engine_hours}</td>
                        <td className="px-3 py-2.5 text-center">
                          {val.all_match
                            ? <CheckCircle size={14} className="inline text-emerald-500" />
                            : <AlertTriangle size={14} className="inline text-amber-500" />
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
