import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  PackagePlus,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { BrandWordmark } from '../components/common/BrandLogo'
import { usePacaData } from '../context/PacaDataContext'
import { getBusinessTerms } from '../utils/businessProfile'

const tourSteps = (terms) => [
  {
    icon: Sparkles,
    eyebrow: 'Bienvenida',
    title: 'Conoce cómo funciona ControlShop',
    description: 'Tu espacio está listo. En menos de un minuto te mostramos el orden más útil para administrar tu negocio todos los días.',
    detail: 'No tienes que memorizarlo: al terminar tendrás una guía disponible cuando la necesites.',
    preview: ['Compras e inventario', 'Clientes y pedidos', 'Cobros y resultados'],
  },
  {
    icon: BarChart3,
    eyebrow: '1. Inicio',
    title: 'Aquí entiendes cómo va tu negocio',
    description: 'El resumen reúne dinero cobrado, saldos por cobrar, inventario, gastos y ganancia estimada según el período que elijas.',
    detail: 'Empieza el día aquí para saber qué necesita atención sin revisar pantalla por pantalla.',
    preview: ['Dinero cobrado', 'Por cobrar', 'Ganancia estimada'],
  },
  {
    icon: PackagePlus,
    eyebrow: '2. Compras',
    title: `Registra cada ${terms.purchaseSingularLower} desde que llega`,
    description: `Anota inversión, transporte, otros gastos, categorías y los ${terms.inventoryUnitPluralLower} recibidos. Así el inventario y el costo nacen con datos reales.`,
    detail: `Cada ${terms.purchaseSingularLower} conserva su historial y puedes consultarla sin perder información.`,
    preview: ['Inversión real', 'Existencias por categoría', 'Precios sugeridos'],
  },
  {
    icon: UsersRound,
    eyebrow: '3. Clientes',
    title: 'Guarda a quienes te compran',
    description: 'Registras a una persona una sola vez y luego encuentras sus pedidos, pagos y saldo pendiente cuando necesitas cobrarle.',
    detail: 'Si una venta queda a crédito, el cliente permite conservar ese saldo correctamente.',
    preview: ['Historial de compras', 'Saldo pendiente', 'Datos de contacto'],
  },
  {
    icon: ClipboardList,
    eyebrow: '4. Pedidos',
    title: 'Cada venta descuenta y ordena',
    description: `Elige los ${terms.inventoryUnitPluralLower}, registra si el pago fue completo, parcial o pendiente, y define si se recoge o se entrega.`,
    detail: 'Después puedes registrar abonos, completar pagos y actualizar la entrega sin perder el historial.',
    preview: ['Venta y abonos', 'Entrega o retiro', 'Inventario actualizado'],
  },
  {
    icon: CheckCircle2,
    eyebrow: 'Listo para comenzar',
    title: 'Controla lo importante sin complicarte',
    description: 'Cuando ya tengas movimiento, usa Más para gastos, arqueo de caja, alertas, reportes y ajustes. Todo parte de las operaciones que registras aquí.',
    detail: 'Puedes volver a esta explicación o consultar la guía de primeros pasos en cualquier momento.',
    preview: ['Gastos y caja', 'Alertas', 'Reportes'],
  },
]

export default function ProductIntroductionPage() {
  const navigate = useNavigate()
  const { data } = usePacaData()
  const terms = getBusinessTerms(data.businessProfile)
  const steps = tourSteps(terms)
  const [currentStep, setCurrentStep] = useState(0)
  const step = steps[currentStep]
  const Icon = step.icon
  const isLastStep = currentStep === steps.length - 1

  function skipTour() {
    navigate('/', { replace: true })
  }

  function nextStep() {
    if (isLastStep) {
      navigate('/primeros-pasos', { replace: true })
      return
    }
    setCurrentStep((current) => current + 1)
  }

  return (
    <main className="relative grid min-h-dvh overflow-hidden bg-brand-950 px-5 py-5 text-white sm:px-8 sm:py-8">
      <div aria-hidden="true" className="absolute -left-28 top-1/4 size-80 rounded-full bg-brand-500/25 blur-3xl" />
      <div aria-hidden="true" className="absolute -right-24 -top-24 size-80 rounded-full bg-emerald-400/15 blur-3xl" />
      <section className="relative mx-auto flex w-full max-w-5xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <BrandWordmark surface="dark" className="h-8 w-auto sm:h-9" />
          <button type="button" onClick={skipTour} className="min-h-10 rounded-xl px-3 text-sm font-extrabold text-brand-100 transition hover:bg-white/10 hover:text-white">
            Saltar recorrido
          </button>
        </header>

        <div className="my-auto grid flex-1 items-center gap-8 py-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)] lg:gap-14">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-200">{step.eyebrow}</p>
            <h1 className="mt-4 max-w-xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">{step.title}</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-brand-100 sm:text-lg">{step.description}</p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-brand-200">{step.detail}</p>
          </div>

          <div className="rounded-[2rem] bg-white p-5 text-slate-950 shadow-2xl shadow-black/25 ring-1 ring-white/15 sm:p-7">
            <span className="grid size-16 place-items-center rounded-3xl bg-brand-50 text-brand-700"><Icon aria-hidden="true" size={31} /></span>
            <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.16em] text-brand-700">Así te ayuda</p>
            <ul className="mt-4 space-y-3">
              {step.preview.map((item) => (
                <li key={item} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">
                  <CheckCircle2 aria-hidden="true" className="shrink-0 text-emerald-600" size={18} />{item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <footer className="flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2" aria-label={`Paso ${currentStep + 1} de ${steps.length}`}>
            {steps.map((item, index) => <span key={item.title} className={`h-2 w-7 rounded-full transition ${index === currentStep ? 'bg-white' : index < currentStep ? 'bg-brand-300' : 'bg-white/20'}`} />)}
          </div>
          <div className="flex gap-3">
            {currentStep > 0 && <button type="button" onClick={() => setCurrentStep((current) => current - 1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-extrabold text-brand-100 transition hover:bg-white/10 hover:text-white"><ArrowLeft aria-hidden="true" size={17} />Anterior</button>}
            <button type="button" onClick={nextStep} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-extrabold text-brand-950 transition hover:bg-brand-50 active:scale-[0.98]">
              {isLastStep ? 'Ver mi guía de primeros pasos' : 'Siguiente'}<ArrowRight aria-hidden="true" size={17} />
            </button>
          </div>
        </footer>
      </section>
    </main>
  )
}
