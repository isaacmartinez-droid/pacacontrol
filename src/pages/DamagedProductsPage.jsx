import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import PageHeader from '../components/common/PageHeader'
import { usePacaData } from '../context/PacaDataContext'

function DamagedProductsPage() {
  const { data, registerDamage } = usePacaData()
  const damagedProducts = data.damagedProducts
  const damagedTotal = damagedProducts.reduce((total, item) => total + item.quantity, 0)
  const availableInventory = data.baleInventory.filter((inventory) => inventory.availablePieces > 0)
  const [inventoryId, setInventoryId] = useState(availableInventory[0]?.id ?? '')
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState('Daño descubierto después de registrar la paca')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!availableInventory.some((inventory) => inventory.id === inventoryId)) setInventoryId(availableInventory[0]?.id ?? '')
  }, [availableInventory, inventoryId])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!inventoryId || Number(quantity) < 1 || !reason.trim()) { setError('Selecciona una paca, cantidad y motivo.'); return }
    setSaving(true); setError('')
    try { await registerDamage({ baleInventoryId: inventoryId, quantity: Number(quantity), reason }) }
    catch (submitError) { setError(submitError.message || 'No fue posible registrar el daño.') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Mermas"
        title="Productos dañados"
        description="Consulta las prendas que no pueden venderse y el motivo registrado."
        backTo="/mas"
      />
      <div className="page-content grid items-start gap-5 py-5 md:py-8 lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.3fr)] lg:gap-8">
        <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-white text-amber-700 shadow-sm">
              <TriangleAlert aria-hidden="true" size={22} />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-800">Total identificado</p>
              <p className="text-2xl font-extrabold text-amber-950">{damagedTotal} piezas</p>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100 lg:col-span-2">
          <h2 className="text-lg font-extrabold text-slate-900">Registrar daño descubierto</h2>
          <p className="mt-1 text-sm text-slate-500">Elige la paca física para descontar las piezas correctas.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-bold text-slate-700">Paca<select value={inventoryId} onChange={(event) => setInventoryId(event.target.value)} className="sale-input mt-2">{availableInventory.map((inventory) => <option key={inventory.id} value={inventory.id}>{inventory.baleCode} · {inventory.categoryName} · {inventory.availablePieces} disponibles</option>)}</select></label>
            <label className="text-sm font-bold text-slate-700">Cantidad<input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="sale-input mt-2" /></label>
            <label className="text-sm font-bold text-slate-700">Motivo<input value={reason} onChange={(event) => setReason(event.target.value)} className="sale-input mt-2" /></label>
          </div>
          {error && <p role="alert" className="mt-3 text-sm font-bold text-coral-600">{error}</p>}
          <button disabled={saving || availableInventory.length === 0} className="mt-4 min-h-11 rounded-xl bg-amber-600 px-4 text-sm font-extrabold text-white disabled:opacity-60">{saving ? 'Guardando…' : 'Registrar daño'}</button>
        </form>

        <section aria-labelledby="damaged-list-title" className="max-w-3xl">
          <h2 id="damaged-list-title" className="mb-3 text-lg font-extrabold text-slate-900">
            Detalle por categoría
          </h2>
          <div className="space-y-2.5">
            {damagedProducts.map((item) => (
              <article
                key={item.id}
                className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
              >
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-800">{item.baleCode} · {item.category}</h3>
                  <p className="mt-1 truncate text-xs text-slate-500">{item.reason}</p>
                </div>
                <span className="shrink-0 rounded-xl bg-amber-50 px-3 py-2 text-sm font-extrabold text-amber-800">
                  {item.quantity}
                </span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default DamagedProductsPage
