// middleware.js — verifica la cookie de sesión (JWT) y expone req.role.

const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'hs_session';
const SECRET = process.env.JWT_SECRET;
if(!SECRET) throw new Error('Falta JWT_SECRET en las variables de entorno');

function signSession(role){
  return jwt.sign({ role }, SECRET, { expiresIn: '30d' });
}

function requireAuth(req, res, next){
  const token = req.cookies?.[COOKIE_NAME];
  if(!token) return res.status(401).json({ error: 'No autenticado' });
  try{
    const payload = jwt.verify(token, SECRET);
    req.role = payload.role;
    next();
  }catch(e){
    return res.status(401).json({ error: 'Sesión inválida o vencida' });
  }
}

function requireRole(...roles){
  return (req, res, next) => {
    if(!roles.includes(req.role)) return res.status(403).json({ error: 'No autorizado para esta acción' });
    next();
  };
}

module.exports = { COOKIE_NAME, signSession, requireAuth, requireRole };
