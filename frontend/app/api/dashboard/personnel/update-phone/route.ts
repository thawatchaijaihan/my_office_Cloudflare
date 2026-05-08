import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "edge";

async function getGoogleWriteAccessToken(serviceAccount: any): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
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

async function listSpreadsheetTabs(token: string, spreadsheetId: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data: any = await response.json();
  return data.sheets || [];
}

async function readSheetValues(token: string, spreadsheetId: string, range: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data: any = await response.json();
  return data.values || [];
}

async function updateSheetValue(token: string, spreadsheetId: string, range: string, value: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      range,
      majorDimension: "ROWS",
      values: [[value]]
    })
  });
  const data: any = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

export async function POST(request: NextRequest) {
  try {
    const { citizenId, newPhone } = await request.json();
    if (!citizenId) return NextResponse.json({ error: "Missing citizenId" }, { status: 400 });

    const env = getRequestContext().env as any;
    if (!env.DB) return NextResponse.json({ error: "No DB" }, { status: 500 });
    if (!env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) return NextResponse.json({ error: "No GOOGLE_SERVICE_ACCOUNT_KEY_BASE64" }, { status: 500 });

    const personnelSheetId = env.PERSONNEL_SHEET_ID || env.GOOGLE_SHEETS_ID_PERSONNEL || env.GOOGLE_SHEETS_ID;
    if (!personnelSheetId) return NextResponse.json({ error: "No PERSONNEL_SHEET_ID" }, { status: 500 });

    // Update D1 immediately
    await env.DB.prepare("UPDATE personnel SET phone = ? WHERE citizen_id = ?")
      .bind(newPhone || "", citizenId)
      .run();

    // Now update Google Sheets
    const serviceAccount = JSON.parse(atob(env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64));
    const token = await getGoogleWriteAccessToken(serviceAccount);
    
    // Find the sheet name
    const tabs = await listSpreadsheetTabs(token, personnelSheetId);
    const possibleNames = ["ข้อมูลกำลังพล", "รายชื่อกำลังพล", "กำลังพล", "Personnel", "personnel", "ชีต1", "Sheet1"];
    let sheetName = tabs.find((t: any) => possibleNames.includes(t.properties.title))?.properties?.title;
    if (!sheetName) sheetName = tabs.find((t: any) => t.properties.title.includes("กำลังพล"))?.properties?.title || "ข้อมูลกำลังพล";

    // Read the citizen_id column (assuming Column G is citizen_id)
    // Wait, let's fetch column A to H to find the exact column of citizen_id and phone!
    const headerValues = await readSheetValues(token, personnelSheetId, `'${sheetName}'!1:2`);
    if (!headerValues || headerValues.length === 0) throw new Error("Sheet is empty");
    
    // In our previous debugging, row1 was the header
    const headers: string[] = headerValues[0].map((h: string) => h.trim());
    const phoneColIndex = headers.indexOf("เบอร์โทร");
    const citizenColIndex = headers.findIndex(h => h.includes("ประชาชน")); // "หมายเลขประจำตัวประชาชน"

    if (phoneColIndex === -1 || citizenColIndex === -1) {
      throw new Error("Could not find 'เบอร์โทร' or 'หมายเลขประจำตัวประชาชน' columns in Google Sheet");
    }

    // Now read the citizen_id column specifically to find the row
    // Column A is index 0. A charcode = 65. So index 0 = A, index 6 = G
    const citizenColLetter = String.fromCharCode(65 + citizenColIndex);
    const phoneColLetter = String.fromCharCode(65 + phoneColIndex);

    const citizenValues = await readSheetValues(token, personnelSheetId, `'${sheetName}'!${citizenColLetter}:${citizenColLetter}`);
    
    let rowIndex = -1;
    for (let i = 0; i < citizenValues.length; i++) {
      if (citizenValues[i] && citizenValues[i][0] && citizenValues[i][0].trim() === citizenId.trim()) {
        rowIndex = i + 1; // 1-indexed
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error(`Citizen ID ${citizenId} not found in Google Sheet`);
    }

    // Update the phone cell
    const cellRange = `'${sheetName}'!${phoneColLetter}${rowIndex}`;
    await updateSheetValue(token, personnelSheetId, cellRange, newPhone || "");

    return NextResponse.json({ status: "success", message: "Updated successfully" });
  } catch (e: any) {
    console.error("[Update Phone API] Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
