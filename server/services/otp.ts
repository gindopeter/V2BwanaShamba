import { randomInt } from 'crypto';
import { dbRun, dbGet, dbExec, isPostgres } from '../db.ts';
import nodemailer from 'nodemailer';

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
  return String(randomInt(100000, 1000000));
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

// Returns the active (unused, non-expired) code for a target, or null.
// Used on resends so the code from an earlier message keeps working —
// the user can enter whichever SMS/email arrives.
export async function getActiveOtp(target: string, type: 'phone' | 'email'): Promise<string | null> {
  const row = await dbGet(
    'SELECT * FROM otp_codes WHERE target = ? AND type = ? AND used = 0',
    target, type
  );
  if (!row) return null;
  if (new Date() > new Date(row.expires_at)) return null;
  return row.code;
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

// Send an OTP over WhatsApp via the Meta Cloud API using a pre-approved
// authentication template. The template must exist and be approved in the
// WhatsApp Business account (name/language configurable via env). Throws if
// WhatsApp isn't configured or the send fails.
export async function sendWhatsAppOtp(phoneNumber: string, code: string, lang: string): Promise<void> {
  const phoneId = process.env.WA_PHONE_NUMBER_ID;
  const token = process.env.WA_ACCESS_TOKEN;
  if (!phoneId || !token) throw new Error('WhatsApp Cloud API not configured');

  const templateName = process.env.WA_TEMPLATE_NAME || 'otp_verification';
  const langCode = process.env.WA_TEMPLATE_LANG || (lang === 'sw' ? 'sw' : 'en');
  const apiVersion = process.env.WA_API_VERSION || 'v21.0';

  // Meta requires E.164 without the leading '+'.
  const to = phoneNumber.replace(/^\+/, '');

  // Standard copy-code authentication template: the same code fills the body
  // text and the one-tap copy button (button index 0).
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: langCode },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: code }] },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: code }],
        },
      ],
    },
  };

  const res = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const responseText = await res.text();
  console.log(`[WA OTP] Status: ${res.status}, Body: ${responseText.substring(0, 200)}`);

  if (!res.ok) {
    throw new Error(`WhatsApp send failed (${res.status}): ${responseText}`);
  }
}

// Deliver a phone OTP over the server-side channels — used when client-side
// Firebase SMS verification is unconfigured or failed (the client falls back
// to these endpoints). WhatsApp first. SMS is a fallback only
// while OTP_SMS_ENABLED=true — kept off until a TCRA-registered sender ID is
// approved, since unregistered-sender SMS is silently dropped by TZ carriers.
// If both channels are unavailable the error propagates so the client can
// offer email verification instead.
export async function deliverPhoneOtp(phoneNumber: string, code: string, lang: string): Promise<'whatsapp' | 'sms'> {
  try {
    await sendWhatsAppOtp(phoneNumber, code, lang);
    return 'whatsapp';
  } catch (err: any) {
    if (process.env.OTP_SMS_ENABLED === 'true') {
      console.warn(`[OTP] WhatsApp delivery failed, falling back to SMS: ${err.message}`);
      await sendSmsOtp(phoneNumber, code, lang);
      return 'sms';
    }
    throw err;
  }
}

export async function sendEmailOtp(email: string, code: string, lang: string): Promise<void> {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPass) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email service not configured. Please set GMAIL_USER and GMAIL_APP_PASSWORD environment variables.');
    }
    console.log(`[OTP] Gmail not configured — dev email OTP for ${email}: ${code}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  });

  const isSwahili = lang === 'sw';

  const subject = isSwahili
    ? 'Nambari yako ya uthibitisho wa BwanaShamba'
    : 'Your BwanaShamba Verification Code';

  const html = isSwahili
    ? `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h2 style="color:#035925;margin:0;">🌱 BwanaShamba</h2>
          <p style="color:#5d6c7b;margin:4px 0;">Msaidizi wa Kilimo wa AI</p>
        </div>
        <p style="color:#1a2e1a;font-size:16px;">Habari!</p>
        <p style="color:#1a2e1a;">Nambari yako ya uthibitisho ni:</p>
        <div style="background:#035925;color:#fff;font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;padding:20px;border-radius:8px;margin:24px 0;">
          ${code}
        </div>
        <p style="color:#5d6c7b;font-size:14px;">Nambari hii inatumika kwa dakika <strong>10</strong> tu.</p>
        <p style="color:#5d6c7b;font-size:14px;">Ikiwa hukuomba hii, puuza barua pepe hii.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
        <p style="color:#9ca3af;font-size:12px;text-align:center;">© BwanaShamba — Kilimo Bora Tanzania</p>
      </div>`
    : `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h2 style="color:#035925;margin:0;">🌱 BwanaShamba</h2>
          <p style="color:#5d6c7b;margin:4px 0;">AI Farm Operations Assistant</p>
        </div>
        <p style="color:#1a2e1a;font-size:16px;">Hello!</p>
        <p style="color:#1a2e1a;">Your email verification code is:</p>
        <div style="background:#035925;color:#fff;font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;padding:20px;border-radius:8px;margin:24px 0;">
          ${code}
        </div>
        <p style="color:#5d6c7b;font-size:14px;">This code is valid for <strong>10 minutes</strong> only.</p>
        <p style="color:#5d6c7b;font-size:14px;">If you didn't request this, you can safely ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
        <p style="color:#9ca3af;font-size:12px;text-align:center;">© BwanaShamba — Smart Farming in Tanzania</p>
      </div>`;

  await transporter.sendMail({
    from: `"BwanaShamba" <${gmailUser}>`,
    to: email,
    subject,
    html,
  });

  console.log(`[OTP] Email sent to ${email}`);
}
