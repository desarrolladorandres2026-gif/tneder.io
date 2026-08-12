# TNEDER — Prueba de Conexión (proyecto educativo)

Página web desplegada en **GitHub Pages** que muestra una prueba de conexión moderna. Consulta la **IP pública** y una **ubicación aproximada derivada de la IP** (estimación, no GPS), y opcionalmente — solo con permiso explícito del usuario — coordenadas GPS reales. Un backend **Node.js + Express + MongoDB** independiente recibe los resultados **autorizados**.

> ⚠️ Proyecto con fines **educativos y de transparencia**. No usa técnicas ocultas, tracking encubierto, redirecciones maliciosas ni captura silenciosa.
>
> 🚫 **No uses datos IP como si fueran GPS**: la geolocalización por IP es aproximada y puede variar decenas de kilómetros.

---

## Arquitectura

```
Visitante (navegador)
    │  HTTPS
    ▼
GitHub Pages (frontend estático: frontend/)
    │ 1. GET https://ipwho.is/  → IP pública + datos aproximados
    │ 2. navigator.geolocation  → GPS (solo si el usuario acepta el diálogo nativo)
    │ 3. POST /api/visits       → resultados autorizados
    ▼
Tu VPS (backend: backend/)
    │  Nginx (HTTPS + proxy) → Node/Express (PM2) → MongoDB
```

**Datos que se guardan** (mínimos): IP resuelta por el servidor, fecha/hora, país, región, ciudad, ISP, zona horaria, coordenadas aproximadas por IP, User-Agent, `allowGps` (bool) y — **únicamente si el usuario dio permiso** — coordenadas GPS y precisión.

---

## Estructura del proyecto

```
.
├── README.md
├── frontend/
│   ├── index.html     # UI Tneder: pantalla de inicio, análisis y dashboard
│   ├── style.css      # Estética cyberpunk, animaciones, responsive
│   └── app.js         # Lógica: IP, GPS opcional, envío autorizado
└── backend/
    ├── server.js          # Express, CORS restringido, rate limiting
    ├── package.json
    ├── .env.example       # Copiar a .env (NUNCA subir .env)
    ├── models/Visit.js    # Esquema Mongoose (datos mínimos)
    └── routes/visits.js   # POST /api/visits con validación y sanitización
```

---

## Parte 1 — Desplegar el frontend en GitHub Pages

### 1.1 Crear el repositorio

1. Ve a https://github.com/new y crea un repositorio.
   - Para el dominio `usuario.github.io` el repositorio **debe** llamarse **`usuario.github.io`** (el nombre exacto de tu cuenta).
2. Sube los archivos. Desde tu proyecto local:

```bash
git init
git add .
git commit -m "Primera versión: Tneder Connection Test"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/usuario.github.io.git
git push -u origin main
```

> Si prefieres una subruta (`usuario.github.io/mi-proyecto`), crea un repo normal (p. ej. `connection-test`) y en el punto 1.2 usa "Deploy from a branch" apuntando a `main`.

### 1.2 Activar GitHub Pages (con GitHub Actions)

El repo incluye `.github/workflows/deploy.yml`, que publica exactamente la carpeta **`frontend/`** como raíz del sitio (por eso tu `index.html` vive en `frontend/` y no en la raíz).

1. En GitHub, ve a tu repositorio → **Settings** → **Pages** (barra izquierda).
2. En **Build and deployment** → **Source** → elige **GitHub Actions**.
3. Sube el código al repositorio (o re-push un cambio). El workflow `.github/workflows/deploy.yml` se ejecutará automáticamente en cada `push` a `main`.
4. Espera ~1 minuto y verás la deploy en **Actions** → **Desplegar frontend** → ✅. Al terminar, el enlace aparecerá arriba en **Settings → Pages**, normalmente `https://usuario.github.io/`.

**Verificación:** abre la URL; debes ver la pantalla "PRUEBA DE CONEXIÓN".

> Si NO quieres usar un workflow, alternativa manual: mueve el contenido de `frontend/` a la raíz del repo (o a `docs/`) y en Settings → Pages → Source elige **Deploy from a branch** con la carpeta `/ (root)` o `/docs`. En `docs/` los enlaces relativos de `style.css` y `app.js` seguirán funcionando igual.

