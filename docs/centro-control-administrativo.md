# Centro de control administrativo

Fecha de decisión: 19 de septiembre de 2026.

## Objetivo

Convertir el portal administrativo separado en un centro de control que permita
detectar qué cuentas requieren acción, comprender por qué y aplicar cambios
sensibles con confirmación y auditoría. El panel no debe permitir navegar ni
editar libremente los datos privados de operación de un negocio.

## Investigación aplicada

La interfaz adopta cuatro principios:

1. **Divulgación progresiva.** El resumen muestra únicamente señales y totales;
   el directorio permite localizar una cuenta; el expediente contiene el detalle
   y los controles.
2. **Tabla para localizar, expediente para actuar.** Las tablas admiten búsqueda,
   filtros y paginación, pero no concentran formularios complejos. Carbon señala
   que las tablas sirven para organizar y localizar recursos y que la paginación
   debe colocarse debajo de ellas.
3. **Estados explícitos.** Salud, acceso y severidad siempre incluyen texto; el
   color es una ayuda secundaria. Esto sigue la guía de etiquetas de estado de
   GOV.UK y la recomendación de W3C de no comunicar información solo con color.
4. **Mínimo privilegio.** El navegador no recibe `service_role`. Las lecturas y
   cambios administrativos continúan pasando por RPC restringidas. Supabase
   recomienda revocar la ejecución general, concederla de forma explícita y
   fijar el `search_path` de funciones `security definer`.

Referencias:

- [Carbon: tablas de datos](https://v10.carbondesignsystem.com/components/data-table/usage/)
- [Carbon: paginación](https://carbondesignsystem.com/components/pagination/usage/)
- [GOV.UK: etiquetas de estado](https://design-system.service.gov.uk/components/tag/)
- [W3C WAI: principios de accesibilidad](https://www.w3.org/WAI/fundamentals/accessibility-principles/)
- [Supabase: funciones de base de datos](https://supabase.com/docs/guides/database/functions)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Arquitectura de información

El portal queda dividido en:

- **Resumen:** indicadores y cuentas que necesitan atención.
- **Cuentas:** directorio, búsqueda, filtros y paginación.
- **Expediente:** uso, cumplimiento, auditoría y controles de una cuenta.
- **Alertas:** bandeja derivada de reglas explicables.
- **Cobros:** planes y vencimientos disponibles actualmente.
- **Sistema:** controles internos existentes y cobertura técnica pendiente.

## Modelo inicial de salud

La salud administrativa no califica la rentabilidad del negocio.

| Estado | Regla inicial |
| --- | --- |
| Crítica | Cuenta suspendida, pago vencido o prueba vencida aún activa |
| Atención | Pago en 3 días, prueba en 7 días o cumplimiento pendiente |
| Nueva | Menos de 7 días y todavía sin ventas |
| Saludable | No tiene alertas administrativas inmediatas |
| Cerrada | Cuenta fuera de operación |

La adopción se presenta separadamente: empezando, uso reciente, uso bajo o sin
actividad. Una cuenta con pocas ventas no se marca automáticamente como un mal
negocio.

## Primera fase implementada localmente

- navegación administrativa independiente;
- resumen con estados explicables;
- directorio adaptable a móvil y escritorio;
- paginación local para el piloto;
- expediente individual;
- términos y privacidad dentro de Cumplimiento;
- confirmación antes de guardar controles sensibles;
- bandeja de alertas calculada con datos existentes;
- vista provisional de cobros;
- inventario visible de controles técnicos pendientes.
- alta de cuentas mediante invitaciones privadas de un solo uso;
- revocación y seguimiento de invitaciones sin revelar nuevamente su token.

## Límites conocidos y siguiente fase

La primera fase todavía usa `admin_list_accounts()` para descargar el conjunto
completo. Antes de crecer fuera del piloto se debe sustituir por consultas
paginadas y filtradas en servidor.

Datos que faltan:

1. último inicio de sesión y última actividad general;
2. estado y paso del onboarding;
3. actividad agregada de 7 y 30 días;
4. historial formal de suscripciones, facturas y pagos;
5. alertas persistentes con responsable, estado y resolución;
6. telemetría de errores, disponibilidad y notificaciones;
7. roles internos separados para soporte, cobros y auditoría.

La siguiente migración administrativa debe crear una RPC paginada de resumen y
otra RPC de expediente. Ambas deberán validar el rol en servidor, devolver solo
los campos necesarios y tener pruebas negativas para cuentas normales.

## Verificación local

- 131 pruebas automatizadas aprobadas;
- humo visual comercial y administrativo aprobado;
- cuenta normal rechazada por el portal;
- resumen, directorio, expediente y sistema recorridos con datos simulados;
- ninguna consulta directa a recursos operativos del negocio;
- compilación administrativa dividida por módulos, con paquete inicial menor a
  500 kB antes de compresión.

Falta el recorrido visual autenticado con la cuenta administrativa de staging.
