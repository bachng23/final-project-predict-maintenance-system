export type BearingStatus = "normal" | "warning" | "critical" | "offline";

export type TelemetryPoint = {
  timestamp: string;
  vibration: number;
  temperature: number;
  pressure: number;
  healthScore: number;
  failureProbability: number;
  rul: number;
  rpm: number;
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
  telemetry: TelemetryPoint[];
  source: "backend" | "demo";
};

export type BearingDetailData = {
  bearing: BearingSummary;
  telemetry: TelemetryPoint[];
  source: "backend" | "demo";
};

export type HealthCheck = {
  ok: boolean;
  service: string;
  checkedAt: string;
};

type RawHealthResponse = {
  ok?: boolean;
  service?: string;
  checkedAt?: string;
  status?: string;
  message?: string;
};

type BackendEnvelope<T> = {
  success?: boolean;
  count?: number;
  data?: T;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "";

function endpoint(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(endpoint(path), {
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

  if (status === "critical" || status === "warning" || status === "normal" || status === "offline") {
    return status;
  }

  const healthyLike = new Set(["healthy", "ok", "nominal"]);
  if (healthyLike.has(status)) return "normal";

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
    rpm: asNumber(point.rpm ?? point.speed, bearing.rpm),
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

function buildFleetTelemetry(bearings: BearingSummary[]): TelemetryPoint[] {
  return Array.from({ length: 24 }, (_, index) => {
    const wave = Math.sin(index / 3.4);
    const drift = index / 24;
    const avgHealth = average(bearings.map((bearing) => bearing.healthScore));
    const avgFailure = average(bearings.map((bearing) => bearing.failureProbability));
    const avgRul = average(bearings.map((bearing) => bearing.rul));
    const avgTemp = average(bearings.map((bearing) => bearing.temperature));
    const avgVibration = average(bearings.map((bearing) => bearing.vibration));
    const avgPressure = average(bearings.map((bearing) => bearing.pressure));
    const avgRpm = average(bearings.map((bearing) => bearing.rpm));

    return {
      timestamp: new Date(Date.now() - (23 - index) * 60 * 60 * 1000).toISOString(),
      healthScore: Number((avgHealth - drift * 2.4 + wave * 1.6).toFixed(1)),
      failureProbability: Number((avgFailure + drift * 4 + Math.max(wave, 0) * 3).toFixed(1)),
      rul: Number((Math.max(0, avgRul - drift * 18)).toFixed(1)),
      temperature: Number((avgTemp + wave * 1.3 + drift * 0.8).toFixed(1)),
      vibration: Number((avgVibration + wave * 0.18 + drift * 0.12).toFixed(2)),
      pressure: Number((avgPressure + Math.cos(index / 4) * 0.08).toFixed(2)),
      rpm: Math.round(avgRpm + wave * 18),
    };
  });
}

function buildDetailTelemetry(bearing: BearingSummary, predictions: unknown[]): TelemetryPoint[] {
  if (predictions.length) {
    return [...predictions]
      .map((prediction, index) => normalizePredictionPoint(prediction, bearing, index))
      .reverse();
  }

  return Array.from({ length: 24 }, (_, index) => {
    const wave = Math.sin(index / 3.2);
    const drift = index / 24;
    return {
      timestamp: new Date(Date.now() - (23 - index) * 60 * 60 * 1000).toISOString(),
      vibration: Number((bearing.vibration + wave * 0.22 + drift * 0.18).toFixed(2)),
      temperature: Number((bearing.temperature + wave * 1.5 + drift * 0.9).toFixed(1)),
      pressure: Number((bearing.pressure + Math.cos(index / 4) * 0.1).toFixed(2)),
      healthScore: Number((bearing.healthScore - drift * 2.6 + wave * 1.8).toFixed(1)),
      failureProbability: Number((bearing.failureProbability + drift * 3 + Math.max(wave, 0) * 2.5).toFixed(1)),
      rul: Number((Math.max(0, bearing.rul - (23 - index) * 1.8)).toFixed(1)),
      rpm: Math.round(bearing.rpm + wave * 20),
    };
  });
}

function demoDashboard(): DashboardData {
  const demoBearings: BearingSummary[] = [
    {
      id: "BRG-001",
      apiId: "demo-critical-1",
      name: "Drive Shaft Bearing",
      assetName: "Unit 7 Thermal Press",
      location: "Western Plant B",
      status: "critical",
      healthScore: 62,
      failureProbability: 74,
      rul: 118,
      temperature: 84,
      vibration: 5.8,
      pressure: 5.2,
      rpm: 1460,
      updatedAt: new Date().toISOString(),
    },
    {
      id: "BRG-002",
      apiId: "demo-warning-1",
      name: "Main Spindle Bearing",
      assetName: "CNC Cell 3",
      location: "Western Plant B",
      status: "warning",
      healthScore: 78,
      failureProbability: 39,
      rul: 286,
      temperature: 73,
      vibration: 3.9,
      pressure: 4.9,
      rpm: 1432,
      updatedAt: new Date().toISOString(),
    },
    {
      id: "BRG-003",
      apiId: "demo-normal-1",
      name: "Cooling Fan Bearing",
      assetName: "Compressor A2",
      location: "Northern Plant A",
      status: "normal",
      healthScore: 91,
      failureProbability: 11,
      rul: 544,
      temperature: 61,
      vibration: 2.1,
      pressure: 4.7,
      rpm: 1498,
      updatedAt: new Date().toISOString(),
    },
  ];

  const totals = computeTotals(demoBearings);
  return {
    generatedAt: new Date().toISOString(),
    totals,
    avgHealthScore: average(demoBearings.map((bearing) => bearing.healthScore)),
    avgFailureProbability: average(demoBearings.map((bearing) => bearing.failureProbability)),
    avgRul: average(demoBearings.map((bearing) => bearing.rul)),
    activeAlerts: totals.warning + totals.critical,
    bearings: demoBearings,
    telemetry: buildFleetTelemetry(demoBearings),
    source: "demo",
  };
}

export async function fetchDashboard(signal?: AbortSignal): Promise<DashboardData> {
  try {
    const payload = unwrapEnvelope(await getJson<BackendEnvelope<unknown[]>>("/api/v1/bearings", signal));
    const bearings = Array.isArray(payload) ? payload.map(normalizeBearing) : [];

    if (bearings.length) {
      const totals = computeTotals(bearings);
      return {
        generatedAt: new Date().toISOString(),
        totals,
        avgHealthScore: average(bearings.map((bearing) => bearing.healthScore)),
        avgFailureProbability: average(bearings.map((bearing) => bearing.failureProbability)),
        avgRul: average(bearings.map((bearing) => bearing.rul)),
        activeAlerts: totals.warning + totals.critical,
        bearings,
        telemetry: buildFleetTelemetry(bearings),
        source: "backend",
      };
    }
  } catch {
    // Fall back to demo data when backend is unavailable.
  }

  return demoDashboard();
}

export async function fetchBearingDetail(id: string, signal?: AbortSignal): Promise<BearingDetailData> {
  try {
    const bearingsPayload = unwrapEnvelope(await getJson<BackendEnvelope<unknown[]>>("/api/v1/bearings", signal));
    const bearings = Array.isArray(bearingsPayload) ? bearingsPayload.map(normalizeBearing) : [];
    const bearing = bearings.find((item) => item.id === id || item.apiId === id);

    if (!bearing) {
      throw new Error(`Bearing ${id} not found`);
    }

    const predictionsPayload = unwrapEnvelope(
      await getJson<BackendEnvelope<unknown[]>>(
        `/api/v1/bearings/${encodeURIComponent(bearing.apiId)}/predictions?limit=48`,
        signal,
      ),
    );
    const predictions = Array.isArray(predictionsPayload) ? predictionsPayload : [];

    return {
      bearing,
      telemetry: buildDetailTelemetry(bearing, predictions),
      source: "backend",
    };
  } catch {
    const fallback = demoDashboard().bearings.find((bearing) => bearing.id === id) ?? demoDashboard().bearings[0];
    return {
      bearing: fallback,
      telemetry: buildDetailTelemetry(fallback, []),
      source: "demo",
    };
  }
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthCheck> {
  const raw = await getJson<RawHealthResponse>("/api/health", signal);

  return {
    ok: raw.ok ?? String(raw.status ?? "").toUpperCase() === "OK",
    service: raw.service ?? raw.message ?? "architect-hub-frontend",
    checkedAt: raw.checkedAt ?? new Date().toISOString(),
  };
}
