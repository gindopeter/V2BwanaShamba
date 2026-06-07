import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer, IncomingMessage } from 'http';
import { GoogleGenAI, Modality } from '@google/genai';
import { randomUUID } from 'crypto';
import { URL } from 'url';
import { dbGet, dbAll } from './db.ts';

const BASE_SYSTEM_INSTRUCTION =
  'LANGUAGE RULE — HIGHEST PRIORITY: Listen to what language the user is speaking RIGHT NOW. ' +
  'If they speak English, respond entirely in English. If they speak Kiswahili, respond entirely in Kiswahili. ' +
  'Switch immediately the moment the user switches languages. Never respond in a language other than what the user just used. ' +
  'You are BwanaShamba, an AI agricultural assistant focused on Tanzania. ' +
  'You have deep knowledge of Tanzanian agriculture across all 26 regions — soils, climate zones, crops, pests, diseases, ' +
  'irrigation, fertigation, market prices, and farming practices. ' +
  'You assist with ALL crops the farmer asks about: vegetables, cereals, legumes, cash crops, fruits, root crops, and more. ' +
  'You know Tanzania\'s soil types by region (e.g. red laterite in Arusha, black clay in Mbeya, volcanic soils on Kilimanjaro), ' +
  'rainfall patterns, seasonal calendars, and can draw on satellite/remote-sensing knowledge for soil and land analysis. ' +
  'When asked, you can compare Tanzania\'s agriculture to other countries and highlight lessons applicable to Tanzanian farmers. ' +
  'Tailor every answer to the farmer\'s specific region and crops. Keep answers practical, concise, and actionable.';

