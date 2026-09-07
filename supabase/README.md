# Base de datos de PacaControl

El archivo `migrations/20260906000000_initial_schema.sql` crea el esquema inicial de la aplicación: usuarios, categorías, pacas, inventario, ventas, clientes, gastos y productos dañados.

## Aplicarlo en Supabase

1. Crea un proyecto en [Supabase](https://database.new).
2. Abre **SQL Editor** en el panel del proyecto.
3. Copia y ejecuta el contenido completo de la migración.
4. En **Authentication > Providers**, habilita el método de acceso que usarán las personas de la tienda (por ejemplo, correo y contraseña).
5. Copia `.env.example` como `.env.local` y reemplaza sus dos valores con los de **Connect** en Supabase.
6. Reinicia el servidor de Vite tras guardar `.env.local`.

La migración activa RLS: cada cuenta autenticada solo puede consultar y modificar sus propios datos. La clave `service_role` no debe copiarse al navegador ni a ningún archivo `VITE_*`.
