# IP Whitelist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rechazar IPs no autorizadas con HTTP 403 antes de ejecutar cualquier lógica de `recolectarMedicos`.

**Architecture:** Un wrapper HTTP independiente extraerá y normalizará la IP, validará el arreglo JSON inyectado y solo delegará al handler existente cuando haya coincidencia exacta. `functions/src/index.ts` enlazará `IP_WHITELIST` mediante `defineJsonSecret` exclusivamente a la Function recolectora.

**Tech Stack:** TypeScript, Node.js 22, Firebase Functions v2, Secret Manager, Vitest.

## Global Constraints

- Trabajar directamente en `main`; no crear ramas, worktrees, staging ni commits.
- No agregar administración de IPs a la UI.
- Proteger `recolectarMedicos`; no modificar `directorio`.
- No admitir CIDR en este alcance; solo IPv4/IPv6 exactas.
- Una IP bloqueada no puede ejecutar el handler, leer la API key, llamar Places ni acceder a Firestore.
- Nunca registrar ni devolver la whitelist completa.

---

### Task 1: Middleware IP fail-closed

**Files:**
- Create: `functions/src/security/ip-whitelist.ts`
- Create: `functions/test/security/ip-whitelist.test.ts`

**Interfaces:**
- Produces: `withIpWhitelist(next, getAllowedIps): HttpHandler`.
- `getAllowedIps(): unknown` recibe el valor deserializado de `defineJsonSecret`.

- [x] **Step 1: Escribir pruebas fallidas**

Cubrir una IP autorizada que delega exactamente una vez, una IP no autorizada, IP ausente, primera entrada de `X-Forwarded-For`, fallback al socket, `::ffff:127.0.0.1`, IPv6 equivalente y configuración inválida.

```ts
const secured = withIpWhitelist(next, () => ["203.0.113.10"]);
await secured(makeRequest({forwardedFor: "198.51.100.1"}), response);
expect(captured).toEqual({
  status: 403,
  body: {error: {code: "IP_FORBIDDEN", message: "IP no autorizada"}},
});
expect(nextCalls).toBe(0);
```

- [x] **Step 2: Confirmar RED**

Run: `npm --prefix functions test -- test/security/ip-whitelist.test.ts`

Expected: FAIL porque el módulo no existe.

- [x] **Step 3: Implementar normalización y wrapper**

El wrapper debe usar la primera IP de `X-Forwarded-For`, fallback a `request.socket.remoteAddress`, `node:net` para validar, una representación canónica para comparar y respuestas JSON seguras. Configuración que no sea un arreglo no vacío de strings-IP produce `500 INTERNAL`; cliente ausente/no autorizado produce `403 IP_FORBIDDEN`.

- [x] **Step 4: Confirmar GREEN**

Run: `npm --prefix functions test -- test/security/ip-whitelist.test.ts`

Expected: todas las pruebas del middleware pasan.

### Task 2: Integración, gestión y verificación

**Files:**
- Modify: `functions/src/index.ts`
- Create: `docs/ip-whitelist.md`
- Modify: `docs/arquitectura.md`
- Modify: `docs/entrega-tecnica.md`

**Interfaces:**
- Consumes: `withIpWhitelist` de Task 1.
- Produces: `IP_WHITELIST` enlazado solo a `recolectarMedicos` y guía operativa completa.

- [x] **Step 1: Enlazar el secreto JSON**

Usar `defineJsonSecret("IP_WHITELIST")`, agregarlo a `secrets` junto con `GOOGLE_PLACES_API_KEY` y envolver `createRecolectarHandler` con `withIpWhitelist`.

- [x] **Step 2: Documentar administración**

Incluir los comandos exactos:

```bash
npx firebase functions:secrets:access IP_WHITELIST --project proyecto1responsibleai
npx firebase functions:secrets:set IP_WHITELIST --project proyecto1responsibleai
npx firebase deploy --only functions:recolectarMedicos --project proyecto1responsibleai
```

Explicar que cada cambio crea una versión completa y requiere redeploy; no imprimir el secreto en logs ni UI.

- [x] **Step 3: Ejecutar verificación automatizada**

Run: `npm test`

Expected: Functions y web pasan; integración de emulador conserva su estado configurado.

Run: `npm run build`

Expected: TypeScript y Vite terminan con exit 0.

- [x] **Step 4: Configurar entorno local y cloud**

Crear `functions/.secret.local` ignorado con loopback y configurar `IP_WHITELIST` en Secret Manager con loopback más la IP pública actual autorizada. No exponer el valor en la respuesta final.

- [x] **Step 5: Verificar en emuladores**

Confirmar que una solicitud loopback llega al handler y que un `X-Forwarded-For` no autorizado recibe 403 sin ejecución de recolección. Detener los emuladores y verificar que sus puertos queden libres.

- [x] **Step 6: Verificar alcance**

Confirmar que no cambiaron `directorio`, Firestore rules, UI, API key ni configuración de cuota. No crear commit.
