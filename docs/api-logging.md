# Auditoría de llamadas HTTP

Cada llamada a `directorio` y `recolectarMedicos` genera una línea JSON con:

- `timestamp`: hora UTC en formato ISO.
- `route`, `method`, `status` y `durationMs`.
- `payload`: query string para GET o cuerpo JSON para POST.
- `requestId`: identificador para correlacionar una solicitud.

Los valores que parezcan credenciales, tokens, contraseñas, cookies o claves API se reemplazan por `[REDACTED]`. No se registran headers ni la whitelist de IPs.

En producción se escribe JSON en stdout para que Firebase lo ingrese en Cloud Logging. El filesystem de Cloud Functions es efímero, así que no se usa como almacenamiento permanente.

En el emulador, las mismas líneas se guardan como texto JSON Lines en `functions/logs/api-calls.ndjson`, que está excluido de Git. Para observarlo en PowerShell:

```powershell
Get-Content .\functions\logs\api-calls.ndjson -Wait
```

Para revisar el flujo local con datos visibles, primero levanta los emuladores y luego ejecuta:

```powershell
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
$env:GCLOUD_PROJECT = "demo-proyecto1responsibleai"
npm --prefix functions run seed:emulator
```

Los registros del seed están marcados como ficticios y nunca se cargan en producción.
