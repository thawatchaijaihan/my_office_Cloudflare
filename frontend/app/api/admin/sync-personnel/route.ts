import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "edge";

async function getGoogleAccessToken(serviceAccount: any): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp,
    iat,
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '');
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = serviceAccount.private_key
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const jwt = `${unsignedToken}.${encodedSignature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data: any = await response.json();
  if (!data.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(data));
  return data.access_token;
}

async function readSheetValues(token: string, spreadsheetId: string, range: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data: any = await response.json();
  return data.values || [];
}

function getCell(row: string[], idx: number): string {
  return row[idx]?.trim() || '';
}

async function syncPersonnel(db: any, token: string, spreadsheetId: string) {
  const tabs = await listSpreadsheetTabs(token, spreadsheetId);
  const possibleNames = ["ข้อมูลกำลังพล", "รายชื่อกำลังพล", "กำลังพล", "Personnel", "personnel"];
  let sheetName = tabs.find((t: any) => possibleNames.includes(t.properties.title))?.properties?.title;
  
  if (!sheetName) {
    sheetName = tabs.find((t: any) => t.properties.title.includes("กำลังพล"))?.properties?.title || "ข้อมูลกำลังพล";
  }

  const values = await readSheetValues(token, spreadsheetId, `'${sheetName}'!A:R`);
  if (!values || values.length === 0) throw new Error(`Personnel sheet '${sheetName}' is empty or missing`);

  let start = 0;
  if (values.length > 0) {
    const first = values[0][0]?.toLowerCase();
    if (first === 'ยศ' || first === 'rank') start = 1;
  }

  let count = 0;
  for (let i = start; i < values.length; i++) {
    const r = values[i];
    const rank = getCell(r, 0);
    const firstName = getCell(r, 1);
    const lastName = getCell(r, 2);

    if (!rank && !firstName && !lastName) continue;

    await db.prepare(`
      INSERT INTO personnel (
        rank, first_name, last_name, phone, bank, account_number,
        citizen_id, military_id, duty, position, unit, birthplace,
        birth_date, registered_date, enlistment_date, rank_date,
        salary, age, retire_year, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(citizen_id) DO UPDATE SET
        rank=excluded.rank, first_name=excluded.first_name, last_name=excluded.last_name,
        phone=excluded.phone, bank=excluded.bank, account_number=excluded.account_number,
        military_id=excluded.military_id, duty=excluded.duty, position=excluded.position,
        unit=excluded.unit, birthplace=excluded.birthplace, birth_date=excluded.birth_date,
        registered_date=excluded.registered_date, enlistment_date=excluded.enlistment_date,
        rank_date=excluded.rank_date, salary=excluded.salary, age=excluded.age,
        retire_year=excluded.retire_year, updated_at=excluded.updated_at
    `).bind(
      rank, firstName, lastName, getCell(r, 3), getCell(r, 4), getCell(r, 5),
      getCell(r, 6), getCell(r, 7), getCell(r, 8), getCell(r, 9), getCell(r, 10),
      getCell(r, 11), getCell(r, 12), getCell(r, 13), getCell(r, 14), getCell(r, 15),
      getCell(r, 16), getCell(r, 17), getCell(r, 18)
    ).run();
    count++;
  }
  return count;
}

async function listSpreadsheetTabs(token: string, spreadsheetId: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data: any = await response.json();
  return data.sheets || [];
}

async function syncPassRequests(db: any, token: string, spreadsheetId: string, indexSheetGid?: string) {
  let sheetName = "index";
  if (indexSheetGid) {
    const tabs = await listSpreadsheetTabs(token, spreadsheetId);
    const tab = tabs.find((t: any) => String(t.properties.sheetId) === String(indexSheetGid));
    if (tab && tab.properties.title) {
      sheetName = tab.properties.title;
    }
  }

  const values = await readSheetValues(token, spreadsheetId, `'${sheetName}'!A2:P`);
  if (!values || values.length === 0) return 0;

  // Clear existing to avoid duplicates
  await db.prepare("DELETE FROM pass_requests").run();

  let count = 0;
  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    if (r.every((c: any) => !String(c ?? "").trim())) continue;

    const timestamp = getCell(r, 0);
    const rank = getCell(r, 1);
    const firstName = getCell(r, 2);
    const lastName = getCell(r, 3);
    const relation = getCell(r, 4);
    const vehicleType = getCell(r, 6);
    const vehicleModel = getCell(r, 7);
    const vehicleColor = getCell(r, 8);
    const plate = getCell(r, 9);
    const phone = getCell(r, 10);
    const statusM = getCell(r, 12);
    const statusN = getCell(r, 13);
    
    let paidAmount = 0;
    if (statusM === 'ชำระแล้ว') paidAmount = 100;

    await db.prepare(`
      INSERT INTO pass_requests (
        timestamp, rank, first_name, last_name, relation, phone,
        vehicle_type, vehicle_model, vehicle_color, plate,
        status_m, status_n, paid_amount, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    `).bind(
      timestamp, rank, firstName, lastName, relation, phone,
      vehicleType, vehicleModel, vehicleColor, plate,
      statusM, statusN, paidAmount
    ).run();
    count++;
  }
  return count;
}

export async function POST(request: NextRequest) {
  try {
    const env = getRequestContext().env as any;
    if (!env.DB) return NextResponse.json({ error: "No DB" }, { status: 500 });
    if (!env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) return NextResponse.json({ error: "No GOOGLE_SERVICE_ACCOUNT_KEY_BASE64" }, { status: 500 });
    if (!env.GOOGLE_SHEETS_ID) return NextResponse.json({ error: "No GOOGLE_SHEETS_ID" }, { status: 500 });

    const serviceAccount = JSON.parse(atob(env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64));
    const token = await getGoogleAccessToken(serviceAccount);
    
    let countPersonnel = 0;
    let personnelError = null;
    try {
      const personnelSheetId = env.PERSONNEL_SHEET_ID || env.GOOGLE_SHEETS_ID_PERSONNEL || env.GOOGLE_SHEETS_ID;
      countPersonnel = await syncPersonnel(env.DB, token, personnelSheetId);
    } catch (e: any) {
      personnelError = e.message;
      console.error("[Sync API] personnel sync failed:", e);
    }

    let countRequests = 0;
    try {
      const indexGid = env.INDEX_SHEET_GID || "1143152346";
      countRequests = await syncPassRequests(env.DB, token, env.GOOGLE_SHEETS_ID, indexGid);
    } catch (e: any) {
      console.error("[Sync API] pass_requests sync failed:", e);
    }
    
    return NextResponse.json({ 
      status: 'success', 
      message: `Synced ${countPersonnel} personnel records and ${countRequests} pass requests successfully`,
      personnelError,
    });
  } catch (e: any) {
    console.error("[Sync API] Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

