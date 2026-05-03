import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer, IncomingMessage } from 'http';
import { GoogleGenAI, Modality } from '@google/genai';
import { randomUUID } from 'crypto';
import { URL } from 'url';

const SYSTEM_INSTRUCTION =
  'LANGUAGE RULE — HIGHEST PRIORITY: Listen to what language the user is speaking RIGHT NOW. ' +
  'If they speak English, respond entirely in English. If they speak Kiswahili, respond entirely in Kiswahili. ' +
  'Switch immediately the moment the user switches languages. Never respond in a language other than what the user just used. ' +
  'You are BwanaShamba, an AI farm supervisor helping farmers across Tanzania manage their farms. ' +
  'You assist with pest identification, irrigation scheduling, crop management, harvest timing, and ' +
  'market strategies for horticulture crops (tomatoes, onions, peppers, cabbage, spinach, cucumbers, ' +
  'watermelon, eggplant, carrots, lettuce, okra, green beans) and maize. ' +
  'Tailor your advice to the farmer\'s specific region and crops. Keep answers practical, concise, and actionable.';

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

  const ai = new GoogleGenAI({ apiKey });
  let geminiSession: any = null;

  const send = (payload: object) => {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify(payload)); } catch {}
    }
  };

  try {
    console.log('[LiveProxy] Connecting to Gemini Live API...');
    geminiSession = await ai.live.connect({
      model: 'gemini-live-2.5-flash-preview',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
        systemInstruction: SYSTEM_INSTRUCTION,
        outputAudioTranscription: {},
        inputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          console.log('[LiveProxy] Gemini WebSocket opened');
        },
        onmessage: (message: any) => {
          if (message.setupComplete) {
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
          send({ type: 'error', message: msg });
          if (ws.readyState === WebSocket.OPEN) ws.close(1011, msg);
        },
        onclose: (event: any) => {
          const reason = event?.reason || `code ${event?.code ?? 'unknown'}`;
          console.log('[LiveProxy] Gemini session closed:', reason);
          // Only close the client socket if Gemini closed it unexpectedly (not because
          // we already nulled geminiSession in ws.on('close'))
          if (geminiSession !== null && ws.readyState === WebSocket.OPEN) {
            ws.close(1000, 'Gemini session ended');
          }
        },
      },
    });
    console.log('[LiveProxy] ai.live.connect() returned — waiting for setupComplete');
  } catch (err: any) {
    console.error('[LiveProxy] Failed to connect to Gemini Live:', err.message);
    send({ type: 'error', message: err.message || 'Failed to connect to Gemini Live API' });
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
        geminiSession.sendRealtimeInput({ audio: { data: msg.data, mimeType: 'audio/pcm;rate=16000' } });
      } else if (msg.type === 'image' && msg.data) {
        // media / video field for image frames
        geminiSession.sendRealtimeInput({ video: { data: msg.data, mimeType: 'image/jpeg' } });
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
