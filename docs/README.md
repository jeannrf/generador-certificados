# Documentación

Contexto oficial del proyecto para el equipo y para agentes de IA. Si vas a escribir código, empieza por la [guía para agentes](11-guia-para-agentes.md).

## Resumen en una frase

Aplicación web en la que el organizador sube una plantilla de certificado (1 a 5 páginas, PDF o imagen), ubica los campos, sube una lista (CSV/Excel/TXT) y obtiene un PDF por persona: en un ZIP, en su Google Drive con un QR único y/o enviado por correo.

## Índice

| # | Archivo | Contenido |
|---|---|---|
| 01 | [vision-y-alcance.md](01-vision-y-alcance.md) | Problema, usuarios, requisitos funcionales y no funcionales |
| 02 | [arquitectura.md](02-arquitectura.md) | Capas, estructura de carpetas, flujo de datos |
| 03 | [stack-tecnologico.md](03-stack-tecnologico.md) | Tecnologías usadas y por qué |
| 04 | [historial-y-roadmap.md](04-historial-y-roadmap.md) | Qué se construyó en cada fase y qué falta |
| 05 | [modelo-de-datos-y-formatos.md](05-modelo-de-datos-y-formatos.md) | Tipos, páginas, campos, fuentes, coordenadas, formatos de lista |
| 06 | [ux-ui-y-responsive.md](06-ux-ui-y-responsive.md) | Flujo de pantallas, responsive, accesibilidad |
| 07 | [buenas-practicas-y-patrones.md](07-buenas-practicas-y-patrones.md) | Patrones y convenciones de código |
| 08 | [seguridad-y-privacidad.md](08-seguridad-y-privacidad.md) | Datos tratados, secretos, riesgos |
| 09 | [testing-calidad-y-despliegue.md](09-testing-calidad-y-despliegue.md) | Pruebas, CI, Vercel y variables de entorno |
| 10 | [decisiones-adr.md](10-decisiones-adr.md) | Registro de decisiones técnicas |
| 11 | [guia-para-agentes.md](11-guia-para-agentes.md) | Reglas de trabajo y skill de diseño `impeccable` |
| 12 | [google-drive-y-qr.md](12-google-drive-y-qr.md) | QR por certificado, Drive del organizador y configuración de Google Cloud |

## Decisiones ya tomadas (no reabrir sin motivo)

1. **Todo en el navegador**, salvo el envío de correos: una función de Vercel con Gmail (ADR-001, ADR-011).
2. **Salida vectorial**: las páginas PDF se incrustan sin rasterizar; las imágenes, sin recomprimir (ADR-002, ADR-009).
3. **Drive del organizador** para alojar los PDFs del QR, con permiso `drive.file` (ADR-010).
4. **Stack**: Vite + React + TypeScript + Tailwind, desplegado en Vercel.
5. **Backend con cuentas**: será Supabase, en una fase posterior (doc 04).

> Los límites de servicios externos citados aquí se verificaron en 2026 y pueden cambiar. Reconfirmarlos en la documentación oficial.
