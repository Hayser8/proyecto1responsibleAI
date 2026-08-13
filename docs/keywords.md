# Keywords de Google Places

`POST /recolectarMedicos` acepta exactamente una keyword editable y la clasificación que se guardará:

```json
{"keyword":"pediatra infantil zona 10 Ciudad de Guatemala","especialidad":"Pediatría","zona":"10"}
```

La keyword es obligatoria, normaliza espacios y admite hasta 120 caracteres. La especialidad continúa limitada al catálogo y la zona al rango 1–25. Cualquier otro campo recibe `400 INVALID_REQUEST`.

La UI propone inicialmente `<especialidad> zona <número> Ciudad de Guatemala`, pero permite reemplazar ese texto. Si la persona no ha personalizado la keyword, la sugerencia se actualiza al cambiar especialidad o zona.

La consulta exacta enviada a Places se conserva como `keyword_usado` en Firestore. Cada ejecución registra además fecha y conteos `encontrados`, `creados` y `actualizados`. Los fixtures del emulador prueban software, pero no representan cobertura real de Google Places.
