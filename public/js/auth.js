// auth.js — sesión respaldada por el servidor (cookie httpOnly con JWT).
// Las contraseñas viven en variables de entorno del backend, nunca en el
// código fuente del cliente (a diferencia de la versión estática anterior).

let currentRole = null;

async function attemptLogin(pw){
  try{
    const { role } = await api('/auth/login', { method: 'POST', body: { password: pw } });
    return role;
  }catch(e){
    return null;
  }
}

function setRole(role){
  currentRole = role;
  applyRolePermissions();
}

async function logout(){
  try{ await api('/auth/logout', { method: 'POST' }); }catch(e){}
  location.reload();
}

// Llamado por api.js cuando cualquier llamada responde 401 (sesión vencida o
// nunca autenticada): vuelve a mostrar la pantalla de contraseña.
function handleUnauthorized(){
  currentRole = null;
  applyRolePermissions();
}

function applyRolePermissions(){
  const locked = !currentRole;
  document.body.classList.toggle('locked', locked);
  document.body.classList.toggle('role-guest', currentRole === 'guest');
  document.body.classList.toggle('role-owner', currentRole === 'owner');
  document.body.classList.toggle('role-booking', currentRole === 'booking');

  const badge = document.getElementById('roleBadge');
  if(badge){
    badge.textContent = currentRole === 'owner' ? '👑 Propietario'
      : currentRole === 'guest' ? '👤 Invitado'
      : currentRole === 'booking' ? '📅 Agendar cita'
      : '';
  }
  const logoutBtn = document.getElementById('logoutBtn');
  if(logoutBtn) logoutBtn.style.display = currentRole ? '' : 'none';

  if(typeof renderOverlays === 'function') renderOverlays();
  if(typeof updateProposalBadges === 'function') updateProposalBadges();
}

const lockForm = document.getElementById('lockForm');
if(lockForm){
  lockForm.addEventListener('submit', async e => {
    e.preventDefault();
    const input = document.getElementById('lockPass');
    const err = document.getElementById('lockError');
    const submitBtn = lockForm.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    const role = await attemptLogin(input.value);
    submitBtn.disabled = false;
    input.value = '';
    if(!role){
      err.textContent = 'Contraseña incorrecta';
      input.focus();
      return;
    }
    err.textContent = '';
    setRole(role);
    if(typeof onLoggedIn === 'function') await onLoggedIn();
  });
}
