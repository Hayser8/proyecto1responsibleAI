# Limitación de ráfagas (rate limiting)

**Mitigación de ráfagas, best-effort por instancia.** Este control acota el ritmo de solicitudes; no garantiza un número exacto por ventana. La diferencia importa y se explica abajo.

El middleware vive en `functions/src/security/rate-limit.ts` y envuelve las dos Functions HTTP. Usa un token bucket en memoria: cada clave guarda tokens disponibles y el instante de la última recarga. Se eligió token bucket sobre ventana fija porque la ventana fija admite el doble del límite en su borde (seis solicitudes instantáneas con un límite de tres), mientras que el bucket acota la ráfaga en el valor declarado y permite calcular un `Retry-After` verdadero.

## Límites configurados

Las constantes están en `functions/src/index.ts`. Cambiarlas requiere redesplegar; no son secretos ni parámetros de consola.

| Function | Ráfaga | Por IP/minuto | Global/minuto | Claves máximas |
|---|---:|---:|---:|---:|
| `recolectarMedicos` | 3 | 6 | 10 | 64 |
| `directorio` | 30 | 30 | 120 | 1000 |

`recolectarMedicos` es restrictivo porque cada solicitud consume cuota de Google Places. El protocolo de [keywords.md](./keywords.md) exige ejecutar una fila por vez y revisar el consumo después de cada invocación, así que seis por minuto no estorba al operador y corta un bucle de reintentos en aproximadamente un segundo.

`directorio` es más permisivo porque es lectura pública de Firestore. La UI genera un `GET` por búsqueda, uno por clic de paginación y uno automático tras una recolección exitosa; los botones se deshabilitan durante la carga y no existe reintento automático en el cliente. Una persona no supera unas diez solicitudes por minuto; un bucle de `curl` agota treinta en dos segundos.

El límite global por instancia existe porque quien pueda rotar o falsificar `X-Forwarded-For` cambia de bucket por IP a voluntad. El bucket global es lo único que acota ese caso, y también es por instancia.

## Orden respecto a la whitelist

En `recolectarMedicos` el limitador va **por dentro** de `withIpWhitelist`:

```ts
withIpWhitelist(withRateLimit(handler, RECOLECCION_RATE_LIMIT), () => ipWhitelist.value())
```

[ip-whitelist.md](./ip-whitelist.md) afirma que una invocación no autorizada recibe 403 antes de cualquier otra cosa. Con el limitador por fuera, una IP no autorizada podría recibir 429 en vez de 403 y esa afirmación quedaría falsa; además, tráfico de internet poblaría el mapa de buckets sin haber pasado ningún control. La prueba `lets the whitelist reject before the limiter records anything` fija ese orden en código.

`directorio` no tiene whitelist, así que el limitador es su único middleware.

## Contrato de respuesta

```
HTTP/1.1 429 Too Many Requests
Retry-After: <segundos enteros, mínimo 1>
Content-Type: application/json

{"error":{"code":"RATE_LIMITED","message":"Demasiadas solicitudes. Espere unos segundos."}}
```

`RATE_LIMITED` no colisiona con los códigos ya usados: `INVALID_REQUEST`, `METHOD_NOT_ALLOWED`, `UNSUPPORTED_MEDIA_TYPE`, `IP_FORBIDDEN`, `INTERNAL`, `PLACES_QUOTA` y `PLACES_ERROR`. La respuesta no revela el límite ni el conteo actual: ese dato ayudaría a calibrar una evasión y no le sirve a quien usa la aplicación de buena fe.

`Retry-After` es el único punto del proyecto donde una respuesta de error fija un header propio. Se acepta porque es la parte accionable de un 429 y porque una solicitud rechazada no descuenta tokens de ningún bucket: el middleware recarga ambos y decide antes de consumir, de modo que rechazar por el límite global tampoco drena el cupo de la IP. Dos pruebas fijan esa propiedad: `keeps Retry-After truthful when a rejected client retries early` y `does not spend the per-IP token when the global limit rejects`.

## Tres orígenes distintos para un mismo 429

Un 429 puede venir de la cuota diaria de Google Places (`PLACES_QUOTA`), de este limitador (`RATE_LIMITED`) o de la plataforma al saturarse. El status no los distingue; solo el código del cuerpo.

