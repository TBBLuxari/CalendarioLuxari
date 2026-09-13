// telegram.js — avisa al propietario por Telegram cuando alguien le propone
// algo (propuesta de invitado o solicitud de cita), para que le llegue como
// notificación al celular incluso con la app cerrada. Opcional: si no hay
// TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID configurados, simplemente no hace nada
// (no rompe el flujo normal de propuestas/citas).

async function notifyOwner(text){
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if(!token || !chatId){
    console.log(`Telegram: aviso omitido (variables no configuradas — token ${token ? 'presente' : 'AUSENTE'}, chat_id ${chatId ? 'presente' : 'AUSENTE'})`);
    return;
  }

  try{
    console.log(`Telegram: enviando aviso a chat_id=${chatId}…`);
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if(res.ok) console.log('Telegram: aviso enviado ✓');
    else console.warn('Telegram: no se pudo enviar el aviso —', res.status, await res.text());
  }catch(err){
    // Un aviso fallido nunca debe tumbar la propuesta/cita en sí.
    console.warn('Telegram: error enviando el aviso —', err.message);
  }
}

module.exports = { notifyOwner };
