// api.js — envoltorio de fetch para hablar con el backend. Todo va con
// cookies same-origin (la sesión vive en una cookie httpOnly, no en JS).

class ApiError extends Error{
  constructor(status, message){ super(message); this.status = status; }
}

async function api(path, opts = {}){
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    credentials: 'same-origin',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let json = null;
  try{ json = await res.json(); }catch(e){ /* respuesta vacía */ }
  if(!res.ok){
    if(res.status === 401 && typeof handleUnauthorized === 'function') handleUnauthorized();
    throw new ApiError(res.status, json?.error || `Error ${res.status}`);
  }
  return json;
}

window.api = api;
window.ApiError = ApiError;
