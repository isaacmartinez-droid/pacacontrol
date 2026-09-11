export const LEGAL_TERMS_VERSION = '2026-09-11'
export const PRIVACY_VERSION = '2026-09-11'

export const legalHighlights = [
  'El acceso al sistema es por invitacion o aprobacion del administrador.',
  'La etapa gratuita o piloto puede cambiar cuando el servicio pase a modalidad pagada.',
  'Los reportes son una herramienta de control operativo, no contabilidad fiscal certificada.',
  'Las mejoras especificas de un negocio se cotizan aparte antes de desarrollarse.',
]

export const termsSections = [
  {
    title: '1. Servicio',
    body: [
      'El sistema permite administrar pacas, inventario, categorias, ventas, pagos, entregas, clientes, gastos, productos danados, alertas y reportes operativos del negocio.',
      'El servicio se presta como una herramienta de apoyo para la administracion diaria. No sustituye revision fisica de inventario, control de caja, asesoria contable, asesoria fiscal ni obligaciones legales del usuario.',
    ],
  },
  {
    title: '2. Acceso y cuentas',
    body: [
      'El acceso se entrega por invitacion, aprobacion del administrador o acuerdo comercial. El registro publico puede estar desactivado para proteger el sistema y evitar cuentas no autorizadas.',
      'Cada usuario debe cuidar su contrasena y no compartir accesos con personas no autorizadas. Las acciones realizadas desde una cuenta se consideran realizadas por la persona o negocio que la administra.',
      'Mientras no exista un modulo formal de empleados o asientos, cada cuenta se entiende como una cuenta principal del negocio. Accesos adicionales, empleados o permisos especiales deben acordarse por separado.',
    ],
  },
  {
    title: '3. Etapa gratuita, piloto o pagada',
    body: [
      'Si el servicio se entrega gratis, como prueba o piloto, el administrador puede ajustar funciones, limitar altas nuevas, suspender el piloto o cambiar a modalidad pagada avisando al usuario por un medio razonable.',
      'Si el servicio pasa a modalidad pagada, el precio, periodo de cobro, fecha de pago y alcance del soporte se informan por acuerdo comercial. La falta de pago puede provocar suspension temporal del acceso hasta regularizar la cuenta.',
      'La mensualidad, cuando exista, cubre acceso al sistema, hosting, mantenimiento basico y soporte razonable para el uso normal. No incluye desarrollo personalizado ilimitado.',
    ],
  },
  {
    title: '4. Mejoras y personalizaciones',
    body: [
      'Las correcciones, ajustes generales y mejoras que beneficien al producto completo pueden incorporarse sin costo adicional segun criterio del administrador.',
      'Funciones especificas para un solo negocio, integraciones externas, reportes especiales, formatos personalizados, automatizaciones o cambios grandes se cotizan aparte y se desarrollan solo despues de que el cliente apruebe alcance, precio y fecha estimada.',
    ],
  },
  {
    title: '5. Responsabilidad del usuario',
    body: [
      'El usuario es responsable de ingresar datos correctos y revisar ventas, pagos, saldos, entregas, costos, inventario fisico y comprobantes antes de tomar decisiones.',
      'El sistema calcula costos, ganancias, saldos y precios recomendados con base en la informacion registrada. Si los datos ingresados son incompletos o incorrectos, los resultados tambien pueden serlo.',
      'No debe usarse el sistema para actividades ilegales, reventa no autorizada del software, intentos de vulnerar seguridad, carga intencional de datos falsos o acciones que afecten el servicio de otros usuarios.',
    ],
  },
  {
    title: '6. Disponibilidad y soporte',
    body: [
      'El administrador procurara mantener el sistema disponible y corregir fallas relevantes, pero no garantiza disponibilidad ininterrumpida. Pueden existir interrupciones por mantenimiento, Internet, navegador, Supabase, Vercel, proveedores de hosting u otros servicios tecnicos.',
      'El soporte basico cubre dudas de uso, revision de errores del sistema y acompanamiento razonable. Recuperaciones complejas, migraciones, capacitaciones extensas o trabajos especiales pueden cotizarse aparte.',
    ],
  },
  {
    title: '7. Limitacion de responsabilidad',
    body: [
      'El sistema no garantiza ganancias, ventas, recuperacion de deudas ni exactitud fiscal. Es una herramienta de control interno.',
      'El administrador no sera responsable por perdidas causadas por datos mal ingresados, uso indebido de cuentas, decisiones comerciales del usuario, falta de conexion, fallas de terceros o incumplimientos contables, tributarios o legales del negocio.',
    ],
  },
  {
    title: '8. Cambios en estos terminos',
    body: [
      'Estos terminos pueden actualizarse cuando cambie el producto, el modelo de cobro, la seguridad o la normativa aplicable. Cuando el cambio sea importante, el sistema podra solicitar aceptar nuevamente la version vigente antes de continuar.',
    ],
  },
]

export const privacySections = [
  {
    title: '1. Datos que se guardan',
    body: [
      'El sistema puede guardar nombre y apellido del usuario, usuario de acceso, identificador interno de cuenta, preferencias del negocio, pacas, categorias, inventario, ventas, pagos, metodos de pago, clientes, telefonos, notas, gastos, productos danados, entregas, alertas y configuracion de notificaciones.',
      'Si se activan notificaciones del telefono o computadora, se guarda una suscripcion tecnica del navegador para enviar avisos. Las notificaciones evitan mostrar datos privados de clientes y solo indican que hay asuntos que revisar.',
    ],
  },
  {
    title: '2. Finalidad',
    body: [
      'Los datos se usan para operar el sistema, mostrar inventario y reportes, calcular costos y ganancias estimadas, registrar ventas y pagos, enviar alertas, dar soporte, mejorar seguridad y mantener el servicio funcionando.',
      'No se venden datos del usuario ni de sus clientes.',
    ],
  },
  {
    title: '3. Proveedores tecnicos',
    body: [
      'El sistema puede apoyarse en proveedores como Supabase para autenticacion/base de datos, Vercel u otro hosting para publicar la aplicacion, y servicios de notificaciones del navegador para avisos push.',
      'Estos proveedores procesan datos tecnicos necesarios para prestar el servicio. El administrador debe cuidar claves privadas, accesos y configuraciones de seguridad.',
    ],
  },
  {
    title: '4. Seguridad',
    body: [
      'El sistema usa autenticacion, separacion de datos por cuenta y reglas de acceso en la base de datos para que cada usuario trabaje con su propia informacion.',
      'Ningun sistema conectado a Internet es completamente infalible. El usuario debe usar contrasenas seguras, cerrar sesion en dispositivos compartidos y avisar si sospecha acceso no autorizado.',
    ],
  },
  {
    title: '5. Acceso, correccion y eliminacion',
    body: [
      'El usuario puede solicitar al administrador revisar, corregir, exportar o eliminar datos de su cuenta, salvo informacion que deba conservarse por seguridad, soporte, respaldo tecnico, cumplimiento legal o registro de operaciones ya realizadas.',
      'La eliminacion de datos puede afectar historiales, reportes, inventario y continuidad del servicio.',
    ],
  },
  {
    title: '6. Retencion',
    body: [
      'Los datos se conservan mientras la cuenta este activa, mientras exista una relacion comercial o mientras sean necesarios para soporte, seguridad, respaldo o cumplimiento de obligaciones aplicables.',
      'Al cerrar una cuenta, el administrador puede eliminar o anonimizar datos dentro de un plazo razonable, segun el caso y la viabilidad tecnica.',
    ],
  },
]
