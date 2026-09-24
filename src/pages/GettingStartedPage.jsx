import {
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  CircleCheck,
  ClipboardList,
  PackagePlus,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
  ReceiptText,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader'
import { usePacaData } from '../context/PacaDataContext'
import { getBusinessTerms } from '../utils/businessProfile'

function GuideStep({ number, icon: Icon, title, description, detail, to, action, complete }) {
  return (
    <article className={`relative overflow-hidden rounded-3xl bg-white p-5 shadow-soft ring-1 ${complete ? 'ring-emerald-100' : 'ring-slate-100'}`}>
      <div className="flex items-start gap-4">
        <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${complete ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-50 text-brand-700'}`}>
          {complete ? <Check aria-label="Paso realizado" size={23} strokeWidth={3} /> : <Icon aria-hidden="true" size={23} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-700">Paso {number}</p>
            {complete && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.68rem] font-extrabold text-emerald-700">Listo</span>}
          </div>
          <h2 className="mt-1 text-lg font-extrabold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
          <Link to={to} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-900 px-4 text-sm font-extrabold text-white transition hover:bg-brand-800 active:scale-[0.98]">
            {action}<ArrowRight aria-hidden="true" size={17} />
          </Link>
        </div>
      </div>
    </article>
  )
}

export default function GettingStartedPage() {
  const { data } = usePacaData()
  const terms = getBusinessTerms(data.businessProfile)
  const hasPurchase = data.bales.length > 0
  const hasCustomer = data.customers.length > 0
  const hasSale = data.sales.length > 0
  const hasFollowUp = data.sales.some((sale) => sale.balance > 0 || (sale.fulfillmentMethod === 'delivery' && sale.deliveryStatus !== 'delivered'))
  const completedSteps = [hasPurchase, hasCustomer, hasSale, hasFollowUp].filter(Boolean).length

  return (
    <div>
      <PageHeader eyebrow="Guía inicial" title="Empieza con lo importante" description="Una ruta práctica para poner tu negocio en marcha, a tu ritmo." />
      <div className="page-content max-w-5xl space-y-6 py-5 md:py-8">
        <section className="relative overflow-hidden rounded-[2rem] bg-brand-950 p-6 text-white shadow-soft sm:p-8">
          <div className="absolute -right-10 -top-12 size-44 rounded-full bg-brand-500/30 blur-3xl" />
          <div className="relative max-w-2xl">
            <span className="grid size-12 place-items-center rounded-2xl bg-white/10 text-brand-100 ring-1 ring-white/15"><Sparkles size={23} /></span>
            <h1 className="mt-5 text-2xl font-extrabold tracking-tight sm:text-3xl">Tu negocio ya tiene su espacio. Ahora hazlo trabajar para ti.</h1>
            <p className="mt-3 text-sm leading-6 text-brand-100 sm:text-base">No tienes que aprender todo de una vez. Sigue estos pasos en el orden que usas en el día a día: compras, clientes, pedidos y control.</p>
            <div className="mt-5 flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-white text-brand-900"><CircleCheck aria-hidden="true" size={19} /></span>
              <p className="text-sm font-bold">{completedSteps} de 4 acciones operativas realizadas</p>
            </div>
            <Link to="/recorrido-inicial" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-extrabold text-white ring-1 ring-white/15 transition hover:bg-white/15">
              Ver la presentación nuevamente<ArrowRight aria-hidden="true" size={17} />
            </Link>
          </div>
        </section>

        <section aria-label="Recorrido principal" className="grid gap-4 lg:grid-cols-2">
          <GuideStep
            number="1"
            icon={PackagePlus}
            title={`Registra una ${terms.purchaseSingularLower}`}
            description={`Aquí anotas cuánto invertiste, el transporte, otros gastos y los ${terms.inventoryUnitPluralLower} que recibiste.`}
            detail={`Al guardarla, el sistema calcula el costo y suma existencias a tu inventario.`}
            to="/pacas/nueva"
            action={hasPurchase ? `Registrar otra ${terms.purchaseSingularLower}` : `Registrar mi primera ${terms.purchaseSingularLower}`}
            complete={hasPurchase}
          />
          <GuideStep
            number="2"
            icon={ScanLine}
            title="Revisa inventario y precios"
            description={`Consulta cuántos ${terms.inventoryUnitPluralLower} tienes disponibles por categoría y usa los precios sugeridos como punto de partida.`}
            detail="El inventario se actualiza cada vez que registras una compra, una venta o un daño."
            to="/inventario"
            action="Ver mi inventario"
            complete={hasPurchase && data.baleInventory.length > 0}
          />
          <GuideStep
            number="3"
            icon={UsersRound}
            title="Agrega a tus clientes"
            description="Guarda sus datos una sola vez para encontrar su historial, compras y saldo pendiente cuando lo necesites."
            detail="Es especialmente útil cuando vendes por encargo, apartado o con abonos."
            to="/clientes/nuevo"
            action={hasCustomer ? 'Agregar otro cliente' : 'Crear mi primer cliente'}
            complete={hasCustomer}
          />
          <GuideStep
            number="4"
            icon={ClipboardList}
            title="Registra un pedido o venta"
            description={`Elige los ${terms.inventoryUnitPluralLower}, el cliente y la forma de pago. Puedes cobrar todo, recibir un abono o dejar saldo pendiente.`}
            detail="Cada pedido descuenta existencias y actualiza tus cobros y resultados."
            to="/ventas/nueva"
            action={hasSale ? 'Registrar otra venta' : 'Registrar mi primera venta'}
            complete={hasSale}
          />
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
            <span className="grid size-11 place-items-center rounded-2xl bg-amber-50 text-amber-700"><WalletCards aria-hidden="true" size={21} /></span>
            <h2 className="mt-4 text-lg font-extrabold text-slate-950">Da seguimiento a cobros y entregas</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Desde Pedidos puedes registrar abonos, completar pagos y marcar cuándo una entrega quedó lista o fue entregada.</p>
            <Link to="/ventas" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-200 bg-white px-4 text-sm font-extrabold text-brand-900 transition hover:bg-brand-50">
              {hasFollowUp ? 'Revisar pendientes' : 'Ver pedidos'}<ArrowRight aria-hidden="true" size={17} />
            </Link>
          </article>
          <article className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
            <span className="grid size-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><BarChart3 aria-hidden="true" size={21} /></span>
            <h2 className="mt-4 text-lg font-extrabold text-slate-950">Consulta el resumen antes de decidir</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">En Inicio ves dinero cobrado, saldos por cobrar, inventario, gastos y ganancia estimada. En Más encuentras reportes, caja y alertas.</p>
            <Link to="/" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-200 bg-white px-4 text-sm font-extrabold text-brand-900 transition hover:bg-brand-50">
              Ir a mi resumen<ArrowRight aria-hidden="true" size={17} />
            </Link>
          </article>
        </section>

        <section aria-labelledby="control-tools-title">
          <div className="mb-3">
            <h2 id="control-tools-title" className="text-lg font-extrabold tracking-tight text-slate-950">Cuando el negocio ya está en marcha</h2>
            <p className="mt-1 text-sm text-slate-500">Estas herramientas complementan el recorrido principal y te ayudan a tomar decisiones con datos.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Link to="/gastos" className="group rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100 transition hover:bg-slate-50">
              <span className="grid size-10 place-items-center rounded-xl bg-coral-50 text-coral-600"><ReceiptText aria-hidden="true" size={19} /></span>
              <h3 className="mt-3 font-extrabold text-slate-900">Gastos y caja</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">Registra salidas y luego compara el efectivo esperado con lo contado.</p>
            </Link>
            <Link to="/reportes" className="group rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100 transition hover:bg-slate-50">
              <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><BarChart3 aria-hidden="true" size={19} /></span>
              <h3 className="mt-3 font-extrabold text-slate-900">Reportes</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">Consulta ventas, costos, cobros y ganancias por el período que elijas.</p>
            </Link>
            <Link to="/alertas" className="group rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100 transition hover:bg-slate-50">
              <span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><Bell aria-hidden="true" size={19} /></span>
              <h3 className="mt-3 font-extrabold text-slate-900">Alertas</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">Revisa existencias bajas, cobros pendientes y entregas que necesitan atención.</p>
            </Link>
            <Link to="/ajustes" className="group rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100 transition hover:bg-slate-50">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><SlidersHorizontal aria-hidden="true" size={19} /></span>
              <h3 className="mt-3 font-extrabold text-slate-900">Ajustes</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">Actualiza cómo llamas a tus compras y productos según tu negocio.</p>
            </Link>
          </div>
        </section>

        <p className="rounded-2xl bg-brand-50 px-5 py-4 text-sm leading-6 text-brand-900 ring-1 ring-brand-100"><strong>Esta guía siempre estará aquí.</strong> Puedes volver cuando quieras desde Más → Primeros pasos; no bloquea tu trabajo ni te obliga a completar los pasos en una sola sesión.</p>
      </div>
    </div>
  )
}
