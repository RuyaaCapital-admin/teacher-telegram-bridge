// api/tg-webhook.js
const TG_API = (token) => `https://api.telegram.org/bot${token}`;
const VF_BASE = 'https://general-runtime.voiceflow.com';

// persistent reply keyboard (6 buttons)
const REPLY_KB = {
  keyboard: [
    ['📚 دراسة الآن', '❓ اسأل المعلّم'],
    ['📝 اختبار قصير', '🗓 المواعيد'],
    ['📈 التقدّم', '⚙️ الإعدادات'],
  ],
  resize_keyboard: true,
  one_time_keyboard: false,
};

// map commands/buttons to simple intents for VF
function mapToVF(text) {
  const t = (text || '').trim().toLowerCase();
  if (t === '/start' || t === '/menu') return { type: 'launch' };
  if (t === '/study' || text.includes('📚')) return { type: 'text', payload: 'study now' };
  if (t === '/ask' || text.includes('❓')) return { type: 'text', payload: 'ask teacher' };
  if (t === '/quiz') return { type: 'text', payload: 'mini quiz' };
  if (t === '/schedule' || text.includes('🗓')) return { type: 'text', payload: 'schedule' };
  if (t === '/progress' || text.includes('📈')) return { type: 'text', payload: 'progress' };
  if (t === '/settings' || text.includes('⚙️')) return { type: 'text', payload: 'settings' };
  if (t.includes('انتهينا') || t.includes('وقف الدرس')) return { type: 'text', payload: 'stop study' };
  return { type: 'text', payload: text || '' };
}

export default async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).send('tg-webhook is alive');

  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const vfKey = process.env.VOICEFLOW_API_KEY;
    if (!token || !vfKey) {
      console.error('Missing TELEGRAM_BOT_TOKEN or VOICEFLOW_API_KEY');
      return res.status(200).json({ ok: true });
    }

    const update = req.body || {};
    const msg = update.message || update.edited_message || update.callback_query?.message;
    if (!msg) return res.status(200).json({ ok: true });

    const chat_id = msg.chat?.id;
    const text = msg.text || update.callback_query?.data || msg.web_app_data?.data || '';

    // 1) build VF request
    const vfRequest = mapToVF(text);

    // 2) call Voiceflow Dialog Manager /interact
    const vfResp = await fetch(`${VF_BASE}/state/user/${chat_id}/interact`, {
      method: 'POST',
      headers: {
        Authorization: vfKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ request: vfRequest }),
    });

    const traces = await vfResp.json();

    // 3) collect text traces
    const lines = [];
    if (Array.isArray(traces)) {
      for (const t of traces) {
        if (t?.type === 'text' || t?.type === 'speak') {
          const m = t?.payload?.message;
          if (m) lines.push(m);
        }
      }
    }
    const replyText = lines.join('\n') || '...';

    // 4) send back to Telegram
    await fetch(`${TG_API(token)}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id,
        text: replyText,
        reply_markup: REPLY_KB,
      }),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('webhook error', err);
    // respond 200 so Telegram doesn’t retry forever
    return res.status(200).json({ ok: true });
  }
}
