# 12 · Google Drive y código QR

Cada certificado puede llevar un **QR único** que abre su PDF guardado en el **Google Drive del organizador**. No hay backend: el navegador sube los archivos directamente con la cuenta de Google del organizador (ver ADR-010).

## Cómo funciona

1. En el Paso 2 se agrega un campo **QR** (contenido por defecto: "PDF en Drive"). También puede codificar una columna de la lista o un texto fijo.
2. En el Paso 5, con "Guardar en mi Google Drive" activado, el organizador pulsa **Conectar con Google**, elige su cuenta en la ventana de Google y la app muestra "Conectado como …" (`about.get`); "Cambiar cuenta" vuelve a abrir el selector. Al pulsar **Comenzar Generación**:
   - se crea la carpeta en el Drive de esa cuenta, con "cualquier persona con el enlace puede ver";
   - se **reservan los IDs** de todos los archivos (`files.generateIds`), así el QR de cada PDF ya apunta a su URL definitiva;
   - cada PDF se genera con su QR y se sube con su ID reservado (3 subidas en paralelo).
3. Los correos pueden incluir `{enlace}` con la URL del PDF de cada persona.

### Robustez

- El progreso se guarda en el navegador tras cada archivo. Si se recarga la página, la subida **se reanuda en la misma carpeta** con los mismos IDs.
- Subir de nuevo un ID que ya existe devuelve `409` y se cuenta como subido: **nunca se duplican certificados**.
- Errores temporales y límites de uso de Google se reintentan con espera exponencial.
- Si la sesión de Google vence a mitad, aparece **"Reconectar y continuar"** y se sube solo lo que falta.

## Permisos

Se pide únicamente `https://www.googleapis.com/auth/drive.file`: la app **solo puede ver y modificar los archivos que ella misma crea**, no el resto del Drive. Google clasifica este permiso como **no sensible** (solo requiere la verificación básica de la app).

## Configuración (una sola vez, la hace el dueño de la app)

1. Entra a [Google Cloud Console](https://console.cloud.google.com/) y crea un proyecto (por ejemplo, "Uniautomate").
2. En **APIs y servicios → Biblioteca**, habilita **Google Drive API**.
3. Configura la **pantalla de consentimiento de OAuth** (tipo *Externo*): nombre de la app, correo de soporte y el permiso `drive.file`. Mientras esté en modo *Prueba*, solo podrán iniciar sesión los usuarios de prueba que agregues en **Público → Usuarios de prueba** (si no, Google muestra "Acceso bloqueado … Error 403: access_denied"). Para abrirla a todos, pulsa **Publicar app**: como `drive.file` no es un permiso sensible, no hace falta la revisión de Google.
4. En **Credenciales → Crear credenciales → ID de cliente de OAuth**, elige **Aplicación web** y agrega en *Orígenes de JavaScript autorizados*:
   - `http://localhost:5173` (desarrollo)
   - la URL de producción en Vercel: `https://uniautomate.vercel.app` (antes `unicertified.vercel.app`, que ahora redirige a la nueva)
5. Copia el **ID de cliente** y guárdalo como `VITE_GOOGLE_CLIENT_ID`:
   - en local, en `.env.local`;
   - en Vercel, en *Settings → Environment Variables*, y vuelve a desplegar.

No se necesita "secreto de cliente": el flujo de token del navegador no lo usa.

## Privacidad

- Los PDFs quedan en el Drive del organizador; la app no guarda copias.
- Cualquiera con el enlace (o el QR) puede ver el certificado. Los IDs de Drive no se pueden adivinar.
- La carpeta es de solo lectura: nadie más puede modificar ni agregar archivos en ella.
- Aun así, el QR no es una verificación fuerte de autenticidad: un falsificador podría copiar el diseño, subir un PDF falso a **su propio** Drive y ponerle un QR que apunte ahí. Quien escanea solo ve "un PDF en Drive". La protección real es que el QR apunte a una página de verificación en un dominio de la app (fase con backend).
