const mongoose = require('mongoose');

// Documento de una visita autorizada a la Prueba de Conexión.
// Solo se guardan los datos mínimos necesarios.
const visitSchema = new mongoose.Schema(
  {
    // IP del visitante, resuelta por el SERVIDOR (nunca confiar en la del cliente).
    ip: { type: String, required: true, trim: true, maxlength: 64 },

    // Datos aproximados derivados de la IP (proporcionados por el cliente tras
    // consultar la API pública de IP; son estimaciones, no GPS).
    country: { type: String, trim: true, maxlength: 100, default: '' },
    region: { type: String, trim: true, maxlength: 100, default: '' },
    city: { type: String, trim: true, maxlength: 100, default: '' },
    isp: { type: String, trim: true, maxlength: 160, default: '' },
    timezone: { type: String, trim: true, maxlength: 80, default: '' },

    // Coordenadas aproximadas del bloque de IP.
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },

    // User-Agent enviado por el navegador.
    userAgent: { type: String, trim: true, maxlength: 500, default: '' },

    // Unicamente true si el usuario autorizó explícitamente el GPS.
    allowGps: { type: Boolean, default: false },

    // Coordenadas GPS reales. SOLO se almacenan si allowGps === true.
    gpsLatitude: { type: Number, min: -90, max: 90 },
    gpsLongitude: { type: Number, min: -180, max: 180 },
    gpsAccuracy: { type: Number, min: 0 },

    // Fecha/hora en la que se registró la visita.
    visitedAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

visitSchema.index({ visitedAt: -1 });

module.exports = mongoose.model('Visit', visitSchema);