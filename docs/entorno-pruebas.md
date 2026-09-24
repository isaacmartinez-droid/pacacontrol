# Entorno separado de pruebas

Proyecto: `Sistema-Pacas-Pruebas`, referencia `zijfywqastacydmuqswv`.
No modificar `.env.local`, las variables de Vercel Production ni datos de clientes.
La configuración local de pruebas está en `.env.staging.local`, excluida de Git.
Solo contiene la URL, clave publicable y direcciones públicas de ambos portales:
no necesita contraseñas ni claves secretas.

## Instalación inicial de la base vacía

1. Confirmar el nombre del proyecto en Supabase antes de abrir SQL Editor.
2. Ejecutar el contenido completo de
   [install_staging.sql](../supabase/setup/install_staging.sql).
   Es una copia generada de las 34 migraciones en orden, con una sola transacción.
   Rechaza bases donde ya exista alguna de las tablas de la app. No usar en clientes.
   Si falla, la transacción revierte; comunicar el error antes de reintentar.
3. En Auth desactivar `Allow new users to sign up`, manteniendo Email habilitado.
4. Crear manualmente solo la primera identidad administrativa desde Auth Users y
   asignarle `active`, `internal` y `admin` por UUID. Este es el arranque inicial;
   no crear contraseñas de clientes desde Supabase.
5. Desplegar `activate-account` y crear las cuentas ficticias siguientes desde
   **Cuentas > Crear cuenta** en el portal administrativo. Cada persona define su
   propia contraseña mediante el enlace privado.

Las migraciones incrementales se registran por separado: nunca se vuelve a usar
el instalador completo sobre una base existente. Antes de probar invitaciones se
debe aplicar `20260919000000_account_invitations.sql`, después
`20260920000000_friendly_account_invitation_links.sql` y
`20260921000000_owner_first_account_invitations.sql`, y ejecutar la auditoría.

## Aplicación local

```sh
npm run dev:staging
```

Abrir `http://127.0.0.1:5174`. El modo staging exige que la URL corresponda a la
referencia configurada y que sea distinta de la conexión de producción. Si existe
una variable de entorno del sistema que reemplaza la URL, el arranque debe fallar
en vez de usar el proyecto de clientes. `npm run dev` y `npm run build` conservan
su comportamiento anterior. No publicar staging sobre el dominio de clientes.

## Recorrido pendiente con cuentas ficticias

- Entrar con A y crear paca C$8,550, categorías y daños mediante la RPC atómica.
- Registrar pedido C$800, corregirlo a C$1,000 y cobrar saldo sin perder pagos.
- Corregir después del segundo pago y registrar el pago adicional.
- Cambiar envío a retiro, verificando cantidades, total y saldo pendiente.
- Registrar gastos y reserva mensual por separado; revisar cierres y fechas locales.
- Archivar/reactivar paca, conservando ventas, gastos, pagos e historial.
- Entrar con B en otro perfil de navegador: no debe acceder a datos de A, tampoco
  mediante peticiones directas con su sesión. Crear su propia paca y venta.
- Suspender una cuenta ficticia y verificar rechazo de escrituras y RPC antiguas.
- Comprobar concurrencia con dos solicitudes sobre las últimas piezas disponibles.

Push requiere configuración de servidor separada y pruebas en dispositivo.
El servidor local Vite no ejecuta las funciones Vercel ni valida push real.
Esta instalación no acredita respaldo/restauración del proyecto de clientes.
