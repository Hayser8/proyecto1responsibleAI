# Directorio de Médicos Especialistas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir, probar y desplegar un directorio académico de médicos especialistas que recolecte un máximo de 20 resultados desde Google Places API (New), los almacene sin duplicados en Firestore y los exponga mediante una API paginada y una UI mínima.

**Architecture:** Un proyecto Firebase en `us-central1` contendrá dos Functions v2 independientes: `recolectarMedicos` para consumo de Places y escritura en Firestore, y `directorio` para consultas paginadas. Firebase Hosting servirá una aplicación TypeScript/Vite y reescribirá `/directorio` hacia la función de lectura; la API key solo estará disponible para la función recolectora mediante Secret Manager.

**Tech Stack:** Node.js 22, TypeScript, Firebase Functions v2, Firebase Admin SDK, Cloud Firestore, Google Places API (New), Firebase Hosting, Vite, Vitest y Firebase Emulator Suite.

## Global Constraints

- Trabajar directamente sobre la rama `main`; no crear otra rama.
- No ejecutar `git commit` hasta que el usuario lo autorice expresamente.
- Proyecto Firebase/GCP: `proyecto1responsibleai`.
- Región de Functions y Firestore: `us-central1`.
- Runtime desplegado: Node.js 22.
- Máximo 20 resultados de Places por invocación.
- `pageSize` entre 1 y 50; valor predeterminado 20.
- Al menos 90 % del desarrollo debe usar emuladores y Places simulado.
- No ejecutar llamadas reales a Places hasta verificar crédito, presupuesto, alertas, cuota y restricciones.
- No imprimir, versionar ni devolver `PLACES_API` o `GOOGLE_PLACES_API_KEY`.
- No inferir datos ausentes; teléfono y sitio web faltantes se guardan como cadena vacía.
- Usar `place_id` como ID del documento de Firestore.
- La whitelist de IP se implementa después de recibir las IP públicas; ningún despliegue final se considera completo sin ella.

---

## File Map

### Configuración raíz

- `.node-version`: fija Node 22.
- `.firebaserc`: vincula el alias `default` a `proyecto1responsibleai`.
- `firebase.json`: configura Functions, Firestore, Hosting, rewrites y Emulator Suite.
- `firestore.rules`: niega acceso directo desde clientes; solo Admin SDK opera datos.
- `firestore.indexes.json`: índices de filtros y orden del directorio.
- `.gitignore`: excluye secretos, dependencias, builds, cobertura, cachés y logs.
- `.env.example`: documenta nombres de variables sin valores reales.
- `package.json`: scripts raíz y versión local de Firebase CLI.

### Backend

- `functions/package.json`: dependencias, scripts y runtime.
- `functions/tsconfig.json`: compilación estricta a `functions/lib`.
- `functions/vitest.config.ts`: pruebas unitarias Node.
- `functions/src/index.ts`: inicialización Admin y exports de Functions v2.
- `functions/src/shared/http.ts`: tipos de respuesta y errores HTTP.
- `functions/src/shared/ip-whitelist.ts`: extracción y validación de IP.
- `functions/src/medicos/model.ts`: modelos persistidos y DTO públicos.
- `functions/src/recoleccion/validation.ts`: validación del body de recolección.
- `functions/src/recoleccion/places-client.ts`: único adaptador de Places API.
- `functions/src/recoleccion/repository.ts`: escrituras idempotentes en Firestore.
- `functions/src/recoleccion/service.ts`: orquestación de la recolección.
- `functions/src/recoleccion/handler.ts`: adaptación HTTP de la recolección.
- `functions/src/directorio/validation.ts`: validación y normalización de query params.
- `functions/src/directorio/repository.ts`: filtros, orden y paginación Firestore.
- `functions/src/directorio/handler.ts`: adaptación HTTP del directorio.
- `functions/test/**/*.test.ts`: pruebas unitarias por responsabilidad.
- `functions/test/integration/firestore-emulator.test.ts`: integración real contra el emulador.

### Frontend

- `web/package.json`: Vite, TypeScript, Vitest y jsdom.
- `web/index.html`: estructura y metadatos de la demo.
- `web/src/types.ts`: DTO compartido de lectura.
- `web/src/api.ts`: cliente HTTP de `/directorio`.
- `web/src/main.ts`: estado, eventos, renderizado y paginación.
- `web/src/styles.css`: presentación mínima responsive y accesible.
- `web/src/*.test.ts`: pruebas de cliente y renderizado.
- `web/vite.config.ts`: configuración de Vite y Vitest/jsdom.

### Documentación

- `docs/keywords.md`: matriz reproducible de especialidad, zona y keyword.
- `docs/arquitectura.md`: diagrama y flujo operativo.
- `docs/postura-etica.md`: decisiones responsables y límites.
- `docs/entrega-tecnica.md`: contenido final de máximo cinco páginas.
- `docs/presentacion/guion.md`: distribución de los 20 minutos.
- `docs/presentacion/demo-checklist.md`: recorrido principal y contingencia.
- `docs/evidencias/`: screenshots de billing, alertas, cuotas, emuladores y producción.

