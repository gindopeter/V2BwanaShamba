import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer, IncomingMessage } from 'http';
import { GoogleGenAI, Modality } from '@google/genai';

const SYSTEM_INSTRUCTION =
  'You are BwanaShamba, an AI farm supervisor helping farmers across Tanzania manage their farms. ' +
  'You assist with pest identification, irrigation scheduling, crop management, harvest timing, and ' +
  'market strategies for horticulture crops (tomatoes, onions, peppers, cabbage, spinach, cucumbers, ' +
  'watermelon, eggplant, carrots, lettuce, okra, green beans) and maize. ' +
  'Tailor your advice to the farmer\'s specific region and crops. Keep answers practical, concise, and actionable. ' +
  'IMPORTANT LANGUAGE RULE: Match the user\'s language exactly. If they speak Kiswahili, respond entirely ' +
  'in Kiswahili. If they speak English, respond in English. Switch immediately when they switch languages.';

async function handleSession(ws: WebSocket) {
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
      ws.send(JSON.stringify(payload));
    }
  };

  try {
    geminiSession = await ai.live.connect({
      model: 'gemini-2.0-flash-live-001',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
        systemInstruction: SYSTEM_INSTRUCTION,
        outputTranscription: {},
        inputTranscription: {},
      },
      callbacks: {
        onopen: () => {
          console.log('[LiveProxy] Gemini session opened');
        },
        onmessage: (message: any) => {
          if (message.setupComplete) {
            console.log('[LiveProxy] Setup complete');
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
          console.error('[LiveProxy] Gemini error:', error);
          send({ type: 'error', message: error?.message || 'Gemini Live error' });
          if (ws.readyState === WebSocket.OPEN) ws.close();
        },
        onclose: (event: any) => {
          console.log('[LiveProxy] Gemini closed:', event?.code, event?.reason);
          if (ws.readyState === WebSocket.OPEN) ws.close();
        },
      },
    });
  } catch (err: any) {
    console.error('[LiveProxy] Failed to connect to Gemini Live:', err.message);
    send({ type: 'error', message: err.message || 'Failed to connect to Gemini Live API' });
    ws.close();
    return;
  }

  ws.on('message', (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (!geminiSession) return;
      if (msg.type === 'audio' && msg.data) {
        geminiSession.sendRealtimeInput({ media: { data: msg.data, mimeType: 'audio/pcm;rate=16000' } });
      } else if (msg.type === 'image' && msg.data) {
        geminiSession.sendRealtimeInput({ media: { data: msg.data, mimeType: 'image/jpeg' } });
      }
    } catch (err) {
      console.error('[LiveProxy] Error handling client message:', err);
    }
  });

  ws.on('close', () => {
    console.log('[LiveProxy] Client disconnected, closing Gemini session');
    if (geminiSession) {
      try { geminiSession.close(); } catch {}
      geminiSession = null;
    }
  });
}

export function setupLiveVoiceProxy(
  server: HttpServer,
  sessionMiddleware: (req: any, res: any, next: () => void) => void
) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    if (request.url !== '/api/live-voice-ws') return;

    sessionMiddleware(request as any, {} as any, () => {
      const userId = (request as any).session?.userId;
      if (!userId) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        console.log(`[LiveProxy] WebSocket connected for user ${userId}`);
        handleSession(ws);
      });
    });
  });

  console.log('[LiveProxy] Live voice proxy ready on /api/live-voice-ws');
}
