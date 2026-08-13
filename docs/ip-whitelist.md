# Estado de la whitelist IP

La whitelist de aplicación no protege `recolectarMedicos`. Se retiró de la composición de la Function porque un cliente puede enviar `X-Forwarded-For` y Node no puede demostrar por sí solo qué salto fue agregado por infraestructura confiable.

El código auxiliar de normalización IP se conserva para el uso aproximado del peer en rate limiting, pero `src/index.ts` no conecta `withIpWhitelist` a ninguna Function y el secreto `IP_WHITELIST` no es necesario.

La dirección de socket identifica al peer inmediato, no necesariamente la IP real del usuario detrás de Firebase Hosting, Cloud Run o un proxy. Si se necesita una política real por IP en producción, debe aplicarse en un ingreso controlado, por ejemplo un load balancer con Cloud Armor. No se debe reactivar una comparación directa contra `X-Forwarded-For`.
