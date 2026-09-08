import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { getSupabaseClient } from '../lib/supabaseClient'
import { formatShortDate } from '../utils/dates'
import { calculateBaseRecommendedPrice, DEFAULT_TARGET_MARGIN } from '../utils/pricing'

const PacaDataContext = createContext(null)

const asNumber = (value) => Number(value) || 0
const deliveryStatuses = ['to_prepare', 'ready', 'on_the_way', 'delivered']
const paymentStatuses = ['pending', 'partial', 'paid']
function normalizeCategoryName(value) {
  return value.trim().replace(/\s+/g, ' ')
}

function categoryComparisonKey(value) {
  return normalizeCategoryName(value).toLocaleLowerCase('es')
}

function createCategorySlug(name) {
  const baseSlug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'categoria'
  const uniqueSuffix = globalThis.crypto?.randomUUID?.().slice(0, 8)
    ?? Math.random().toString(36).slice(2, 10)

  return `${baseSlug}-${uniqueSuffix}`
}

async function findOrCreateCategory(supabase, categoryName) {
  const normalizedName = normalizeCategoryName(categoryName)
  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('id, name')

  if (categoriesError) throw categoriesError

  const existingCategory = categories.find(
    (category) => categoryComparisonKey(category.name) === categoryComparisonKey(normalizedName),
  )
  if (existingCategory) return existingCategory

  const { data: newCategory, error: categoryError } = await supabase
    .from('categories')
    .insert({ name: normalizedName, slug: createCategorySlug(normalizedName) })
    .select('id, name')
    .single()

  if (categoryError) throw categoryError
  return newCategory
}

function mapBale(row, currentRevenue = 0) {
  const receivedPieces = row.received_pieces
  const damagedPieces = row.damaged_pieces
  const sellablePieces = Math.max(0, receivedPieces - damagedPieces)
  const totalInvestment = asNumber(row.purchase_cost) + asNumber(row.transport_cost) + asNumber(row.other_expenses)
  const estimatedUnitCost = sellablePieces > 0 ? totalInvestment / sellablePieces : 0
  const targetMargin = asNumber(row.target_margin_percent) || DEFAULT_TARGET_MARGIN
  return {
    id: row.id,
    code: row.code,
    purchaseDate: row.purchase_date,
    purchaseCost: asNumber(row.purchase_cost),
    acquisitionTransport: asNumber(row.transport_cost),
    otherExpenses: asNumber(row.other_expenses),
    receivedPieces,
    soldPieces: row.sold_pieces,
    damagedPieces,
    availablePieces: row.available_pieces,
    currentRevenue,
    targetMargin,
    estimatedUnitCost,
    baseRecommendedPrice: calculateBaseRecommendedPrice(estimatedUnitCost, targetMargin),
    status: row.available_pieces > 0 ? 'En venta' : row.sold_pieces > 0 ? 'Agotada' : 'Sin piezas vendibles',
  }
}

