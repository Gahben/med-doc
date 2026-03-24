/**
 * server.cjs — MedDoc · Render Free Tier
 *
 * Web Service Node.js serve o build Vite + endpoint /health para UptimeRobot.
 * O UptimeRobot bate a cada 5 min em /health → Render Free nunca dorme.
 */
const express = require('express');
const path    = require('path');
const app     = express();
const PORT    = process.env.PORT || 10000;

// Health check para UptimeRobot
app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'meddoc',
    timestamp: new Date().toISOString(),
    uptime:    Math.floor(process.uptime()),
    supabase:  process.env.VITE_SUPABASE_URL ? 'configured' : 'MISSING',
  });
});

app.get('/ping', (_req, res) => res.send('pong'));

// Arquivos estáticos do build Vite
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '1y',
  index: false,
  etag: true,
}));

// SPA fallback
app.get('/:splat*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ MedDoc na porta ${PORT}`);
  console.log(`   Supabase: ${process.env.VITE_SUPABASE_URL ? 'OK' : '⚠️  VITE_SUPABASE_URL não definida'}`);
  console.log(`   /health : http://localhost:${PORT}/health`);
});
