# Diseño: IP whitelist para recolección

**Fecha:** 2026-08-11  
**Alcance:** proteger `recolectarMedicos` antes de validar el request, leer la API key, llamar Places o acceder a Firestore.

## Decisión

La lista autorizada vivirá en Secret Manager como `IP_WHITELIST`, con un arreglo JSON de direcciones exactas:

```json
["127.0.0.1", "::1", "203.0.113.10"]
```

No se implementará administración desde la UI pública. Agregar o eliminar una IP significa crear una versión nueva con la lista completa y redesplegar `recolectarMedicos`. Para el alcance académico no se admitirán rangos CIDR.

## Middleware y orden de ejecución

Un wrapper independiente se ejecutará antes del handler de recolección:

1. Obtiene la IP desde la primera entrada de `X-Forwarded-For`, que Cloud Run Functions incorpora a la solicitud.
2. Si el header no existe, usa la dirección del socket para permitir pruebas directas en el emulador.
3. Normaliza espacios, IPv4 representada como IPv6 (`::ffff:`), corchetes y representación IPv6.
4. Valida el JSON de `IP_WHITELIST` y normaliza todas sus entradas.
5. Si la IP no está autorizada o no puede identificarse, responde `403` con `IP_FORBIDDEN` y no llama al handler.
6. Si la configuración es inválida, falla cerrado con `500 INTERNAL` y tampoco llama al handler.
7. Solo una IP autorizada llega a `createRecolectarHandler`.

`directorio` no cambia en este alcance: la protección se limita al endpoint que consume cuota de Places, conforme a la decisión aprobada por el usuario.

## Configuración

`functions/src/index.ts` declarará `IP_WHITELIST` con `defineJsonSecret` y lo enlazará junto con `GOOGLE_PLACES_API_KEY` únicamente a `recolectarMedicos`. Localmente, `functions/.secret.local` contendrá loopback y la IP de prueba; permanece ignorado por Git.

La documentación incluirá comandos para:

- ver el valor actual;
- sustituir la lista completa;
- redesplegar solo `recolectarMedicos`;
- probar un request autorizado y uno rechazado.

## Pruebas

Las pruebas unitarias cubrirán:

- primera IP de una cadena `X-Forwarded-For`;
- fallback al socket;
- normalización IPv4-mapped e IPv6;
- IP autorizada delega exactamente una vez;
- IP no autorizada devuelve 403 y no delega;
- IP ausente devuelve 403;
- secreto vacío, JSON inválido o entradas inválidas devuelven 500 sin delegar;
- la API key y el servicio de recolección no se leen para requests bloqueados.

La verificación local ejecutará el endpoint con una whitelist temporal y confirmará HTTP 200 para loopback y HTTP 403 para una IP simulada no autorizada, sin consumir Places en el caso bloqueado.
