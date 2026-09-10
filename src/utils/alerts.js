export const defaultAlertSettings = Object.freeze({
  stockEnabled: true,
  stockLimit: 10,
  deliveryEnabled: true,
  deliveryHours: 24,
  debtEnabled: true,
  damageEnabled: true,
  damagePercent: 10,
})

export function normalizeAlertSettings(value = {}) {
  const settings = { ...defaultAlertSettings }
  if (!value || typeof value !== 'object') return settings
  for (const key of ['stockEnabled', 'deliveryEnabled', 'debtEnabled', 'damageEnabled']) {
    if (typeof value[key] === 'boolean') settings[key] = value[key]
  }
  for (const [key, min, max] of [['stockLimit', 0, 10000], ['deliveryHours', 1, 720], ['damagePercent', 1, 100]]) {
    const number = value[key]
    if (Number.isInteger(number) && number >= min && number <= max) settings[key] = number
  }
  return settings
}

export function buildAlerts(data, settings = defaultAlertSettings, now = Date.now()) {
  const rules = normalizeAlertSettings(settings)
  const alerts = []

  if (rules.stockEnabled) {
    for (const category of data.categories) {
      if (!(category.receivedPieces > 0) || !Number.isFinite(category.availablePieces)
        || category.availablePieces > rules.stockLimit) continue
      const empty = category.availablePieces <= 0
      alerts.push({
        id: `stock:${category.id}`,
        revision: empty ? 'empty' : 'low',
        type: 'stock',
        priority: empty ? 0 : 2,
        title: empty ? `Sin existencias: ${category.name}` : `Poco inventario: ${category.name}`,
        description: `${Math.max(0, category.availablePieces)} piezas disponibles. Revisa si necesitas reponer esta categoría.`,
        detail: `Límite: ${rules.stockLimit} piezas`,
        to: `/inventario?categoria=${encodeURIComponent(category.id)}`,
        action: 'Revisar inventario',
      })
    }
  }

  if (rules.deliveryEnabled) {
    for (const sale of data.sales) {
      const soldAt = Date.parse(sale.soldAt)
      // La venta de mostrador no implica un envío. Tampoco inferimos un pago
      // cuando el estado todavía no existe en el esquema de la base de datos.
      if (!sale.customerId || sale.fulfillmentMethod !== 'delivery' || !sale.hasDeliveryStatus || sale.paymentStatus !== 'paid' || sale.deliveryStatus !== 'to_prepare'
        || !Number.isFinite(soldAt) || now - soldAt < rules.deliveryHours * 3600000) continue
      alerts.push({
        id: `delivery:${sale.id}`,
        revision: 'pending',
        type: 'delivery',
        priority: 1,
        title: `Revisar entrega: ${sale.customerName}`,
        description: 'El pedido ya está pagado, pero sigue pendiente de preparación o despacho.',
        detail: `${Math.floor((now - soldAt) / 3600000)} h desde el registro · ${sale.dateLabel}`,
        to: `/ventas?venta=${encodeURIComponent(sale.id)}`,
        action: 'Revisar pedido',
      })
    }
  }

  if (rules.debtEnabled) {
    const debts = new Map()
    for (const sale of data.sales) {
      if (!sale.customerId || !(sale.balance > 0)) continue
      const referenceAt = Date.parse(sale.lastPaymentAt ?? sale.soldAt)
      if (!Number.isFinite(referenceAt)) continue
      const current = debts.get(sale.customerId) ?? { customerId: sale.customerId, customerName: sale.customerName, balance: 0, referenceAt, sales: 0 }
      current.balance += sale.balance
      current.sales += 1
      // Si tiene varios pedidos, uno reciente no debe ocultar una deuda vieja.
      current.referenceAt = Math.min(current.referenceAt, referenceAt)
      debts.set(sale.customerId, current)
    }
    for (const debt of debts.values()) {
      const elapsed = now - debt.referenceAt
      const wait = 24 * 3600000
      if (elapsed < wait) continue
      const reminder = Math.floor((elapsed - wait) / (5 * 3600000))
      alerts.push({
        id: `debt:${debt.customerId}`,
        revision: `overdue-${reminder}`,
        type: 'debt',
        priority: 0,
        title: `Cobro pendiente: ${debt.customerName}`,
        description: `Tiene un saldo pendiente de C$${debt.balance.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
        detail: `${debt.sales} ${debt.sales === 1 ? 'pedido pendiente' : 'pedidos pendientes'} · recordatorio cada 5 horas`,
        to: `/clientes/${encodeURIComponent(debt.customerId)}`,
        action: 'Ver historial y cobrar',
      })
    }
  }

  if (rules.damageEnabled) {
    for (const bale of data.bales) {
      if (bale.receivedPieces > 0 && Number.isFinite(bale.availablePieces)
        && bale.availablePieces <= 0 && bale.soldPieces > 0) {
        alerts.push({
          id: `bale:${bale.id}`,
          revision: 'exhausted',
          type: 'bale',
          priority: 1,
          title: `Paca agotada: ${bale.code}`,
          description: 'Esta paca ya no tiene piezas vendibles. Revisa su resultado antes de abrir otra compra.',
          detail: `${bale.soldPieces} vendidas · ${bale.damagedPieces || 0} dañadas`,
          to: `/pacas?paca=${encodeURIComponent(bale.id)}`,
          action: 'Revisar paca',
        })
      }
      if (!(bale.receivedPieces > 0) || !(bale.damagedPieces > 0)) continue
      const percentage = bale.damagedPieces * 100 / bale.receivedPieces
      if (percentage < rules.damagePercent) continue
      alerts.push({
        id: `damage:${bale.id}`,
        revision: 'high',
        type: 'damage',
        priority: 2,
        title: `Daños elevados: ${bale.code}`,
        description: `${bale.damagedPieces} de ${bale.receivedPieces} piezas están dañadas (${percentage.toLocaleString('es', { maximumFractionDigits: 1 })} %). Revisa esta compra.`,
        detail: `Límite: ${rules.damagePercent} % por paca`,
        to: `/pacas?paca=${encodeURIComponent(bale.id)}`,
        action: 'Revisar paca',
      })
    }
  }

  return alerts.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
}

// Solo conservamos lecturas de problemas activos. Si se resuelve y luego
// vuelve a ocurrir, vuelve a ser una alerta sin leer.
export function reconcileAlertReads(reads, alerts) {
  return Object.fromEntries(alerts
    .filter((alert) => reads[alert.id] === alert.revision)
    .map((alert) => [alert.id, alert.revision]))
}

export function parseAlertPreferences(serialized) {
  try {
    const parsed = JSON.parse(serialized)
    return {
      settings: normalizeAlertSettings(parsed?.settings),
      reads: Object.fromEntries(Object.entries(parsed?.reads ?? {})
        .filter(([id, revision]) => /^(stock|delivery|debt|damage|bale):/.test(id) && typeof revision === 'string')),
    }
  } catch {
    return { settings: { ...defaultAlertSettings }, reads: {} }
  }
}
