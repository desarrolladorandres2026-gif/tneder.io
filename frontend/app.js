'use strict';

/* ==========================================================================
   CONFIGURACIÓN DEL FRONTEND
   --------------------------------------------------------------------------
   API_URL: apunta a tu backend en el VPS. Cámbiala tras desplegar.
   IP_API_URL: proveedor gratuito y SIN clave para obtener IP pública + datos
   aproximados por IP. Puedes cambiarlo por cualquier proveedor compatible.
   ========================================================================== */
const CONFIG = {
  API_URL: 'http://localhost:3000/api/visits', // TODO: reemplazar por https://tudominio.com/api/visits
  IP_API_URL: 'https://ipwho.is/',
  ENABLE_SEND_BTN: true
};

/* --------------------------------------------------------------------------
   Referencias al DOM
   -------------------------------------------------------------------------- */
const $ = (id) => document.getElementById(id);

const screens = {
  home: $('homeScreen'),
  analyzing: $('analyzingScreen'),
  result: $('resultScreen')
};

const els = {
  startBtn: $('startBtn'),
  gpsBtn: $('gpsBtn'),
  sendBtn: $('sendBtn'),
  retryBtn: $('retryBtn'),
  progressFill: $('progressFill'),
  stepLog: $('stepLog'),
  hudStatus: $('hudStatus'),
  toast: $('toast'),
  footerClock: $('footerClock'),
  resultTimestamp: $('resultTimestamp'),
  gpsHint: $('gpsHint'),
  gpsCard: $('gpsCard'),
  dataIp: $('dataIp'),
  dataCountry: $('dataCountry'),
  dataRegion: $('dataRegion'),
  dataCity: $('dataCity'),
  dataIsp: $('dataIsp'),
  dataTimezone: $('dataTimezone'),
  dataIpCoords: $('dataIpCoords'),
  dataGps: $('dataGps')
};

/* --------------------------------------------------------------------------
   Estado de la prueba
   -------------------------------------------------------------------------- */
const state = {
  ipData: null,     // datos por IP
  gps: null,        // coords GPS (solo si el usuario aceptó)
  gpsAuthorized: false
};

/* --------------------------------------------------------------------------
   Utilidades
   -------------------------------------------------------------------------- */
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove('active'));
  screens[name].classList.add('active');
}

function setProgress(percent) {
  els.progressFill.style.width = percent + '%';
}

function setLog(text) {
  els.stepLog.textContent = text;
}

function showToast(msg, type = '', duration = 3200) {
  els.toast.textContent = msg;
  els.toast.className = 'toast show ' + type;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    els.toast.className = 'toast';
  }, duration);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* --------------------------------------------------------------------------
   Paso 1: obtener IP pública + geolocalización aproximada por IP
   -------------------------------------------------------------------------- */
