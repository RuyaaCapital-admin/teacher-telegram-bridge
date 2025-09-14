export default async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).send('tg-webhook is alive');
  // Telegram will POST here later
  return res.status(200).json({ ok: true });
}
