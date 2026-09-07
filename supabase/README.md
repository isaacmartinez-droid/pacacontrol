# Base de datos de PacaControl

La carpeta `migrations` contiene el esquema de la aplicación y sus cambios posteriores: usuarios, categorías, pacas, inventario, ventas, seguimiento de entregas, clientes, gastos y productos dañados.

## Aplicarlo en Supabase

1. Crea un proyecto en [Supabase](https://database.new).
2. Abre **SQL Editor** en el panel del proyecto.
3. Copia y ejecuta las migraciones en orden por nombre. Si el esquema inicial ya está instalado, ejecuta únicamente las migraciones nuevas.
4. En **Authentication > Providers**, habilita el método de acceso que usarán las personas de la tienda (por ejemplo, correo y contraseña).
5. Copia `.env.example` como `.env.local` y reemplaza sus dos valores con los de **Connect** en Supabase.
6. Reinicia el servidor de Vite tras guardar `.env.local`.

La migración activa RLS: cada cuenta autenticada solo puede consultar y modificar sus propios datos. La clave `service_role` no debe copiarse al navegador ni a ningún archivo `VITE_*`.
