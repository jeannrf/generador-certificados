# 09 · Testing, calidad y despliegue

## Pirámide de pruebas

| Nivel | Herramienta | Qué cubre | Meta |
|---|---|---|---|
| Unitarias | Vitest | Dominio, composición de PDF (incluida la comparación con el compositor antiguo), fuentes, Drive, QR, deshacer | Todo cambio de dominio con su prueba |
| E2E | Playwright | Flujo completo, multipágina, fuentes, atajos del editor, columnas y Drive con Google simulado | Flujos principales en verde |
| Rendimiento | Vitest | 300 certificados de 3 páginas sin reconstruir la plantilla | Dentro del test de `pdfComposer` |

## Casos de prueba imprescindibles

- Nombres con tildes, ñ, diéresis, apóstrofes, guiones y muy largos (≥ 60 caracteres).
- CSV con `;`, con BOM, con comillas y saltos de línea dentro de campos.
- Excel con varias hojas, celdas vacías y filas finales en blanco.
- TXT con saltos de línea Windows (`\r\n`) y líneas vacías.
- Duplicados por correo y por nombre.
- Plantilla PDF vectorial, PNG grande, JPG con orientación EXIF.
- Cancelar la generación a la mitad.
- Envío de correos: cupo agotado, fallo de red, reanudación, no reenviar a quien ya está `enviado`.
- Drive: sesión vencida a mitad, otra cuenta de Google, reintento sin duplicar.

## Integración continua (GitHub Actions)

`.github/workflows/ci.yml` corre en cada PR a `main` y en cada push a `main`:

1. `npm ci`
2. `tsc --noEmit`
3. `npm run test:run` (Vitest)
4. `npm run build`
5. `npm run test:e2e` (Playwright, Chromium)

Los E2E levantan Vite en el puerto 5174 con un `VITE_GOOGLE_CLIENT_ID` falso y simulan Google por completo (inicio de sesión, Drive). La fusión a `main` exige el CI en verde.

## Despliegue

- **Hosting**: Vercel. Producción desde `main` en `https://uniautomate.vercel.app`; vista previa automática por PR.
- **Variables de entorno** (Vercel → Settings → Environment Variables):
  - `VITE_GOOGLE_CLIENT_ID` (tipo *Config*, todos los entornos): ID de cliente OAuth, público.
  - `GMAIL_USER` y `GMAIL_APP_PASSWORD` (tipo *Secret*): cuenta que envía los correos.
- Las variables `VITE_*` se incrustan al compilar: tras cambiarlas hay que volver a desplegar.
- En local: copiar `.env.example` a `.env.local`.

## Observabilidad (sin comprometer privacidad)

- Sin telemetría por defecto. Si se activa, solo eventos agregados anónimos (p. ej. "generación completada", cantidad en rangos).
- Los logs de error en consola nunca incluyen nombres ni correos.

## Checklist de lanzamiento

- [ ] Todas las pruebas y CI en verde
- [ ] Probado en Chrome, Edge, Firefox y Safari (escritorio y móvil)
- [ ] Probado con 500 y con 5.000 filas
- [ ] Aviso de privacidad visible
- [ ] Límites de servicios externos reconfirmados en su documentación oficial
- [ ] README del repositorio y esta carpeta `docs/` actualizados
