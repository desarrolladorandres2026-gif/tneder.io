require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const visitsRouter = require('./routes/visits');

const app = express();

/* --------------------------------------------------------------------------
   Configuración
   -------------------------------------------------------------------------- */
const PORT = process.env.PORT || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tneder_visits';
const GITHUB_PAGES_ORIGIN = process.env.GITHUB_PAGES_ORIGIN || '';
const TRUST_PROXY = process.env.TRUST_PROXY || 1;
const BODY_LIMIT = process.env.BODY_LIMIT || '16kb';

// Necesario para que req.ip sea correcto detrás de nginx y para el rate limit.
app.set('trust proxy', TRUST_PROXY === 'true' ? true : Number(TRUST_PROXY) || 1);

/* --------------------------------------------------------------------------
   CORS: solo se permite tu dominio de GitHub Pages.
   Se permiten peticiones sin cabecera Origin (curl, Postman, tests) pero se
   bloquea cualquier origen distinto al configurado.
   -------------------------------------------------------------------------- */
const allowedOrigins = GITHUB_PAGES_ORIGIN
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true); // no es un navegador
      if (allowedOrigins.includes(origin)) return callback(null, true);
      const err = new Error('Origen no permitido por CORS');
      err.status = 403;
      return callback(err);
    },
    methods: ['POST', 'GET', 'OPTIONS']
  })
);

app.use(express.json({ limit: BODY_LIMIT }));

/* --------------------------------------------------------------------------
   Rate limiting global (por IP), para evitar abusos.
   -------------------------------------------------------------------------- */
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: Number(process.env.RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas peticiones. Inténtalo más tarde.' }
});
app.use(limiter);

/* --------------------------------------------------------------------------
   Rutas
   -------------------------------------------------------------------------- */
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.use('/api/visits', visitsRouter);

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Ruta no encontrada.' });
});

/* --------------------------------------------------------------------------
   Manejo centralizado de errores
   -------------------------------------------------------------------------- */
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Cuerpo de petición demasiado grande.' });
  }
  if (err.status) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  console.error('Error no controlado:', err);
  res.status(500).json({ success: false, message: 'Error interno del servidor.' });
});

/* --------------------------------------------------------------------------
   Arranque
   -------------------------------------------------------------------------- */
async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[db] Conectado a MongoDB');
  } catch (err) {
    console.error('[db] No se pudo conectar a MongoDB:', err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`[server] API escuchando en http://localhost:${PORT}`);
    console.log(`[cors]  Orígenes permitidos: ${allowedOrigins.length ? allowedOrigins.join(', ') : '(ninguno)'}`);
  });
}

start();