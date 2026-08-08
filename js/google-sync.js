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
        // Guardamos el bloque y la definición completa de la actividad (id,
        // color, ícono) como propiedad privada, invisible en la UI de Google
        // Calendar, para poder reconstruir el horario exacto al "traer" desde
        // otro computador — no solo el texto del evento.
        extendedProperties: {
          private: {
            hsDay: String(d),
            hsStart: String(b.start),
            hsEnd: String(b.end),
            hsAct: JSON.stringify({id: a.id, label: a.label, icon: a.icon || '', bg: a.bg, fg: a.fg}),
          },
        },
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

/* TRAER DE GOOGLE
   Contraparte de syncGoogleCalendar(): en vez de sobrescribir Google con lo
   local, reconstruye el horario y las actividades locales a partir de lo que
   ya hay en el calendario dedicado "Mi Horario Semanal". Así, dos
   computadores pueden coordinarse: uno sincroniza (sube), el otro trae
   (baja), en vez de que cada uno sobreescriba con su propia versión.
*/
let gPulling = false;

function pullFromGoogleCalendar(){
  if(gPulling) return;
  if(!tokenClient){ toast('Google todavía está cargando, intenta de nuevo en unos segundos'); return; }
  if(!confirm(`Esto REEMPLAZA tu horario y actividades locales con lo que haya guardado en el calendario "${GCAL_NAME}" de tu cuenta de Google. Si tienes cambios locales sin sincronizar, se perderán. ¿Continuar?`)) return;
  setGPullBtnState(true);
  gPulling = true;
  if(gAccessToken){
    runPull().finally(() => { gPulling = false; });
  }else{
    const prevCallback = tokenClient.callback;
    tokenClient.callback = async (resp) => {
      tokenClient.callback = prevCallback;
      if(resp.error){
        toast('Google: autorización rechazada');
        setGPullBtnState(false);
        gPulling = false;
        return;
      }
      gAccessToken = resp.access_token;
      await runPull();
      gPulling = false;
    };
    tokenClient.requestAccessToken({prompt: ''});
  }
}

async function fetchAllEvents(calId){
  let pageToken;
  const items = [];
  do{
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`);
    url.searchParams.set('maxResults', '250');
    url.searchParams.set('showDeleted', 'false');
    if(pageToken) url.searchParams.set('pageToken', pageToken);
    const page = await gFetch(url.toString());
    (page.items || []).forEach(e => items.push(e));
    pageToken = page.nextPageToken;
  } while(pageToken);
  return items;
}

async function runPull(){
  try{
    toast('🔗 Conectando con Google Calendar…');
    const calId = await findOrCreateCalendar();
    const events = await fetchAllEvents(calId);

    const newData = Array.from({length: 7}, () => Array(24).fill('free'));
    const newActivities = [DEFAULT_ACTIVITIES.find(a => a.id === 'free')];
    const seenActIds = new Set(['free']);
    let blocksApplied = 0;

    events.forEach(e => {
      const p = e.extendedProperties?.private;
      if(!p || !p.hsAct || p.hsDay === undefined) return;
      let act;
      try{ act = JSON.parse(p.hsAct); }catch(err){ return; }
      const d = +p.hsDay, start = +p.hsStart, end = +p.hsEnd;
      if(!(d >= 0 && d < 7) || !(start >= 0 && end <= 24 && start < end)) return;

      if(!seenActIds.has(act.id)){
        seenActIds.add(act.id);
        newActivities.push({id: act.id, label: act.label, icon: act.icon || '', bg: act.bg, fg: act.fg});
      }
      for(let h = start; h < end; h++) newData[d][h] = act.id;
      blocksApplied++;
    });

    if(blocksApplied === 0){
      toast('⚠️ No se encontraron bloques guardados en Google (¿ya sincronizaste desde algún computador?)');
      return;
    }

    data = newData;
    activities = newActivities;
    reindexActivities();
    saveActivities();
    saveData();
    renderPalette();
    renderAll();
    toast(`✓ Horario traído de Google (${blocksApplied} bloques)`);
  }catch(err){
    console.error(err);
    toast('❌ Falló al traer el horario desde Google Calendar');
  }finally{
    setGPullBtnState(false);
  }
}

function setGPullBtnState(active){
  const b = document.getElementById('gpullBtn');
  if(!b) return;
  b.disabled = active;
  b.textContent = active ? '⏳ Trayendo…' : '🔄 Traer de Google';
}
