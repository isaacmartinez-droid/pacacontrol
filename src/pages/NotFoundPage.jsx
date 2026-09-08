import { MapPinOff } from 'lucide-react'
import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'

function NotFoundPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Página no encontrada"
        title="Esta pantalla no existe"
        description="La dirección que abriste no pertenece a ningún módulo de Tienda J&F."
      />
      <div className="page-content pb-6 pt-16 md:pt-24">
        <div className="mx-auto max-w-2xl">
          <EmptyState
          icon={MapPinOff}
          title="¿Quieres volver al inicio?"
          description="Puedes regresar al resumen de tu negocio desde el botón de abajo."
          action={{ to: '/', label: 'Ir al inicio' }}
          />
        </div>
      </div>
    </div>
  )
}

export default NotFoundPage
