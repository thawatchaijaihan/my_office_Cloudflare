/**
 * Google Sheets client for Edge Runtime (Cloudflare Pages / Workers)
 * Uses fetch() + JWT auth via Web Crypto API instead of `googleapis` SDK
 */
import { config } from "./config";
import { withRetry } from "./retry";
import { logger } from "./logger";

// ─── JWT Auth (Web Crypto API — works on Edge) ───────────────────────────

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
};

function loadServiceAccountKey(): ServiceAccountKey {
  const b64 = config.google.serviceAccountKeyBase64;
  if (!b64) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 is not set");
  }

  let raw: string;
  try {
    raw = atob(b64);
  } catch {
    throw new Error("Invalid base64 in GOOGLE_SERVICE_ACCOUNT_KEY_BASE64");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 is not valid JSON");
  }

  const key = parsed as ServiceAccountKey;
  if (!key.client_email || !key.private_key) {
    throw new Error("Service account key is missing client_email/private_key");
  }
  return key;
}

function base64url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlBytes(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function getGoogleAccessToken(
  serviceAccount: ServiceAccountKey,
  scope: string
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    exp,
    iat,
  };

  const unsignedToken = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

  // Import PEM private key via Web Crypto
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = serviceAccount.private_key
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const jwt = `${unsignedToken}.${base64urlBytes(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data: any = await response.json();
  if (!data.access_token)
    throw new Error("Failed to get access token: " + JSON.stringify(data));
  return data.access_token;
}

// ─── Token cache ─────────────────────────────────────────────────────────

let cachedTokens: Record<string, { token: string; expiresAt: number }> = {};

async function getToken(readOnly: boolean): Promise<string> {
  const scope = readOnly
    ? "https://www.googleapis.com/auth/spreadsheets.readonly"
    : "https://www.googleapis.com/auth/spreadsheets";

  const cached = cachedTokens[scope];
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  const sa = loadServiceAccountKey();
  const token = await getGoogleAccessToken(sa, scope);
  cachedTokens[scope] = { token, expiresAt: Date.now() + 50 * 60 * 1000 }; // 50 min
  return token;
}

// ─── Error helpers ───────────────────────────────────────────────────────

function logSheetsError(params: {
  operation: string;
  spreadsheetId?: string;
  range?: string;
  error: unknown;
}) {
  const meta = [
    params.spreadsheetId ? `spreadsheetId=${params.spreadsheetId}` : undefined,
    params.range ? `range=${params.range}` : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  logger.error({
    message: `Google Sheets API error: ${params.operation}${meta ? ` (${meta})` : ""}`,
    error: params.error instanceof Error ? params.error.message : String(params.error),
    stack: params.error instanceof Error ? params.error.stack : undefined,
  });
}

// ─── Sheets API via fetch() ──────────────────────────────────────────────

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

export type GoogleSheetTab = {
  title: string;
  gid: number;
  index?: number;
  hidden?: boolean;
};

/**
 * List all tabs/sheets in a spreadsheet.
 * - `gid` in URL == `sheetId` from API
 */
export async function listSpreadsheetTabs(params?: {
  spreadsheetId?: string;
}): Promise<GoogleSheetTab[]> {
  const spreadsheetId = params?.spreadsheetId || config.google.sheetsId;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID is not set");

  const token = await getToken(true);
  const url = `${SHEETS_API}/${spreadsheetId}?fields=sheets(properties(sheetId,title,index,hidden))`;

  let res: Response;
  try {
    res = await withRetry(() =>
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    );
  } catch (err) {
    logSheetsError({ operation: "spreadsheets.get", spreadsheetId, error: err });
    throw err;
  }

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Sheets API error ${res.status}: ${text}`);
    logSheetsError({ operation: "spreadsheets.get", spreadsheetId, error: err });
    throw err;
  }

  const data: any = await res.json();
  const tabs: GoogleSheetTab[] = [];
  for (const s of data.sheets ?? []) {
    const p = s.properties;
    if (p?.sheetId == null || !p.title) continue;
    tabs.push({
      title: p.title,
      gid: p.sheetId,
      index: p.index ?? undefined,
      hidden: p.hidden ?? undefined,
    });
  }
  return tabs;
}

/**
 * Helper: extract spreadsheetId from full Google Sheets URL.
 */
export function parseSpreadsheetId(input: string): string | null {
  const m = input.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m?.[1] ?? null;
}

export async function readValues(params: {
  range: string;
  spreadsheetId?: string;
}): Promise<string[][]> {
  const spreadsheetId = params.spreadsheetId || config.google.sheetsId;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID is not set");

  const token = await getToken(true);
  const url = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(params.range)}`;

  let res: Response;
  try {
    res = await withRetry(() =>
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    );
  } catch (err) {
    logSheetsError({
      operation: "spreadsheets.values.get",
      spreadsheetId,
      range: params.range,
      error: err,
    });
    throw err;
  }

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Sheets API error ${res.status}: ${text}`);
    logSheetsError({
      operation: "spreadsheets.values.get",
      spreadsheetId,
      range: params.range,
      error: err,
    });
    throw err;
  }

  const data: any = await res.json();
  const values = (data.values ?? []) as unknown[][];
  return values.map((r) => r.map((c) => String(c ?? "")));
}

export async function batchUpdateValues(params: {
  spreadsheetId?: string;
  updates: Array<{ range: string; values: (string | number | null)[][] }>;
  valueInputOption?: "RAW" | "USER_ENTERED";
}): Promise<void> {
  const spreadsheetId = params.spreadsheetId || config.google.sheetsId;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID is not set");
  if (params.updates.length === 0) return;

  const token = await getToken(false);
  const url = `${SHEETS_API}/${spreadsheetId}/values:batchUpdate`;

  try {
    const res = await withRetry(() =>
      fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          valueInputOption: params.valueInputOption ?? "USER_ENTERED",
          data: params.updates.map((u) => ({
            range: u.range,
            values: u.values,
          })),
        }),
      })
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sheets API error ${res.status}: ${text}`);
    }
  } catch (err) {
    logSheetsError({
      operation: "spreadsheets.values.batchUpdate",
      spreadsheetId,
      range: params.updates[0]?.range,
      error: err,
    });
    throw err;
  }
}

export async function appendValues(params: {
  spreadsheetId?: string;
  range: string;
  values: (string | number | null)[][];
  valueInputOption?: "RAW" | "USER_ENTERED";
}): Promise<void> {
  const spreadsheetId = params.spreadsheetId || config.google.sheetsId;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID is not set");
  if (params.values.length === 0) return;

  const token = await getToken(false);
  const url = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(params.range)}:append?valueInputOption=${params.valueInputOption ?? "USER_ENTERED"}&insertDataOption=INSERT_ROWS`;

  try {
    const res = await withRetry(() =>
      fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: params.values }),
      })
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sheets API error ${res.status}: ${text}`);
    }
  } catch (err) {
    logSheetsError({
      operation: "spreadsheets.values.append",
      spreadsheetId,
      range: params.range,
      error: err,
    });
    throw err;
  }
}
