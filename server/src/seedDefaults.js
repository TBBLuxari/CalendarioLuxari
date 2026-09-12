// seedDefaults.js — datos con los que arranca una base de datos nueva
// (mismo horario/actividades de ejemplo que tenía la versión estática).

const A = (n, t) => Array(n).fill(t);

const DEFAULT_SCHEDULE = [
  [...A(8,'sleep'),'free','free','plan','plan','commute','commute',...A(7,'work'),'commute','meal','winddown'],
  [...A(4,'sleep'),'free','commute','commute',...A(8,'work'),'commute','commute','personal','plan','personal','personal','sleep','sleep','sleep'],
  [...A(8,'sleep'),'free','commute',...A(11,'work'),'commute','gym','winddown'],
  [...A(9,'sleep'),...A(3,'personal'),'prep','prep',...A(8,'personal'),'gym','winddown'],
  [...A(8,'sleep'),'free','free','plan','plan','commute','commute',...A(7,'work'),'commute','gym','winddown'],
  [...A(9,'sleep'),'personal','personal','prep','prep',...A(10,'personal'),'winddown'],
  [...A(9,'sleep'),'personal','personal','prep','prep','prep',...A(4,'personal'),'plan','plan','personal','winddown','winddown','sleep'],
];

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

module.exports = { DEFAULT_SCHEDULE, DEFAULT_ACTIVITIES };
