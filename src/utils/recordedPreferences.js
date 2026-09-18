// Las compras reales y las categorías elegidas explícitamente tienen prioridad
// sobre el catálogo inicial. No elimina categorías ni registros históricos.
export function recordedCategories(data) {
  const purchases = new Map(data.bales.map((bale) => [bale.id, bale]))
  const recent = new Map()
  for (const inventory of data.baleInventory) {
    const bale = purchases.get(inventory.baleId)
    const date = bale?.createdAt || bale?.purchaseDate || ''
    if (!recent.has(inventory.categoryId) || date > recent.get(inventory.categoryId)) recent.set(inventory.categoryId, date)
  }
  return data.categories.filter((category) => recent.has(category.id) || category.isUserCreated
    || category.receivedPieces > 0 || Object.values(category.prices || {}).some((price) => price > 0))
    .sort((a, b) => (recent.get(b.id) || '').localeCompare(recent.get(a.id) || '') || a.name.localeCompare(b.name, 'es'))
}

export function lastRecordedOperations(data) {
  const sales = [...data.sales].sort((a, b) => (b.createdAt || b.soldAt || '').localeCompare(a.createdAt || a.soldAt || '') || String(b.id || '').localeCompare(String(a.id || '')))
  const purchases = [...data.bales].sort((a, b) => (b.createdAt || b.purchaseDate || '').localeCompare(a.createdAt || a.purchaseDate || ''))
  const prices = new Map()
  for (const sale of sales) {
    const categoryPrices = new Map()
    for (const item of sale.items || []) {
      if (!(item.unitPrice > 0)) continue
      const values = categoryPrices.get(item.categoryId) || []
      if (!values.includes(item.unitPrice)) values.push(item.unitPrice)
      categoryPrices.set(item.categoryId, values)
    }
    for (const [id, values] of categoryPrices) if (!prices.has(id)) prices.set(id, values)
  }
  const sale = sales[0]
  return {
    sale: sale && { method: sale.firstPaymentMethod || sale.paymentMethod,
      status: sale.paymentStatus },
    purchase: purchases[0], delivery: sales.find((item) => item.fulfillmentMethod === 'delivery'), prices,
  }
}