function mapSale(row) {
  const items = row.sale_items ?? []
  const primaryItem = items[0]
  const baleCodes = [...new Set(items.flatMap((item) => (
    (item.sale_item_allocations ?? []).map((allocation) => allocation.inventory?.bale?.code).filter(Boolean)
  )))]
  const deliveryStatus = deliveryStatuses.includes(row.delivery_status) ? row.delivery_status : 'to_prepare'
  const paymentStatus = paymentStatuses.includes(row.payment_status) ? row.payment_status : 'paid'
  const paidAmount = asNumber(row.paid_amount)
  const total = asNumber(row.total)
  const merchandiseTotal = asNumber(row.merchandise_total ?? total - asNumber(row.delivery_charge))
  const deliveryCost = asNumber(row.delivery_cost)
  const estimatedMerchandiseCost = asNumber(row.estimated_merchandise_cost)

  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer?.name ?? 'Venta de mostrador',
    pieces: items.reduce((total, item) => total + item.quantity, 0),
    total,
    merchandiseTotal,
    deliveryCost,
    deliveryCharge: asNumber(row.delivery_charge),
    estimatedMerchandiseCost,
    estimatedProfit: total - estimatedMerchandiseCost - deliveryCost,
    dateLabel: formatShortDate(row.sold_at),
    soldAt: row.sold_at,
    hasDeliveryStatus: deliveryStatuses.includes(row.delivery_status),
    deliveryStatus,
    paymentStatus,
    paidAmount,
    balance: Math.max(0, total - paidAmount),
    paymentMethod: row.payment_method,
    firstPaymentAmount: asNumber(row.first_payment_amount ?? paidAmount),
    firstPaymentMethod: row.first_payment_method ?? (paidAmount > 0 ? row.payment_method : null),
    firstPaymentAt: row.first_payment_at ?? (paidAmount > 0 ? row.sold_at : null),
    secondPaymentAmount: asNumber(row.second_payment_amount),
    secondPaymentMethod: row.second_payment_method,
    secondPaymentAt: row.second_payment_at,
    lastPaymentAt: row.second_payment_at ?? row.first_payment_at ?? row.sold_at,
    baleCodes,
    unitPrice: asNumber(primaryItem?.unit_price),
    referenceUnitCost: asNumber(primaryItem?.reference_unit_cost),
    recommendedUnitPrice: asNumber(primaryItem?.recommended_unit_price),
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

function mapDailySummary(row) {
  return {
    id: row.id,
    date: row.summary_date,
    salesTotal: asNumber(row.sales_total),
    cashTotal: asNumber(row.cash_total),
    transferTotal: asNumber(row.transfer_total),
    cardTotal: asNumber(row.card_total),
    otherTotal: asNumber(row.other_total),
    piecesSold: row.pieces_sold ?? 0,
    damagedPieces: row.damaged_pieces ?? 0,
    estimatedCost: asNumber(row.estimated_cost),
    estimatedProfit: asNumber(row.estimated_profit),
    expensesTotal: asNumber(row.expenses_total),
    netResult: asNumber(row.net_result),
    pendingDeliveries: row.pending_deliveries ?? 0,
    ordersTotal: asNumber(row.orders_total),
    deliveryCostTotal: asNumber(row.delivery_cost_total),
    deliveryChargeTotal: asNumber(row.delivery_charge_total),
    pendingReceivables: asNumber(row.pending_receivables),
  }
}

export function PacaDataProvider({ children }) {
  const { user } = useAuth()
  return <AccountPacaDataProvider key={user?.id ?? 'guest'} userId={user?.id}>{children}</AccountPacaDataProvider>
}

function AccountPacaDataProvider({ userId, children }) {
  const [state, setState] = useState({ isLoading: true, error: '', lastUpdatedAt: null, data: emptyData() })
  const latestRequest = useRef(0)
  const pendingRequests = useRef(0)
  const lastRefreshAt = useRef(0)

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!userId) {
      setState({ isLoading: false, error: '', lastUpdatedAt: null, data: emptyData() })
      return
    }
    if (silent && pendingRequests.current > 0) return
    const requestId = ++latestRequest.current
    pendingRequests.current += 1
    if (!silent) setState((current) => ({ ...current, isLoading: true, error: '' }))

    try {
      const supabase = getSupabaseClient()
      const [categories, bales, sales, customers, expenses, damagedProducts, allocations, dailySummaries, baleInventory] = await Promise.all([
        supabase.from('inventory_summary').select('category_id, name, received_pieces, available_pieces').order('name'),
        supabase.from('bale_summary').select('*').order('purchase_date', { ascending: false }),
        supabase.from('sales').select('*, customer:customers(name), sale_items(quantity, unit_price, reference_unit_cost, recommended_unit_price, sale_item_allocations(quantity, inventory:bale_inventory(bale:bales(code))))').order('sold_at', { ascending: false }),
        supabase.from('customer_summary').select('id, name, phone, is_priority, purchases, total_spent').order('name'),
        supabase.from('expenses').select('id, concept, amount, expense_date').order('expense_date', { ascending: false }),
        supabase.from('damaged_products').select('id, quantity, reason, reported_at, inventory:bale_inventory(category:categories(name), bale:bales(code))').order('reported_at', { ascending: false }),
        supabase.from('sale_item_allocations').select('quantity, sale_item:sale_items(unit_price), inventory:bale_inventory(bale_id)'),
        supabase.from('daily_summaries').select('*').order('summary_date', { ascending: false }).limit(14),
        supabase.from('bale_inventory_pricing').select('*').order('bale_code'),
      ])
      const failed = [categories, bales, sales, customers, expenses, damagedProducts, allocations, dailySummaries, baleInventory].find((result) => result.error)
      if (failed) throw failed.error
      if (requestId !== latestRequest.current) return

      const revenueByBale = new Map()
      allocations.data.forEach((row) => {
        const baleId = row.inventory?.bale_id
        if (baleId) revenueByBale.set(baleId, (revenueByBale.get(baleId) ?? 0) + row.quantity * asNumber(row.sale_item?.unit_price))
      })
      const mappedBales = bales.data.map((row) => mapBale(row, revenueByBale.get(row.id) ?? 0))
      lastRefreshAt.current = Date.now()
      setState({
        isLoading: false,
        error: '',
        lastUpdatedAt: lastRefreshAt.current,
        data: {
          categories: categories.data.map((row) => ({ id: row.category_id, name: row.name, receivedPieces: row.received_pieces, availablePieces: row.available_pieces })),
          bales: mappedBales,
          sales: sales.data.map(mapSale),
          customers: customers.data.map(mapCustomer),
          expenses: expenses.data.map((row) => ({ id: row.id, concept: row.concept, dateLabel: formatShortDate(row.expense_date), amount: asNumber(row.amount) })),
          dailySummaries: dailySummaries.data.map(mapDailySummary),
          baleInventory: baleInventory.data.map((row) => ({
            id: row.id,
            baleId: row.bale_id,
            baleCode: row.bale_code ?? 'Paca',
            categoryId: row.category_id,
            categoryName: row.category_name ?? 'Categoría',
            receivedPieces: row.received_quantity,
            soldPieces: row.sold_quantity,
            damagedPieces: row.damaged_quantity,
            availablePieces: row.available_quantity,
            priceLevel: row.price_level,
            customRecommendedPrice: asNumber(row.custom_recommended_price),
            targetMargin: asNumber(row.target_margin_percent) || DEFAULT_TARGET_MARGIN,
            estimatedUnitCost: asNumber(row.estimated_unit_cost),
            baseRecommendedPrice: asNumber(row.base_recommended_price),
            recommendedUnitPrice: asNumber(row.recommended_unit_price),
          })),
          damagedProducts: damagedProducts.data.map((row) => ({ id: row.id, baleCode: row.inventory?.bale?.code ?? 'Paca', category: row.inventory?.category?.name ?? 'Sin categoría', quantity: row.quantity, reason: row.reason })),
        },
      })
    } catch (error) {
      if (requestId === latestRequest.current) {
        setState((current) => ({ ...current, isLoading: false, error: error.message || 'No fue posible actualizar los datos.' }))
      }
    } finally {
      pendingRequests.current -= 1
    }
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!userId) return undefined
    const refreshVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRefreshAt.current >= 15000) {
        refresh({ silent: true })
      }
    }
    const timer = window.setInterval(refreshVisible, 60000)
    document.addEventListener('visibilitychange', refreshVisible)
    window.addEventListener('focus', refreshVisible)
    window.addEventListener('online', refreshVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshVisible)
      window.removeEventListener('focus', refreshVisible)
      window.removeEventListener('online', refreshVisible)
    }
  }, [userId, refresh])

  const createBale = useCallback(async ({
    purchaseDate,
    purchaseCost,
    transportCost,
    otherExpenses,
    receivedPieces,
    targetMargin,
    categoryEntries,
  }) => {
    const supabase = getSupabaseClient()
    const { data: bale, error: baleError } = await supabase.from('bales').insert({ purchase_date: purchaseDate, purchase_cost: purchaseCost, transport_cost: transportCost, other_expenses: otherExpenses, received_pieces: receivedPieces, target_margin_percent: targetMargin }).select('*').single()
    if (baleError) throw baleError

    const categoryNames = []
    let damagedPieces = 0
    for (const entry of categoryEntries) {
      const category = await findOrCreateCategory(supabase, entry.name)
      const { data: inventory, error: inventoryError } = await supabase.from('bale_inventory').insert({
        bale_id: bale.id,
        category_id: category.id,
        received_quantity: entry.quantity,
        price_level: entry.priceLevel,
        custom_recommended_price: entry.priceLevel === 'custom' ? entry.customRecommendedPrice : null,
      }).select('id').single()
      if (inventoryError) throw inventoryError
      categoryNames.push(category.name)
      damagedPieces += entry.damagedPieces
      if (entry.damagedPieces > 0) {
        const { error: damagedError } = await supabase.rpc('register_damaged_product', {
          p_bale_inventory_id: inventory.id, p_quantity: entry.damagedPieces, p_reason: entry.damageReason,
        })
        if (damagedError) throw damagedError
      }
    }

    await refresh()
    return {
      ...mapBale({
        ...bale,
        sold_pieces: 0,
        damaged_pieces: damagedPieces,
        available_pieces: receivedPieces - damagedPieces,
        target_margin_percent: targetMargin,
      }),
      categoryNames,
    }
  }, [refresh])

  const registerSale = useCallback(async ({ categoryId, quantity, unitPrice, paymentMethod, customerId, baleInventoryId, paymentStatus = 'paid', paidAmount = null, deliveryCost = 0, deliveryCharge = 0 }) => {
    const { error } = await getSupabaseClient().rpc('register_sale', {
      p_category_id: categoryId,
      p_quantity: quantity,
      p_unit_price: unitPrice,
      p_payment_method: paymentMethod,
      p_customer_id: customerId === 'walk-in' ? null : customerId,
      p_bale_inventory_id: baleInventoryId || null,
      p_payment_status: paymentStatus,
      p_paid_amount: paidAmount,
      p_delivery_cost: deliveryCost,
      p_delivery_charge: deliveryCharge,
    })
    if (error) throw error
    await refresh()
  }, [refresh])

  const registerDamage = useCallback(async ({ baleInventoryId, quantity, reason }) => {
    const { error } = await getSupabaseClient().rpc('register_damaged_product', {
      p_bale_inventory_id: baleInventoryId,
      p_quantity: quantity,
      p_reason: reason.trim(),
    })
    if (error) throw error
    await refresh()
  }, [refresh])

  const updateSaleDeliveryStatus = useCallback(async (saleId, deliveryStatus) => {
    if (!deliveryStatuses.includes(deliveryStatus)) {
      throw new Error('El estado de entrega no es válido.')
    }

    const { data: updatedSale, error } = await getSupabaseClient().rpc('update_sale_delivery_status', {
      p_sale_id: saleId, p_delivery_status: deliveryStatus,
    })

    if (error) throw error

    setState((current) => ({
      ...current,
      data: {
        ...current.data,
        sales: current.data.sales.map((sale) => (
          sale.id === saleId ? { ...sale, deliveryStatus: updatedSale.delivery_status, hasDeliveryStatus: true } : sale
        )),
      },
    }))
    await refresh()
  }, [refresh])

  const updateSalePayment = useCallback(async (saleId, { paymentStatus, paidAmount, paymentMethod }) => {
    const { error } = await getSupabaseClient().rpc('update_sale_payment', {
      p_sale_id: saleId,
      p_payment_status: paymentStatus,
      p_paid_amount: paidAmount,
      p_payment_method: paymentMethod,
    })
    if (error) throw error
    await refresh()
  }, [refresh])

  const completeSalePayment = useCallback(async (saleId, paymentMethod) => {
    const { error } = await getSupabaseClient().rpc('complete_sale_payment', {
      p_sale_id: saleId,
      p_payment_method: paymentMethod,
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
    () => ({ ...state, refresh, createBale, createCustomer, registerSale, registerDamage, updateSaleDeliveryStatus, updateSalePayment, completeSalePayment }),
    [state, refresh, createBale, createCustomer, registerSale, registerDamage, updateSaleDeliveryStatus, updateSalePayment, completeSalePayment],
  )
  return <PacaDataContext.Provider value={value}>{children}</PacaDataContext.Provider>
}

function emptyData() {
  return { categories: [], bales: [], sales: [], customers: [], expenses: [], damagedProducts: [], dailySummaries: [], baleInventory: [] }
}

export function usePacaData() {
  const context = useContext(PacaDataContext)
  if (!context) throw new Error('usePacaData debe usarse dentro de PacaDataProvider.')
  return context
}
