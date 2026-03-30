import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import { dbAll, dbGet, dbRun } from '../db.ts';
import { isAuthenticated } from '../middleware/auth.ts';
import { getFarmContext, chatViaGeminiDirect } from '../services/gemini.ts';
import { chatViaADK, createADKStreamFetch } from '../services/adk.ts';
import { issueLiveToken } from '../liveVoiceProxy.ts';

const router = Router();

// ─── GET /api/chat/live-voice-token ───────────────────────────────────────────
// Issues a short-lived one-time token (30 s) that the browser passes as a
// query param when opening the /api/live-voice-ws WebSocket.
router.get('/live-voice-token', isAuthenticated, (req, res) => {
  const token = issueLiveToken(req.session.userId!);
  res.json({ token });
});

// ─── GET /api/conversations ────────────────────────────────────────────────────
router.get('/conversations', isAuthenticated, async (req, res) => {
  const userId = req.session.userId!;
  const conversations = await dbAll(
    'SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC',
    userId
  );
  res.json(conversations);
});

// ─── POST /api/conversations ───────────────────────────────────────────────────
router.post('/conversations', isAuthenticated, async (req, res) => {
  const userId = req.session.userId!;
  const { title } = req.body;
  const result = await dbRun(
    'INSERT INTO conversations (user_id, title) VALUES (?, ?)',
    userId,
    title || 'New Conversation'
  );
  res.json({ id: result.lastInsertRowid, title: title || 'New Conversation' });
});

// ─── DELETE /api/conversations/:id ────────────────────────────────────────────
router.delete('/conversations/:id', isAuthenticated, async (req, res) => {
  const userId = req.session.userId!;
  await dbRun(
    'DELETE FROM chat_messages WHERE conversation_id = ? AND conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)',
    req.params.id,
    userId
  );
  await dbRun(
    'DELETE FROM conversations WHERE id = ? AND user_id = ?',
    req.params.id,
    userId
  );
  res.json({ success: true });
});

// ─── GET /api/conversations/:id/messages ──────────────────────────────────────
router.get('/conversations/:id/messages', isAuthenticated, async (req, res) => {
  const userId = req.session.userId!;
  const conv = await dbGet(
    'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
    req.params.id,
    userId
  );
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const messages = await dbAll(
    'SELECT id, role, text, image_url, created_at FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC',
    req.params.id
  );
  res.json(messages);
});

