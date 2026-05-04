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
  source: "backend" | "demo";
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

function asStatus(value: unknown, failureProbability: number): BearingStatus {
  const status = String(value ?? "").toLowerCase();

  if (status === "critical" || status === "warning" || status === "normal" || status === "offline") {
    return status;
  }

  if (failureProbability >= 70) return "critical";
  if (failureProbability >= 35) return "warning";
  return "normal";
}

function unwrapArray(value: unknown, keys: string[]) {
  if (Array.isArray(value)) return value;

  const record = asRecord(value);
  for (const key of keys) {
    const candidate = record[key];
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function normalizeBearing(value: unknown, index = 0): BearingSummary {
  const bearing = asRecord(value);
  const failureProbability = asNumber(
    bearing.failureProbability ?? bearing.failure_probability ?? bearing.failure_prob ?? bearing.risk,
    12,
  );

  return {
    id: asString(bearing.id ?? bearing.bearingId ?? bearing.bearing_id, `BRG-${index + 1}`),
    name: asString(bearing.name ?? bearing.bearingName ?? bearing.bearing_name, `Bearing ${index + 1}`),
    assetName: asString(bearing.assetName ?? bearing.asset_name ?? bearing.machineName, "Thermal Press"),
    location: asString(bearing.location ?? bearing.line ?? bearing.area, "Line A"),
    status: asStatus(bearing.status, failureProbability),
    healthScore: asNumber(bearing.healthScore ?? bearing.health_score ?? bearing.health, 88),
    failureProbability,
    rul: asNumber(bearing.rul ?? bearing.remainingUsefulLife ?? bearing.remaining_useful_life, 450),
    temperature: asNumber(bearing.temperature ?? bearing.temp, 72),
    vibration: asNumber(bearing.vibration ?? bearing.vibrationRms ?? bearing.vibration_rms, 3.2),
    pressure: asNumber(bearing.pressure, 5.1),
    updatedAt: asString(bearing.updatedAt ?? bearing.updated_at ?? bearing.timestamp, new Date().toISOString()),
  };
}

function normalizeTelemetryPoint(value: unknown, index = 0): TelemetryPoint {
  const point = asRecord(value);
  const timestamp = asString(
    point.timestamp ?? point.time ?? point.createdAt ?? point.created_at,
    new Date(Date.now() - (47 - index) * 30 * 60 * 1000).toISOString(),
  );

  return {
    timestamp,
    vibration: asNumber(point.vibration ?? point.vibrationRms ?? point.vibration_rms, 2.8),
    temperature: asNumber(point.temperature ?? point.temp, 70),
    pressure: asNumber(point.pressure, 5),
    healthScore: asNumber(point.healthScore ?? point.health_score ?? point.health, 88),
    failureProbability: asNumber(
      point.failureProbability ?? point.failure_probability ?? point.failure_prob ?? point.risk,
      14,
    ),
    rul: asNumber(point.rul ?? point.remainingUsefulLife ?? point.remaining_useful_life, 450),
    rpm: asNumber(point.rpm ?? point.speed, 1460),
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

function normalizeDashboard(raw: unknown): DashboardData {
  const record = asRecord(raw);
  const bearings = unwrapArray(record.bearings ?? record.assets ?? raw, ["bearings", "assets", "data"]).map(
    normalizeBearing,
  );
  const telemetry = unwrapArray(record.telemetry ?? record.series ?? record.timeSeries, [
    "telemetry",
    "series",
    "timeSeries",
    "data",
  ]).map(normalizeTelemetryPoint);
  const totals = computeTotals(bearings);

  return {
    generatedAt: asString(record.generatedAt ?? record.generated_at ?? record.timestamp, new Date().toISOString()),
    totals,
    avgHealthScore: asNumber(record.avgHealthScore ?? record.avg_health_score, average(bearings.map((b) => b.healthScore))),
    avgFailureProbability: asNumber(
      record.avgFailureProbability ?? record.avg_failure_probability,
      average(bearings.map((b) => b.failureProbability)),
    ),
    avgRul: asNumber(record.avgRul ?? record.avg_rul, average(bearings.map((b) => b.rul))),
    activeAlerts: asNumber(record.activeAlerts ?? record.active_alerts, totals.warning + totals.critical),
    bearings,
    telemetry,
    source: "backend",
  };
}

function demoTelemetry(seed = 0): TelemetryPoint[] {
  return Array.from({ length: 48 }, (_, index) => {
    const wave = Math.sin((index + seed) / 5);
    const drift = index / 47;
    return {
      timestamp: new Date(Date.now() - (47 - index) * 30 * 60 * 1000).toISOString(),
      vibration: Number((2.4 + wave * 0.35 + drift * 1.1).toFixed(2)),
      temperature: Number((63 + wave * 5 + drift * 14).toFixed(1)),
      pressure: Number((4.8 + Math.cos(index / 4) * 0.24).toFixed(2)),
      healthScore: Number((94 - drift * 15 - Math.max(wave, 0) * 4).toFixed(1)),
      failureProbability: Number((8 + drift * 31 + Math.max(wave, 0) * 5).toFixed(1)),
      rul: Math.round(620 - drift * 210 - Math.max(wave, 0) * 35),
      rpm: Math.round(1450 + wave * 34),
    };
  });
}

const demoBearings: BearingSummary[] = [
  {
    id: "BRG-001",
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
    updatedAt: new Date().toISOString(),
  },
  {
    id: "BRG-002",
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
    updatedAt: new Date().toISOString(),
  },
  {
    id: "BRG-003",
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
    updatedAt: new Date().toISOString(),
  },
  {
    id: "BRG-004",
    name: "Conveyor Roller Bearing",
    assetName: "Packaging Line 1",
    location: "Western Plant B",
    status: "normal",
    healthScore: 88,
    failureProbability: 16,
    rul: 492,
    temperature: 66,
    vibration: 2.8,
    pressure: 5,
    updatedAt: new Date().toISOString(),
  },
];

function demoDashboard(): DashboardData {
  const totals = computeTotals(demoBearings);
  return {
    generatedAt: new Date().toISOString(),
    totals,
    avgHealthScore: average(demoBearings.map((bearing) => bearing.healthScore)),
    avgFailureProbability: average(demoBearings.map((bearing) => bearing.failureProbability)),
    avgRul: average(demoBearings.map((bearing) => bearing.rul)),
    activeAlerts: totals.warning + totals.critical,
    bearings: demoBearings,
    telemetry: demoTelemetry(),
    source: "demo",
  };
}

export async function fetchDashboard(signal?: AbortSignal): Promise<DashboardData> {
  try {
    const dashboard = normalizeDashboard(await getJson("/api/dashboard", signal));

    if (dashboard.bearings.length) {
      return {
        ...dashboard,
        telemetry: dashboard.telemetry.length ? dashboard.telemetry : demoTelemetry(),
      };
    }
  } catch {
    // Fall through to the bearing endpoint and finally demo data.
  }

  try {
    const bearings = unwrapArray(await getJson("/api/bearings", signal), ["bearings", "assets", "data"]).map(
      normalizeBearing,
    );
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
        telemetry: demoTelemetry(),
        source: "backend",
      };
    }
  } catch {
    // Fallback lets the UI be developed while the backend endpoint is offline.
  }

  return demoDashboard();
}

export async function fetchBearingDetail(id: string, signal?: AbortSignal): Promise<BearingDetailData> {
  try {
    const [bearingRaw, telemetryRaw] = await Promise.all([
      getJson(`/api/bearings/${encodeURIComponent(id)}`, signal),
      getJson(`/api/bearings/${encodeURIComponent(id)}/telemetry?range=24h`, signal),
    ]);

    return {
      bearing: normalizeBearing(asRecord(bearingRaw).bearing ?? bearingRaw),
      telemetry: unwrapArray(telemetryRaw, ["telemetry", "series", "timeSeries", "data"]).map(normalizeTelemetryPoint),
      source: "backend",
    };
  } catch {
    const fallbackBearing = demoBearings.find((bearing) => bearing.id === id) ?? demoBearings[0];
    return {
      bearing: fallbackBearing,
      telemetry: demoTelemetry(demoBearings.findIndex((bearing) => bearing.id === fallbackBearing.id)),
      source: "demo",
    };
  }
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthCheck> {
  const raw = await getJson<RawHealthResponse>("/api/health", signal);

  return {
    ok: raw.ok ?? String(raw.status ?? "").toUpperCase() === "OK",
    service: raw.service ?? raw.message ?? "backend-health",
    checkedAt: raw.checkedAt ?? new Date().toISOString(),
  };
}
