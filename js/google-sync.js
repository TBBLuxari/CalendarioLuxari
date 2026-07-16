// google-sync.js — sincroniza el horario directamente con Google Calendar,
// en un calendario SEPARADO y dedicado ("Mi Horario Semanal") para no tocar
// nunca el calendario principal del usuario. Todo corre en el navegador con
// Google Identity Services (OAuth sin backend); el Client ID no es secreto.
//
// Reutiliza buildDayBlocks() y nextMonday() de js/ics.js.

const GOOGLE_CLIENT_ID = '134242478766-m087uhlpeabp5ev383lhjf3l6tk8314u.apps.googleusercontent.com';
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar';
const GCAL_NAME = 'Mi Horario Semanal';
const GCAL_ID_KEY = 'hs_gcal_id';

let tokenClient = null;
let gAccessToken = null;
let gSyncing = false;

function initGoogleAuth(){
  if(!window.google?.accounts?.oauth2){ setTimeout(initGoogleAuth, 300); return; }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_SCOPE,
    callback: async (resp) => {
      if(resp.error){
        toast('Google: autorización rechazada');
        setGSyncBtnState(false);
        return;
      }
      gAccessToken = resp.access_token;
      await runSync();
    },
  });
}

function syncGoogleCalendar(){
  if(gSyncing) return;
  if(!tokenClient){ toast('Google todavía está cargando, intenta de nuevo en unos segundos'); return; }
  if(!confirm(`Esto reemplaza TODOS los eventos del calendario "${GCAL_NAME}" en tu cuenta de Google con el horario actual. Tu calendario principal no se toca. ¿Continuar?`)) return;
  setGSyncBtnState(true);
  tokenClient.requestAccessToken({prompt: gAccessToken ? '' : 'consent'});
}

async function gFetch(url, opts = {}){
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${gAccessToken}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if(!res.ok){
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json();
}

async function findOrCreateCalendar(){
  const cachedId = localStorage.getItem(GCAL_ID_KEY);
  if(cachedId){
    try{
      const cal = await gFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cachedId)}`);
      if(cal && cal.summary === GCAL_NAME) return cachedId;
    }catch(e){ /* ya no existe o no autorizado: buscamos/creamos de nuevo */ }
  }

  const list = await gFetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=owner');
  const existing = (list.items || []).find(c => c.summary === GCAL_NAME);
  if(existing){
    localStorage.setItem(GCAL_ID_KEY, existing.id);
    return existing.id;
  }

  const created = await gFetch('https://www.googleapis.com/calendar/v3/calendars', {
    method: 'POST',
    body: JSON.stringify({
      summary: GCAL_NAME,
      description: 'Generado por Mi Horario Semanal — se sobrescribe en cada sincronización, no lo edites a mano.',
    }),
  });
  localStorage.setItem(GCAL_ID_KEY, created.id);
  return created.id;
}

async function clearCalendarEvents(calId){
  let pageToken;
  const ids = [];
  do{
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`);
    url.searchParams.set('maxResults', '250');
    url.searchParams.set('showDeleted', 'false');
    if(pageToken) url.searchParams.set('pageToken', pageToken);
    const page = await gFetch(url.toString());
    (page.items || []).forEach(e => ids.push(e.id));
    pageToken = page.nextPageToken;
  } while(pageToken);

  for(let i = 0; i < ids.length; i++){
    await gFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${ids[i]}?sendUpdates=none`, {method: 'DELETE'});
    toast(`🗑 Borrando eventos anteriores… ${i + 1}/${ids.length}`);
  }
}

function toLocalDateTime(date){
  const pad = n => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

async function pushEvents(calId){
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const monday = nextMonday();
  const events = [];

  for(let d = 0; d < 7; d++){
    buildDayBlocks(d).forEach(b => {
      const a = activityMap[b.id] || activityMap.free;
      const startDate = new Date(monday); startDate.setDate(monday.getDate() + d); startDate.setHours(b.start, 0, 0, 0);
      const endDate = new Date(monday); endDate.setDate(monday.getDate() + d); endDate.setHours(b.end, 0, 0, 0);
      events.push({
        summary: (a.icon ? a.icon + ' ' : '') + a.label,
        start: {dateTime: toLocalDateTime(startDate), timeZone: tz},
        end: {dateTime: toLocalDateTime(endDate), timeZone: tz},
        recurrence: ['RRULE:FREQ=WEEKLY'],
        reminders: {useDefault: false, overrides: [{method: 'popup', minutes: 0}]},
      });
    });
  }

  for(let i = 0; i < events.length; i++){
    await gFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?sendUpdates=none`, {
      method: 'POST',
      body: JSON.stringify(events[i]),
    });
    toast(`📆 Subiendo eventos… ${i + 1}/${events.length}`);
  }
  return events.length;
}

async function runSync(){
  gSyncing = true;
  try{
    toast('🔗 Conectando con Google Calendar…');
    const calId = await findOrCreateCalendar();
    await clearCalendarEvents(calId);
    const count = await pushEvents(calId);
    toast(`✓ ${count} eventos sincronizados`);
  }catch(err){
    console.error(err);
    toast('❌ Falló la sincronización con Google Calendar');
  }finally{
    gSyncing = false;
    setGSyncBtnState(false);
  }
}

function setGSyncBtnState(active){
  const b = document.getElementById('gsyncBtn');
  if(!b) return;
  b.disabled = active;
  b.textContent = active ? '⏳ Sincronizando…' : '📆 Sincronizar Google';
}