---

### Task 1: Billing gate and local toolchain

**Files:**
- Create: `.node-version`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `package.json`
- Preserve locally: `.env`

**Interfaces:**
- Consumes: proyecto `proyecto1responsibleai` y sesión Firebase ya autenticada.
- Produces: entorno Node 22 reproducible, Firebase CLI fijada y evidencia de que ninguna operación facturable puede comenzar sin controles.

- [ ] **Step 1: Verify billing linkage without changing cloud state**

Run:

```bash
npx --yes firebase-tools@15.25.1 projects:list
```

Expected: aparece `Proyecto1ResponsibleAI`, ID `proyecto1responsibleai`, número `487068590350`.

- [ ] **Step 2: Verify the promotional-credit evidence manually**

Open Google Cloud Console → Facturación → Créditos and record:

- remaining promotional amount;
- expiration date;
- billing account displaying `Proyecto1ResponsibleAI` as linked.

Expected: screenshot saved outside Git first, reviewed for payment identifiers, then copied to `docs/evidencias/credito-promocional.png` only if it contains no sensitive payment data.

- [ ] **Step 3: Verify budget thresholds and quota before any Places request**

In Google Cloud Console confirm:

- budget scope includes `proyecto1responsibleai`;
- alert thresholds include 50 % and 90 %;
- Places API (New) has a conservative daily request quota.

Expected: no Places call is made in this task; evidence is recorded in `docs/evidencias/` after redaction.

- [ ] **Step 4: Pin the local runtime**

Create `.node-version`:

```text
22
```

Run:

```bash
fnm install 22
fnm use 22
node --version
```

Expected: output begins with `v22.`.

- [ ] **Step 5: Protect generated files and secrets**

Create `.gitignore`:

```gitignore
.env
.env.*
!.env.example
node_modules/
functions/lib/
functions/coverage/
web/dist/
web/coverage/
.firebase/
firebase-debug.log
*.local
.DS_Store
```

Create `.env.example`:

```dotenv
PLACES_API=
ALLOWED_IPS=127.0.0.1,::1
```

Run:

```bash
git check-ignore -v .env
git log --all --oneline -- .env
```

Expected: `.env` está ignorado y el segundo comando no imprime commits.

- [ ] **Step 6: Add reproducible root scripts without a global CLI dependency**

Create `package.json`:

```json
{
  "name": "proyecto1responsibleai",
  "private": true,
  "scripts": {
    "build": "npm --prefix functions run build && npm --prefix web run build",
    "test": "npm --prefix functions test && npm --prefix web test",
    "emulators": "firebase emulators:start",
    "deploy:hosting": "firebase deploy --only hosting",
    "deploy:functions": "firebase deploy --only functions"
  },
  "devDependencies": {
    "firebase-tools": "15.25.1"
  }
}
```

Run:

```bash
npm install
npx firebase --version
```

Expected: `15.25.1`; `package-lock.json` creado; ninguna API habilitada todavía.

---

### Task 2: Firebase project scaffold and emulator configuration

**Files:**
- Create: `.firebaserc`
- Create: `firebase.json`
- Create: `firestore.rules`
- Create: `firestore.indexes.json`
- Create: `functions/package.json`
- Create: `functions/tsconfig.json`
- Create: `functions/vitest.config.ts`
- Create: `functions/src/index.ts`
- Create: `web/` through Vite scaffold

**Interfaces:**
- Consumes: Node 22 and local Firebase CLI from Task 1.
- Produces: compilable Functions/UI workspaces and emulator routing contracts used by every later task.

- [ ] **Step 1: Bind the repository to the exact Firebase project**

Create `.firebaserc`:

```json
{
  "projects": {
    "default": "proyecto1responsibleai"
  }
}
```

- [ ] **Step 2: Configure Firebase products and local ports**

Create `firebase.json`:

```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs22",
    "predeploy": ["npm --prefix functions run build"]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": {
    "public": "web/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {"source": "/directorio", "function": {"functionId": "directorio", "region": "us-central1"}},
      {"source": "/recolectarMedicos", "function": {"functionId": "recolectarMedicos", "region": "us-central1"}},
      {"source": "**", "destination": "/index.html"}
    ]
  },
  "emulators": {
    "functions": {"port": 5001},
    "firestore": {"port": 8080},
    "hosting": {"port": 5000},
    "ui": {"enabled": true, "port": 4000},
    "singleProjectMode": true
  }
}
```

- [ ] **Step 3: Deny direct Firestore client access**

Create `firestore.rules`:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 4: Define deterministic directory indexes**

Create `firestore.indexes.json` with collection-group indexes for:

