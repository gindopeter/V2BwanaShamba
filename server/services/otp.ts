import { dbRun, dbGet, dbExec, isPostgres } from '../db.ts';

export async function ensureOtpTable() {
  if (isPostgres) {
    await dbExec(`
      CREATE TABLE IF NOT EXISTS otp_codes (
        id SERIAL PRIMARY KEY,
        target TEXT NOT NULL,
        code TEXT NOT NULL,
        type TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } else {
    await dbExec(`
      CREATE TABLE IF NOT EXISTS otp_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target TEXT NOT NULL,
        code TEXT NOT NULL,
        type TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createOtp(target: string, type: 'phone' | 'email'): Promise<string> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await dbRun(
    'DELETE FROM otp_codes WHERE target = ? AND type = ?',
    target, type
  );
  await dbRun(
    'INSERT INTO otp_codes (target, code, type, expires_at) VALUES (?, ?, ?, ?)',
    target, code, type, expiresAt
  );
  return code;
}

export async function verifyOtp(target: string, code: string, type: 'phone' | 'email'): Promise<boolean> {
  const row = await dbGet(
    'SELECT * FROM otp_codes WHERE target = ? AND type = ? AND used = 0',
    target, type
  );
  if (!row) return false;
  if (row.code !== code) return false;
  const now = new Date();
  const expires = new Date(row.expires_at);
  if (now > expires) return false;
  await dbRun('UPDATE otp_codes SET used = 1 WHERE id = ?', row.id);
  return true;
}

export async function sendSmsOtp(phoneNumber: string, code: string, lang: string): Promise<void> {
  const username = process.env.AT_USERNAME;
  const apiKey = process.env.AT_API_KEY;
  if (!username || !apiKey) throw new Error('Africa\'s Talking credentials not configured');

  const message = lang === 'sw'
    ? `Nambari yako ya uthibitisho wa BwanaShamba ni: ${code}. Inatumika kwa dakika 10.`
    : `Your BwanaShamba verification code is: ${code}. Valid for 10 minutes.`;

  const isSandbox = username.toLowerCase() === 'sandbox';
  const baseUrl = isSandbox
    ? 'https://api.sandbox.africastalking.com'
    : 'https://api.africastalking.com';

  const params = new URLSearchParams();
  params.append('username', username);
  params.append('to', phoneNumber);
  params.append('message', message);

  const res = await fetch(`${baseUrl}/version1/messaging`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'apiKey': apiKey,
    },
    body: params.toString(),
  });

  const responseText = await res.text();
  console.log(`[AT SMS] Status: ${res.status}, Body: ${responseText.substring(0, 200)}`);

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Africa\'s Talking authentication failed. Please check your AT_API_KEY in Settings.');
    }
    throw new Error(`SMS send failed (${res.status}): ${responseText}`);
  }

  let data: any;
  try { data = JSON.parse(responseText); } catch { return; }

  const recipients = data?.SMSMessageData?.Recipients;
  if (recipients && recipients.length > 0) {
    const status = recipients[0].status;
    if (status !== 'Success') {
      console.warn(`[AT SMS] Delivery status: ${status}`);
    }
  }
}
