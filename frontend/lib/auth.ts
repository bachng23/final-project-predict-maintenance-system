"use client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "";
const TOKEN_KEY = "pdm.auth.token";

type LoginResponse = Record<string, unknown>;

export function endpoint(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

export function hasToken() {
  return Boolean(getToken());
}

export function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function pickToken(payload: unknown): string | null {
  const record = asRecord(payload);
  const data = asRecord(record.data);
  const user = asRecord(record.user);
  const candidates = [
    record.token,
    record.accessToken,
    record.access_token,
    record.jwt,
    data.token,
    data.accessToken,
    data.access_token,
    data.jwt,
    user.token,
    user.accessToken,
  ];

  const match = candidates.find((value) => typeof value === "string" && value.trim());
  return typeof match === "string" ? match : null;
}

function getErrorMessage(payload: unknown, fallback: string) {
  const record = asRecord(payload);
  const error = asRecord(record.error);
  const message = record.message ?? error.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

export function withAuthHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);
  const token = getToken();

  if (token) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  return nextHeaders;
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const response = await fetch(input, {
    ...init,
    headers: withAuthHeaders(init.headers),
  });

  if (response.status === 401 || response.status === 403) {
    clearToken();
    redirectToLogin();
  }

  return response;
}

export async function login(username: string, password: string) {
  const response = await fetch(endpoint("/api/v1/auth/login"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  let payload: LoginResponse | null = null;
  try {
    payload = (await response.json()) as LoginResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, "Invalid username or password."));
  }

  const token = pickToken(payload);
  if (!token) {
    throw new Error("Login response did not include an access token.");
  }

  setToken(token);
}