```json
{
  "indexes": [
    {
      "collectionGroup": "medicos",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "nombre", "order": "ASCENDING"},
        {"fieldPath": "place_id", "order": "ASCENDING"}
      ]
    },
    {
      "collectionGroup": "medicos",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "especialidad", "order": "ASCENDING"},
        {"fieldPath": "nombre", "order": "ASCENDING"},
        {"fieldPath": "place_id", "order": "ASCENDING"}
      ]
    },
    {
      "collectionGroup": "medicos",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "zona", "order": "ASCENDING"},
        {"fieldPath": "nombre", "order": "ASCENDING"},
        {"fieldPath": "place_id", "order": "ASCENDING"}
      ]
    },
    {
      "collectionGroup": "medicos",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "especialidad", "order": "ASCENDING"},
        {"fieldPath": "zona", "order": "ASCENDING"},
        {"fieldPath": "nombre", "order": "ASCENDING"},
        {"fieldPath": "place_id", "order": "ASCENDING"}
      ]
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 5: Scaffold the Functions workspace**

Create `functions/package.json`:

```json
{
  "name": "functions",
  "private": true,
  "main": "lib/index.js",
  "engines": {"node": "22"},
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "vitest run test/integration"
  },
  "dependencies": {
    "firebase-admin": "latest",
    "firebase-functions": "latest"
  },
  "devDependencies": {
    "@types/express": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

Create `functions/tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "outDir": "lib",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

Create `functions/vitest.config.ts`:

```ts
import {defineConfig} from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {reporter: ["text", "html"]},
  },
});
```

Run:

```bash
npm --prefix functions install
```

Expected: `functions/package-lock.json` created with resolved, pinned dependency versions.

- [ ] **Step 6: Scaffold the UI workspace**

Run:

```bash
npm create vite@latest web -- --template vanilla-ts
npm --prefix web install
npm --prefix web install --save-dev vitest jsdom @testing-library/dom
```

Expected: `npm --prefix web run build` succeeds before feature code is added.

---

### Task 3: Shared domain and HTTP contracts

**Files:**
- Create: `functions/src/medicos/model.ts`
- Create: `functions/src/shared/http.ts`
- Test: `functions/test/shared/http.test.ts`

**Interfaces:**
- Produces: `Medico`, `MedicoDto`, `HttpError`, `HttpResult<T>` and `toErrorResult(error)` for all handlers.

- [ ] **Step 1: Write failing tests for safe error mapping**

Create `functions/test/shared/http.test.ts`:

```ts
import {describe, expect, it} from "vitest";
import {HttpError, toErrorResult} from "../../src/shared/http.js";

