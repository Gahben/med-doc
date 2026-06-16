/**
 * server.cjs — MedDoc · Render Free Tier
 *
 * Web Service Node.js serve o build Vite + endpoint /health para UptimeRobot.
 * O UptimeRobot bate a cada 5 min em /health → Render Free nunca dorme.
 */
const express = require('express');
const path    = require('path');
const rateLimit = require('express-rate-limit');
const app     = express();
const PORT    = process.env.PORT || 10000;

// Rate limiting para /health (prevenir abuso)
const healthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite de 100 requisições por IP
  message: { error: 'Muitas requisições, tente novamente mais tarde' }
});

// Health check para UptimeRobot
app.get('/health', healthLimiter, (_req, res) => {
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
app.get(/^(?!\/api).+/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Middleware de erro global
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ MedDoc online em 0.0.0.0:${PORT}`);
  console.log(`   Supabase: ${process.env.VITE_SUPABASE_URL ? 'OK' : '⚠️  VITE_SUPABASE_URL não definida'}`);
  console.log(`   Health Check: /health`);
});
