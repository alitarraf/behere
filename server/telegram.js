// Dead-man ping via the existing Telegram bot (same one telegram-mobile-command uses).
// Purely operational: fires only when the bell has silently died.
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function telegramPing(text) {
  if (!TOKEN || !CHAT_ID) {
    console.warn('telegram ping skipped (no token/chat id):', text);
    return false;
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: `🔔 behere: ${text}` }),
    });
    if (!r.ok) console.error('telegram ping failed:', r.status, await r.text());
    return r.ok;
  } catch (e) {
    console.error('telegram ping error:', e.message);
    return false;
  }
}
