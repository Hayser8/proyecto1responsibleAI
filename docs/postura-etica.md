# Postura ética y uso responsable

## Propósito limitado

Este directorio es un ejercicio académico. No es un registro profesional, una certificación médica, un sistema clínico ni un sustituto de orientación médica. Su eventual uso de datos de Google Places API (New) queda sujeto a los términos vigentes de Google; antes de recolectar o publicar datos reales deben revisarse las condiciones aplicables de almacenamiento, visualización, atribución y retención.

No se ha realizado ninguna llamada real a Places ni se publican resultados reales en este estado del proyecto.

## Qué afirma y qué no afirma

Una fila solo representa información entregada por Places en una fecha determinada para una keyword documentada. No confirma:

- título, licencia, colegiación, especialidad o vigencia profesional;
- que el lugar pertenezca a una sola persona;
- calidad, disponibilidad, precios ni idoneidad clínica;
- cobertura completa de profesionales en una zona.

El sitio web devuelto puede pertenecer a una clínica, hospital o grupo y no necesariamente al profesional nombrado. La ausencia de un resultado o campo no demuestra que el médico o dato no exista.

## Integridad de datos

- La especialidad y zona provienen de la invocación explícita; no se infieren de texto devuelto.
- `place_id` se usa como identidad técnica para evitar duplicados.
- Teléfono o sitio web ausentes permanecen vacíos y la UI los presenta como “No disponible”.
- No se agregan redes sociales, datos manuales, otras fuentes ni afirmaciones inferidas.
- Cada registro muestra `fecha_recoleccion` y conserva `keyword_usado` para trazabilidad.
- Una actualización reemplaza o completa únicamente campos permitidos del mismo `place_id`; no fusiona identidades por similitud de nombres.

## Sesgos y límites de cobertura

Places es una plataforma comercial y sus resultados pueden reflejar ranking, disponibilidad digital, idioma, densidad urbana y calidad desigual de fichas. La matriz de tres especialidades y tres zonas es una muestra académica, no representativa de Ciudad de Guatemala. Debe explicarse esta limitación al presentar conteos y evitar comparaciones de calidad o suficiencia sanitaria entre zonas.

## Privacidad y seguridad

El sistema solo contempla información pública de establecimientos entregada por Places; no solicita historias clínicas, diagnósticos ni datos de pacientes. La API key no pertenece al conjunto de datos y nunca debe aparecer en cliente, logs, documentación ni capturas.

La key dedicada ya está restringida a Places API (New) y `SearchTextRequest` tiene una cuota diaria efectiva de 100. Aún deben existir una whitelist de IP con direcciones públicas autorizadas, un despliegue controlado y revisión del gasto antes de una demo cloud. Estos controles pendientes explican por qué no se han ejecutado llamadas reales ni publicado datos. El estado demostrable actual es local en `http://127.0.0.1:5002`, con 25 fixtures deterministas de Pediatría, zona 10.

## Compromiso de comunicación

Toda demostración debe decir de forma visible:

> Este directorio es una referencia académica; no certifica credenciales ni sustituye orientación médica profesional.

No se presentarán fixtures como médicos reales, métricas pendientes como resultados, ni arquitectura planeada como despliegue completado.
