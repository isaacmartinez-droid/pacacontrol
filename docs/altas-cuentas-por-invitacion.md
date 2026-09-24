# Altas de cuentas por invitación

Fecha: 19 de septiembre de 2026.

## Decisión

Las cuentas comerciales no se crean con registro público ni compartiendo una
contraseña provisional. El administrador crea una invitación, la persona
responsable abre un enlace de un solo uso, acepta los documentos vigentes y
define su propia contraseña.

Este flujo es independiente de promociones, recompensas y descuentos. Una
invitación autoriza crear una cuenta; un beneficio comercial solo modificará el
importe futuro de una cuenta ya identificada.

## Flujo

1. El administrador abre **Cuentas > Crear cuenta** y registra negocio,
   responsable, usuario, contacto, plan y vigencia.
2. PostgreSQL genera un token aleatorio de 128 bits representado en 22
   caracteres base64url. Guarda únicamente su huella SHA-256 y devuelve el
   token original una vez para construir el enlace.
3. El cliente abre `/bienvenida/{código}`, revisa la cuenta preparada, acepta términos y
   privacidad y define una contraseña de al menos 10 caracteres.
4. La Edge Function reclama la invitación de manera atómica, crea el usuario
   mediante la API administrativa y finaliza la activación. La cuenta queda
   `active`, con rol `owner` y onboarding `pending`.
5. La aplicación inicia sesión y lleva al cliente a `/configurar-negocio`.

Una invitación vencida, revocada, utilizada o que ya está siendo procesada no
puede volver a reclamarse. Si la creación de Auth falla, el backend libera la
invitación. Si falla la finalización, elimina el usuario recién creado antes de
liberarla.

## Fronteras de seguridad

- `service_role` solo existe dentro de la Edge Function.
- El navegador administrativo invoca únicamente RPC concedidas a
  `authenticated`; todas validan `current_account_is_admin()`.
- Una cuenta normal no puede crear, listar ni revocar invitaciones.
- Las RPC de reclamación y finalización solo se conceden a `service_role`.
- La tabla no tiene permisos para `anon` ni `authenticated` y tiene RLS activa.
- El token completo no se puede recuperar después de cerrar el resultado de
  creación; solo se conserva una pista de ocho caracteres para soporte.
- Los enlaces históricos `/activar?token=...` continúan funcionando hasta su
  vencimiento, pero todas las invitaciones nuevas usan la ruta breve.
- El alta siempre produce `account_role = 'owner'`. El formulario no ofrece
  crear administradores ni el plan interno.

La creación administrativa de usuarios debe ejecutarse exclusivamente en un
servidor porque Supabase exige proteger la `service_role`:
[Auth Admin: createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser).
La función pública se protege con el secreto aleatorio de alta entropía, uso
único, vencimiento y origen permitido; antes de abrir campañas públicas se debe
añadir CAPTCHA y límites por origen/IP según las guías de
[CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha) y
[rate limits](https://supabase.com/docs/guides/auth/rate-limits).

## Instalación en el proyecto de pruebas

No volver a ejecutar `install_staging.sql` en una base existente. En
`Sistema-Pacas-Pruebas`:

1. ejecutar en SQL Editor el contenido de
   `supabase/migrations/20260919000000_account_invitations.sql` y después
   `supabase/migrations/20260920000000_friendly_account_invitation_links.sql`;
2. desplegar la función sin verificación JWT, porque todavía no existe una
   sesión antes de activar:

   ```powershell
   supabase functions deploy activate-account --project-ref zijfywqastacydmuqswv
   ```

   `supabase/config.toml` ya declara `verify_jwt = false` solo para esta función.

3. limitar sus orígenes al frontend comercial de pruebas y al servidor local:

   ```powershell
   supabase secrets set --project-ref zijfywqastacydmuqswv ALLOWED_ACTIVATION_ORIGINS="http://127.0.0.1:5174,URL_DEL_FRONTEND_DE_PRUEBA"
   ```

4. configurar `VITE_CUSTOMER_APP_URL` en el portal administrativo de pruebas;
5. ejecutar `supabase/setup/audit_hito0.sql` y confirmar que los cuatro controles
   nuevos resultan `true`.

Supabase inyecta `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en sus funciones.
No deben copiarse a `.env.local`, al frontend ni a una variable `VITE_`.

## Prueba remota obligatoria

1. Crear una invitación para un usuario que no exista.
2. Copiar el enlace mostrado una sola vez.
   El panel también prepara un mensaje personalizado que presenta el beneficio,
   explica el siguiente paso y conserva una sola llamada a la acción.
3. Abrirlo en una ventana privada de la aplicación comercial de pruebas.
4. Crear la contraseña y confirmar que abre el onboarding.
5. Verificar en el panel que la invitación figura como **Utilizada** y la cuenta
   aparece como activa, plan elegido y rol propietario.
6. Volver a abrir el mismo enlace: debe rechazarse.
7. Crear otra invitación, revocarla y confirmar que tampoco puede activarse.
8. Iniciar sesión con una cuenta normal y comprobar que no accede al portal
   administrativo ni a sus RPC.

Producción permanece sin cambios hasta aprobar este recorrido en pruebas.