Por eso `web/src/api.ts` lee `error.code` antes de elegir el mensaje. Sin eso, la interfaz diría "Se alcanzó la cuota de Google Places. Intente mañana." cuando Places ni siquiera fue llamado y el cupo se libera en segundos. El cliente **compara** el código pero nunca muestra el `message` del servidor: siempre usa una constante local, de modo que un cuerpo con HTML o trazas no puede llegar a la pantalla.

## Verificación local sin consumir Places

Con los emuladores activos:

```bash
for i in $(seq 1 40); do curl -s -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:5002/directorio?page=1&pageSize=20'; done
```

Se esperan alrededor de treinta códigos `200` seguidos de `429`. Igual que las recetas de [ip-whitelist.md](./ip-whitelist.md), esto comprueba el comportamiento funcional del emulador y **no demuestra el límite en producción**.

Aviso para quien pruebe en local: todo el tráfico del emulador cae en la clave `127.0.0.1`, así que el cupo se agota entre todas las personas que prueben a la vez. Cada Function tiene su propio limitador y no comparten contador, pero los `curl` de [ip-whitelist.md](./ip-whitelist.md) apuntan a `recolectarMedicos`, cuya ráfaga es de solo tres: repetirlos seguido devuelve `429` en vez del `405` esperado. Un 429 local durante una demo no es un fallo del sistema.

## Lo que este control no garantiza

1. **No garantiza un número exacto por ventana.** El contador vive por instancia y el ruteo de Cloud Run no es pegajoso por IP. El techo real es el límite multiplicado por `maxInstances`: hasta 12 por minuto en `recolectarMedicos` (6 × 2) y hasta 150 por minuto y por IP en `directorio` (30 × 5).
2. **No sostiene un presupuesto diario.** Ninguna Function declara `minInstances`, así que ambas escalan a cero; cada arranque en frío y cada despliegue crean un mapa vacío. La única garantía diaria sobre Places sigue siendo el override de cuota de 100 `SearchTextRequest` que aplica Google del lado servidor. Este limitador aporta control de ráfaga, no de cuota.
3. **No es inmune a suplantación de `X-Forwarded-For`.** Hereda la advertencia completa de [ip-whitelist.md](./ip-whitelist.md), y aquí pesa más: la whitelist falla cerrada ante un header extraño (403) y el limitador falla abierto (bucket nuevo con la ráfaga completa).
4. **No detiene un ataque distribuido.** Limitar por IP no hace nada frente a muchas IP. Esto no es protección contra denegación de servicio y no debe describirse así.
5. **La expulsión por antigüedad descarta estado.** Quien controle más direcciones que `maxKeys` puede desalojar la entrada de un cliente legítimo y reiniciarle el contador. Es inherente a un limitador en memoria acotado; la alternativa, rechazar claves nuevas al llenarse, convertiría una rociada de IP en denegación de servicio contra usuarios legítimos.
6. **Castiga a quienes comparten NAT.** `directorio` es público: una red universitaria o una red móvil comparten un solo cupo. Con varias personas evaluando desde la misma red durante la demo, comparten los treinta por minuto.
7. **No reduce el costo de invocación.** Una solicitud rechazada sigue siendo una invocación facturada. Lo que ahorra es el trabajo posterior: la llamada a Places y las lecturas de Firestore.
8. **No pone techo al gasto mensual.** Nada en este diseño lo pone. El presupuesto de USD 270 con alertas notifica, pero no detiene el consumo.
9. **No mide cuánto rechaza.** No hay métricas ni registro estructurado de rechazos, así que no puede afirmarse después que el limitador evitó una cantidad concreta de llamadas.
10. **No está desplegado.** Igual que la whitelist, el estado honesto es **implementado en código; despliegue pendiente**. Toda cifra sobre su comportamiento en cloud es una predicción, no una medición.
11. **Los límites son juicios, no mediciones.** Salen del protocolo de recolección documentado y del uso observable de la interfaz. No hay telemetría de producción porque no hay producción.

## Relación con los otros controles

Son cuatro controles ortogonales y ninguno sustituye a otro:

- la **whitelist de IP** decide *quién* puede recolectar;
- la **restricción de la API key** decide *dónde* vale la credencial;
- la **cuota de Places** decide *cuánto* por día;
- el **limitador de ráfagas** decide *a qué ritmo*.