async function fetchIpData() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(CONFIG.IP_API_URL, { signal: controller.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/* Normaliza la respuesta según la API usada (ipwho.is por defecto). */
function normalizeIpData(raw) {
  const connection = raw.connection || {};
  const tz = raw.timezone || {};

  return {
    ip: raw.ip || 'N/D',
    country: raw.country || raw.country_name || 'N/D',
    region: raw.region || raw.region_name || raw.state || 'N/D',
    city: raw.city || 'N/D',
    isp: connection.isp || connection.org || raw.org || raw.isp || 'N/D',
    timezone: (typeof tz === 'string' ? tz : tz.id) || raw.timezone_gmt || 'N/D',
    lat: parseFloat(raw.latitude) || null,
    lon: parseFloat(raw.longitude) || null,
    source: 'ip'
  };
}

/* --------------------------------------------------------------------------
   Paso 2 (opcional): GPS con permiso explícito del usuario
   -------------------------------------------------------------------------- */
function requestGps() {
  if (!('geolocation' in navigator)) {
    showToast('Tu navegador no soporta geolocalización.', 'error');
    return;
  }

  els.gpsBtn.disabled = true;
  showToast('El navegador pedirá tu permiso. Si lo rechazas, seguimos solo con la ubicación por IP.', '', 4200);

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.gps = {
        lat: +pos.coords.latitude.toFixed(6),
        lon: +pos.coords.longitude.toFixed(6),
        accuracy: Math.round(pos.coords.accuracy)
      };
      state.gpsAuthorized = true;
      els.dataGps.textContent = `${state.gps.lat}, ${state.gps.lon}`;
      els.gpsHint.textContent = `Autorizado · precisión ±${state.gps.accuracy} m`;
      els.gpsBtn.disabled = false;
      showToast('GPS recibido correctamente.', 'success');
    },
    (err) => {
      els.gpsBtn.disabled = false;
      state.gps = null;
      state.gpsAuthorized = false;
      const msg =
        err.code === err.PERMISSION_DENIED
          ? 'Permiso denegado. Solo usaremos la ubicación aproximada por IP.'
          : err.code === err.POSITION_UNAVAILABLE
            ? 'GPS no disponible. Solo usaremos la ubicación por IP.'
            : 'No se pudo obtener el GPS. Solo usaremos la ubicación por IP.';
      els.gpsHint.textContent = 'Rechazado / no disponible';
      showToast(msg, 'error');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

/* --------------------------------------------------------------------------
   Paso 3: envío autorizado de resultados al backend
   -------------------------------------------------------------------------- */
async function sendToServer() {
  if (!CONFIG.ENABLE_SEND_BTN) {
    showToast('El envío está desactivado en la configuración.', 'error');
    return;
  }
  if (!state.ipData) {
    showToast('Aún no hay resultados que enviar.', 'error');
    return;
  }

  els.sendBtn.disabled = true;
  showToast('Enviando los datos autorizados...', '');

  const payload = {
    ip: state.ipData.ip,
    country: state.ipData.country,
    region: state.ipData.region,
    city: state.ipData.city,
    isp: state.ipData.isp,
    timezone: state.ipData.timezone,
    latitude: state.ipData.lat,
    longitude: state.ipData.lon,
    allowGps: state.gpsAuthorized,
    gps: state.gps
  };

  try {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json().catch(() => ({}));
    showToast(json.message || 'Resultados registrados correctamente.', 'success');
  } catch (err) {
    console.error('Error al enviar al servidor:', err);
    showToast('No se pudo contactar el servidor. Revisa la configuración de API_URL.', 'error', 5000);
  } finally {
    els.sendBtn.disabled = false;
  }
}

/* --------------------------------------------------------------------------
   Flujo principal de la prueba
   -------------------------------------------------------------------------- */
async function runTest() {
  state.ipData = null;
  state.gps = null;
  state.gpsAuthorized = false;

  showScreen('analyzing');
  els.hudStatus.textContent = 'ANALIZANDO CONEXIÓN...';
  setProgress(0);

  const steps = [
    { pct: 15, msg: 'Inicializando protocolo de diagnóstico...', wait: 500 },
    { pct: 35, msg: 'Consultando IP pública y geolocalización aproximada (IP)...', wait: 700 },
    { pct: 60, msg: 'Procesando datos de red y operador (ISP)...', wait: 700 },
    { pct: 80, msg: 'Calculando zona horaria y coordenadas aproximadas...', wait: 600 },
    { pct: 95, msg: 'Preparando informe de conexión...', wait: 500 }
  ];

  for (const step of steps) {
    setProgress(step.pct);
    setLog(step.msg);
    await wait(step.wait);
  }

  setProgress(5);
  setLog('Consultando proveedor de IP...');

  let ipData;
  try {
    ipData = normalizeIpData(await fetchIpData());
  } catch (err) {
    console.error('Fallo al obtener datos por IP:', err);
    setLog('Error al consultar el proveedor de IP. Revisa tu conexión.');
    els.hudStatus.textContent = 'ERROR DE CONEXIÓN';
    showToast('No se pudo obtener la IP pública. Verifica tu conexión e inténtalo de nuevo.', 'error');
    setTimeout(() => {
      showScreen('home');
      els.hudStatus.textContent = 'SISTEMA INACTIVO';
    }, 2000);
    return;
  }

  state.ipData = ipData;
  setProgress(100);
  setLog('Análisis completado.');

  await wait(400);
  renderResults(ipData);
  showScreen('result');
  els.hudStatus.textContent = 'ANÁLISIS COMPLETADO';
}

/* --------------------------------------------------------------------------
   Render de resultados
   -------------------------------------------------------------------------- */
function renderResults(data) {
  els.dataIp.textContent = data.ip;
  els.dataCountry.textContent = data.country;
  els.dataRegion.textContent = data.region;
  els.dataCity.textContent = data.city;
  els.dataIsp.textContent = data.isp;
  els.dataTimezone.textContent = data.timezone;
  els.dataIpCoords.textContent =
    data.lat != null && data.lon != null
      ? `${data.lat}, ${data.lon}`
      : 'No disponible';
  els.dataGps.textContent = '--';
  els.gpsHint.textContent = 'No compartido';

  const now = new Date();
  const ts = now.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'medium' });
  els.resultTimestamp.textContent = 'Registrado el ' + ts;
}

/* --------------------------------------------------------------------------
   Reloj del footer
   -------------------------------------------------------------------------- */
function tickClock() {
  const now = new Date();
  const p = (n) => String(n).padStart(2, '0');
  els.footerClock.textContent = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
}
setInterval(tickClock, 1000);
tickClock();

/* --------------------------------------------------------------------------
   Eventos
   -------------------------------------------------------------------------- */
els.startBtn.addEventListener('click', runTest);
els.gpsBtn.addEventListener('click', requestGps);
els.sendBtn.addEventListener('click', sendToServer);
els.retryBtn.addEventListener('click', () => {
  showScreen('home');
  els.hudStatus.textContent = 'SISTEMA INACTIVO';
  els.progressFill.style.width = '0%';
  state.ipData = null;
});