### 1.3 Configurar la URL de la API en el frontend

Abre `frontend/app.js` y cambia `CONFIG.API_URL` (línea ~12):

```js
const CONFIG = {
  API_URL: 'https://tudominio.com/api/visits', // ← tu dominio con HTTPS
  IP_API_URL: 'https://ipwho.is/',
  ENABLE_SEND_BTN: true
};
```

> El botón **"ENVIAR RESULTADOS"** solo funciona cuando apuntas a tu backend desplegado. Puedes desactivarlo con `ENABLE_SEND_BTN: false`.

Re-haz commit y push para que GitHub Pages publique el cambio:

```bash
git add frontend/app.js
git commit -m "Apuntar a la API del VPS"
git push
```

---

## Parte 2 — Desplegar el backend en tu VPS (Ubuntu)

### 2.1 Instalar Node.js (v18+ recomendado)

```bash
# Utiliza el instalador oficial de NodeSource (versión 20 LTS como ejemplo):
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

node -v   # debe mostrar v20.x o superior
npm -v
```

### 2.2 Configurar MongoDB

```bash
# Importa la clave de MongoDB y añade el repositorio (Ubuntu 22.04/24.04):
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
http://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt-get update
sudo apt-get install -y mongodb-org

# Inicia y habilita el servicio
sudo systemctl enable mongod
sudo systemctl start mongod
sudo systemctl status mongod
```

**Opcional pero recomendado — crear usuario dedicado en MongoDB:**

```bash
mongosh
```

```js
use tneder_visits
db.createUser({
  user: "tneder",
  pwd: "CAMBIA_ESTA_CONTRASENA",
  roles: [{ role: "readWrite", db: "tneder_visits" }]
})
exit
```

Y usa esa URI en `.env`:
```
MONGODB_URI=mongodb://tneder:CAMBIA_ESTA_CONTRASENA@127.0.0.1:27017/tneder_visits?authSource=tneder_visits
```

### 2.3 Subir el backend y configurar `.env`

```bash
# Desde tu máquina local, copia solo la carpeta backend al VPS
rsync -avz --exclude node_modules --exclude .env ./backend/ usuario@TU_VPS:/home/usuario/tneder-backend/

# En el VPS:
cd /home/usuario/tneder-backend
cp .env.example .env
nano .env     # ★ rellena MONGODB_URI y GITHUB_PAGES_ORIGIN
```

Valores obligatorios del `.env`:

```
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/tneder_visits
GITHUB_PAGES_ORIGIN=https://tuusuario.github.io
TRUST_PROXY=1
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=30
BODY_LIMIT=16384
```

### 2.4 Instalar dependencias y probar

```bash
cd /home/usuario/tneder-backend
npm install
node server.js
```

Debes ver `[db] Conectado a MongoDB` y `[server] API escuchando en http://localhost:3000`.

Prueba el endpoint:

```bash
curl -X POST http://localhost:3000/api/visits \
  -H "Content-Type: application/json" \
  -d '{"country":"Prueba","city":"Test","latitude":0,"longitude":0}'
```

Comprueba la salud y que CORS bloquea orígenes ajenos:

```bash
curl http://localhost:3000/api/health

# Debe devolver 403 (origen no permitido)
curl -X POST http://localhost:3000/api/visits \
  -H "Origin: https://evil.example.com" -H "Content-Type: application/json" \
  -d '{"country":"x"}'
```

Detén con `Ctrl+C`.

### 2.5 Ejecutar con PM2 (siempre activo)

```bash
sudo npm install -g pm2

cd /home/usuario/tneder-backend
pm2 start server.js --name tneder-api
pm2 save
pm2 startup    # copia y ejecuta la línea que imprime (arranca al reiniciar)
```

Gestión:

```bash
pm2 status            # ver estado
pm2 logs tneder-api   # ver logs
pm2 restart tneder-api
```

### 2.6 Configurar Nginx como proxy inverso

Instala Nginx:

```bash
sudo apt-get update
sudo apt-get install -y nginx
```

Crea el sitio (cambia `tudominio.com`):

