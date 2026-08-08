// auth.js — candado ligero de acceso: contraseña de propietario y de
// invitado con permisos limitados.
//
// IMPORTANTE: este es un sitio 100% estático (sin servidor), así que esto
// NO es seguridad real — cualquiera con conocimientos técnicos puede leer
// el hash en el código fuente público e intentar romperlo por fuerza
// bruta. Sirve para filtrar visitas casuales, no para proteger información
// sensible. Ver README para más detalle.
//
// Para configurar tus contraseñas: abre esta página, abre la consola del
// navegador (F12) y ejecuta, por ejemplo:
//   await hashPassword('tu-contraseña')
// Copia el resultado en OWNER_HASH o GUEST_HASH más abajo.

const OWNER_HASH = 'CAMBIA_ESTO'; // hash SHA-256 de tu contraseña
const GUEST_HASH = 'CAMBIA_ESTO'; // hash SHA-256 de la contraseña de invitados
const AUTH_CONFIGURED = OWNER_HASH !== 'CAMBIA_ESTO';

const ROLE_KEY = 'hs_role';
let currentRole = AUTH_CONFIGURED ? (localStorage.getItem(ROLE_KEY) || null) : 'owner';

async function hashPassword(pw){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
window.hashPassword = hashPassword;

async function attemptLogin(pw){
  if(!pw) return null;
  const h = await hashPassword(pw);
  if(h === OWNER_HASH) return 'owner';
  if(h === GUEST_HASH) return 'guest';
  return null;
}

function setRole(role){
  currentRole = role;
  localStorage.setItem(ROLE_KEY, role);
  applyRolePermissions();
}

function logout(){
  localStorage.removeItem(ROLE_KEY);
  location.reload();
}

function applyRolePermissions(){
  const locked = AUTH_CONFIGURED && !currentRole;
  document.body.classList.toggle('locked', locked);
  document.body.classList.toggle('role-guest', currentRole === 'guest');
  document.body.classList.toggle('role-owner', currentRole === 'owner');

  const badge = document.getElementById('roleBadge');
  if(badge) badge.textContent = currentRole === 'owner' ? '👑 Propietario' : currentRole === 'guest' ? '👤 Invitado' : '';
  const logoutBtn = document.getElementById('logoutBtn');
  if(logoutBtn) logoutBtn.style.display = (AUTH_CONFIGURED && currentRole) ? '' : 'none';

  if(typeof renderProposalOverlay === 'function') renderProposalOverlay();
  if(typeof updateProposalBadges === 'function') updateProposalBadges();
}

const lockForm = document.getElementById('lockForm');
if(lockForm){
  lockForm.addEventListener('submit', async e => {
    e.preventDefault();
    const input = document.getElementById('lockPass');
    const err = document.getElementById('lockError');
    const role = await attemptLogin(input.value);
    input.value = '';
    if(!role){
      err.textContent = 'Contraseña incorrecta';
      input.focus();
      return;
    }
    err.textContent = '';
    setRole(role);
  });
}

if(!AUTH_CONFIGURED){
  console.warn('Mi Horario Semanal: el candado de acceso está desactivado. Configura OWNER_HASH y GUEST_HASH en js/auth.js para activarlo (ver README).');
}
