# Matriz reproducible de keywords

Fecha de corte documental: 2026-08-02  
Proyecto: `proyecto1responsibleai`  
Estado: matriz inicial aprobada; cuota y key configuradas, pero invocaciones reales a Places **BLOQUEADAS** hasta completar whitelist y despliegue controlado.

## Regla de nomenclatura

Cada búsqueda usa una frase explícita y reproducible con esta forma:

```text
<especialista en singular> zona <número> Ciudad de Guatemala
```

La especialidad también se envía como campo separado. Nunca se deduce a partir del nombre, categoría, sitio web o texto devuelto por Places. Una variante como “clínica pediátrica” sería otra invocación y tendría su propia fila; no reemplaza silenciosamente una keyword ya registrada.

## Matriz inicial

| especialidad | zona | keyword exacta | fecha | encontrados | creados | actualizados |
|---|---:|---|---|---:|---:|---:|
| Pediatría | 1 | `pediatra zona 1 Ciudad de Guatemala` | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| Pediatría | 9 | `pediatra zona 9 Ciudad de Guatemala` | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| Pediatría | 10 | `pediatra zona 10 Ciudad de Guatemala` | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| Cardiología | 1 | `cardiólogo zona 1 Ciudad de Guatemala` | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| Cardiología | 9 | `cardiólogo zona 9 Ciudad de Guatemala` | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| Cardiología | 10 | `cardiólogo zona 10 Ciudad de Guatemala` | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| Dermatología | 1 | `dermatólogo zona 1 Ciudad de Guatemala` | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| Dermatología | 9 | `dermatólogo zona 9 Ciudad de Guatemala` | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| Dermatología | 10 | `dermatólogo zona 10 Ciudad de Guatemala` | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |

No se completan métricas con fixtures del emulador: esos datos prueban el software, no representan resultados de Places. La fecha y los tres conteos se registrarán únicamente después de una invocación real autorizada.

## Protocolo pendiente de ejecución

Ya se verificaron dos controles previos: `SearchTextRequest` tiene un override diario efectivo de **100** (predeterminado anterior: 75,000) y la key dedicada del proyecto está limitada a `places.googleapis.com`. No se ha efectuado ninguna llamada real.

Antes de cada llamada real también deben estar listas la whitelist con IP públicas autorizadas y el despliegue controlado. Esos controles siguen pendientes, por lo que las nueve filas permanecen **BLOQUEADAS**.

Cuando se abra el gate:

1. ejecutar una sola fila por vez, sin cambiar la keyword;
2. guardar fecha/hora y los conteos devueltos por la función;
3. revisar consumo y SKU después de cada invocación;
4. detenerse ante 429, SKU inesperado, alerta de gasto o datos malformados;
5. conservar campos ausentes como vacíos y no enriquecer manualmente;
6. no interpretar “no encontrado” como inexistencia del profesional.

Pediatría/zona 10 es el recorrido principal propuesto para la demo, pero su ejecución real y sus métricas siguen **PENDIENTES**.
