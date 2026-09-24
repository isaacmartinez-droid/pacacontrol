# Funciones de altas

`activate-account` es pública únicamente en el sentido de que no exige una sesión previa. La autorización real es el token aleatorio, de un solo uso y con vencimiento. La función usa `service_role` solo en el servidor; nunca debe copiarse a variables `VITE_`.

Para pruebas:

```powershell
supabase functions deploy activate-account --project-ref zijfywqastacydmuqswv
supabase secrets set --project-ref zijfywqastacydmuqswv ALLOWED_ACTIVATION_ORIGINS="http://127.0.0.1:5174,URL_DEL_FRONTEND_DE_PRUEBA"
```

`supabase/config.toml` deja `verify_jwt = false` fijado para esta función. Es
necesario porque la persona todavía no tiene sesión; la autorización es la
invitación aleatoria, expirable y de un solo uso.

Antes de producción se repite el despliegue con el `project-ref` y dominio de producción, después de validar todo el flujo en pruebas.
