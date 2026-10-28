# 03 · Stack tecnológico

Criterios: gratuito, mantenido activamente, funciona en el navegador, buena calidad de salida. Las versiones exactas están en `package.json`.

| Necesidad | Elección | Motivo |
|---|---|---|
| Build y desarrollo | **Vite** | Rápido y estándar; separa en chunks las librerías pesadas |
| UI | **React 19** | Ecosistema amplio |
| Lenguaje | **TypeScript (strict)** | Seguridad de tipos, mejor contexto para agentes |
| Estilos | **Tailwind CSS 3** + `clsx` + `tailwind-merge` | Responsive rápido y consistente |
| Iconos | **lucide-react** | Ligeros y consistentes |
| Vista previa de PDF | **pdfjs-dist (pdf.js)** | Renderiza páginas PDF en canvas |
| Componer el PDF final | **pdf-lib** + **@pdf-lib/fontkit** | Salida vectorial y fuentes reales con subconjunto de glifos |
| Fuentes | **Google Fonts** (vista previa) y **Fontsource vía jsDelivr** (TTF para el PDF) | ~100 fuentes sin alojarlas en el repo |
| Código QR | **qrcode** (solo la matriz) | El QR se dibuja como vector con pdf-lib |
| Leer CSV | **PapaParse** | Detecta delimitador y maneja comillas |
| Leer Excel | **SheetJS (`xlsx`)** | Soporta .xlsx y .xls |
| ZIP | **fflate** | Ligero y rápido |
| Persistencia local | **localStorage** | Sesión, campañas de correo y progreso de Drive |
| Google Drive | **Google Identity Services** + API REST de Drive v3 | Sin SDK; permiso `drive.file` |
| Correo | **Función de Vercel** + **nodemailer** con Gmail | Ver ADR-011 |
| Pruebas | **Vitest** (unitarias) y **Playwright** (E2E) | Integrados con Vite / navegador real |
| Hosting | **Vercel** | Sitio estático + función de correo, vista previa por PR |
| CI | **GitHub Actions** | Tipos, tests, build y E2E en cada PR |

## Notas

- **SheetJS**: la versión de npm (`0.18.5`) es la última publicada ahí; las nuevas se distribuyen desde `cdn.sheetjs.com`. Revisar si se necesita una corrección de seguridad.
- **pdf.js worker**: se carga desde el propio paquete, no desde una CDN.
- **fontkit** se carga bajo demanda (chunk aparte) para no pesar en la primera visita.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Canvas → PNG → PDF | Pierde calidad vectorial y aumenta el peso |
| Next.js / SSR | No se necesita renderizado en servidor |
| Google Apps Script por organizador | Configuración difícil para usuarios no técnicos; reemplazado por la función de Vercel (ADR-011) |
| Zustand, Zod, Web Workers, IndexedDB | Previstos en el diseño inicial; no hicieron falta con el volumen actual |
| Firebase | Para la fase de backend se prefirió Supabase (Postgres, SQL, sin dependencia de un solo proveedor) |
