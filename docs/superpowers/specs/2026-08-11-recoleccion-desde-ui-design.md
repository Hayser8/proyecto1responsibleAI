# Diseño: recolección desde la interfaz

**Fecha:** 2026-08-11  
**Alcance:** permitir iniciar la recolección de Google Places desde la UI existente, sin consola.

## Decisión de experiencia

La aplicación mostrará una tarjeta independiente, antes de los filtros del directorio, llamada **Recolectar desde Google Places**. Separar la recolección de la consulta deja claro qué acción consume cuota y garantiza que filtrar o paginar nunca vuelva a llamar a Places.

La tarjeta tendrá:

- keyword de texto, inicialmente `pediatra zona 10 Ciudad de Guatemala`;
- especialidad entre Pediatría, Cardiología y Dermatología;
- zona entre 1, 9 y 10;
- botón `Recolectar desde Google Places`;
- aviso visible de que cada envío consume una solicitud de la cuota;
- estado accesible con las cantidades encontradas, creadas y actualizadas.

## Flujo de datos

1. La persona envía keyword, especialidad y zona.
2. La UI valida que los tres campos tengan valor y envía exactamente un `POST /recolectarMedicos` con JSON.
3. Mientras espera, bloquea el formulario de recolección para evitar el doble envío.
4. Si el POST termina correctamente, muestra `encontrados`, `creados` y `actualizados`.
5. Copia especialidad y zona a los filtros del directorio, vuelve a la página 1 y ejecuta un único `GET /directorio`.
6. La tabla muestra los documentos recién guardados junto con cualquier registro previo coincidente.

La API key nunca se incluirá en el navegador; Firebase Hosting enviará `/recolectarMedicos` a la Function, que obtiene el secreto en el servidor.

## Errores y costos

La UI tendrá un estado independiente para errores de recolección. Nunca mostrará HTML, trazas, secretos ni mensajes internos del proveedor. Para cuota agotada (`429`) mostrará una explicación específica; para validación (`400`) pedirá revisar los campos; para otros fallos usará un mensaje seguro y genérico.

El botón conservará un aviso de costo porque repetir una keyword vuelve a consumir Places aunque Firestore evite documentos duplicados. La whitelist de IP queda fuera de este cambio por instrucción del usuario y deberá resolverse antes de exponer públicamente el disparador de recolección.

## Componentes y pruebas

- `web/src/types.ts`: tipos de solicitud y resumen de recolección.
- `web/src/api.ts`: cliente `collectDoctors` para `POST /recolectarMedicos` y errores seguros.
- `web/src/main.ts`: tarjeta, estados, encadenamiento POST → GET y sincronización de filtros.
- `web/src/styles.css`: estilos responsivos y accesibles consistentes con la UI actual.
- `web/src/api.test.ts`: payload exacto, respuesta y errores públicos seguros.
- `web/src/main.test.ts`: render, bloqueo durante carga, resumen y refresco automático filtrado.

La implementación se hará con pruebas primero. El criterio de aceptación es que una sola acción de UI recolecte, anuncie el resumen y refresque la tabla sin exponer la API key ni hacer llamadas adicionales a Places durante consulta o paginación.
