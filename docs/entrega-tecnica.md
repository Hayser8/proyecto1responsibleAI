# Entrega técnica — Directorio de especialistas médicos

Documento ejecutivo diseñado para una extensión aproximada máxima de cinco páginas. Fecha de corte: 2026-08-11.

## 1. Problema, alcance y arquitectura

El proyecto `proyecto1responsibleai` construye un directorio académico de especialistas de Ciudad de Guatemala. La primera matriz cubre Pediatría, Cardiología y Dermatología en zonas 1, 9 y 10. El objetivo técnico es recolectar hasta 20 resultados por invocación, persistirlos sin duplicados y consultarlos por filtros con paginación. El directorio no valida credenciales médicas.

La solución TypeScript/Node.js 22 separa dos Firebase Functions v2 en `us-central1`: `recolectarMedicos` aplica una whitelist IP, valida una solicitud, consume Places mediante una key secreta y escribe; `directorio` solo filtra y lee. Firebase Hosting sirve la UI y reescribe `/directorio` a la Function. Firestore identifica cada documento como `medicos/{place_id}`. Esta separación evita que una consulta de lectura active consumo externo.

La arquitectura completa está en [arquitectura.md](./arquitectura.md). Fue validada localmente con emuladores; en cloud se prepararon APIs, Firestore, cuota y secreto, pero no existe URL de producción verificada ni se afirma un despliegue de Functions o Hosting.

## 2. Infraestructura, billing y seguridad

La facturación de `proyecto1responsibleai` está habilitada. La evidencia del 2026-08-02 confirma crédito promocional activo de USD 300, restante USD 300 y vencimiento 2026-10-16. Existe un presupuesto mensual de USD 270 para la cuenta de facturación completa, con alertas 25 %, 50 % y 90 %; las alertas notifican, pero no detienen gasto.

| Control | Estado |
|---|---|
| Proyecto y billing vinculados | VERIFICADO |
| Crédito USD 300 hasta 2026-10-16 | VERIFICADO |
| Presupuesto USD 270; alertas 25/50/90 | VERIFICADO |
| APIs necesarias, incluida API Keys API | VERIFICADAS/HABILITADAS |
| Cuota Places `SearchTextRequest` | VERIFICADA: override diario efectivo 100 (default anterior 75,000) |
| Key dedicada restringida a Places API (New) | VERIFICADA: target solo `places.googleapis.com` |
| Secret Manager cloud | VERIFICADO: `GOOGLE_PLACES_API_KEY` latest=v2 ENABLED |
| Firestore `(default)` | VERIFICADO: Native Standard, `us-central1`, delete protection |
| Whitelist de `recolectarMedicos` | IMPLEMENTADA; `IP_WHITELIST` v1 ENABLED; despliegue pendiente |
| Functions/Hosting desplegados | **PENDIENTE** |
| URLs de producción | **PENDIENTE** |

La key y el arreglo JSON `IP_WHITELIST` se vinculan solo a `recolectarMedicos` al desplegar. `latest` de la key corresponde a la versión 2 ENABLED y a una key dedicada del proyecto número `487068590350`; la versión anterior pertenecía a otro proyecto y no fue eliminada. Firestore niega acceso directo de clientes; las Functions accederán por Admin SDK/IAM. La whitelist es un control de entrada al endpoint de recolección y rechaza con 403 antes de negocio, Places o Firestore. Su diseño académico confía en la primera IP de la cadena suministrada por el ingreso administrado y no debe describirse como inmune a suplantación hasta probar las URLs directas y de Hosting desplegadas; producción debe considerar Cloud Armor o un proxy controlado que reescriba un header confiable. La restricción de key es otro control: limita la credencial a Places; una restricción por IP de egress exigiría salida estática no configurada. Ninguno sustituye al otro. La gestión segura de la lista está en [ip-whitelist.md](./ip-whitelist.md).

## 3. Recolección, modelo y keywords

