# Verificación de facturación y crédito (redactada)

Fecha de revisión: 2026-08-02

La evidencia fue revisada manualmente por la persona autorizada. No se copia ninguna captura a Git y este registro no contiene identificadores completos de cuenta de facturación ni de crédito.

## Enlace de facturación

- La respuesta ya verificada de Cloud Billing API indicó `billingEnabled=true` para `proyecto1responsibleai`.
- La cuenta de facturación enlazada con `proyecto1responsibleai` coincidió con la cuenta proporcionada por la persona usuaria; su identificador permanece redactado.

## Crédito promocional

- Crédito de actualización de prueba gratuita: **activo y disponible**.
- Importe original: **USD 300**.
- Importe restante: **USD 300 (100 %)**.
- Inicio: **2026-07-17**.
- Vencimiento: **2026-10-16**.

## Presupuesto

- Presupuesto mensual de la cuenta de facturación: **USD 270**.
- Alertas configuradas: **25 %, 50 % y 90 %**.
- Gasto actual: **USD 0.00**.
- Créditos usados: **ninguno**.
- El alcance del presupuesto es la **cuenta de facturación completa**. Por el enlace de facturación verificado, incluye `proyecto1responsibleai`; no es un presupuesto exclusivo de ese proyecto.

## Control de Places

La tercera captura inicial revisada no era evidencia de cuota: correspondía a **“My First Project”**, solo mostraba tráfico de API y no mostraba la cuota de Places. La configuración se verificó posteriormente en el proyecto correcto:

- Las APIs necesarias están habilitadas en `proyecto1responsibleai`, incluida API Keys API (`apikeys.googleapis.com`).
- Places API (New) tiene un override diario efectivo de **100** solicitudes para `SearchTextRequest`; el valor predeterminado anterior era 75,000.
- El secreto `GOOGLE_PLACES_API_KEY` apunta en `latest` a la versión **2**, estado **ENABLED**.
- La versión 2 contiene una key dedicada al proyecto número `487068590350`, con target de API únicamente `places.googleapis.com`.
- La versión anterior del secreto correspondía a otro proyecto y **no fue eliminada**; no es la versión `latest`.

No se realizó ninguna solicitud real a Places durante esta verificación.

## Infraestructura cloud verificada

- Firestore `(default)` fue creado en modo **Native**, edición **Standard**, región `us-central1` y con delete protection.
- No se desplegaron Functions ni Hosting.
- La whitelist de IP continúa pendiente por instrucción de la persona usuaria.
