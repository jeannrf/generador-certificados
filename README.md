# Uniautomate

Genera certificados en PDF y envía correos masivos personalizados desde tu Excel o CSV, directamente en el navegador.

**En producción:** https://uniautomate.vercel.app

## Qué hace

- **Plantillas de 1 a 5 páginas** en PDF, PNG o JPG, con salida vectorial.
- **Varios campos por página**: nombre, columnas de tu lista o texto fijo, con ~100 fuentes de Google Fonts.
- **Lista** en CSV, Excel o TXT, con validación y corrección antes de generar.
- **Un PDF por persona**: descarga en ZIP, guardado en tu Google Drive con un **QR único** que abre cada certificado, o envío por correo.
- **Correos masivos** sin certificado, con variables como `{nombre}`.

## Desarrollo

Requisitos: Node.js 20 o superior.

```bash
npm install
cp .env.example .env.local   # completa las variables
npm run dev                  # http://localhost:5173
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Revisa tipos y compila para producción |
| `npm run test:run` | Pruebas unitarias (Vitest) |
| `npm run test:e2e` | Pruebas de punta a punta (Playwright, puerto 5174) |

### Variables de entorno

| Variable | Para qué | ¿Secreta? |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Guardar en Google Drive (ID de cliente OAuth) | No |
| `GMAIL_USER` | Cuenta que envía los correos | Sí |
| `GMAIL_APP_PASSWORD` | Contraseña de aplicación de esa cuenta | Sí |

Cómo obtener el ID de cliente de Google: [docs/12-google-drive-y-qr.md](docs/12-google-drive-y-qr.md).

## Estructura

```
api/          función de Vercel que envía los correos
docs/         documentación del proyecto (empieza por docs/README.md)
public/       archivos estáticos (política de privacidad)
src/          aplicación React (domain, features, infra, ui)
tests/        Vitest, Playwright y archivos de prueba
.claude/      skill de diseño "impeccable" para agentes de IA
```

## Privacidad

Las plantillas y listas se procesan en tu navegador. Ver la [política de privacidad](https://uniautomate.vercel.app/privacidad.html).