La solicitud contiene `keyword`, `zona` y `especialidad` explícitas. La validación ocurre antes de red o base de datos. El cliente Places usa un máximo de 20 y un field mask para nombre, dirección, teléfono y sitio web. Los resultados se normalizan sin inventar valores: faltantes quedan vacíos y sitios de redes sociales no se agregan. Cada escritura usa merge en el documento cuyo ID es `place_id`; la respuesta separa encontrados, creados y actualizados.

Campos: `nombre`, `especialidad`, `direccion`, `telefono`, `sitio_web`, `zona`, `place_id`, `fecha_recoleccion` y `keyword_usado`. Un sitio puede representar una clínica. La fecha y keyword permiten explicar procedencia y antigüedad.

La matriz exacta está en [keywords.md](./keywords.md). No se completa una matriz de cobertura con fixtures; cada resultado real debe registrar su keyword, fecha y conteos de forma trazable.

## 4. API, UI y evidencia de pruebas

`GET /directorio` admite `page` ≥ 1, `pageSize` de 1 a 50, y filtros exactos opcionales `especialidad` y `zona`. Responde datos, metadatos de paginación y filtros efectivos. Firestore ordena por `nombre` y `place_id`. La paginación numérica satisface el alcance pequeño; una versión a escala debe usar cursores.

La UI ofrece comboboxes nativos, búsqueda, estado de carga/error/vacío, tabla de siete columnas, fechas y botones Anterior/Siguiente. También incluye un apartado de recolección: envía `POST /recolectarMedicos` con keyword, especialidad y zona; después consulta `GET /directorio` para mostrar los datos guardados. Inserta datos remotos como texto y muestra el aviso académico.

La verificación automatizada final ejecutó `npm test` y `npm run build`: Functions registró 99 pruebas aprobadas y 1 integración omitida sin emulador; Web registró 27 aprobadas; ambos builds terminaron correctamente.

- Functions: pruebas unitarias y de integración local con Firestore Emulator.
- Web: pruebas de interfaz y build de Vite.
- Chromium real, Firebase Hosting/Functions/Firestore emulados: el directorio paginó resultados y el flujo de recolección local se verificó antes de integrar la whitelist. Después se comprobó el rewrite con whitelist: loopback llegó al handler (405 para GET), una IP no autorizada recibió 403 y `directorio` siguió respondiendo 200. No se repitió el POST real para evitar otra llamada de Places.

Evidencia visual: [página 1](./evidencias/task-12-browser-page1.png), [página 2](./evidencias/task-12-browser-page2.png) y [retorno](./evidencias/task-12-browser-page1-return.png). Estas pruebas no consumieron Places ni modificaron producción.

Evidencia adicional de la tubería local: [recolección exitosa SIMULADA/LOCAL](./evidencias/task-14-recoleccion-simulada-local.png) ejecutó el servicio con un cliente Places falso y persistió tres fixtures en Firestore Emulator; [respuesta JSON del API LOCAL](./evidencias/task-14-api-json-local.png) capturó HTTP 200 mediante Hosting rewrite a `directorio`. Estas evidencias prueban código y emuladores; además, se efectuaron pruebas locales reales de Places en trabajo posterior. Ninguna de estas pruebas completa por sí sola la matriz de keywords.

## 5. Ética, limitaciones y recomendaciones

El directorio reproduce información fechada; no certifica identidad, licencia, especialidad, calidad ni disponibilidad. No mezcla fuentes, no enriquece manualmente y no interpreta campos ausentes. Los resultados de Places pueden tener sesgos de ranking y presencia digital; tres zonas y tres especialidades no representan la oferta sanitaria de la ciudad. Véase [postura-etica.md](./postura-etica.md).

Antes de producción se debe: desplegar Functions y Hosting de forma controlada; registrar SKU, uso y métricas; y completar secuencialmente la matriz. La infraestructura base en `us-central1`, la key, la restricción de API, la cuota y `IP_WHITELIST` v1 ya están configurados. La whitelist existe en código solo para `recolectarMedicos`; `directorio` continúa sin whitelist. Las URLs de producción no se afirman hasta contar con evidencia de despliegue.
