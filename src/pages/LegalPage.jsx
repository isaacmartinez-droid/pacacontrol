import { ArrowLeft, LogIn } from 'lucide-react'
import { Link } from 'react-router-dom'
import LegalDocument from '../components/legal/LegalDocument'
import { useAuth } from '../context/AuthContext'

function LegalPage() {
  const { user } = useAuth()
  const backTo = user ? '/mas' : '/acceder'

  return (
    <main className="min-h-dvh bg-brand-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          to={backTo}
          className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-extrabold text-brand-800 shadow-sm ring-1 ring-slate-100 transition hover:bg-slate-50"
        >
          {user ? <ArrowLeft aria-hidden="true" size={18} /> : <LogIn aria-hidden="true" size={18} />}
          {user ? 'Volver a mas' : 'Volver al acceso'}
        </Link>
        <LegalDocument />
      </div>
    </main>
  )
}

export default LegalPage
