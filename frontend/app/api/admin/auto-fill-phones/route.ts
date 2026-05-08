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
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data: any = await response.json();
  return data.values || [];
}

async function batchUpdateSheetValues(token: string, spreadsheetId: string, data: { range: string, values: any[][] }[]) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      valueInputOption: "USER_ENTERED",
      data
    })
  });
  const result: any = await response.json();
  if (result.error) throw new Error(result.error.message);
  return result;
}

function getCell(row: any[], idx: number): string {
  return row[idx]?.trim() || '';
}

export async function GET(request: NextRequest) {
  try {
    const env = getRequestContext().env as any;
    if (!env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) throw new Error("No GOOGLE_SERVICE_ACCOUNT_KEY_BASE64");
    if (!env.GOOGLE_SHEETS_ID) throw new Error("No GOOGLE_SHEETS_ID");

    const spreadsheetId = env.GOOGLE_SHEETS_ID;
    const personnelSheetId = env.PERSONNEL_SHEET_ID || env.GOOGLE_SHEETS_ID_PERSONNEL || spreadsheetId;
    const indexGid = env.INDEX_SHEET_GID || "1143152346";

    const serviceAccount = JSON.parse(atob(env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64));
    const token = await getGoogleWriteAccessToken(serviceAccount);

    // 1. Get Pass Requests sheet name
    const tabs = await listSpreadsheetTabs(token, spreadsheetId);
    let passSheetName = "index";
    const passTab = tabs.find((t: any) => String(t.properties.sheetId) === String(indexGid));
    if (passTab && passTab.properties.title) passSheetName = passTab.properties.title;

    // 2. Read Pass Requests
    const passValues = await readSheetValues(token, spreadsheetId, `'${passSheetName}'!A2:L`);
    // Column K is index 10 (Phone)
    // Column C is index 2 (First Name)
    // Column D is index 3 (Last Name)
    const phoneMap = new Map<string, string>();
    for (const r of passValues) {
      const firstName = getCell(r, 2);
      const lastName = getCell(r, 3);
      const phone = getCell(r, 10); // Col K
      
      if (firstName && lastName && phone && phone !== "-" && phone.length >= 9) {
        // Last one overwrites (so we get the most recent phone number)
        phoneMap.set(`${firstName} ${lastName}`, phone);
      }
    }

    if (phoneMap.size === 0) {
      return NextResponse.json({ message: "No phone numbers found in pass requests" });
    }

    // 3. Get Personnel sheet name
    let personnelSheetName = "ข้อมูลกำลังพล";
    if (personnelSheetId === spreadsheetId) {
       const possibleNames = ["ข้อมูลกำลังพล", "รายชื่อกำลังพล", "กำลังพล", "Personnel", "personnel"];
       const pTab = tabs.find((t: any) => possibleNames.includes(t.properties.title));
       if (pTab) personnelSheetName = pTab.properties.title;
    } else {
       const pTabs = await listSpreadsheetTabs(token, personnelSheetId);
       const possibleNames = ["ข้อมูลกำลังพล", "รายชื่อกำลังพล", "กำลังพล", "Personnel", "personnel"];
       const pTab = pTabs.find((t: any) => possibleNames.includes(t.properties.title));
       if (pTab) personnelSheetName = pTab.properties.title;
    }

    // 4. Read Personnel Sheet
    // Column B is index 1 (First Name)
    // Column C is index 2 (Last Name)
    // Column D is index 3 (Phone)
    const personnelValues = await readSheetValues(token, personnelSheetId, `'${personnelSheetName}'!A:E`);
    
    // 5. Find matches and prepare updates
    const updates: { range: string, values: any[][] }[] = [];
    let updatedCount = 0;

    for (let i = 0; i < personnelValues.length; i++) {
      const r = personnelValues[i];
      const firstName = getCell(r, 1);
      const lastName = getCell(r, 2);
      const currentPhone = getCell(r, 3);
      
      if (!firstName || !lastName) continue;

      const key = `${firstName} ${lastName}`;
      const newPhone = phoneMap.get(key);

      if (newPhone && currentPhone !== newPhone) {
        // Row index is i + 1
        const cellRange = `'${personnelSheetName}'!D${i + 1}`;
        updates.push({
          range: cellRange,
          values: [[newPhone]]
        });
        updatedCount++;
      }
    }

    if (updates.length > 0) {
      await batchUpdateSheetValues(token, personnelSheetId, updates);
    }

    return NextResponse.json({ 
      status: "success", 
      message: `Updated ${updatedCount} phone numbers in Personnel sheet based on Pass Requests.`,
      updatedCount
    });

  } catch (e: any) {
    console.error("[Auto-Fill Phones] Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
