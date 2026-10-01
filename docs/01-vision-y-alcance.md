# 01 · Visión y alcance

## Problema

Emitir certificados para eventos, cursos o talleres es repetitivo: se edita una plantilla decenas o cientos de veces, se exporta cada PDF y se envía uno por uno por correo. Es lento y propenso a errores.

## Solución

Una web donde el usuario:

1. Sube una plantilla ya diseñada (Canva, PowerPoint, etc.) con firmas, textos y logos.
2. Marca el área donde se escribirá el nombre.
3. Sube una lista de destinatarios (nombre y correo).
4. Genera todos los certificados y los descarga o los envía por correo automáticamente.

## Usuarios objetivo

- Organizadores de eventos, docentes, coordinadores académicos y ONGs.
- Perfil no técnico. Debe ser usable sin capacitación.

## Objetivos

- **Costo operativo cero** (hosting estático gratuito, sin base de datos).
- **Privacidad por diseño**: los datos del usuario no se suben a ningún servidor propio.
- **Calidad profesional**: salida en PDF nítida, tipografías correctas con tildes y ñ.
- **Fiabilidad**: validación previa, reporte final, reintentos.

## Fuera de alcance (por ahora)

- Cuentas de usuario, login y pagos.
- Editor visual completo de plantillas (el diseño se hace en Canva u otra herramienta).
- Base de datos centralizada.

## Requisitos funcionales (RF)

| ID | Requisito | Fase |
|---|---|---|
| RF-01 | Subir plantilla en PDF, PNG o JPG | 1 |
| RF-02 | Marcar con el ratón el área del nombre sobre la vista previa | 1 |
| RF-03 | Configurar fuente, tamaño máximo, color, alineación y transformación de mayúsculas | 1 |
| RF-04 | Reducir automáticamente el tamaño de letra para nombres largos | 1 |
| RF-05 | Subir lista en CSV, XLSX o TXT | 1 |
| RF-06 | Mapear columnas (nombre, correo) automáticamente, con ajuste manual | 1 |
| RF-07 | Validar filas: vacías, duplicadas, correos inválidos | 1 |
| RF-08 | Vista previa con el primer nombre y con el más largo | 1 |
| RF-09 | Generar todos los PDFs y descargarlos en un ZIP | 1 |
| RF-10 | Plantilla de correo editable con variables (`{nombre}`) | 2 |
| RF-11 | Conectar con Google Apps Script mediante URL y token | 2 |
| RF-12 | Envío de prueba antes del envío masivo | 2 |
| RF-13 | Envío por lotes con progreso, pausas, reintentos y control de cuota | 2 |
| RF-14 | Reporte descargable (enviado / falló / pendiente) | 2 |
| RF-15 | Campos adicionales (curso, fecha, ID) | 3 |
| RF-16 | Código QR / ID único y página de verificación | 3 |
| RF-17 | Guardar y cargar proyectos (plantilla + configuración) | 3 |
| RF-18 | Proveedores de correo alternativos | 3 |

## Requisitos no funcionales (RNF)

- **Rendimiento**: 500 certificados en menos de 60 s en un equipo de gama media, sin congelar la interfaz (Web Workers).
- **Responsive**: usable desde 360 px de ancho hasta escritorio.
- **Accesibilidad**: WCAG 2.1 AA como meta (teclado, contraste, etiquetas).
- **Compatibilidad**: últimas 2 versiones de Chrome, Edge, Firefox y Safari.
- **Idioma**: interfaz en español; estructura preparada para i18n.
- **Mantenibilidad**: TypeScript estricto, módulos desacoplados, pruebas automatizadas.

## Criterios de éxito

- Un usuario nuevo genera sus certificados en menos de 5 minutos.
- La salida es visualmente idéntica a la plantilla, solo con el nombre añadido.
- Cero datos personales enviados a servidores propios.
