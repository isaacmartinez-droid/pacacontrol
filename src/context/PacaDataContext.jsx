import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { getSupabaseClient } from '../lib/supabaseClient'
import { formatShortDate } from '../utils/dates'

const PacaDataContext = createContext(null)

const asNumber = (value) => Number(value) || 0

function mapBale(row, currentRevenue = 0) {
  return {
    id: row.id,
    code: row.code,
    purchaseDate: row.purchase_date,
    purchaseCost: asNumber(row.purchase_cost),
    acquisitionTransport: asNumber(row.transport_cost),
    otherExpenses: asNumber(row.other_expenses),
    receivedPieces: row.received_pieces,
    soldPieces: row.sold_pieces,
    damagedPieces: row.damaged_pieces,
    currentRevenue,
    status: row.available_pieces > 0 ? 'En venta' : 'Finalizada',
  }
}

function mapSale(row) {
  const items = row.sale_items ?? []
  return {
    id: row.id,
    customerName: row.customer?.name ?? 'Venta de mostrador',
    pieces: items.reduce((total, item) => total + item.quantity, 0),
    total: asNumber(row.total),
    dateLabel: formatShortDate(row.sold_at),
    status: 'Completada',
  }
}

function mapCustomer(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? '',
    priority: row.is_priority,
    purchases: row.purchases ?? 0,
    totalSpent: asNumber(row.total_spent),
  }
}

export function PacaDataProvider({ children }) {
  const { user } = useAuth()
  const [state, setState] = useState({ isLoading: true, error: '', data: emptyData() })

  const refresh = useCallback(async () => {
    if (!user) {
      setState({ isLoading: false, error: '', data: emptyData() })
      return
    }

    setState((current) => ({ ...current, isLoading: true, error: '' }))
    const supabase = getSupabaseClient()
    const [categories, bales, sales, customers, expenses, damagedProducts, allocations] = await Promise.all([
      supabase.from('inventory_summary').select('category_id, name, available_pieces').order('name'),
      supabase.from('bale_summary').select('*').order('purchase_date', { ascending: false }),
      supabase.from('sales').select('id, total, sold_at, customer:customers(name), sale_items(quantity)').order('sold_at', { ascending: false }),
      supabase.from('customer_summary').select('id, name, phone, is_priority, purchases, total_spent').order('name'),
      supabase.from('expenses').select('id, concept, amount, expense_date').order('expense_date', { ascending: false }),
      supabase.from('damaged_products').select('id, quantity, reason, reported_at, inventory:bale_inventory(category:categories(name))').order('reported_at', { ascending: false }),
      supabase.from('sale_item_allocations').select('quantity, sale_item:sale_items(unit_price), inventory:bale_inventory(bale_id)'),
    ])
    const failed = [categories, bales, sales, customers, expenses, damagedProducts, allocations].find((result) => result.error)
    if (failed) {
      setState((current) => ({ ...current, isLoading: false, error: failed.error.message }))
      return
    }

    const revenueByBale = new Map()
    allocations.data.forEach((row) => {
      const baleId = row.inventory?.bale_id
      if (baleId) revenueByBale.set(baleId, (revenueByBale.get(baleId) ?? 0) + row.quantity * asNumber(row.sale_item?.unit_price))
    })

    setState({
      isLoading: false,
      error: '',
      data: {
        categories: categories.data.map((row) => ({ id: row.category_id, name: row.name, availablePieces: row.available_pieces })),
        bales: bales.data.map((row) => mapBale(row, revenueByBale.get(row.id) ?? 0)),
        sales: sales.data.map(mapSale),
        customers: customers.data.map(mapCustomer),
        expenses: expenses.data.map((row) => ({ id: row.id, concept: row.concept, dateLabel: formatShortDate(row.expense_date), amount: asNumber(row.amount) })),
        damagedProducts: damagedProducts.data.map((row) => ({ id: row.id, category: row.inventory?.category?.name ?? 'Sin categoría', quantity: row.quantity, reason: row.reason })),
      },
    })
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  const createBale = useCallback(async ({ purchaseDate, purchaseCost, transportCost, otherExpenses, receivedPieces, categoryId }) => {
    const supabase = getSupabaseClient()
    const { data: bale, error: baleError } = await supabase.from('bales').insert({ purchase_date: purchaseDate, purchase_cost: purchaseCost, transport_cost: transportCost, other_expenses: otherExpenses, received_pieces: receivedPieces }).select('*').single()
    if (baleError) throw baleError

    const { error: inventoryError } = await supabase.from('bale_inventory').insert({ bale_id: bale.id, category_id: categoryId, received_quantity: receivedPieces })
    if (inventoryError) throw inventoryError
    await refresh()
    return mapBale({ ...bale, sold_pieces: 0, damaged_pieces: 0, available_pieces: receivedPieces })
  }, [refresh])

  const registerSale = useCallback(async ({ categoryId, quantity, unitPrice, paymentMethod, customerId }) => {
    const { error } = await getSupabaseClient().rpc('register_sale', {
      p_category_id: categoryId,
      p_quantity: quantity,
      p_unit_price: unitPrice,
      p_payment_method: paymentMethod,
      p_customer_id: customerId === 'walk-in' ? null : customerId,
    })
    if (error) throw error
    await refresh()
  }, [refresh])

  const createCustomer = useCallback(async ({ name, phone, isPriority }) => {
    const { data, error } = await getSupabaseClient()
      .from('customers')
      .insert({
        name: name.trim(),
        phone: phone.trim() || null,
        is_priority: Boolean(isPriority),
      })
      .select('id, name, phone, is_priority')
      .single()

    if (error) throw error
    await refresh()
    return mapCustomer(data)
  }, [refresh])

  const value = useMemo(
    () => ({ ...state, refresh, createBale, createCustomer, registerSale }),
    [state, refresh, createBale, createCustomer, registerSale],
  )
  return <PacaDataContext.Provider value={value}>{children}</PacaDataContext.Provider>
}

function emptyData() {
  return { categories: [], bales: [], sales: [], customers: [], expenses: [], damagedProducts: [] }
}

export function usePacaData() {
  const context = useContext(PacaDataContext)
  if (!context) throw new Error('usePacaData debe usarse dentro de PacaDataProvider.')
  return context
}
