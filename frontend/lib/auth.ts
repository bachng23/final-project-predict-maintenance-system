"use client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "";
const TOKEN_KEY = "marco.ai.auth.token";

type LoginResponse =
  | { token?: string; accessToken?: string; access_token?: string; jwt?: string; data?: LoginResponse; user?: LoginResponse }
  | Record<string, unknown>;

function isBrowser() {
  return typeof window !== "undefined";
}

export function endpoint(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
}

export function getToken() {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function hasToken() {
  return Boolean(getToken());
}

export function setToken(token: string) {
  if (!isBrowser()) return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(TOKEN_KEY);
}

export function redirectToLogin() {
  if (!isBrowser()) return;
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

function extractToken(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as LoginResponse;
  const direct =
    typeof record.token === "string" ? record.token :
    typeof record.accessToken === "string" ? record.accessToken :
    typeof record.access_token === "string" ? record.access_token :
    typeof record.jwt === "string" ? record.jwt :
    null;

  if (direct) return direct;
  return extractToken(record.data) ?? extractToken(record.user);
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

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof (payload as { message?: unknown }).message === "string"
        ? (payload as { message: string }).message
        : "Invalid username or password.";
    throw new Error(message);
  }

  const token = extractToken(payload);
  if (!token) {
    throw new Error("Login succeeded but no access token was returned.");
  }

  setToken(token);
  return token;
}

export function withAuthHeaders(headers?: HeadersInit) {
  const token = getToken();
  const result = new Headers(headers);

  if (token) {
    result.set("Authorization", `Bearer ${token}`);
  }

  return result;
}

export async function authFetch(input: string, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: withAuthHeaders(init?.headers),
  });

  if (response.status === 401 || response.status === 403) {
    clearToken();
    redirectToLogin();
  }

  return response;
}
