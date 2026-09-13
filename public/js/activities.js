// activities.js — actividades personalizables: nombre, ícono, color de fondo
// y de letra. Viven en el backend (tabla activities); esto solo mantiene el
// caché en memoria que usa el resto de la UI.

let activities = [];
let activityMap = {};

function reindexActivities(){
  activityMap = Object.fromEntries(activities.map(a => [a.id, a]));
}

async function fetchActivities(){
  activities = await api('/activities');
  reindexActivities();
}

async function addActivity(a){
  const created = await api('/activities', { method: 'POST', body: a });
  activities.push(created);
  reindexActivities();
  return created;
}

async function updateActivity(id, patch){
  const updated = await api('/activities/' + id, { method: 'PUT', body: patch });
  const a = activityMap[id];
  if(a) Object.assign(a, updated);
  reindexActivities();
}

async function deleteActivity(id){
  if(id === 'free') return; // "Libre" es la actividad base y no se puede borrar
  await api('/activities/' + id, { method: 'DELETE' });
  activities = activities.filter(a => a.id !== id);
  reindexActivities();
}

// Reemplaza la lista completa preservando los ids dados (usado por
// "Traer de Google", que necesita que los ids coincidan con los que quedaron
// guardados en cada bloque del calendario).
async function replaceAllActivities(list){
  activities = await api('/activities', { method: 'PUT', body: list });
  reindexActivities();
}
