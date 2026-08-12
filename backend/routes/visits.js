const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Visit = require('../models/Visit');

/* --------------------------------------------------------------------------
   Helper de sanitización de texto: elimina caracteres de control y limita
   la longitud. Nunca guardamos HTML/JS crudo.
   -------------------------------------------------------------------------- */
function cleanString(value, maxLen) {
  if (typeof value !== 'string') return '';
  const sanitized = value
    .replace(/[\u0000-\u001F\u007F]/g, '') // caracteres de control
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized.slice(0, maxLen);
}

/* --------------------------------------------------------------------------
   Helper de validación de pares de coordenadas.
   -------------------------------------------------------------------------- */
function validCoord(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

/* --------------------------------------------------------------------------
   Límite de peticiones específico para el envío de visitas (por IP).
   Se configura en server.js via rateLimit con estos parámetros por defecto;
   aquí se aplica el configurado globalmente en server.js, por lo que este
   archivo solo define el endpoint. Si prefieres un límite más estricto para
   POST /api/visits, activa el rateLimit local comentado abajo.
   -------------------------------------------------------------------------- */
// const visitsLimiter = rateLimit({...config heredado de server.js...});

/* --------------------------------------------------------------------------
   POST /api/visits
   Recibe los resultados autorizados de la prueba de conexión.
   -------------------------------------------------------------------------- */
router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};

    // IP: SIEMPRE la resuelve el servidor (req.ip considera "trust proxy").
    // Nunca se debe confiar en un campo "ip" enviado por el cliente.
    const clientIp = req.ip || 'unknown';

    // Datos opcionales aproximados por IP (texto sanitizado).
    const country = cleanString(body.country, 100);
    const region = cleanString(body.region, 100);
    const city = cleanString(body.city, 100);
    const isp = cleanString(body.isp, 160);
    const timezone = cleanString(body.timezone, 80);

    // Coordenadas aproximadas (validación de rango).
    const latitude = validCoord(body.latitude, -90, 90) ? body.latitude : null;
    const longitude = validCoord(body.longitude, -180, 180) ? body.longitude : null;

    // GPS: solo se acepta si el cliente indica haber recibido permiso.
    const allowGps = body.allowGps === true;
    const gps = body.gps && typeof body.gps === 'object' ? body.gps : null;

    const gpsLat = gps && validCoord(gps.lat, -90, 90) ? gps.lat : null;
    const gpsLon = gps && validCoord(gps.lon, -180, 180) ? gps.lon : null;
    const gpsAccuracy =
      gps && validCoord(gps.accuracy, 0, 100000) ? gps.accuracy : null;

    // Regla de seguridad: sin permiso, los campos GPS se descartan.
    const hasGps =
      allowGps && gpsLat != null && gpsLon != null;

    const visit = new Visit({
      ip: clientIp,
      country,
      region,
      city,
      isp,
      timezone,
      latitude,
      longitude,
      userAgent: cleanString(req.get('User-Agent') || '', 500),
      allowGps: allowGps,
      gpsLatitude: hasGps ? gpsLat : undefined,
      gpsLongitude: hasGps ? gpsLon : undefined,
      gpsAccuracy: hasGps ? gpsAccuracy : undefined
    });

    await visit.save();

    res.status(201).json({
      success: true,
      message: 'Resultados registrados correctamente.'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;