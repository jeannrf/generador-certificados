# 03 · Stack tecnológico

Criterios: gratuito, mantenido activamente, funciona en el navegador, buena calidad de salida.

| Necesidad | Elección | Motivo |
|---|---|---|
| Build y desarrollo | **Vite** | Rápido, estándar, soporta Workers y TypeScript |
| UI | **React 18+** | Ecosistema amplio, fácil de contratar y mantener |
| Lenguaje | **TypeScript (strict)** | Seguridad de tipos, mejor contexto para agentes |
| Estilos | **Tailwind CSS** | Responsive rápido y consistente; tokens de diseño |
| Estado | **Zustand** | Ligero, sin boilerplate, un store por feature |
| Validación de esquemas | **Zod** | Valida filas, configuración y proyectos guardados |
| Vista previa de PDF | **pdfjs-dist (pdf.js)** | Renderiza el PDF en canvas |
| Componer el PDF final | **pdf-lib** + **@pdf-lib/fontkit** | Edita PDFs y embebe fuentes propias (tildes, ñ) |
| Leer CSV | **PapaParse** | Detecta delimitador (`,` / `;`) y maneja comillas |
| Leer Excel | **SheetJS** (ver nota) | Soporta .xlsx y .xls |
| ZIP | **fflate** o **JSZip** | Empaquetado en el navegador (fflate es más ligero y rápido) |
| Persistencia local | **idb-keyval** (IndexedDB) | Guardar proyectos y cola de envío |
| Formularios/estado de UI | Componentes propios + **Radix UI** | Accesibilidad lista (modal, tabs, tooltip) |
| Pruebas unitarias | **Vitest** | Integrado con Vite |
| Pruebas de componentes | **Testing Library** | Pruebas orientadas al usuario |
| Pruebas e2e | **Playwright** | Flujo completo en navegadores reales |
| Calidad de código | **ESLint + Prettier + Husky + lint-staged** | Consistencia automática |
| Correo (Fase 2) | **Google Apps Script** | Gratis, cuenta propia del organizador |
| Hosting | **Cloudflare Pages** (o Netlify / GitHub Pages) | Gratis, CDN, HTTPS |

## Notas importantes

- **SheetJS**: la versión publicada en npm está desactualizada. Seguir las instrucciones oficiales de instalación (paquete desde `cdn.sheetjs.com`) y revisar su licencia. Alternativa si genera fricción: `read-excel-file` (más simple, solo lectura).
- **Fuentes**: usar TTF/OTF con licencia libre (SIL OFL), guardadas en `public/fonts/`. Incluir un set inicial de 6–8 fuentes de aspecto formal y caligráfico (p. ej. Playfair Display, Cormorant Garamond, Montserrat, Great Vibes, Lora, Poppins). Verificar la licencia de cada una.
- **pdf.js worker**: configurar `GlobalWorkerOptions.workerSrc` con el archivo local del paquete, no desde una CDN (compatible con la política CSP).
- **Versiones**: fijar versiones exactas en `package.json` y mantener `package-lock.json` en el repositorio.

## Alternativas descartadas

| Alternativa | Motivo del descarte |
|---|---|
| Backend Node propio | Costo, mantenimiento y riesgo de privacidad |
| Canvas → PNG → PDF | Pierde calidad vectorial y aumenta el peso |
| Next.js / SSR | No se necesita renderizado en servidor |
| SMTP directo desde el navegador | Imposible por seguridad del navegador |
| Firebase / Supabase | Innecesarios en Fase 1–2; podrían evaluarse en Fase 3 |
