// activities.js — actividades personalizables: nombre, ícono, color de fondo y de letra.

const DEFAULT_ACTIVITIES = [
  { id: 'free',     label: 'Libre',           icon: '',   bg: '#ECECEA', fg: '#BBBBB6' },
  { id: 'sleep',    label: 'Dormir',          icon: '😴', bg: '#C5DAF0', fg: '#1A4870' },
  { id: 'work',     label: 'Trabajo',         icon: '💼', bg: '#D3CEFC', fg: '#35298C' },
  { id: 'commute',  label: 'Trayecto',        icon: '🚌', bg: '#FAD696', fg: '#6A430A' },
  { id: 'gym',      label: 'Gimnasio',        icon: '💪', bg: '#FAC0AA', fg: '#7A2D13' },
  { id: 'meal',     label: 'Comida/dieta',    icon: '🍽️', bg: '#C6E89A', fg: '#285C0E' },
  { id: 'prep',     label: 'Prep. comidas',   icon: '🍱', bg: '#AEE0BE', fg: '#165430' },
  { id: 'plan',     label: 'Planear clases',  icon: '📚', bg: '#A4E4CC', fg: '#0A4E3E' },
  { id: 'personal', label: 'Tiempo personal', icon: '🌿', bg: '#F6C4D6', fg: '#6B1E3E' },
  { id: 'winddown', label: 'Relajarse',       icon: '🌙', bg: '#D8D4C6', fg: '#48453A' },
];

const ACTS_KEY = 'hs_activities';

function loadActivities(){
  try{
    const s = localStorage.getItem(ACTS_KEY);
    if(s){
      const arr = JSON.parse(s);
      if(Array.isArray(arr) && arr.some(a=>a.id==='free')) return arr;
    }
  }catch(e){}
  return DEFAULT_ACTIVITIES.map(a=>({...a}));
}

function saveActivities(){
  try{ localStorage.setItem(ACTS_KEY, JSON.stringify(activities)); }catch(e){}
}

let activities = loadActivities();
let activityMap = {};
function reindexActivities(){
  activityMap = Object.fromEntries(activities.map(a=>[a.id, a]));
}
reindexActivities();

function makeActivityId(){
  return 'act_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function addActivity(a){
  activities.push({ id: makeActivityId(), ...a });
  reindexActivities();
  saveActivities();
}

function updateActivity(id, patch){
  const a = activityMap[id];
  if(!a) return;
  Object.assign(a, patch);
  reindexActivities();
  saveActivities();
}

function deleteActivity(id){
  if(id === 'free') return; // "Libre" es la actividad base y no se puede borrar
  activities = activities.filter(a => a.id !== id);
  reindexActivities();
  saveActivities();
}
