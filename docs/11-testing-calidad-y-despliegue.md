# 11 · Testing, calidad y despliegue

## Pirámide de pruebas

| Nivel | Herramienta | Qué cubre | Meta |
|---|---|---|---|
| Unitarias | Vitest | Dominio: normalización, validación, layout/coordenadas, autoajuste, cola de envío, parsers | ≥ 80 % cobertura en `domain` e `infra/parsers` |
| Integración | Vitest + Testing Library | Features con adaptadores reales (parsear archivo → tabla → validar) | Flujos principales por feature |
| E2E | Playwright | Flujo completo: plantilla → lista → ZIP; Fase 2 con script simulado (mock) | 1 flujo feliz + 3 de error |
| Visual | Comparación de PDF a imagen | El nombre cae dentro de la caja y no se corta | Plantillas de referencia |
| Accesibilidad | `axe` (vía Playwright) | Reglas críticas WCAG | 0 violaciones críticas |
| Rendimiento | Script de carga | 500 certificados en < 60 s | Umbral en CI de referencia |

## Casos de prueba imprescindibles

- Nombres con tildes, ñ, diéresis, apóstrofes, guiones y muy largos (≥ 60 caracteres).
- CSV con `;`, con BOM, con comillas y saltos de línea dentro de campos.
- Excel con varias hojas, celdas vacías y filas finales en blanco.
- TXT con saltos de línea Windows (`\r\n`) y líneas vacías.
- Duplicados por correo y por nombre.
- Plantilla PDF vectorial, PNG grande, JPG con orientación EXIF.
- Cancelar la generación a la mitad.
- Cola de envío: cuota agotada, token inválido, fallo de red, reanudación, no reenviar `enviado`.

## Integración continua (GitHub Actions, gratuito)

Pipeline en cada PR:

1. `npm ci`
2. `lint` y `typecheck`
3. `test` (unitarias + integración) con cobertura
4. `build`
5. `e2e` (Playwright)
6. `npm audit --audit-level=high`

La fusión a `main` exige todos los pasos en verde.

## Despliegue

- **Hosting**: Cloudflare Pages (primera opción) o Netlify / GitHub Pages. Los tres tienen plan gratuito suficiente para un sitio estático; verificar condiciones vigentes al elegir.
- **Entornos**: `preview` automático por PR y `producción` desde `main`.
- **Cabeceras de seguridad** definidas en `public/_headers` (Cloudflare/Netlify).
- **Versionado**: SemVer, `CHANGELOG.md` generado desde Conventional Commits.
- **Dominio propio**: opcional; la URL gratuita del hosting es suficiente para empezar.

## Observabilidad (sin comprometer privacidad)

- Sin telemetría por defecto. Si se activa, solo eventos agregados anónimos (p. ej. "generación completada", cantidad en rangos).
- Los logs de error en consola nunca incluyen nombres ni correos.

## Checklist de lanzamiento

- [ ] Todas las pruebas y CI en verde
- [ ] Probado en Chrome, Edge, Firefox y Safari (escritorio y móvil)
- [ ] Probado con 500 y con 5.000 filas
- [ ] CSP y cabeceras verificadas
- [ ] Aviso de privacidad visible
- [ ] Guía de configuración del correo revisada con un usuario no técnico
- [ ] Límites de servicios externos reconfirmados en su documentación oficial
- [ ] README del repositorio y esta carpeta `docs/` actualizados