describe("toErrorResult", () => {
  it("preserves controlled status and public message", () => {
    expect(toErrorResult(new HttpError(400, "INVALID_REQUEST", "Solicitud inválida"))).toEqual({
      status: 400,
      body: {error: {code: "INVALID_REQUEST", message: "Solicitud inválida"}},
    });
  });

  it("hides unexpected internal details", () => {
    expect(toErrorResult(new Error("secret stack detail"))).toEqual({
      status: 500,
      body: {error: {code: "INTERNAL", message: "Error interno"}},
    });
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
npm --prefix functions test -- test/shared/http.test.ts
```

Expected: FAIL because `src/shared/http.ts` does not exist.

- [ ] **Step 3: Define exact domain records**

Create `functions/src/medicos/model.ts`:

```ts
import type {Timestamp} from "firebase-admin/firestore";

export interface Medico {
  nombre: string;
  especialidad: string;
  direccion: string;
  telefono: string;
  sitio_web: string;
  zona: string;
  place_id: string;
  fecha_recoleccion: Timestamp;
  keyword_usado: string;
}

export interface MedicoDto extends Omit<Medico, "fecha_recoleccion"> {
  fecha_recoleccion: string;
}
```

Create `functions/src/shared/http.ts` with:

```ts
export interface HttpResult<T> {
  status: number;
  body: T;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function toErrorResult(error: unknown): HttpResult<{error: {code: string; message: string}}> {
  if (error instanceof HttpError) {
    return {status: error.status, body: {error: {code: error.code, message: error.message}}};
  }
  return {status: 500, body: {error: {code: "INTERNAL", message: "Error interno"}}};
}
```

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```bash
npm --prefix functions test -- test/shared/http.test.ts
npm --prefix functions run build
```

Expected: PASS and TypeScript exits 0.

---

### Task 4: Collection request validation

**Files:**
- Create: `functions/src/recoleccion/validation.ts`
- Test: `functions/test/recoleccion/validation.test.ts`

**Interfaces:**
- Consumes: un body `unknown`.
- Produces: `RecolectarInput {keyword, zona, especialidad}` or throws `HttpError(400, "INVALID_REQUEST", ...)` before any external call.

- [ ] **Step 1: Write failing validation tests**

Cover these exact cases:

```ts
expect(parseRecolectarInput({keyword: "pediatra zona 10 Ciudad de Guatemala", zona: "10", especialidad: "Pediatría"})).toEqual({
  keyword: "pediatra zona 10 Ciudad de Guatemala",
  zona: "10",
  especialidad: "Pediatría",
});
expect(() => parseRecolectarInput({keyword: "", zona: "10", especialidad: "Pediatría"})).toThrow(HttpError);
expect(() => parseRecolectarInput({keyword: "pediatra", zona: "abc", especialidad: "Pediatría"})).toThrow(HttpError);
expect(() => parseRecolectarInput({keyword: "pediatra", zona: "10", especialidad: ""})).toThrow(HttpError);
```

- [ ] **Step 2: Verify the test fails**

Run `npm --prefix functions test -- test/recoleccion/validation.test.ts`.

Expected: FAIL because the parser is missing.

- [ ] **Step 3: Implement narrow normalization**

Implement:

```ts
export interface RecolectarInput {
  keyword: string;
  zona: string;
  especialidad: string;
}

export function parseRecolectarInput(body: unknown): RecolectarInput
```

Rules:

- body must be a non-array object;
- trim all three strings and collapse internal whitespace;
- keyword length 3–160;
- especialidad length 3–80;
- zona must match `^(?:[1-9]|1[0-9]|2[0-5])$`;
- do not infer specialty from keyword.

- [ ] **Step 4: Run focused tests**

Expected: every validation case passes and no network dependency is imported.

---

### Task 5: Google Places API adapter

**Files:**
- Create: `functions/src/recoleccion/places-client.ts`
- Test: `functions/test/recoleccion/places-client.test.ts`

**Interfaces:**
- Consumes: `search(keyword: string, apiKey: string)`.
- Produces: at most 20 `PlaceCandidate` records containing only `id`, `displayName`, `formattedAddress`, `nationalPhoneNumber` and `websiteUri`.

- [ ] **Step 1: Write a failing success-path test with injected fetch**

Use a fake fetch and assert:

```ts
expect(request.url).toBe("https://places.googleapis.com/v1/places:searchText");
expect(request.init.method).toBe("POST");
expect(request.init.headers["X-Goog-FieldMask"]).toBe(
  "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri",
);
expect(JSON.parse(String(request.init.body))).toEqual({
  textQuery: "pediatra zona 10 Ciudad de Guatemala",
  pageSize: 20,
  languageCode: "es",
  regionCode: "GT",
});
```

Assert the key is sent only in `X-Goog-Api-Key` and never appears in a thrown public error.

- [ ] **Step 2: Write failing error-path tests**

Cover:

- HTTP 429 maps to `HttpError(429, "PLACES_QUOTA", ...)`;
- other non-2xx responses map to `HttpError(502, "PLACES_ERROR", ...)`;
- malformed JSON maps to the same safe 502 response;
- a provider response longer than 20 is sliced to 20 defensively.

- [ ] **Step 3: Verify tests fail without implementation**

Run `npm --prefix functions test -- test/recoleccion/places-client.test.ts`.

- [ ] **Step 4: Implement `createPlacesClient(fetchImpl)`**

Define:

```ts
export interface PlaceCandidate {
  id: string;
  displayName?: {text?: string};
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
}

export interface PlacesClient {
  search(keyword: string, apiKey: string): Promise<PlaceCandidate[]>;
}

export function createPlacesClient(fetchImpl: typeof fetch): PlacesClient
```

The adapter must not log headers, body responses or API keys.

- [ ] **Step 5: Run focused tests and confirm zero real calls**

Expected: PASS; test output contains no external URL request beyond assertions made against the fake.

---

### Task 6: Ethical mapping and idempotent Firestore persistence

**Files:**
- Create: `functions/src/recoleccion/repository.ts`
- Test: `functions/test/recoleccion/repository.test.ts`

**Interfaces:**
- Consumes: `PlaceCandidate[]`, `RecolectarInput`, Firestore and a clock.
- Produces: `{creados: number; actualizados: number}` and writes `Medico` documents keyed by `place_id`.

- [ ] **Step 1: Write failing mapping tests**

Test that a complete candidate maps directly and that missing optional values become empty strings. Test that invalid/absent `id` candidates are skipped. Test that website values on `facebook.com`, `instagram.com`, `tiktok.com`, `x.com` and `twitter.com` become empty strings instead of being redistributed as the official site.

- [ ] **Step 2: Write failing persistence tests with a fake repository port**

Assert:

- document path is `medicos/{place_id}`;
- repeated `place_id` values in one result set are deduplicated;
- a fixed clock supplies one `fecha_recoleccion` value for the batch;
- `keyword_usado`, `zona` and `especialidad` come from validated input;
- maximum writes remain 20.

- [ ] **Step 3: Verify tests fail**

Run `npm --prefix functions test -- test/recoleccion/repository.test.ts`.

- [ ] **Step 4: Implement the repository contract**

Define:

```ts
export interface SaveResult {
  creados: number;
  actualizados: number;
}

export interface MedicosWriter {
  save(candidates: PlaceCandidate[], input: RecolectarInput): Promise<SaveResult>;
}

export function createFirestoreMedicosWriter(
  firestore: FirebaseFirestore.Firestore,
  now: () => FirebaseFirestore.Timestamp,
): MedicosWriter
```

Implementation sequence:

1. map and deduplicate valid candidates;
2. call `firestore.getAll(...refs)` to distinguish existing documents;
3. create one batch;
4. `batch.set(ref, medico, {merge: true})` for each candidate;
5. commit once;
6. return exact counts.

- [ ] **Step 5: Run focused tests**

Expected: PASS with no emulator required for unit tests.

---

### Task 7: Collection service and HTTP function

**Files:**
- Create: `functions/src/recoleccion/service.ts`
- Create: `functions/src/recoleccion/handler.ts`
- Modify: `functions/src/index.ts`
- Test: `functions/test/recoleccion/service.test.ts`
- Test: `functions/test/recoleccion/handler.test.ts`

**Interfaces:**
- Consumes: validated POST request, `PlacesClient`, `MedicosWriter`, `GOOGLE_PLACES_API_KEY`.
- Produces: HTTP 200 summary or safe 400/405/415/429/500/502 response.

- [ ] **Step 1: Write failing service orchestration tests**

Assert `collect(input, apiKey)` calls Places once, writer once and returns:

```json
{
  "keyword": "pediatra zona 10 Ciudad de Guatemala",
  "zona": "10",
  "especialidad": "Pediatría",
  "encontrados": 20,
  "creados": 18,
  "actualizados": 2
}
```

Also assert zero writes when Places returns no candidates.

- [ ] **Step 2: Write failing HTTP boundary tests**

Cover:

- GET returns 405 before service execution;
- POST without `application/json` returns 415 before service execution;
- invalid body returns 400 before service execution;
- valid body delegates exactly once;
- thrown `HttpError` maps through `toErrorResult`;
- unexpected errors return safe 500.

- [ ] **Step 3: Implement service and handler factories**

Define:

```ts
export function createCollectionService(deps: {
  places: PlacesClient;
  writer: MedicosWriter;
}): {
  collect(input: RecolectarInput, apiKey: string): Promise<CollectionSummary>;
}

export function createRecolectarHandler(deps: {
  collect(input: RecolectarInput, apiKey: string): Promise<CollectionSummary>;
  getApiKey(): string;
}): (request: Request, response: Response) => Promise<void>;
```

- [ ] **Step 4: Export the v2 function with the secret bound only here**

In `functions/src/index.ts`:

```ts
import {initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {defineSecret} from "firebase-functions/params";
import {onRequest} from "firebase-functions/v2/https";

initializeApp();
const placesApiKey = defineSecret("GOOGLE_PLACES_API_KEY");

export const recolectarMedicos = onRequest(
  {
    region: "us-central1",
    secrets: [placesApiKey],
    maxInstances: 2,
    timeoutSeconds: 60,
  },
  createRecolectarHandler({
    collect: collectionService.collect,
    getApiKey: () => placesApiKey.value(),
  }),
);
```

Initialize `places`, `writer` and `collectionService` once at module scope using native `fetch`, `getFirestore()` and `Timestamp.now`.

- [ ] **Step 5: Run collection tests and build**

Run:

```bash
npm --prefix functions test -- test/recoleccion
npm --prefix functions run build
```

Expected: PASS; `lib/index.js` exports `recolectarMedicos`.

---

### Task 8: Directory query validation and repository

**Files:**
- Create: `functions/src/directorio/validation.ts`
- Create: `functions/src/directorio/repository.ts`
- Test: `functions/test/directorio/validation.test.ts`
- Test: `functions/test/directorio/repository.test.ts`

**Interfaces:**
- Consumes: raw query params and Firestore.
- Produces: `DirectoryQuery` and `DirectoryPage` with stable ordering and `hasNextPage`.

- [ ] **Step 1: Write failing query-validation tests**

Assert:

```ts
expect(parseDirectoryQuery({})).toEqual({page: 1, pageSize: 20});
expect(parseDirectoryQuery({page: "2", pageSize: "50", especialidad: " Pediatría ", zona: "10"})).toEqual({
  page: 2,
  pageSize: 50,
  especialidad: "Pediatría",
  zona: "10",
});
expect(() => parseDirectoryQuery({page: "0"})).toThrow(HttpError);
expect(() => parseDirectoryQuery({pageSize: "51"})).toThrow(HttpError);
expect(() => parseDirectoryQuery({page: "1.5"})).toThrow(HttpError);
```

- [ ] **Step 2: Implement `parseDirectoryQuery(query)`**

Define:

```ts
export interface DirectoryQuery {
  page: number;
  pageSize: number;
  especialidad?: string;
  zona?: string;
}
```

Reject arrays, repeated params and invalid zone values. Trim filters without guessing synonyms.

- [ ] **Step 3: Write failing repository tests using a query spy**

Assert operation order:

1. optional `where("especialidad", "==", value)`;
2. optional `where("zona", "==", value)`;
3. `orderBy("nombre", "asc")`;
4. `orderBy("place_id", "asc")`;
5. `offset((page - 1) * pageSize)`;
6. `limit(pageSize + 1)`.

Assert the extra record is removed and controls `hasNextPage`. Assert Firestore timestamps serialize to ISO 8601.

- [ ] **Step 4: Implement the repository port**

Define:

```ts
export interface DirectoryPage {
  data: MedicoDto[];
  pagination: {
    page: number;
    pageSize: number;
    returned: number;
    hasNextPage: boolean;
  };
  filters: {
    especialidad: string | null;
    zona: string | null;
  };
}

export interface MedicosReader {
  list(query: DirectoryQuery): Promise<DirectoryPage>;
}
```

The repository must read only collection `medicos` and never expose unknown Firestore fields.

- [ ] **Step 5: Run directory validation and repository tests**

Expected: PASS without a real database.

---

### Task 9: Directory HTTP function

**Files:**
- Create: `functions/src/directorio/handler.ts`
- Modify: `functions/src/index.ts`
- Test: `functions/test/directorio/handler.test.ts`

**Interfaces:**
- Consumes: GET query params and `MedicosReader`.
- Produces: JSON `DirectoryPage` or safe 400/405/500 response.

- [ ] **Step 1: Write failing HTTP tests**

Cover:

- GET delegates parsed params and returns 200;
- POST returns 405 and never reads Firestore;
- invalid page returns 400 and never reads Firestore;
- repository failure returns safe 500;
- response includes `Content-Type: application/json`.

- [ ] **Step 2: Implement `createDirectoryHandler(reader)`**

The handler must have no import from Places, no secret binding and no write dependency.

- [ ] **Step 3: Export `directorio`**

Add to `functions/src/index.ts`:

```ts
export const directorio = onRequest(
  {
    region: "us-central1",
    maxInstances: 5,
    timeoutSeconds: 30,
  },
  createDirectoryHandler(reader),
);
```

- [ ] **Step 4: Run all backend unit tests and build**

Run:

```bash
npm --prefix functions test
npm --prefix functions run build
```

Expected: all unit tests PASS; both exports are present.

---

### Task 10: IP whitelist middleware, held until IPs are provided

**Files:**
- Create: `functions/src/shared/ip-whitelist.ts`
- Modify: `functions/src/index.ts`
- Test: `functions/test/shared/ip-whitelist.test.ts`

**Interfaces:**
- Consumes: request IP plus comma-separated `ALLOWED_IPS` parameter.
- Produces: early HTTP 403 or delegation to the wrapped handler.

**Execution gate:** Do not execute this task until the user supplies the public IPs. Loopback addresses remain allowed only in the emulator. Production deployment is blocked if the resolved allowlist is empty.

- [ ] **Step 1: Write failing normalization tests with documentation-only sample IPs**

Test these sample values, which are reserved for documentation:

- `203.0.113.10` matches exactly;
- `::ffff:203.0.113.10` normalizes to `203.0.113.10`;
- `2001:db8::10` matches exactly;
- `198.51.100.7` is rejected;
- comma-separated values are trimmed and empty entries removed.

- [ ] **Step 2: Write failing early-return middleware tests**

Assert a rejected request returns 403 and the wrapped handler call count remains zero. Assert an accepted request delegates once.

- [ ] **Step 3: Implement exact-match middleware**

Define:

```ts
export function parseAllowedIps(raw: string): ReadonlySet<string>;
export function normalizeIp(raw: string): string;
export function withIpWhitelist(
  allowedIps: () => ReadonlySet<string>,
  handler: (request: Request, response: Response) => Promise<void>,
): (request: Request, response: Response) => Promise<void>;
```

Use the platform request IP after proxy normalization. Do not accept CIDR ranges in the first version.

- [ ] **Step 4: Bind a non-secret Functions parameter to both functions**

Use `defineString("ALLOWED_IPS")`. Wrap both HTTP handlers. Configure loopback values in `functions/.env.local` for emulator use; exclude that file from Git.

- [ ] **Step 5: Run middleware tests**

Expected: allowed test IP delegates; rejected test IP returns 403 before mocked Places/Firestore dependencies are called.

---

### Task 11: Minimal TypeScript UI

**Files:**
- Modify: `web/index.html`
- Create: `web/src/types.ts`
- Create: `web/src/api.ts`
- Modify: `web/src/main.ts`
- Modify: `web/src/styles.css`
- Create: `web/src/api.test.ts`
- Create: `web/src/main.test.ts`
- Create: `web/vite.config.ts`

**Interfaces:**
- Consumes: same-origin `GET /directorio`.
- Produces: accessible search/filter form, result table, loading/error/empty states and previous/next controls.

- [ ] **Step 1: Configure Vitest with jsdom**

Update `web/package.json` scripts:

```json
{
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Update Vite config to use jsdom for tests while preserving the vanilla TypeScript build.

Create `web/vite.config.ts`:

```ts
import {defineConfig} from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
  },
});
```

- [ ] **Step 2: Write failing API-client tests**

Assert `fetchDirectory` encodes:

```text
/directorio?page=2&pageSize=20&especialidad=Pediatr%C3%ADa&zona=10
```

Assert non-2xx responses become a user-safe `DirectoryApiError` without HTML or server stack details.

- [ ] **Step 3: Implement API DTOs and client**

Mirror `MedicoDto` and `DirectoryPage` in `web/src/types.ts`. Implement:

```ts
export async function fetchDirectory(
  query: {page: number; pageSize: number; especialidad?: string; zona?: string},
  fetchImpl: typeof fetch = fetch,
): Promise<DirectoryPage>
```

- [ ] **Step 4: Write failing rendering tests**

Using Testing Library, assert:

- initial form labels are associated with controls;
- submit renders returned names and links;
- missing phone/site displays `No disponible`;
- empty page displays `No se encontraron médicos`;
- failed request displays a safe error;
- Previous is disabled on page 1;
- Next is disabled when `hasNextPage` is false.

- [ ] **Step 5: Implement the UI state machine**

Use one state object:

```ts
interface UiState {
  page: number;
  pageSize: number;
  especialidad?: string;
  zona?: string;
  loading: boolean;
  error?: string;
  result?: DirectoryPage;
}
```

Specialty options: blank, Pediatría, Cardiología, Dermatología. Zone options: blank, 1, 9, 10. Render text with DOM `textContent`; never use untrusted API strings in `innerHTML`.

- [ ] **Step 6: Implement minimal responsive styling**

Requirements:

- readable table at desktop widths;
- horizontal table scroll on narrow screens;
- visible keyboard focus;
- buttons at least 44 px high;
- loading and error messages announced with `aria-live`;
- no external font, image or analytics requests.

- [ ] **Step 7: Run UI tests and production build**

Run:

```bash
npm --prefix web test
npm --prefix web run build
```

Expected: PASS and `web/dist/index.html` created.

---

### Task 12: Firestore emulator integration and end-to-end local verification

**Files:**
- Create: `functions/test/integration/firestore-emulator.test.ts`
- Modify: root `package.json`
- Create locally: `functions/.env.local` (ignored)

**Interfaces:**
- Consumes: compiled Functions, Firestore Emulator and Hosting Emulator.
- Produces: evidence that writes, filters, pagination and rewrites work without cloud consumption.

- [ ] **Step 1: Write the emulator integration test**

Test against `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`:

1. clear collection `medicos`;
2. save 20 deterministic candidates;
3. save five of them again and assert created/updated counts;
4. query Pediatría/zone 10 with page size 10;
5. assert stable first and second pages;
6. assert no duplicate `place_id` documents;
7. clear test data.

- [ ] **Step 2: Add a one-command CI-style emulator script**

Add root script:

```json
{
  "test:emulators": "firebase emulators:exec --only firestore,functions,hosting \"npm --prefix functions run test:integration\""
}
```

- [ ] **Step 3: Provide a local non-secret allowlist**

Create ignored `functions/.env.local`:

```dotenv
ALLOWED_IPS=127.0.0.1,::1
```

Do not copy the Places key into this file; unit and integration tests inject a fake client.

- [ ] **Step 4: Run all local verification**

Run:

```bash
npm test
npm run build
npm run test:emulators
```

Expected: all tests PASS; no network request reaches Places; no production resource changes.

- [ ] **Step 5: Manually verify the Hosting rewrite in emulators**

Run `npm run emulators`, record the task-owned process/session, open `http://127.0.0.1:5000`, perform a search against seeded emulator data, then stop the emulator gracefully with Ctrl-C and verify the process exits.

Expected: UI loads, `/directorio` resolves through Hosting, table paginates, and all temporary processes stop.

---

### Task 13: Cloud services, secret, controlled real data and deployment

**Files:**
- Modify only if generated by validated deploy tooling: `.firebaserc`, `firebase.json`, lockfiles.
- Create: `docs/evidencias/` screenshots after redaction.

**Interfaces:**
- Consumes: fully passing local build, approved billing gate and production IP list.
- Produces: deployed Functions/Hosting and a small Firestore dataset.

**Execution gate:** This task begins only after Tasks 1–12 pass, the user confirms visible promotional balance/expiry, and the whitelist contains real demo IPs.

- [ ] **Step 1: Install and authenticate Google Cloud CLI only if needed**

Run read-only checks first:

```bash
command -v gcloud
gcloud auth list
gcloud config get-value project
```

If absent, install Google Cloud CLI with Homebrew, authenticate interactively, and set only this working session/project to `proyecto1responsibleai`.

```bash
brew install --cask google-cloud-sdk
gcloud auth login
gcloud config set project proyecto1responsibleai
gcloud config get-value project
```

Expected: the final command prints `proyecto1responsibleai`.

- [ ] **Step 2: Enable the minimum services**

Enable:

```bash
gcloud services enable \
  firestore.googleapis.com \
  cloudfunctions.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  places.googleapis.com \
  --project proyecto1responsibleai
```

Run `gcloud services list --enabled --project proyecto1responsibleai` and verify every exact service name above appears.

- [ ] **Step 3: Create Firestore Native in `us-central1`**

Confirm the selected location before submitting because database location is not a routine reversible setting. Verify with Firebase CLI that the database is listed afterward.

After the confirmation, run exactly once:

```bash
gcloud firestore databases create \
  --database='(default)' \
  --location=us-central1 \
  --type=firestore-native \
  --project=proyecto1responsibleai
npx firebase firestore:databases:list --project proyecto1responsibleai
```

Expected: the default Native database reports location `us-central1`.

- [ ] **Step 4: Store the existing key without printing it**

Use the existing `.env` value as stdin for:

```bash
sed -n 's/^PLACES_API=//p' .env | \
  npx firebase functions:secrets:set GOOGLE_PLACES_API_KEY \
  --project proyecto1responsibleai
```

Never place the value directly in the command line. Verify only secret metadata/version existence; do not access or echo the secret value.

- [ ] **Step 5: Restrict the key and re-check quota in Cloud Console**

Application restriction decision:

- API restriction: Places API (New) only.
- IP restriction: not applied to the key unless static function egress is deliberately added.
- Function endpoint whitelist: real IP list supplied by the user.

Record redacted screenshots.

- [ ] **Step 6: Deploy a minimal production checkpoint**

Deploy Functions first and verify:

```bash
npx firebase deploy --only functions --project proyecto1responsibleai
```

- unauthorized IP receives 403;
- authorized IP can call `GET /directorio` and receives an empty page;
- no Places request is made during this checkpoint.

- [ ] **Step 7: Execute one controlled Places collection**

Use:

```json
{
  "keyword": "pediatra zona 10 Ciudad de Guatemala",
  "zona": "10",
  "especialidad": "Pediatría"
}
```

Expected: at most 20 documents, each keyed by `place_id`, with one timestamp and the exact keyword. Immediately inspect Google Maps Platform usage and confirm it remains inside the configured quota/free tier.

- [ ] **Step 8: Expand only through the approved keyword matrix**

Run additional queries sequentially for zones 1, 9 and 10 across Pediatría, Cardiología and Dermatología. After every invocation record result count and check quota usage. Stop immediately on unexpected SKU, 429, billing alert or malformed data.

- [ ] **Step 9: Deploy Hosting and perform production smoke tests**

Run:

```bash
npm --prefix web run build
npx firebase deploy --only hosting --project proyecto1responsibleai
```

Verify:

- Hosting URL loads over HTTPS;
- authorized demo IP can search and paginate;
- unauthorized network receives 403 before Firestore access;
- direct Firestore client access is denied;
- UI contains the ethical notice and collection dates.

---

### Task 14: Documentation, architecture, ethics and presentation

**Files:**
- Create: `docs/keywords.md`
- Create: `docs/arquitectura.md`
- Create: `docs/postura-etica.md`
- Create: `docs/entrega-tecnica.md`
- Create: `docs/presentacion/guion.md`
- Create: `docs/presentacion/demo-checklist.md`

**Interfaces:**
- Consumes: verified architecture, tests, screenshots, deployed URLs and real collection matrix.
- Produces: all Week 4 written and presentation deliverables.

- [ ] **Step 1: Document the keyword matrix**

For every invocation record:

```text
especialidad | zona | keyword exacta | fecha | encontrados | creados | actualizados
```

Explain nomenclature variation and why no specialty is inferred from a returned place.

- [ ] **Step 2: Document architecture and operational flow**

Include the approved Mermaid diagram, component responsibilities, Secret Manager boundary, Firestore rule posture, IP whitelist flow and the difference between endpoint IP filtering and API-key egress restriction.

- [ ] **Step 3: Finalize the ethical posture**

State explicitly:

- academic scope and Google ToS limitation;
- directory is not medical credential validation;
- missing data remains empty;
- website may represent a clinic;
- every result shows collection date;
- no manual enrichment or inferred claims.

- [ ] **Step 4: Produce the maximum-five-page technical document**

Use this page allocation:

1. problem, scope and architecture;
2. infrastructure, billing and security;
3. collection, data model and keyword strategy;
4. API, UI and testing evidence;
5. ethical posture, limitations and production recommendations.

- [ ] **Step 5: Prepare the 20-minute presentation**

Timebox:

- 2 min: problem and responsibility constraints;
- 4 min: architecture and security;
- 4 min: collection and data quality;
- 5 min: live demo;
- 3 min: testing, costs and limitations;
- 2 min: ethical posture and close.

- [ ] **Step 6: Prepare demo contingency**

The checklist must include:

- preloaded Firestore data;
- screenshots of successful collection and API response;
- local emulator fallback;
- known authorized demo IP;
- no dependency on making a fresh billable Places call live.

- [ ] **Step 7: Run the final verification suite**

Run:

```bash
npm test
npm run build
npm run test:emulators
git status --short
```

Expected: all checks PASS; no secret files tracked; only intentional project and documentation files appear as changes. Do not commit until the user explicitly authorizes it.

---

## Completion Gate

Implementation is complete only when:

- billing link, credit visibility, budget alerts and quota evidence are verified;
- all unit and emulator tests pass;
- each collection invocation returns at most 20;
- duplicate place IDs do not create duplicate documents;
- API validation enforces `pageSize <= 50`;
- both specialty and zone filters work together;
- unauthorized IPs return 403 before business logic;
- UI works through Firebase Hosting;
- the deployed dataset contains collection dates and no inferred fields;
- documentation and presentation materials cover all weekly deliverables;
- `.env` and the Places key remain outside Git history;
- no task-owned emulator, server or browser process remains running.
