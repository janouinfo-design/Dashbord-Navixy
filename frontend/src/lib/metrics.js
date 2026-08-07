// ============ FLEET METRICS ENGINE v2 ============
// Aligned with Analytics Engine v1.0.0
// All values from LOGITRAK or configurable parameters. No random, no estimation.

const FUEL_PRICE_CHF = 2.0; // Default — overridden via /api/config/fuel
const IDLE_FUEL_RATE_LH = 1.5;
const IDLE_COST_PER_HOUR = IDLE_FUEL_RATE_LH * FUEL_PRICE_CHF;

const safe = (v, fb = 0) => (v !== null && v !== undefined && !isNaN(v)) ? Number(v) : fb;

// ---- Vehicle score → real utilization_score from engine ----
export const calcVehicleScore = (vehicle) => safe(vehicle.utilization_score, 0);

// ---- Driver score → based on real assignment data ----
export const calcDriverScore = (driver, compVehicles) => {
  const tid = driver.vehicles?.[0]?.tracker_id;
  const v = compVehicles.find(c => c.tracker_id === tid);
  if (!v) return { score: 0, distance: 0, utilization: 0, idle: null, violations: null, consumption: null, fuelCost: null };
  return {
    score: safe(v.utilization_score),
    distance: safe(v.total_distance_week),
    utilization: safe(v.utilization_score),
    idle: v.idle_percentage,
    violations: v.violations_count,
    consumption: v.fuel_efficiency,
    fuelCost: null,
  };
};

// ---- Insights from REAL data only ----
export const generateInsights = (vehicles, compVehicles) => {
  const insights = [];

  // Offline vehicles
  const offline = vehicles.filter(v => v.connection_status !== 'active');
  if (offline.length > 0) {
    insights.push({
      type: 'warning', icon: 'WifiOff',
      title: `${offline.length} vehicule${offline.length > 1 ? 's' : ''} hors ligne`,
      detail: 'Perte de signal GPS — verifier alimentation et connectivite',
      action: 'Inspecter les trackers GPS',
    });
  }

  // Low utilization (real utilization_score < 30)
  const lowUtil = compVehicles.filter(v => safe(v.utilization_score) < 30 && safe(v.utilization_score) > 0);
  if (lowUtil.length > 0) {
    insights.push({
      type: 'danger', icon: 'AlertTriangle',
      title: `${lowUtil.length} vehicule${lowUtil.length > 1 ? 's' : ''} sous-utilise${lowUtil.length > 1 ? 's' : ''} (<30%)`,
      detail: lowUtil.slice(0, 3).map(v => v.label).join(', ') + (lowUtil.length > 3 ? '...' : ''),
      action: 'Analyser le besoin reel et optimiser les affectations',
    });
  }

  // Zero km vehicles
  const zeroKm = compVehicles.filter(v => safe(v.total_distance_week) === 0);
  if (zeroKm.length > 2) {
    insights.push({
      type: 'info', icon: 'Truck',
      title: `${zeroKm.length} vehicules sans activite (0 km cette semaine)`,
      detail: 'Potentiel de redistribution ou reduction de flotte',
      action: 'Verifier si ces vehicules sont encore necessaires',
    });
  }

  // Best performer
  const sorted = [...compVehicles].sort((a, b) => safe(b.total_distance_week) - safe(a.total_distance_week));
  if (sorted.length > 0 && safe(sorted[0].total_distance_week) > 0) {
    insights.push({
      type: 'success', icon: 'CheckCircle',
      title: `Meilleur vehicule: ${sorted[0].label}`,
      detail: `${sorted[0].total_distance_week} km — Utilisation ${sorted[0].utilization_score}%`,
      action: 'Reference pour benchmarker la flotte',
    });
  }

  return insights;
};

// ---- Financial risk from REAL data ----
export const calcFinancialRisk = (compVehicles, trends) => {
  // Without fuel sensor data, we cannot compute real fuel waste
  // Return zeros — costs tab will show "configurer" prompt
  return { idleCost: 0, fuelWaste: 0, monthlyEstimate: 0 };
};

// ---- Fleet summary from REAL data ----
export const calcFleetSummary = (vehicles, compVehicles, trends) => {
  const total = vehicles.length;
  const active = vehicles.filter(v => v.connection_status === 'active').length;
  const idle = vehicles.filter(v => v.movement_status === 'idle').length;
  const offline = total - active;
  const totalKm = vehicles.reduce((s, v) => s + safe(v.mileage), 0);
  const totalEngineH = vehicles.reduce((s, v) => s + safe(v.engine_hours), 0);

  const avgUtil = compVehicles.length > 0
    ? Math.round(compVehicles.reduce((s, v) => s + safe(v.utilization_score), 0) / compVehicles.length)
    : 0;

  const alertCount = compVehicles.filter(v => safe(v.utilization_score) < 30).length + offline;

  return {
    total, active, idle, offline, totalKm, totalEngineH,
    fleetScore: avgUtil,
    alertCount,
    violations: 0,
    totalFuelL: trends?.summary?.total_fuel || 0,
    totalFuelCost: Math.round((trends?.summary?.total_fuel || 0) * FUEL_PRICE_CHF),
    avgFuelEff: 'N/A',
    totalIdleH: 'N/A',
    idleCostEstimate: 0,
  };
};

// ---- Formatting helpers ----
export const formatTime = (seconds) => {
  if (!seconds && seconds !== 0) return 'N/A';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const formatCHF = (value) => {
  if (value === null || value === undefined) return 'N/A';
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return `${value}`;
};

export const getScoreColor = (score) => {
  const s = safe(score);
  if (s >= 70) return 'text-emerald-600';
  if (s >= 40) return 'text-amber-600';
  return 'text-red-500';
};

export const getScoreBg = (score) => {
  const s = safe(score);
  if (s >= 70) return 'bg-emerald-500';
  if (s >= 40) return 'bg-amber-500';
  return 'bg-red-500';
};

export const getStatusColor = (status) => {
  if (status === 'active') return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
  if (status === 'idle') return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' };
  return { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400' };
};

export const getStatusLabel = (status) => {
  if (status === 'active') return 'Actif';
  if (status === 'idle') return 'Ralenti';
  return 'Offline';
};

// Display helper for null values
export const displayValue = (val, unit = '', fallback = 'N/A') => {
  if (val === null || val === undefined) return fallback;
  return `${val}${unit}`;
};

export { FUEL_PRICE_CHF, IDLE_COST_PER_HOUR };
