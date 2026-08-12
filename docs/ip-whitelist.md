# Administración de la whitelist IP

La whitelist protege el endpoint/Function de recolección `recolectarMedicos`, cuyo método válido es `POST`. El wrapper se ejecuta antes de validar el método, leer la key de Places, llamar Places o escribir en Firestore; por eso una invocación no autorizada recibe 403 incluso si usa `GET` u otro método. `GET /directorio` permanece sin whitelist para permitir la consulta pública del directorio académico.

La Function toma la primera dirección de `X-Forwarded-For` y la compara con la lista autorizada. Si el header no existe, usa la IP del socket. Solo en Firebase Functions Emulator, cuando tampoco existe IP de socket, usa `127.0.0.1` como candidato para soportar el rewrite interno de Hosting Emulator; esa dirección todavía debe estar incluida en la lista. Un header presente pero vacío o inválido nunca activa ese fallback, y producción sin IP recibe 403.

## Formato del secreto

El secreto `IP_WHITELIST` debe ser un arreglo JSON **no vacío** de direcciones IPv4 o IPv6 exactas. No se admiten rangos CIDR, nombres de host ni texto adicional. Ejemplo con direcciones reservadas para documentación:

```json
["203.0.113.10", "2001:db8::10"]
```

El middleware normaliza las representaciones equivalentes de IPv4/IPv6 antes de comparar y admite un único par exterior completo de corchetes alrededor de IPv6, por ejemplo `[2001:db8::10]`. No admite puertos, corchetes incompletos ni envolturas múltiples. Una lista inválida o vacía falla de forma cerrada con HTTP 500; una IP ausente o no autorizada recibe HTTP 403 con `IP_FORBIDDEN` y no ejecuta la recolección.

## Ver, reemplazar y desplegar

Usar estos comandos desde la raíz del repositorio:

```bash
npx firebase functions:secrets:access IP_WHITELIST --project proyecto1responsibleai
npx firebase functions:secrets:set IP_WHITELIST --project proyecto1responsibleai
npx firebase deploy --only functions:recolectarMedicos --project proyecto1responsibleai
```

El primer comando muestra el valor actual solo en una terminal privada. El segundo solicita el arreglo JSON completo y publica una nueva versión del secreto. Agregar o eliminar una IP no es una edición parcial: se reemplaza el arreglo completo y luego se vuelve a desplegar `recolectarMedicos` para que la nueva versión quede vinculada a la Function.

Como alternativa, en Google Cloud Console abrir **Secret Manager**, seleccionar `IP_WHITELIST`, crear una versión nueva con el arreglo JSON completo y volver a desplegar la Function con el último comando. La consola permite inspeccionar versiones y estados; no debe usarse la UI pública del directorio para administrar este control.

## Pruebas locales sin consumo de Places

Con Functions Emulator escuchando en su puerto predeterminado, estos comandos prueban el orden del middleware sin hacer una llamada válida a Places:

```bash
# IP autorizada: pasa la whitelist y GET llega al handler, que responde HTTP 405.
curl -i -H 'X-Forwarded-For: 127.0.0.1' \
  http://127.0.0.1:5001/proyecto1responsibleai/us-central1/recolectarMedicos

# IP no autorizada: la whitelist responde HTTP 403 antes del handler.
curl -i -H 'X-Forwarded-For: 198.51.100.77' \
  http://127.0.0.1:5001/proyecto1responsibleai/us-central1/recolectarMedicos
```

El primer ejemplo supone que `127.0.0.1` aparece en `functions/.secret.local`; el segundo usa una dirección reservada para documentación. Definir manualmente `X-Forwarded-For` solo comprueba el comportamiento funcional del emulador. **No demuestra la seguridad del ingreso de producción.**

## Uso local y límites de confianza

Para emuladores, `functions/.secret.local` puede definir `IP_WHITELIST` con direcciones de loopback o de prueba. Ese archivo está ignorado por Git y nunca debe subirse. El secreto, sus valores, la administración de IPs y cualquier listado de IPs no deben aparecer en la UI, logs, capturas compartidas ni repositorio.

El uso de la primera dirección de `X-Forwarded-For` es la decisión aprobada para este proyecto académico y supone que el ingreso administrado de Cloud Functions entrega una cadena confiable. Esa suposición debe comprobarse con la topología real: algunos balanceadores conservan valores de `X-Forwarded-For` enviados por el cliente antes de agregar otras direcciones. Por eso se deben probar tanto la URL directa de la Function desplegada como el rewrite de Firebase Hosting, incluido un header aportado por el cliente, antes de afirmar que la whitelist está endurecida para producción.

Este middleware académico no es inmune a suplantación en toda topología. Para producción, usar Cloud Armor o un load balancer/proxy controlado que reemplace un header dedicado con la IP verificada del cliente. No basta con cambiar de posición dentro de la cadena sin fijar y validar primero el número y comportamiento de los proxies.
