const fs = require('fs');

async function getGoogleAccessToken(serviceAccount) {
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

  const crypto = require('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`);
  const signature = sign.sign(serviceAccount.private_key, 'base64url');
  const jwt = `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await response.json();
  return data.access_token;
}

async function main() {
  const envFile = fs.readFileSync('/TWC-JH-Server/Projects/my_office_Docker/frontend/.env.local', 'utf8');
  let saBase64 = '';
  let sheetsId = '';
  for(let line of envFile.split('\n')) {
    if(line.startsWith('GOOGLE_SERVICE_ACCOUNT_KEY_BASE64=')) saBase64 = line.split('=')[1];
    if(line.startsWith('GOOGLE_SHEETS_ID=')) sheetsId = line.split('=')[1].trim();
  }
  const sa = JSON.parse(Buffer.from(saBase64, 'base64').toString('utf8'));
  const token = await getGoogleAccessToken(sa);
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}?fields=sheets(properties(sheetId,title,index,hidden))`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
main().catch(console.error);
