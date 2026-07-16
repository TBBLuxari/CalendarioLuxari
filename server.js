// server.js — servidor estático simple para previsualizar el proyecto en local con Bun.
// Uso: bun run dev

const port = Number(process.env.PORT) || 3000;

Bun.serve({
  port,
  async fetch(req){
    const url = new URL(req.url);
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = Bun.file('.' + path);
    if(await file.exists()) return new Response(file);
    return new Response('404 Not Found', {status: 404});
  },
});

console.log(`Mi Horario Semanal → http://localhost:${port}`);
