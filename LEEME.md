# Study World UNAC 2026 — app con cuenta, avatar y avisos de clase

Qué incluye:
- Horario, apuntes y tutor (como antes).
- **Cuenta + sincronización** (correo y contraseña) entre celular y PC.
- **Avatar** personalizable (gatita kawaii con lazo, colores, ojitos, accesorios).
- **Avisos de clase** programados por el teléfono: suenan **antes** de cada clase (por defecto 15 min; el mínimo permitido es 10), aparecen en la **pantalla de bloqueo** con el teléfono apagado de pantalla/bloqueado y como banner cuando está en uso. Funcionan aunque la app esté cerrada, sin internet, y se reprograman solos si reinicias el teléfono.

> Los avisos con la app cerrada solo son posibles en la **app instalada (APK de Android)**. En el navegador o como PWA el sistema no permite programarlos: ahí suenan solo mientras la app está abierta.

---

## Parte 1 — Generar la app de Android (APK) sin instalar nada en tu PC

La app se construye sola en la nube de GitHub (gratis).

1. Crea una cuenta en https://github.com y un repositorio nuevo (botón **New**), por ejemplo `study-world`.
2. En el repositorio: **Add file → Upload files** y arrastra **todo el contenido** de esta carpeta (incluida la carpeta oculta `.github`).
   - Si tu computadora no deja arrastrar `.github` (Mac la oculta), crea el archivo a mano: **Add file → Create new file**, escribe el nombre `.github/workflows/build.yml` y pega el contenido de `workflow-build.yml` (viene en esta carpeta).
3. Ve a la pestaña **Actions**. Si pide habilitar, acepta. Entra a **Construir app (APK + web)** → **Run workflow**.
4. Espera unos 8–12 minutos. Al terminar (check verde), abre esa ejecución y baja a **Artifacts**: descarga **study-world-apk**. Dentro está `app-debug.apk`.
5. Pasa el APK a tu celular (WhatsApp, Drive, cable) y ábrelo. Android pedirá permitir “instalar apps desconocidas”: acepta.
6. Al abrir la app te pedirá permiso de **notificaciones**: acepta. Luego ve a **Avisos & Temas** y toca **Probar aviso (10 s)**; bloquea la pantalla y comprueba que te llega.

Si el paso 4 sale en rojo, abre el paso que falló en Actions y mándame el texto del error: es el primer build y puede necesitar un ajuste.

## Parte 2 — Activar cuentas y sincronización (Firebase, gratis)

Sin esto la app funciona, pero guarda solo en cada dispositivo.

1. Entra a https://console.firebase.google.com → **Agregar proyecto** → ponle nombre → desactiva Google Analytics → **Crear**.
2. **Compilación → Authentication → Comenzar → Correo electrónico/contraseña → Habilitar → Guardar**.
3. **Compilación → Firestore Database → Crear base de datos** → elige una ubicación → modo **producción** → Habilitar.
4. En Firestore, pestaña **Reglas**, borra lo que hay, pega esto y toca **Publicar**:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
   (Cada persona solo puede leer y escribir su propio documento.)
5. Engranaje ⚙️ → **Configuración del proyecto → Tus apps → ícono web `</>`** → registra la app → copia el bloque `firebaseConfig`.
6. En GitHub abre `src/firebase-config.js` (lápiz ✏️), pega tus valores y guarda (**Commit**). Eso vuelve a construir la app: descarga el APK nuevo.
   - Estos datos no son secretos; la seguridad la dan las reglas del paso 4.

Cómo funciona la sincronización: se guardan horario, apuntes de texto, avatar, tema y ajustes de avisos. Si cambias algo en dos dispositivos, gana el cambio más reciente. Las **fotos y audios** de los apuntes se quedan en el dispositivo donde los adjuntaste.

## Parte 3 — Versión web (opcional)

El mismo flujo publica la web en GitHub Pages (**Settings → Pages → Source: GitHub Actions**). Si usas cuentas ahí, agrega tu dirección `tuusuario.github.io` en Firebase → Authentication → Settings → Authorized domains.

## Para que los avisos lleguen siempre (importante en algunos teléfonos)

- Permite **Notificaciones** y, si Android lo pide, **Alarmas y recordatorios** (la app te muestra un botón en *Avisos & Temas*).
- Xiaomi/Redmi/POCO, Huawei, Oppo, Vivo, Samsung: en Ajustes → Apps → Study World → Batería, elige **Sin restricciones** y activa **Inicio automático**. Estas marcas matan procesos en segundo plano si no.
- No actives “No molestar” durante las clases, o silenciará el aviso.

## iPhone

Para iPhone hay que compilar en una Mac con cuenta de Apple Developer (no se puede desde GitHub gratis). Mientras tanto, la versión web instalada desde Safari funciona, pero no puede avisar con la app cerrada.

## Cambiar la hora real de una clase

En el horario toca la clase y, en “Profesor / Detalle”, escribe la hora entre paréntesis, p. ej. `Intensivo UNAC (18:00)`. Esa hora se usa para el panel en vivo y para el aviso.

## Para desarrolladores

```
npm install
npm test            # pruebas de horarios, avisos y avatar
npm run build       # genera www/
npx cap add android && bash scripts/android-setup.sh && npx cap sync android
cd android && ./gradlew assembleDebug
```
Requiere Node 22 y JDK 21.
