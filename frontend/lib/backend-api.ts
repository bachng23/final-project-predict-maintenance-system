import { authFetch, endpoint } from "@/lib/auth";

export type BearingStatus = "normal" | "warning" | "critical" | "offline";

export type TelemetryPoint = {
  timestamp: string;
  fileIdx?: number;
  vibration: number;
  temperature: number;
  pressure: number;
  healthScore: number;
  failureProbability: number;
  rul: number;
  rulLower?: number;
  rulUpper?: number;
  rpm: number;
  faultType?: string;
};

export type BearingSummary = {
  id: string;
  apiId: string;
  name: string;
  assetName: string;
  location: string;
  status: BearingStatus;
  healthScore: number;
  failureProbability: number;
  rul: number;
  temperature: number;
  vibration: number;
  pressure: number;
  rpm: number;
  updatedAt: string;
};

export type DashboardData = {
  generatedAt: string;
  totals: {
    bearings: number;
    normal: number;
    warning: number;
    critical: number;
    offline: number;
  };
  avgHealthScore: number;
  avgFailureProbability: number;
  avgRul: number;
  activeAlerts: number;
  bearings: BearingSummary[];
  source: "backend";
};

export type HealthCheck = {
  ok: boolean;
  service: string;
  checkedAt: string;
};

type RawHealthResponse = {
  status?: string;
  message?: string;
  ok?: boolean;
  service?: string;
  checkedAt?: string;
};

export type BearingDetailData = {
  bearing: BearingSummary;
  telemetry: TelemetryPoint[];
  source: "backend";
};