async function buildSystemInstruction(userId: number): Promise<string> {
  try {
    const user = await dbGet(
      'SELECT first_name, last_name, region, district, farm_size_acres FROM users WHERE id = ?',
      userId
    );
    const zones = await dbAll(
      "SELECT name, crop_type, area_size, planting_date, status FROM zones WHERE user_id = ? AND status != 'Harvested' ORDER BY planting_date DESC LIMIT 10",
      userId
    );

    const now = new Date().toLocaleString('en-US', {
      timeZone: 'Africa/Dar_es_Salaam',
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    let context = BASE_SYSTEM_INSTRUCTION + '\n\n';
    context += `Current Date/Time: ${now} EAT\n`;

    if (user) {
      const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Farmer';
      context += `\nFARMER PROFILE:\n`;
      context += `Name: ${name}\n`;
      if (user.district || user.region) {
        const loc = [user.district && `${user.district} District`, user.region && `${user.region} Region`, 'Tanzania']
          .filter(Boolean).join(', ');
        context += `Location: ${loc}\n`;
      }
      if (user.farm_size_acres) {
        context += `Farm Size: ${user.farm_size_acres} acres\n`;
      }
    }

    if (zones && zones.length > 0) {
      context += `\nACTIVE CROPS:\n`;
      for (const z of zones) {
        const area = z.area_size ? ` (${z.area_size} acres)` : '';
        const planted = z.planting_date ? `, planted ${z.planting_date}` : '';
        context += `- ${z.crop_type}${area} in zone "${z.name}"${planted} [${z.status}]\n`;
      }
    }

    context += `\nAddress the farmer by name when appropriate. Always tailor advice to their specific location and active crops.`;
    return context;
  } catch (err) {
    console.error('[LiveProxy] Failed to load user context, using base instruction:', err);
    return BASE_SYSTEM_INSTRUCTION;
  }
}

interface LiveToken {
  userId: number;
  expiresAt: number;
}

const liveTokens = new Map<string, LiveToken>();

setInterval(() => {
  const now = Date.now();
  for (const [token, data] of liveTokens) {
    if (data.expiresAt < now) liveTokens.delete(token);
  }
}, 30_000);

export function issueLiveToken(userId: number): string {
  const token = randomUUID();
  liveTokens.set(token, { userId, expiresAt: Date.now() + 30_000 });
  return token;
}

async function handleSession(ws: WebSocket, userId: number) {
  console.log(`[LiveProxy] Starting Gemini Live session for user ${userId}`);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    ws.send(JSON.stringify({ type: 'error', message: 'Gemini API key not configured on server.' }));
    ws.close();
    return;
  }

  const systemInstruction = await buildSystemInstruction(userId);
  console.log(`[LiveProxy] System instruction built for user ${userId}`);

  const ai = new GoogleGenAI({ apiKey });
  let geminiSession: any = null;

  const send = (payload: object) => {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify(payload)); } catch {}
    }
  };

  // Track whether setupComplete was received — lets onclose distinguish an early
  // rejection (before the session was ready) from a normal end-of-session close.
  let setupCompleted = false;

  try {
    console.log('[LiveProxy] Connecting to Gemini Live API...');
    geminiSession = await ai.live.connect({
      model: 'gemini-3.1-flash-live-preview',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
        systemInstruction: systemInstruction,
        outputAudioTranscription: {},
        inputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          console.log('[LiveProxy] Gemini WebSocket opened');
        },
        onmessage: (message: any) => {
          if (message.setupComplete) {
            setupCompleted = true;
            console.log('[LiveProxy] Gemini setup complete — session ready');
            send({ type: 'ready' });
            return;
          }

          if (message.serverContent?.interrupted) {
            send({ type: 'interrupted' });
            return;
          }

          const parts = message.serverContent?.modelTurn?.parts;
          if (parts) {
            for (const part of parts) {
              if (part.inlineData?.data) {
                send({ type: 'audio', data: part.inlineData.data });
              }
            }
          }

          if (message.serverContent?.outputTranscription?.text) {
            send({ type: 'output_transcript', text: message.serverContent.outputTranscription.text });
          }

          if (message.serverContent?.inputTranscription?.text) {
            send({ type: 'input_transcript', text: message.serverContent.inputTranscription.text });
          }

          if (message.serverContent?.turnComplete) {
            send({ type: 'turn_complete' });
          }
        },
        onerror: (error: any) => {
          const msg = error?.message || String(error) || 'Gemini Live error';
          console.error('[LiveProxy] Gemini error:', msg);
          send({ type: 'error', message: `Voice session error: ${msg}` });
          if (ws.readyState === WebSocket.OPEN) ws.close(1011, msg.substring(0, 123));
        },
        onclose: (event: any) => {
          const code = event?.code ?? 'unknown';
          const reason = event?.reason || `code ${code}`;
          console.log('[LiveProxy] Gemini session closed:', reason);
          if (geminiSession === null) return; // already handled in ws.on('close')
          if (!setupCompleted) {
            // Gemini closed before setup — surface a clear error to the client
            console.error('[LiveProxy] Gemini closed before setupComplete. Code:', code, 'Reason:', reason);
            send({ type: 'error', message: `Voice session could not start: ${reason}. Please try again.` });
          }
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(setupCompleted ? 1000 : 1011, 'Gemini session ended');
          }
        },
      },
    });
    console.log('[LiveProxy] ai.live.connect() returned — waiting for setupComplete');
  } catch (err: any) {
    console.error('[LiveProxy] Failed to connect to Gemini Live:', err.message);
    send({ type: 'error', message: `Failed to connect to voice API: ${err.message || 'Unknown error'}` });
    ws.close();
    return;
  }

  // Keep the client WebSocket alive so Cloud Run doesn't drop idle connections
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.ping(); } catch {}
    } else {
      clearInterval(pingInterval);
    }
  }, 25_000);

  ws.on('message', (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (!geminiSession) return;
      if (msg.type === 'audio' && msg.data) {
        // audio field for PCM audio data; mimeType must be 'audio/pcm;rate=16000'
        const r = geminiSession.sendRealtimeInput({ audio: { data: msg.data, mimeType: 'audio/pcm;rate=16000' } });
        if (r && typeof (r as any).catch === 'function') (r as any).catch((e: any) => console.error('[LiveProxy] sendRealtimeInput audio error:', e));
      } else if (msg.type === 'image' && msg.data) {
        // media / video field for image frames
        const r = geminiSession.sendRealtimeInput({ video: { data: msg.data, mimeType: 'image/jpeg' } });
        if (r && typeof (r as any).catch === 'function') (r as any).catch((e: any) => console.error('[LiveProxy] sendRealtimeInput image error:', e));
      }
      // keepalive messages are silently ignored
    } catch (err) {
      console.error('[LiveProxy] Error handling client message:', err);
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    console.log(`[LiveProxy] Client disconnected (user ${userId}), closing Gemini session`);
    const session = geminiSession;
    geminiSession = null; // null first to prevent re-entrant close from onclose callback
    if (session) {
      try { session.close(); } catch {}
    }
  });
}

export function setupLiveVoiceProxy(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const baseUrl = `http://${request.headers.host}`;
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(request.url || '', baseUrl);
    } catch {
      return;
    }

    if (parsedUrl.pathname !== '/api/live-voice-ws') {
      // Replit's proxy strips the `sec-websocket-protocol` header, which causes
      // Vite's HMR upgrade listener to silently ignore the request (it only
      // handles upgrades with protocol='vite-hmr').  Inject it here — this
      // handler runs first, so by the time Vite's listener fires the header
      // is already present and the HMR connection succeeds.
      if (!request.headers['sec-websocket-protocol']) {
        (request.headers as Record<string, string>)['sec-websocket-protocol'] = 'vite-hmr';
      }
      return;
    }

    const token = parsedUrl.searchParams.get('token');
    console.log(`[LiveProxy] Upgrade request, token=${token ? token.substring(0, 8) + '...' : 'none'}`);

    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const tokenData = liveTokens.get(token);
    if (!tokenData || tokenData.expiresAt < Date.now()) {
      console.warn('[LiveProxy] Invalid or expired token');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    liveTokens.delete(token);
    const { userId } = tokenData;

    wss.handleUpgrade(request, socket, head, (ws) => {
      console.log(`[LiveProxy] WebSocket upgraded for user ${userId}`);
      handleSession(ws, userId);
    });
  });

  console.log('[LiveProxy] Live voice proxy ready on /api/live-voice-ws');
}
