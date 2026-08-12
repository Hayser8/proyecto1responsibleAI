# Postura ética y uso responsable

## Propósito y límites

Este proyecto ofrece un directorio informativo de médicos obtenido de fuentes públicas. No diagnostica, recomienda tratamientos ni sustituye la atención de profesionales de salud. La información puede estar incompleta, desactualizada o contener errores; la persona usuaria debe confirmar los datos con el establecimiento o profesional.

## Privacidad y minimización de datos

Sólo se almacenarán los datos públicos necesarios para el directorio: nombre, especialidad, ubicación, teléfono, sitio web, identificador de lugar y metadatos de recolección. No se recopilan historiales clínicos, diagnósticos, datos de pacientes ni información de contacto de personas usuarias.

## Seguridad y acceso

Firestore niega todo acceso directo de clientes. Las operaciones se realizarán mediante funciones de servidor que validan la entrada y aplican controles de autorización. Las claves de proveedores externos se configuran como secretos o variables de entorno locales y nunca se versionan.

## Calidad, transparencia y correcciones

Se indicará el origen público de la información y su fecha de recolección. El equipo atenderá solicitudes razonables de corrección o eliminación de fichas, y revisará periódicamente la calidad de los resultados y el posible sesgo de cobertura geográfica o de especialidades.

## Control de costos

La recolección futura tendrá límites de resultados y control de solicitudes. Firebase Functions fija un límite de instancias para reducir picos de gasto. El equipo debe usar presupuestos y alertas de facturación en el proyecto de Firebase antes de desplegar servicios que consuman APIs pagadas.
