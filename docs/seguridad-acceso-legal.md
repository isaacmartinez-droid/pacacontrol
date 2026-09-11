# Seguridad de acceso, terminos y privacidad

Esta guia deja el sistema listo para promocionarlo sin abrir el registro al publico.

## Que cambio en la app

- La pantalla de acceso ya no muestra registro publico por defecto.
- La ruta `/legal` muestra terminos de uso y politica de privacidad.
- Al iniciar sesion, una cuenta debe aceptar la version legal vigente antes de entrar.
- Supabase guarda `legal_terms_version`, `terms_accepted_at`, `privacy_version` y `privacy_accepted_at`.
- Supabase tambien guarda `access_status` para pausar cuentas sin borrar datos.

## Activacion en Supabase

1. Ejecutar `supabase/migrations/20260911000000_profiles_legal_access.sql` en SQL Editor.
2. En Supabase Auth, desactivar los registros publicos si el sistema ya se promociona en redes.
3. Crear cuentas de clientes manualmente desde el panel de Supabase o por el flujo administrativo que decidas usar.
4. Mantener `VITE_ALLOW_PUBLIC_SIGNUP` sin configurar o en `false` en Vercel.

> Importante: ocultar el boton de registro en la app no basta si Supabase Auth permite registros publicos. El cierre real debe hacerse tambien en la configuracion de Auth.

## Registro publico opcional

Solo para pruebas controladas puedes activar:

```env
VITE_ALLOW_PUBLIC_SIGNUP=true
VITE_SIGNUP_ACCESS_CODE=un-codigo-privado
```

Esto muestra el registro con codigo de acceso y aceptacion legal. No lo uses como unica barrera para una promocion publica grande; el control principal debe estar en Supabase Auth.

## Pausar o reactivar una cuenta

Para suspender una cuenta sin borrar sus datos:

```sql
update public.profiles
set access_status = 'suspended'
where id = 'ID_DEL_USUARIO';
```

Para reactivarla:

```sql
update public.profiles
set access_status = 'active'
where id = 'ID_DEL_USUARIO';
```

Valores disponibles:

- `active`: puede entrar si acepto terminos.
- `suspended`: acceso pausado, por ejemplo por falta de pago o revision.
- `closed`: cuenta cerrada.

## Cuando empiece el cobro

La version legal actual contempla piloto gratuito y servicio pagado. Cuando cambies precio, soporte, pais, marca comercial o forma de facturacion, sube las versiones en `src/legal/legalContent.js`. Al cambiar la version, el sistema pedira aceptar nuevamente.

Antes de crecer a varios clientes, conviene que un abogado revise el texto final segun el pais donde vas a vender.
