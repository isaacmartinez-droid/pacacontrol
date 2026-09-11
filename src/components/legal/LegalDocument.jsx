import { ShieldCheck } from 'lucide-react'
import { LEGAL_TERMS_VERSION, PRIVACY_VERSION, privacySections, termsSections } from '../../legal/legalContent'

function LegalDocument({ compact = false }) {
  return (
    <div className={compact ? 'space-y-6' : 'space-y-8'}>
      <section className="rounded-3xl bg-brand-950 p-5 text-white shadow-soft sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-brand-950">
            <ShieldCheck aria-hidden="true" size={24} />
          </span>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-200">Version legal</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Terminos y privacidad</h1>
            <p className="mt-2 text-sm leading-6 text-brand-100">
              Terminos v{LEGAL_TERMS_VERSION} y privacidad v{PRIVACY_VERSION}. Este documento regula el uso del sistema, los datos que se guardan y las condiciones de acceso.
            </p>
          </div>
        </div>
      </section>

      <DocumentSection title="Terminos de uso" sections={termsSections} />
      <DocumentSection title="Politica de privacidad" sections={privacySections} />
    </div>
  )
}

function DocumentSection({ title, sections }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 sm:p-6">
      <h2 className="text-xl font-extrabold text-slate-950">{title}</h2>
      <div className="mt-5 space-y-5">
        {sections.map((section) => (
          <article key={section.title}>
            <h3 className="text-sm font-extrabold text-brand-900">{section.title}</h3>
            <div className="mt-2 space-y-2">
              {section.body.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-6 text-slate-600">
                  {paragraph}
                </p>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default LegalDocument