// ─── POST /api/chat/guest ──────────────────────────────────────────────────────
router.post('/guest', async (req, res) => {
  try {
    const { message, language } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown';

    const GUEST_LIMIT = 5;
    const WINDOW_HOURS = 24;

    let guestLog = await dbGet('SELECT * FROM guest_chat_logs WHERE ip_address = ?', ip);

    if (guestLog) {
      const firstMsg = new Date(guestLog.first_message_at);
      const hoursSince = (Date.now() - firstMsg.getTime()) / (1000 * 60 * 60);

      if (hoursSince >= WINDOW_HOURS) {
        await dbRun(
          'UPDATE guest_chat_logs SET message_count = 1, first_message_at = CURRENT_TIMESTAMP, last_message_at = CURRENT_TIMESTAMP WHERE ip_address = ?',
          ip
        );
        guestLog = await dbGet('SELECT * FROM guest_chat_logs WHERE ip_address = ?', ip);
      } else if (guestLog.message_count >= GUEST_LIMIT) {
        const hoursLeft = Math.ceil(WINDOW_HOURS - hoursSince);
        return res.status(429).json({
          error: 'limit_reached',
          message:
            language === 'sw'
              ? `Umefika kikomo cha mazungumzo ya mgeni. Jiandikishe au rudi baada ya masaa ${hoursLeft}.`
              : `You've reached the guest chat limit. Please register or come back in ${hoursLeft} hours.`,
          hours_left: hoursLeft,
        });
      } else {
        await dbRun(
          'UPDATE guest_chat_logs SET message_count = message_count + 1, last_message_at = CURRENT_TIMESTAMP WHERE ip_address = ?',
          ip
        );
      }
    } else {
      await dbRun('INSERT INTO guest_chat_logs (ip_address, message_count) VALUES (?, 1)', ip);
    }

    const guestCount = guestLog ? guestLog.message_count + 1 : 1;
    const remainingMessages = GUEST_LIMIT - guestCount;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'AI service unavailable' });

    const ai = new GoogleGenAI({ apiKey });
    const langInstr =
      language === 'sw' ? 'Jibu DAIMA kwa Kiswahili tu.' : 'Always respond in English.';

    const systemInstruction = `You are BwanaShamba, an AI farming assistant for farmers in Tanzania. ${langInstr}
You help farmers with questions about crops, soil, pests, diseases, fertilizers, weather, and market prices.
Be concise, practical, and friendly.
Current Date: ${new Date().toISOString().split('T')[0]}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: message }] }],
      config: { systemInstruction },
    });

    const reply = response.text || 'I could not generate a response.';
    res.json({ reply, messages_remaining: Math.max(0, remainingMessages) });
  } catch (err: any) {
    console.error('[guest-chat] Error:', err.message);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// ─── POST /api/chat ────────────────────────────────────────────────────────────
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { message, image, mimeType: clientMimeType, conversationId, stream: wantStream } = req.body;
    const userId = req.session.userId!;

    let convId = conversationId;

    if (convId) {
      const owned = await dbGet(
        'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
        convId,
        userId
      );
      if (!owned) {
        return res.status(403).json({ reply: 'Conversation not found or access denied.' });
      }
    } else {
      const result = await dbRun(
        'INSERT INTO conversations (user_id, title) VALUES (?, ?)',
        userId,
        (message || 'Image analysis').substring(0, 80)
      );
      convId = result.lastInsertRowid;
    }

    const hasImage = !!image;
    await dbRun(
      'INSERT INTO chat_messages (conversation_id, role, text, image_url) VALUES (?, ?, ?, ?)',
      convId,
      'user',
      message || 'Analyze this image.',
      hasImage ? 'attached' : null
    );

    // Retrieve existing ADK session ID if any
    let adkSessionId: string | null = null;
    const existing = await dbGet(
      "SELECT text FROM chat_messages WHERE conversation_id = ? AND role = 'system' AND text LIKE 'adk_session:%' ORDER BY created_at DESC LIMIT 1",
      convId
    );
    if (existing) {
      adkSessionId = existing.text.replace('adk_session:', '');
    }

    // ── Build farm location context to inject into every ADK message ──────────
    const userProfile = await dbGet(
      'SELECT region, district, farm_size_acres FROM users WHERE id = ?',
      userId
    );
    let farmContextPrefix = '';
    if (userProfile) {
      const parts: string[] = [];
      if (userProfile.district) parts.push(`${userProfile.district} District`);
      if (userProfile.region) parts.push(`${userProfile.region} Region`);
      parts.push('Tanzania');
      const locationStr = parts.join(', ');
      const now = new Date().toLocaleString('en-US', {
        timeZone: 'Africa/Dar_es_Salaam',
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      const farmSize = userProfile.farm_size_acres ? `${userProfile.farm_size_acres} acres` : 'not specified';
      farmContextPrefix =
        `[FARM CONTEXT - read before responding]\n` +
        `Location: ${locationStr}\n` +
        `Farm Size: ${farmSize}\n` +
        `Current Date/Time: ${now} EAT\n` +
        (userProfile.district ? `Weather: call get_weather_forecast with district="${userProfile.district}" region="${userProfile.region || ''}" for accurate local conditions\n` : '') +
        `[END FARM CONTEXT]\n\n`;
    }
    const enrichedMessage = farmContextPrefix + (message || 'Analyze this image.');

    // ── Streaming path ──────────────────────────────────────────────────────────
    if (wantStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      res.write(`data: ${JSON.stringify({ type: 'start', conversationId: convId })}\n\n`);

      let fullReply = '';
      let agentName = 'gemini-direct';
      let sessionSaved = false;
      let clientDisconnected = false;
      let adkStreamCtrl: { abort: () => void } | null = null;

      res.on('close', () => {
        clientDisconnected = true;
        adkStreamCtrl?.abort();
      });

      try {
        const { promise, abort } = createADKStreamFetch(
          enrichedMessage,
          String(userId),
          adkSessionId,
          image,
          clientMimeType
        );
        adkStreamCtrl = { abort };

        const adkResp = await promise;
        const reader = adkResp.body;

        if (reader) {
          let buffer = '';

          for await (const chunk of reader as any) {
            if (clientDisconnected) break;
            buffer += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const parsed = JSON.parse(line.slice(6));

                  if (parsed.type === 'text') {
                    fullReply += parsed.content;
                    agentName = parsed.agent || agentName;
                    if (!clientDisconnected) {
                      res.write(`data: ${JSON.stringify({ type: 'text', content: parsed.content })}\n\n`);
                    }
                  } else if (parsed.type === 'error') {
                    if (!clientDisconnected) {
                      res.write(`data: ${JSON.stringify({ type: 'error', message: parsed.message || 'Agent error' })}\n\n`);
                    }
                  } else if (
                    (parsed.type === 'start' || parsed.type === 'done') &&
                    parsed.session_id &&
                    !adkSessionId &&
                    !sessionSaved
                  ) {
                    sessionSaved = true;
                    await dbRun(
                      'INSERT INTO chat_messages (conversation_id, role, text) VALUES (?, ?, ?)',
                      convId,
                      'system',
                      `adk_session:${parsed.session_id}`
                    );
                  }

                  if (parsed.type === 'done') {
                    agentName = parsed.agent || agentName;
                  }
                } catch {
                  // ignore malformed SSE lines
                }
              }
            }
          }
        }

        abort();
        console.log(`[chat] ADK stream agent '${agentName}' handled conversation ${convId}`);
      } catch (adkErr: any) {
        if (clientDisconnected) return;
        console.log(`[chat] ADK stream unavailable (${adkErr.message}), falling back to direct Gemini`);

        const history = await dbAll(
          "SELECT role, text FROM chat_messages WHERE conversation_id = ? AND role IN ('user', 'ai') ORDER BY created_at ASC",
          convId
        );
        const contents = history.map((msg: any) => ({
          role: msg.role === 'ai' ? 'model' : 'user',
          parts: [{ text: msg.text }],
        }));

        fullReply = await chatViaGeminiDirect(enrichedMessage, contents, image, clientMimeType, userId);
        res.write(`data: ${JSON.stringify({ type: 'text', content: fullReply })}\n\n`);
      }

      if (fullReply) {
        await dbRun(
          'INSERT INTO chat_messages (conversation_id, role, text) VALUES (?, ?, ?)',
          convId,
          'ai',
          fullReply
        );
        await dbRun('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', convId);

        const historyCount = await dbAll(
          "SELECT id FROM chat_messages WHERE conversation_id = ? AND role IN ('user', 'ai')",
          convId
        );
        if (historyCount.length <= 2) {
          await dbRun(
            'UPDATE conversations SET title = ? WHERE id = ?',
            (message || 'Image analysis').substring(0, 80),
            convId
          );
        }
      }

      if (!clientDisconnected) {
        res.write(`data: ${JSON.stringify({ type: 'done', conversationId: convId, agent: agentName })}\n\n`);
        res.end();
      }

      return;
    }

    // ── Non-streaming path ──────────────────────────────────────────────────────
    let reply: string;
    let agentName = 'gemini-direct';

    try {
      const adkResult = await chatViaADK(
        enrichedMessage,
        String(userId),
        adkSessionId,
        image,
        clientMimeType
      );
      reply = adkResult.reply;
      agentName = adkResult.agentName;

      if (!adkSessionId && adkResult.adkSessionId) {
        await dbRun(
          'INSERT INTO chat_messages (conversation_id, role, text) VALUES (?, ?, ?)',
          convId,
          'system',
          `adk_session:${adkResult.adkSessionId}`
        );
      }
      console.log(`[chat] ADK agent '${agentName}' handled request for conversation ${convId}`);
    } catch (adkErr: any) {
      console.log(`[chat] ADK unavailable (${adkErr.message}), falling back to direct Gemini`);

      const history = await dbAll(
        "SELECT role, text FROM chat_messages WHERE conversation_id = ? AND role IN ('user', 'ai') ORDER BY created_at ASC",
        convId
      );
      const contents = history.map((msg: any) => ({
        role: msg.role === 'ai' ? 'model' : 'user',
        parts: [{ text: msg.text }],
      }));

      reply = await chatViaGeminiDirect(enrichedMessage, contents, image, clientMimeType, userId);
    }

    await dbRun(
      'INSERT INTO chat_messages (conversation_id, role, text) VALUES (?, ?, ?)',
      convId,
      'ai',
      reply!
    );
    await dbRun('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', convId);

    const history = await dbAll(
      "SELECT id FROM chat_messages WHERE conversation_id = ? AND role IN ('user', 'ai')",
      convId
    );
    if (history.length <= 2) {
      await dbRun(
        'UPDATE conversations SET title = ? WHERE id = ?',
        (message || 'Image analysis').substring(0, 80),
        convId
      );
    }

    res.json({ reply: reply!, conversationId: convId, agent: agentName });
  } catch (err: any) {
    console.error('[chat] Error:', err.message);
    res.status(500).json({ reply: 'Sorry, I encountered an error processing your request.' });
  }
});

// ─── POST /api/chat/analyze-crop ───────────────────────────────────────────────
router.post('/analyze-crop', isAuthenticated, async (req, res) => {
  try {
    const { zone_id, image } = req.body;

    if (!zone_id || !image) {
      return res.status(400).json({ error: 'zone_id and image are required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Gemini API key is not configured.' });

    const zone = await dbGet('SELECT * FROM zones WHERE id = ?', zone_id);
    if (!zone) return res.status(404).json({ error: 'Zone not found.' });

    const ai = new GoogleGenAI({ apiKey });
    const growthDay = Math.ceil(
      Math.abs(Date.now() - new Date(zone.planting_date).getTime()) / (1000 * 60 * 60 * 24)
    );

    const prompt = `You are an expert agricultural AI analyzing a crop image for a farm in Tanzania.

Zone: ${zone.name}
Crop: ${zone.crop_type}
Growth Day: ${growthDay}
Area: ${zone.area_size} acres

Analyze this image and provide:
1. **Health Assessment** - Overall plant health (Healthy/Warning/Critical)
2. **Pest Detection** - Check for common pests relevant to this crop
3. **Disease Signs** - Any visible diseases (blight, fungal infection, etc.)
4. **Growth Stage Confirmation** - Does the visual match the expected growth day?
5. **Recommendations** - Immediate actions needed

Be concise and actionable.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: image } },
            { text: prompt },
          ],
        },
      ],
    });

    const analysisText = response.text || 'Could not analyze the image.';

    await dbRun(
      'INSERT INTO logs (zone_id, message, severity) VALUES (?, ?, ?)',
      zone_id,
      `Crop analysis performed: ${analysisText.substring(0, 200)}...`,
      'Info'
    );

    res.json({ analysis: analysisText, zone_name: zone.name });
  } catch (err: any) {
    console.error('[analyze-crop] Error:', err.message);
    res.status(500).json({ error: 'Failed to analyze crop image.' });
  }
});

