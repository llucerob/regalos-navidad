# Regalos de Navidad · Ilustre Municipalidad de Coinco

Sistema de inscripción (en línea y presencial) a la entrega de Regalos de Navidad para madres en gestación,
niñas y niños de la comuna, con revisión manual de la cartola del Registro Social de Hogares, avisos por correo
y exportación del conglomerado de inscritos.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres, Auth, Storage, RLS) · Nodemailer (Gmail SMTP).

---

## 1. Puesta en marcha

### 1.1 Supabase
1. Cree un proyecto en Supabase.
2. En **SQL Editor** pegue y ejecute, en este orden: `supabase/migrations/0001_init.sql` y luego `supabase/seed.sql`
   (ajuste antes las fechas del seed y los sectores; los sectores también se editan desde el panel).
3. En **Project Settings → API** copie la URL, la clave `anon` y la clave `service_role`.

### 1.2 Variables de entorno
```bash
cp .env.example .env.local     # y complete los valores
```
La clave `SUPABASE_SERVICE_ROLE_KEY` es **solo de servidor**: nunca la exponga en el navegador ni la suba a un repositorio.

### 1.3 Primer administrador
```bash
npm install
node --env-file=.env.local scripts/crear-admin.mjs correo@municoinco.cl "Contraseña-larga-123" "Nombre Apellido"
```
Luego el resto de los funcionarios se crean desde el panel: **Usuarios**.

### 1.4 Ejecutar
```bash
npm run dev        # desarrollo  → http://localhost:3000
npm run build && npm start
npm test           # pruebas (RUT, edad, reglas de inscripción)
npm run typecheck
```

---

## 2. Correo desde Google Workspace (contraseña de aplicación)

1. Cree una cuenta dedicada, por ejemplo `inscripciones@municoinco.cl`.
2. Active la **verificación en dos pasos** en esa cuenta (sin ella Google no permite contraseñas de aplicación).
3. Verifique en la consola de administración que las contraseñas de aplicación estén permitidas para la organización.
4. En la cuenta: *Seguridad → Contraseñas de aplicaciones* → genere una (16 caracteres).
5. Complete `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_FROM_NAME` y `MAIL_REPLY_TO`.
6. En el panel, **Correos → Enviar prueba** confirma que el envío funciona.

Recomendado: pedir a quien administre el dominio que SPF y DKIM estén activos en `municoinco.cl` para evitar el spam.
El sistema envía por SMTP (`smtp.gmail.com:465`), registra cada envío en `correos_log` y reintenta hasta 3 veces.

**Envío masivo (aviso de entrega):** el panel deja los correos en cola y se envían en tandas con “Procesar pendientes”.
Para automatizarlo, llame periódicamente a:
```
GET https://<su-dominio>/api/correos/procesar
Authorization: Bearer <CRON_SECRET>
```
(por ejemplo con Vercel Cron o cualquier cron externo).

---

## 3. Cómo funciona

| Parte | Descripción |
|---|---|
| `/` | Portada con requisitos, fechas y estado de la campaña. |
| `/inscripcion` | Formulario en 4 pasos. Los documentos (fotos/PDF, máx. 5 MB) se suben **directo a Storage** con URL firmada; el celular comprime las fotos. |
| `/consulta` | Consulta por **folio + RUT** del adulto responsable. Si la inscripción está *observada*, permite subir los documentos faltantes. |
| `/admin` | Panel de funcionarios: resumen, bandeja con filtros, revisión con checklist, registro presencial, entrega, exportación, correos, campañas, sectores y usuarios. |

**Roles:** *Administrador* (todo, incluida la exportación) · *Revisor* (revisa/aprueba y registra presenciales) · *Digitador* (solo registra presenciales y consulta).

**Estados:** Recibida → En revisión → Observada / Aprobada / Rechazada. Para aprobar deben marcarse los 4 puntos de verificación
(residencia, tramo 40 %, identidad, edad). Observar y rechazar exigen un mensaje, que se envía por correo al apoderado.

### Reglas implementadas (de las bases)
- Beneficiarios: madres en gestación (cédula + carnet de control de embarazo) y niñas/niños hasta **4 años, 11 meses y 30 días**
  (cédula o certificado de nacimiento + carnet de control sano).
- Residencia: cartola RSH o certificado de la Junta de Vecinos. **La cartola se pide siempre** porque con ella el funcionario verifica el tramo del 40 %
  (si acredita con certificado, se piden ambos). Se puede relajar en `src/lib/documentos.ts`.
- La edad se mide a la **fecha de referencia de edad** de la campaña (recomendado: día de la entrega). Se configura en *Campañas*.
- Inscripciones solo dentro de las fechas de la campaña (en línea y presencial). Un administrador puede extender el cierre.
- Un mismo RUT no puede inscribirse dos veces en la campaña; si la inscripción anterior fue **rechazada**, puede volver a inscribirse.

### Exportación (solo administrador)
*Exportar* genera un Excel con 4 hojas: **Inscritos** (una fila por beneficiario), **Resumen compra** (edad × sexo y gestantes),
**Por sector** y **Lista de entrega** (con columna de firma). También hay CSV. Por defecto solo incluye las aprobadas.

---

## 4. Seguridad y datos personales
- El público **no accede a la base de datos directamente**: todo pasa por el servidor. RLS está activo en todas las tablas y solo permite lectura a funcionarios autenticados.
- Bucket `documentos` **privado**; los funcionarios ven los archivos con URL firmada de 15 minutos.
- Límite de velocidad por IP (hasheada) en inscripciones, cargas, consultas y correcciones; campo trampa (honeypot) anti-bots.
- Consentimiento explícito en el formulario y cabeceras de seguridad HTTP.
- Datos de menores y socioeconómicos: defina el plazo de conservación y elimine los datos y documentos de campañas cerradas cuando corresponda
  (Ley 19.628 y nueva ley de protección de datos personales).
- Las cargas que un usuario abandona quedan en `cargas/` sin inscripción asociada: conviene una limpieza periódica de archivos huérfanos.

## 5. Despliegue
Funciona en Vercel (defina las variables de entorno del `.env.example`) o en cualquier Node 20+ (`npm run build && npm start`).
Configure `NEXT_PUBLIC_SITE_URL` con el dominio final: se usa en los enlaces y el logo de los correos.

## 6. Identidad visual
Colores oficiales en `src/app/globals.css` (`#003169`, `#00ceff`, `#ffba2f`, `#00a87a`, `#ff4153`). Logos en `public/`. Modo oscuro deshabilitado a propósito.

## 7. Pendientes / ideas
- Probado con pruebas automáticas y con una base simulada; **falta una prueba de punta a punta contra su proyecto real de Supabase y su cuenta de Gmail**.
- Edición de beneficiarios desde el panel (hoy solo se edita el adulto responsable; si hay un error en un RUT de beneficiario, rechace y reinscriba).
- Cloudflare Turnstile en el formulario público si aparece spam.
- Recordatorio automático a inscripciones *observadas* antes del cierre.
