# Entorno separado de pruebas

Proyecto: `Sistema-Pacas-Pruebas`, referencia `zijfywqastacydmuqswv`.
No modificar `.env.local`, las variables de Vercel Production ni datos de clientes.
La configuración local de pruebas está en `.env.staging.local`, excluida de Git.
Solo contiene la URL y clave publicable: no necesita contraseñas ni claves secretas.

## Instalación inicial de la base vacía

1. Confirmar el nombre del proyecto en Supabase antes de abrir SQL Editor.
2. Ejecutar el contenido completo de
   [install_staging.sql](../supabase/setup/install_staging.sql).
   Es una copia generada de las 31 migraciones en orden, con una sola transacción.
   Rechaza bases donde ya exista alguna de las tablas de la app. No usar en clientes.
   Si falla, la transacción revierte; comunicar el error antes de reintentar.
3. En Auth desactivar `Allow new users to sign up`, manteniendo Email habilitado.
4. Crear dos usuarios ficticios desde Auth Users mediante la opción administrativa
   de añadir usuario. Usar correos controlados por el desarrollador; no reutilizar
   correos o contraseñas de clientes. No compartir contraseñas en el chat.
5. Aprobar únicamente esas dos cuentas por sus UUID desde SQL Editor: los nuevos
   perfiles quedan suspendidos por defecto. No activar todas las cuentas en bloque.
   La sentencia con los UUID concretos se preparará al crear esas cuentas.

No se han instalado migraciones ni creado usuarios de forma remota desde Codex.
La inspección inicial de solo lectura encontró Auth accesible, registro abierto
y ausencia de `public.profiles` en REST. Esa inspección no ejecutó escrituras.

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