```bash
sudo nano /etc/nginx/sites-available/tneder
```

```nginx
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Activa el sitio y recarga:

```bash
sudo ln -s /etc/nginx/sites-available/tneder /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

> Nginx debe apuntar a un **dominio propio** (`tudominio.com`). GitHub Pages no admite proxying a tu API. Apunta el registro **A** de tu dominio al IP de tu VPS desde tu registrador o proveedor DNS.

**Verificación:** `curl -X POST http://tudominio.com/api/visits ...` debe responder 201 (y requieres que el origen sea tu dominio en CORS para que funcione desde el navegador).

### 2.7 Configurar HTTPS con Let's Encrypt (Certbot)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tudominio.com -d www.tudominio.com
```

Certbot edita Nginx automáticamente y añade renovación automática. Verifica la renovación:

```bash
sudo certbot renew --dry-run
```

A partir de ahora el frontend debe apuntar a `https://tudominio.com/api/visits`.

---

## Parte 3 — Probar TODO localmente antes de desplegar

### 3.1 Backend local

Necesitas MongoDB local o Docker. Con Docker (opcional):

```bash
docker run -d --name mongo -p 27017:27017 mongo:7
```

```bash
cd backend
cp .env.example .env
npm install
npm start        # o npm run dev (recarga automática)
```

### 3.2 Frontend local

La pantalla de prueba funciona desde `file://`, pero **el GPS y el envío requieren servirla con HTTP**. Además, `fetch` a la API de IP funciona desde `file://`, sin embargo, sirve la página con un servidor estático para validar todo:

```bash
cd frontend
npx serve .
# abre http://localhost:3000  →  si la API corre en 3000, usa: npx serve -p 8080 .
```

> **Ajuste local:** para probar el envío con el backend local, edita temporalmente `CONFIG.API_URL` a `http://localhost:3000/api/visits`. Recuerda cambiarlo a tu dominio HTTPS al desplegar. Si el CSS/JS no carga con `file://`, es un tema de navegador; usa `npx serve` o cualquier estático.

### 3.3 Verificar datos guardados

```bash
mongosh tneder_visits --eval "db.visits.find().sort({visitedAt:-1}).limit(5).pretty()"
```

---

## Guía de seguridad (resumen de lo implementado)

| Riesgo | Mitigación (backend) |
|---|---|
| CORS abierto | `origin` restringido a `GITHUB_PAGES_ORIGIN` |
| IP falsificada por el cliente | La IP se resuelve en el servidor (`req.ip` + `trust proxy`) |
| Abuso / spam | `express-rate-limit` global (30 req / 15 min por IP) |
| Inyección de texto | Sanitización (control chars) + longitud máxima por campo |
| Inyección de coordenadas | Validación de rangos lat/lon |
| GPS sin permiso | El backend descarta campos GPS salvo que `allowGps === true` |
| Body gigante | `BODY_LIMIT` (16 kb) |
| Secretos expuestos | Claves solo en `.env` (backend) + apunta a `API_URL` sin claves en el frontend |
| Datos innecesarios | El modelo `Visit.js` solo define campos mínimos |

**En el frontend:** los datos no salen del navegador hasta que el usuario pulsa **"ENVIAR RESULTADOS"** (envío explícito y visible). No se usan librerías de tracking ni almacenamiento silencioso.

---

## Preguntas frecuentes

- **¿Por qué aparece 403 al enviar desde el navegador?** Revisa `GITHUB_PAGES_ORIGIN` en el `.env`; debe ser exactamente igual a tu URL de Pages (con https, sin barra final). Si publicas en una subruta, inclúyela completa.
- **¿Por qué el GPS no pregunta permiso?** En `file://` el navegador lo bloquea. Sirve la página por HTTPS (GitHub Pages) o por `localhost`.
- **¿Es legal recopilar la IP?** La transparencia informada (aviso en pantalla) cumple la buena práctica; revisa la normativa de tu país (RGPD/LOPD en Europa) antes de desplegar con fines comerciales.

## Licencia

MIT — proyecto educativo. Los datos de ubicación por IP de terceros (ipwho.is) están sujetos a sus propios términos.