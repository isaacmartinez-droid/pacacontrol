# Portal administrativo separado

Fecha de implementación local: 18 de septiembre de 2026.

## Decisión

La administración no será una ruta oculta de la aplicación comercial. El mismo
repositorio produce dos aplicaciones independientes:

- `npm run build` genera `dist/`, exclusivamente para los negocios;
- `npm run build:admin` genera `dist-admin/`, exclusivamente para administración.

Cada aplicación tendrá su propio proyecto y dominio de Vercel. Ambas se conectan
al mismo Supabase para evitar duplicar usuarios, planes o auditorías. La autoridad
real continúa en PostgreSQL mediante `account_role`, `current_account_is_admin()`
y las funciones administrativas protegidas.

## Fronteras implementadas

### Aplicación comercial

- no importa ni compila `AdminPage`;
- no tiene una ruta `/admin`;
- una cuenta `owner` utiliza el panel del negocio;
- una cuenta `admin` se deriva a `VITE_ADMIN_APP_URL`;
- si el portal no está configurado, muestra una explicación y permite cerrar la
  sesión en lugar de cargar datos del negocio.

### Portal administrativo

- tiene su propio `index.html`, arranque, login y enrutador;
- su página principal es el panel administrativo, sin sufijo `/admin`;
- rechaza una cuenta `owner` antes de cargar la consola;
- no monta `PacaDataProvider` ni consulta compras, ventas, clientes o gastos;
- no ofrece registro público;
- incluye `noindex, nofollow` para evitar indexación accidental.

La separación de frontend reduce exposición y errores de navegación, pero no se
considera por sí sola un control de seguridad. Las RPC administrativas mantienen
la verificación de rol en la base de datos.

## Desarrollo local

Aplicación comercial de prueba:

```powershell
npm run dev:staging
```

Portal administrativo de prueba:

```powershell
npm run dev:admin:staging
```

Direcciones locales:

- negocio: `http://127.0.0.1:5174`;
- administración: `http://127.0.0.1:5175`.

El archivo `.env.staging.local` debe incluir las dos direcciones públicas no
secretas:

```text
VITE_ADMIN_APP_URL=http://127.0.0.1:5175
VITE_CUSTOMER_APP_URL=http://127.0.0.1:5174
```

## Segundo proyecto de Vercel

Crear un proyecto nuevo conectado al mismo repositorio. Vercel permite conectar
varios proyectos a un repositorio y personalizar el comando y directorio de
salida desde los ajustes de cada proyecto.

Configuración del portal administrativo:

- Root Directory: raíz del repositorio;
- Build Command: `npm run build:admin`;
- Output Directory: `dist-admin`;
- Install Command: `npm install`;
- variable `VITE_SUPABASE_URL`: URL de Supabase de producción;
- variable `VITE_SUPABASE_PUBLISHABLE_KEY`: clave publicable, nunca `service_role`;
- variable `VITE_CUSTOMER_APP_URL`: dirección de la aplicación comercial.

Después de obtener el dominio del nuevo proyecto, añadir en el proyecto comercial:

```text
VITE_ADMIN_APP_URL=https://dominio-del-portal-admin
```

y volver a desplegar la aplicación comercial. Las opciones de compilación se
pueden configurar en Project Settings, según la
[documentación oficial de Vercel](https://vercel.com/docs/project-configuration/project-settings).

## Verificación antes de publicar

1. `npm test` aprueba seguridad y reglas de base de datos;
2. `npm run test:ui` prueba las dos aplicaciones;
3. `npm run build` no contiene la consola administrativa;
4. `npm run build:admin` produce el portal separado;
5. una cuenta normal es rechazada por el portal;
6. una cuenta administrativa entra en la raíz del portal;
7. el portal no consulta recursos operativos del negocio;
8. ambos dominios usan la misma referencia correcta de Supabase;
9. producción mantiene desactivado el registro público.

## Estado

La separación está implementada y verificada localmente. No debe publicarse el
cambio de redirección comercial hasta que el segundo proyecto de Vercel exista y
su dominio se haya configurado en `VITE_ADMIN_APP_URL`.

La primera reestructuración del centro de control se documenta en
[`docs/centro-control-administrativo.md`](centro-control-administrativo.md). Esta
evolución permanece en la rama del portal separado y tampoco modifica producción.
