# Checklist de demo

## Estado de la demostración

- [x] Flujo local verificado con Hosting, Functions y Firestore Emulator.
- [x] Capturas sin secretos disponibles.
- [ ] **BLOQUEADO:** demo en producción; no hay URL verificada.
- [ ] **BLOQUEADO:** datos reales; no se ha llamado Places.
- [ ] **BLOQUEADO:** whitelist; faltan IP públicas autorizadas.
- [x] Cuota conservadora efectiva de 100 para `SearchTextRequest` y key dedicada restringida a Places API (New).

La presentación debe usar el flujo local o las evidencias. No inventar URL, métricas ni datos reales.

## Antes de la sesión

- [ ] Confirmar que se presentará el proyecto `proyecto1responsibleai` y región `us-central1`.
- [ ] Repetir que Pediatría/zona 10 usa fixtures deterministas.
- [ ] Confirmar que no se mostrará `.env`, API key, identificadores de billing ni logs sensibles.
- [ ] Preparar Java local desde `/Applications/DBeaver.app/Contents/Eclipse/jre/Contents/Home` únicamente para emuladores.
- [ ] Confirmar que Hosting Emulator usa `http://127.0.0.1:5002`; no intervenir el proceso ajeno que ocupa 5000.
- [ ] Registrar el PID/session ID de todo proceso temporal y planear Ctrl-C + revisión de puertos.
- [ ] Tener abiertas como respaldo:
  - [página 1, 20 filas](../evidencias/task-12-browser-page1.png)
  - [página 2, 5 filas](../evidencias/task-12-browser-page2.png)
  - [retorno a página 1](../evidencias/task-12-browser-page1-return.png)

## Recorrido de cinco minutos

- [ ] Abrir la UI local y mostrar `Especialistas médicos`.
- [ ] Señalar el aviso: referencia académica, no validación médica.
- [ ] Elegir `Pediatría` en Especialidad.
- [ ] Elegir `10` en Zona de la ciudad.
- [ ] Activar `Buscar especialistas`.
- [ ] Confirmar visualmente: `20 médicos encontrados. Página 1.`
- [ ] Confirmar primera/última fila: `Pediatra Browser 01` y `Pediatra Browser 20`.
- [ ] Confirmar Anterior deshabilitado y Siguiente habilitado.
- [ ] Activar Siguiente.
- [ ] Confirmar: `5 médicos encontrados. Página 2.` y filas `21`–`25`.
- [ ] Confirmar Anterior habilitado y Siguiente deshabilitado.
- [ ] Activar Anterior y confirmar el retorno a página 1.
- [ ] Aclarar verbalmente que los 25 registros son fixtures, no resultados reales.

## Evidencia técnica a mencionar

- [x] [Recolección exitosa SIMULADA/LOCAL](../evidencias/task-14-recoleccion-simulada-local.png): ejecución real de `createCollectionService` con cliente Places falso inyectado y Firestore Emulator; 3 encontrados, 3 creados, 0 actualizados, sin red externa.
- [x] [Respuesta JSON del API LOCAL](../evidencias/task-14-api-json-local.png): solicitud HTTP real mediante Hosting Emulator y rewrite a `directorio`; HTTP 200, tres fixtures y metadatos de paginación/filtros.
- [ ] Functions: 126 unitarias aprobadas.
- [ ] Web: 32 pruebas aprobadas.
- [ ] Integración: 1 prueba real contra Firestore Emulator aprobada; solo se ejecuta con el emulador activo.
- [ ] Builds Functions/Web aprobados.
- [ ] Navegador Chromium verificó el flujo 20 → 5 → 20 y los rewrites HTTP 200.
- [ ] Sin llamadas Places ni deploy de Functions/Hosting; solo preparación de APIs, Firestore, cuota y secreto en cloud.

Estas capturas prueban orquestación, persistencia y lectura local. No son evidencia de una invocación real a Google Places ni completan las métricas PENDIENTES de la matriz de keywords.

## Billing y gates

- [ ] Crédito verificado: USD 300 activo hasta 2026-10-16.
- [ ] Presupuesto verificado: USD 270, cuenta completa, alertas 25/50/90.
- [ ] Explicar que alertas notifican y no frenan consumo.
- [ ] Mostrar cuota Places configurada: override diario efectivo **100** para `SearchTextRequest` (default anterior 75,000).
- [ ] Mostrar key dedicada restringida a `places.googleapis.com` y secreto `GOOGLE_PLACES_API_KEY` latest=v2 ENABLED.
- [ ] Aclarar que la versión anterior del secreto era de otro proyecto y no fue eliminada.
- [ ] Mostrar Firestore `(default)` Native Standard en `us-central1` con delete protection.
- [ ] Marcar whitelist, deploy de Functions/Hosting, URLs y datos reales como **PENDIENTES/BLOQUEADOS**.

## Cierre y limpieza

- [ ] Cerrar únicamente la pestaña/sesión de navegador creada para la demo.
- [ ] Enviar Ctrl-C al session ID registrado del emulador y esperar exit.
- [ ] Verificar libres los puertos 4000, 4400, 4500, 5001, 5002, 8080 y 9150.
- [ ] Verificar que el proceso ajeno en 5000 sigue intacto.
- [ ] Eliminar logs temporales del emulador si fueron creados.
- [ ] Confirmar que no quedaron datos, claves ni procesos temporales propios.
