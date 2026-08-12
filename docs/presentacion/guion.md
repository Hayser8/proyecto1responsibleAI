# Guion de presentación — 20 minutos

## 0:00–2:00 · Problema y restricciones responsables

- Problema: construir un directorio académico consultable por especialidad y zona sin presentar una lista como certificación médica.
- Alcance inicial: Pediatría, Cardiología y Dermatología; zonas 1, 9 y 10.
- Declaración obligatoria: no valida credenciales ni sustituye orientación médica.
- Transparencia de estado: no hay deploy, URL de producción ni resultados reales de Places; la demo usa emuladores y fixtures deterministas.

Transición: “Primero diseñamos límites técnicos que impiden confundir consulta, recolección y consumo externo”.

## 2:00–6:00 · Arquitectura y seguridad

- Mostrar [arquitectura.md](../arquitectura.md) y recorrer Hosting → `directorio` → Firestore.
- Explicar la ruta separada `recolectarMedicos` → Places y el límite de 20.
- Secret Manager: `GOOGLE_PLACES_API_KEY` latest=v2 ENABLED contiene la key dedicada y solo debe vincularse a la recolectora al desplegar.
- Firestore Rules: clientes denegados; Admin SDK/IAM para Functions.
- Diferenciar:
  - whitelist de endpoint = controla IP de entrada y corta con 403;
  - restricción de key = limita la credencial a Places;
  - restricción por IP de salida requeriría egress estático no configurado.
- Whitelist real BLOQUEADA hasta recibir IP públicas.

## 6:00–10:00 · Recolección y calidad de datos

- Mostrar [keywords.md](../keywords.md): nueve keywords exactas, métricas PENDIENTES.
- `especialidad` se envía explícita; no se infiere de un resultado.
- `place_id` evita duplicados; merge separa creados/actualizados.
- Campos ausentes quedan vacíos; un sitio puede ser de una clínica.
- Cada registro conserva fecha y keyword.
- No se hizo llamada real: cuota diaria 100 y key restringida ya están verificadas; whitelist y despliegue siguen como gates.

## 10:00–15:00 · Demo local

Seguir [demo-checklist.md](./demo-checklist.md).

1. Abrir la UI local en `http://127.0.0.1:5002` (25 fixtures de Pediatría, zona 10).
2. Señalar el aviso académico y la fecha visible.
3. Elegir Pediatría y zona 10 con controles nativos.
4. Buscar: verificar 20 fixtures y Next habilitado.
5. Ir a página 2: verificar 5 fixtures y Previous habilitado.
6. Volver a página 1.
7. Si la demo en vivo no está preparada, usar las tres capturas verificadas; no improvisar cloud.

Frase: “Estos nombres son fixtures; demuestran integración y paginación, no cobertura médica real”.

## 15:00–18:00 · Pruebas, costos y limitaciones

- 63 pruebas Functions, 9 Web y 1 integración Firestore Emulator aprobadas; builds aprobados.
- Navegador real verificó formulario, tabla 20/5 y navegación completa.
- Crédito: USD 300 activo hasta 2026-10-16.
- Presupuesto: USD 270 para la cuenta, alertas 25/50/90; alertas no detienen gasto.
- Cuota Places: override diario efectivo de 100 para `SearchTextRequest` (predeterminado anterior: 75,000).
- Limitaciones: muestra pequeña, ranking de Places, paginación por offset y ausencia de despliegue/datos reales.

## 18:00–20:00 · Postura ética y cierre

- Mostrar [postura-etica.md](../postura-etica.md).
- Repetir: referencia académica, no certificación ni consejo médico.
- No inferir, enriquecer ni ocultar faltantes; fecha visible y procedencia trazable.
- Cierre honesto: “APIs, Firestore, secreto, restricción de key y cuota están preparados. No se ha llamado Places ni desplegado Functions/Hosting; producción permanece bloqueada hasta completar whitelist y prueba controlada”.
- Invitar preguntas sobre arquitectura, controles y límites, no sobre supuestos resultados médicos.