// ─── POST /api/chat/voice-transcript ──────────────────────────────────────────
router.post('/voice-transcript', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const { conversationId, messages: transcriptMessages } = req.body;

    let convId = conversationId;

    if (convId) {
      const existing = await dbGet(
        'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
        convId,
        userId
      );
      if (!existing) return res.status(403).json({ error: 'Access denied to this conversation' });
    } else {
      const title =
        '🎙️ Voice Scout — ' +
        new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
      const result = await dbRun(
        'INSERT INTO conversations (user_id, title) VALUES (?, ?)',
        userId,
        title
      );
      convId = result.lastInsertRowid;
    }

    if (transcriptMessages && Array.isArray(transcriptMessages)) {
      for (const msg of transcriptMessages) {
        if (msg.role === 'system') continue;
        const role = msg.role === 'user' ? 'user' : 'ai';
        await dbRun(
          'INSERT INTO chat_messages (conversation_id, role, text) VALUES (?, ?, ?)',
          convId,
          role,
          msg.text || ''
        );
      }
    }

    await dbRun('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', convId);
    res.json({ success: true, conversationId: convId });
  } catch (err: any) {
    console.error('[voice-transcript] Error:', err.message);
    res.status(500).json({ error: 'Failed to save voice transcript' });
  }
});

export default router;
