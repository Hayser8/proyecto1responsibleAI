# Recolección desde la UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir iniciar `recolectarMedicos` desde la interfaz y refrescar automáticamente el directorio filtrado con los datos guardados.

**Architecture:** Se añadirá un cliente web tipado para el POST y una tarjeta de recolección separada del formulario GET existente. Tras un POST exitoso, el controlador de UI sincronizará especialidad y zona, volverá a la página 1 y ejecutará un único GET del directorio.

**Tech Stack:** TypeScript 6, Vite 8, Vitest 4, Testing Library DOM, Firebase Hosting rewrites y Functions v2.

## Global Constraints

- Trabajar sobre `main`; no crear ramas, commits ni staging.
- No implementar ni modificar la whitelist de IP.
- La API key debe permanecer únicamente en Secret Manager y en la Function.
- Cada envío de recolección hace exactamente un POST; consultar y paginar nunca llama a Places.
- La UI debe bloquear doble envío y mostrar errores públicos seguros.

---

### Task 1: Cliente web tipado de recolección

**Files:**
- Modify: `web/src/types.ts`
- Modify: `web/src/api.ts`
- Test: `web/src/api.test.ts`

**Interfaces:**
- Produces: `CollectionRequest`, `CollectionSummary`, `CollectionApiError` y `collectDoctors(input, fetchImpl)`.

- [ ] **Step 1: Escribir pruebas fallidas del POST y los errores seguros**

Agregar casos que verifiquen el URL `/recolectarMedicos`, método `POST`, headers JSON, cuerpo exacto y deserialización del resumen. Agregar casos para `400`, `429` y `500`, comprobando que nunca se expone el cuerpo interno.

```ts
await collectDoctors({
  keyword: "pediatra zona 10 Ciudad de Guatemala",
  especialidad: "Pediatría",
  zona: "10",
}, fetchImpl);

expect(fetchImpl).toHaveBeenCalledWith("/recolectarMedicos", {
  method: "POST",
  headers: {Accept: "application/json", "Content-Type": "application/json"},
  body: JSON.stringify({
    keyword: "pediatra zona 10 Ciudad de Guatemala",
    especialidad: "Pediatría",
    zona: "10",
  }),
});
```

- [ ] **Step 2: Ejecutar la prueba y confirmar RED**

Run: `npm --prefix web test -- src/api.test.ts`

Expected: FAIL porque `collectDoctors` y sus tipos todavía no existen.

- [ ] **Step 3: Implementar los tipos y el cliente mínimo**

```ts
export interface CollectionRequest {
  keyword: string;
  especialidad: string;
  zona: string;
}

export interface CollectionSummary extends CollectionRequest {
  encontrados: number;
  creados: number;
  actualizados: number;
}
```

`collectDoctors` enviará el JSON exacto. Para `400` usará “Revise la keyword, especialidad y zona.”, para `429` “Se alcanzó la cuota de Google Places. Intente mañana.” y para cualquier otro fallo “No se pudo recolectar desde Google Places. Intente de nuevo.”.

- [ ] **Step 4: Ejecutar la prueba y confirmar GREEN**

Run: `npm --prefix web test -- src/api.test.ts`

Expected: todas las pruebas de `api.test.ts` pasan.

### Task 2: Tarjeta y flujo POST → GET

**Files:**
- Modify: `web/src/main.ts`
- Test: `web/src/main.test.ts`

**Interfaces:**
- Consumes: `collectDoctors(input, fetchImpl): Promise<CollectionSummary>`.
- Produces: formulario accesible “Recolectar médicos desde Google Places” y refresco automático del directorio.

- [ ] **Step 1: Escribir pruebas fallidas de la tarjeta**

Verificar labels `Keyword`, `Especialidad para guardar` y `Zona para guardar`, el botón `Recolectar desde Google Places`, el valor inicial de la keyword y el aviso de cuota.

- [ ] **Step 2: Escribir prueba fallida del flujo exitoso**

Configurar `fetchImpl` para responder primero con:

```json
{"keyword":"pediatra zona 10 Ciudad de Guatemala","especialidad":"Pediatría","zona":"10","encontrados":20,"creados":18,"actualizados":2}
```

y después con una `DirectoryPage`. Verificar dos solicitudes en orden: `POST /recolectarMedicos` y `GET /directorio?page=1&pageSize=20&especialidad=Pediatr%C3%ADa&zona=10`; verificar el resumen visible y los filtros sincronizados.

- [ ] **Step 3: Escribir prueba fallida de bloqueo y error**

Mantener el POST pendiente y comprobar que el botón y los tres campos quedan deshabilitados. Rechazar con `CollectionApiError` y comprobar un `role="alert"` separado, sin ejecutar GET.

- [ ] **Step 4: Ejecutar las pruebas y confirmar RED**

Run: `npm --prefix web test -- src/main.test.ts`

Expected: FAIL porque la tarjeta y el flujo no existen.

- [ ] **Step 5: Implementar la tarjeta y el estado de recolección**

Crear elementos independientes del filtro existente. El submit llamará a `collectDoctors`; en éxito asignará especialidad y zona a ambos selects, pondrá `state.page = 1`, actualizará el resumen y esperará `requestPage()`.

El estado de recolección debe usar `collectionLoading`, `collectionError` y `collectionSummary`, sin reutilizar el error de consulta.

- [ ] **Step 6: Ejecutar pruebas y confirmar GREEN**

Run: `npm --prefix web test -- src/main.test.ts`

Expected: todas las pruebas de `main.test.ts` pasan.

### Task 3: Presentación responsiva y verificación completa

**Files:**
- Modify: `web/src/styles.css`
- Test: `web/src/main.test.ts`

**Interfaces:**
- Consumes: clases de la tarjeta creadas en Task 2.
- Produces: formulario responsivo, aviso de cuota y resumen visualmente diferenciados.

- [ ] **Step 1: Agregar una prueba estructural fallida de estilos esenciales**

Comprobar que el CSS contiene una cuadrícula para `.collection-form`, estilos para `.quota-notice` y un breakpoint que cambia `.collection-form` a una columna.

- [ ] **Step 2: Ejecutar la prueba y confirmar RED**

Run: `npm --prefix web test -- src/main.test.ts`

Expected: FAIL porque las reglas nuevas aún no existen.

- [ ] **Step 3: Implementar estilos mínimos**

Reutilizar tokens, botones, campos y mensajes existentes. Incluir `input` en tipografía, focus, tamaño táctil, disabled y layout móvil. No agregar dependencias, animaciones ni rediseños no relacionados.

- [ ] **Step 4: Ejecutar toda la verificación automatizada**

Run: `npm --prefix web test`

Expected: todas las pruebas web pasan.

Run: `npm test`

Expected: todas las pruebas unitarias de Functions y web pasan; la integración del emulador conserva su comportamiento configurado.

Run: `npm run build`

Expected: TypeScript y Vite terminan con código 0.

- [ ] **Step 5: Probar localmente sin dejar procesos activos**

Iniciar los emuladores con un handle registrado, abrir Hosting local, confirmar la tarjeta y ejecutar el flujo con una respuesta controlada o una única llamada real aprobada. Cerrar los emuladores al terminar, esperar su salida y verificar que 4000, 5001, 5002 y 8080 estén libres.

- [ ] **Step 6: Revisar alcance final**

Confirmar mediante `git diff -- web docs/superpowers` que no se modificaron Functions, Secret Manager, configuración de APIs, whitelist ni archivos ajenos. No crear commit.
