// notify.js — avisos dentro de la app (notificación del navegador + pitido)
// mientras la pestaña esté abierta. Complementa la exportación a calendario
// (js/ics.js), que es la vía confiable cuando la app NO está abierta.

let notifsEnabled = localStorage.getItem('hs_notifs') === '1';
let lastSlotKey = null;
let audioCtx = null;

function beep(){
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  }catch(e){}
}

function updateNotifBtn(){
  const b = document.getElementById('notifBtn');
  if(!b) return;
  b.textContent = notifsEnabled ? '🔔 Avisos: ON' : '🔕 Avisos';
  b.classList.toggle('on', notifsEnabled);
}

function toggleNotifs(){
  if(notifsEnabled){
    notifsEnabled = false;
    localStorage.setItem('hs_notifs', '0');
    updateNotifBtn();
    toast('Avisos desactivados');
    return;
  }
  if(!('Notification' in window)){
    toast('Tu navegador no soporta notificaciones');
    return;
  }
  Notification.requestPermission().then(perm => {
    if(perm !== 'granted'){ toast('Permiso de notificaciones denegado'); return; }
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    notifsEnabled = true;
    lastSlotKey = currentSlotKey(); // evita avisar de inmediato a mitad de un bloque
    localStorage.setItem('hs_notifs', '1');
    updateNotifBtn();
    toast('Avisos activados');
  });
}

function currentSlotKey(){
  const now = new Date();
  const d = (now.getDay() + 6) % 7;
  const h = now.getHours();
  return d + '_' + h;
}

function checkActivityChange(){
  if(!notifsEnabled) return;
  const key = currentSlotKey();
  if(key === lastSlotKey) return;
  lastSlotKey = key;

  const [d, h] = key.split('_').map(Number);
  const id = data[d]?.[h];
  if(id === undefined) return;
  const a = activityMap[id] || activityMap.free;
  const label = (a.icon ? a.icon + ' ' : '') + a.label;

  if(Notification.permission === 'granted'){
    new Notification('Cambio de actividad', {body: label, tag: 'hs-activity'});
  }
  beep();
}