type BackendEnvelope<T> = {
  success?: boolean;
  count?: number;
  data?: T;
};

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await authFetch(endpoint(path), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Backend responded ${response.status} for ${path}`);
  }

  return response.json() as Promise<T>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asPercent(value: unknown, fallback = 0) {
  const number = asNumber(value, fallback);
  return number <= 1 ? number * 100 : number;
}

function asHoursFromMinutes(value: unknown, fallback = 0) {
  const minutes = asNumber(value, fallback * 60);
  return minutes / 60;
}

function asStatus(value: unknown, failureProbability: number): BearingStatus {
  const status = String(value ?? "").toLowerCase();

  if (status === "offline") return "offline";

  // Always derive status from failure probability — backend status field lags behind predictions
  if (failureProbability >= 70) return "critical";
  if (failureProbability >= 35) return "warning";
  return "normal";
}

function unwrapEnvelope<T>(value: BackendEnvelope<T> | T): T {
  const record = asRecord(value);
  if ("data" in record) {
    return record.data as T;
  }
  return value as T;
}

function normalizeBearing(value: unknown, index = 0): BearingSummary {
  const bearing = asRecord(value);
  const failureProbability = asPercent(
    bearing.failureProbability ??
      bearing.failure_probability ??
      bearing.failure_prob ??
      bearing.p_fail ??
      bearing.risk,
    12,
  );

  return {
    id: asString(bearing.bearing_id ?? bearing.bearingId ?? bearing.id, `BRG-${index + 1}`),
    apiId: asString(bearing.id ?? bearing.bearing_id, `bearing-${index + 1}`),
    name: asString(
      bearing.name ?? bearing.display_name ?? bearing.bearingName ?? bearing.bearing_name ?? bearing.machineName,
      `Bearing ${index + 1}`,
    ),
    assetName: asString(
      bearing.assetName ?? bearing.asset_name ?? bearing.dataset_source ?? bearing.machineName,
      "Bearing Asset",
    ),
    location: asString(bearing.location ?? bearing.line ?? bearing.area ?? bearing.condition_label, "Unknown zone"),
    status: asStatus(bearing.status, failureProbability),
    healthScore: asNumber(bearing.healthScore ?? bearing.health_score ?? bearing.health, 88),
    failureProbability,
    rul: asHoursFromMinutes(
      bearing.rul ?? bearing.rul_hours ?? bearing.rul_minutes ?? bearing.remainingUsefulLife ?? bearing.remaining_useful_life,
      450,
    ),
    temperature: asNumber(bearing.temperature ?? bearing.temp ?? bearing.temperatureC, 72),
    vibration: asNumber(
      bearing.vibration ?? bearing.vibrationRms ?? bearing.vibration_rms ?? bearing.vibrationMmS,
      3.2,
    ),
    pressure: asNumber(bearing.pressure, 5.1),
    rpm: asNumber(bearing.rpm ?? bearing.speed, 1460),
    updatedAt: asString(
      bearing.updatedAt ?? bearing.updated_at ?? bearing.timestamp ?? bearing.lastUpdated ?? bearing.latest_prediction_at,
      new Date().toISOString(),
    ),
  };
}

function normalizePredictionPoint(value: unknown, bearing: BearingSummary, index = 0): TelemetryPoint {
  const point = asRecord(value);
  const timestamp = asString(
    point.timestamp ?? point.time ?? point.createdAt ?? point.created_at ?? point.sample_ts,
    new Date(Date.now() - (47 - index) * 30 * 60 * 1000).toISOString(),
  );

  return {
    timestamp,
    fileIdx: asNumber(point.file_idx ?? point.fileIdx, index + 1),
    vibration: asNumber(point.vibration ?? point.vibrationRms ?? point.vibration_rms, bearing.vibration),
    temperature: asNumber(point.temperature ?? point.temp, bearing.temperature),
    pressure: asNumber(point.pressure, bearing.pressure),
    healthScore: asNumber(point.healthScore ?? point.health_score ?? point.health, bearing.healthScore),
    failureProbability: asPercent(
      point.failureProbability ?? point.failure_probability ?? point.failure_prob ?? point.p_fail ?? point.risk,
      bearing.failureProbability,
    ),
    rul: asHoursFromMinutes(
      point.rul ?? point.rul_hours ?? point.rul_minutes ?? point.remainingUsefulLife ?? point.remaining_useful_life,
      bearing.rul,
    ),
    // Fields with explicit minutes suffix need conversion; bare rul_lower/rul_upper assumed hours
    rulLower: (point.rul_lower_minutes ?? point.rulLowerMinutes) != null
      ? asHoursFromMinutes(point.rul_lower_minutes ?? point.rulLowerMinutes, bearing.rul)
      : asNumber(point.rul_lower, bearing.rul),
    rulUpper: (point.rul_upper_minutes ?? point.rulUpperMinutes) != null
      ? asHoursFromMinutes(point.rul_upper_minutes ?? point.rulUpperMinutes, bearing.rul)
      : asNumber(point.rul_upper, bearing.rul),
    rpm: asNumber(point.rpm ?? point.speed, bearing.rpm),
    faultType: asString(point.fault_type ?? point.faultType, ""),
  };
}

function computeTotals(bearings: BearingSummary[]) {
  return bearings.reduce(
    (totals, bearing) => {
      totals.bearings += 1;
      totals[bearing.status] += 1;
      return totals;
    },
    { bearings: 0, normal: 0, warning: 0, critical: 0, offline: 0 },
  );
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildDetailTelemetry(bearing: BearingSummary, predictions: unknown[]): TelemetryPoint[] {
  return [...predictions]
    .map((prediction, index) => normalizePredictionPoint(prediction, bearing, index))
    .reverse();
}

export async function fetchDashboard(signal?: AbortSignal): Promise<DashboardData> {
  const payload = unwrapEnvelope(await getJson<BackendEnvelope<unknown[]>>("/api/v1/bearings", signal));
  const bearings = Array.isArray(payload) ? payload.map(normalizeBearing) : [];
  const totals = computeTotals(bearings);

  return {
    generatedAt: new Date().toISOString(),
    totals,
    avgHealthScore: average(bearings.map((bearing) => bearing.healthScore)),
    avgFailureProbability: average(bearings.map((bearing) => bearing.failureProbability)),
    avgRul: average(bearings.map((bearing) => bearing.rul)),
    activeAlerts: totals.warning + totals.critical,
    bearings,
    source: "backend",
  };
}

export async function fetchBearingPredictions(apiId: string, bearing: BearingSummary, signal?: AbortSignal, limit = 48) {
  const predictionsPayload = unwrapEnvelope(
    await getJson<BackendEnvelope<unknown[]>>(
      `/api/v1/bearings/${encodeURIComponent(apiId)}/predictions?limit=${limit}`,
      signal,
    ),
  );
  const predictions = Array.isArray(predictionsPayload) ? predictionsPayload : [];
  return buildDetailTelemetry(bearing, predictions);
}

export async function fetchBearingDetail(id: string, signal?: AbortSignal): Promise<BearingDetailData> {
  const bearingsPayload = unwrapEnvelope(await getJson<BackendEnvelope<unknown[]>>("/api/v1/bearings", signal));
  const bearings = Array.isArray(bearingsPayload) ? bearingsPayload.map(normalizeBearing) : [];
  const bearing = bearings.find((item) => item.id === id || item.apiId === id);

  if (!bearing) {
    throw new Error(`Bearing ${id} not found`);
  }

  const telemetry = await fetchBearingPredictions(bearing.apiId, bearing, signal);

  return {
    bearing,
    telemetry,
    source: "backend",
  };
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthCheck> {
  const raw = await getJson<RawHealthResponse>("/api/health", signal);

  return {
    ok: raw.ok ?? String(raw.status ?? "").toUpperCase() === "OK",
    service: raw.service ?? raw.message ?? "backend-health",
    checkedAt: raw.checkedAt ?? new Date().toISOString(),
  };
}
