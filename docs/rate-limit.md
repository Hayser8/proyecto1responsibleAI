# Limitación de ráfagas

Este control funciona sin API keys ni configuración adicional. Es una mitigación best-effort por instancia, no autenticación ni una cuota global exacta. Usa token bucket en memoria y responde `429 RATE_LIMITED` con `Retry-After`.

| Function | Clave aproximada | Ráfaga | Por clave/minuto | Global/minuto | Claves máximas |
|---|---|---:|---:|---:|---:|
| `recolectarMedicos` | dirección del socket/peer | 3 | 6 | 10 | 64 |
| `directorio` | dirección del socket/peer | 30 | 30 | 120 | 1000 |

Solo los `POST` a `recolectarMedicos` consumen su bucket; otros métodos llegan al `405` sin gastar capacidad. `X-Forwarded-For` no se usa para construir la clave. Detrás de Firebase Hosting o Cloud Run, el peer puede ser un proxy compartido, por lo que varias personas podrían compartir bucket.

## Contrato

```http
HTTP/1.1 429 Too Many Requests
Retry-After: <segundos enteros, mínimo 1>
Content-Type: application/json

{"error":{"code":"RATE_LIMITED","message":"Demasiadas solicitudes. Espere unos segundos."}}
```

## Lo que no garantiza

- No decide quién puede recolectar; el endpoint sigue siendo público.
- El estado se reinicia con arranques en frío y despliegues.
- Cada instancia tiene buckets independientes; `maxInstances` multiplica el techo efectivo.
- No detiene ataques distribuidos ni fija presupuesto mensual.
- La cuota de Google Places sigue siendo el control para consumo diario.

Un límite global estricto requeriría almacenamiento compartido o un gateway administrado. Restringir quién puede escribir requeriría un control de acceso independiente.
