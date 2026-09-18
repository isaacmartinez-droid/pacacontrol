import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { getSupabaseClient } from '../lib/supabaseClient'
import { formatShortDate } from '../utils/dates'
import { allocateBaleCollections } from '../utils/baleFinancials'
import { calculateBaseRecommendedPrice, DEFAULT_TARGET_PROFIT } from '../utils/pricing'
import {
  businessSettingsToRow,
  defaultBusinessSettings,
  mapBusinessSettings,
  normalizeBusinessSettings,
} from '../utils/businessSettings'
import { mapBusinessProfile, mapBusinessTemplate, normalizeBusinessVocabulary } from '../utils/businessProfile'

const PacaDataContext = createContext(null)

const asNumber = (value) => Number(value) || 0
const deliveryStatuses = ['to_prepare', 'ready', 'on_the_way', 'delivered']
const paymentStatuses = ['pending', 'partial', 'paid']

async function loadAllRows(query) {
  const data = []
  for (let offset = 0; ; offset += 500) {
    const result = await query().range(offset, offset + 499)
    if (result.error) return result
    data.push(...result.data)
    if (result.data.length < 500) return { data, error: null }
  }
}
function mapBale(row, currentRevenue = 0, collectedAmount = 0) {
  const receivedPieces = row.received_pieces
  const damagedPieces = row.damaged_pieces
  const sellablePieces = Math.max(0, receivedPieces - damagedPieces)
  const totalInvestment = asNumber(row.purchase_cost) + asNumber(row.transport_cost) + asNumber(row.other_expenses)
  const estimatedUnitCost = sellablePieces > 0 ? totalInvestment / sellablePieces : 0
  const targetProfitAmount = asNumber(row.target_profit_amount) || DEFAULT_TARGET_PROFIT
  return {
    id: row.id,
    code: row.code,
    purchaseDate: row.purchase_date,
    createdAt: row.created_at,
    archivedAt: row.archived_at ?? null,
    archivedReason: row.archived_reason ?? '',
    isArchived: Boolean(row.archived_at),
    purchaseCost: asNumber(row.purchase_cost),
    acquisitionTransport: asNumber(row.transport_cost),
    otherExpenses: asNumber(row.other_expenses),
    notes: row.notes ?? '',
    receivedPieces,
    soldPieces: row.sold_pieces,
    damagedPieces,
    availablePieces: row.available_pieces,
    currentRevenue,
    collectedAmount,
    targetProfitAmount,
    estimatedUnitCost,
    baseRecommendedPrice: calculateBaseRecommendedPrice(estimatedUnitCost, targetProfitAmount, sellablePieces),
    status: row.archived_at ? 'Archivada' : row.available_pieces > 0 ? 'En venta' : row.sold_pieces > 0 ? 'Agotada' : 'Sin piezas vendibles',
  }
}

function mapSale(row) {
  const items = row.sale_items ?? []
  const primaryItem = items[0]
  const saleItems = items.flatMap((item) => (item.sale_item_allocations?.length ? item.sale_item_allocations : [null]).map((allocation) => ({
    id: allocation ? `${item.id}:${allocation.inventory?.id}` : item.id,
    categoryId: item.category_id,
    categoryName: item.category?.name ?? 'Sin categoría',
    baleInventoryId: allocation?.inventory?.id,
    baleId: allocation?.inventory?.bale?.id,
    baleIsArchived: Boolean(allocation?.inventory?.bale?.archived_at),
    baleCode: allocation?.inventory?.bale?.code ?? 'Paca',
    quantity: allocation?.quantity ?? item.quantity,
    unitPrice: asNumber(item.unit_price),
    referenceUnitCost: asNumber(item.reference_unit_cost),
    recommendedUnitPrice: asNumber(item.recommended_unit_price),
  }))).sort((a, b) => a.categoryName.localeCompare(b.categoryName, 'es') || a.unitPrice - b.unitPrice)
  const priceLines = saleItems.map((item) => ({
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    referenceUnitCost: item.referenceUnitCost,
    recommendedUnitPrice: item.recommendedUnitPrice,
  }))
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
    isArchived: saleItems.length > 0 && saleItems.every((item) => item.baleIsArchived),
    hasArchivedInventory: saleItems.some((item) => item.baleIsArchived),
    customerName: row.customer?.name ?? 'Venta de mostrador',
    pieces: items.reduce((total, item) => total + item.quantity, 0),
    total,
    merchandiseTotal,
    deliveryCost,
    deliveryCharge: asNumber(row.delivery_charge),
    fulfillmentMethod: row.fulfillment_method ?? (deliveryCost > 0 ? 'delivery' : 'pickup'),
    estimatedMerchandiseCost,
    estimatedProfit: total - estimatedMerchandiseCost - deliveryCost,
    dateLabel: formatShortDate(row.sold_at),
    soldAt: row.sold_at,
    createdAt: row.created_at,
    notes: row.notes ?? '',
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
    lastPaymentAt: row.last_additional_payment_at ?? row.second_payment_at ?? row.first_payment_at ?? row.sold_at,
    additionalPayments: (row.additional_payments ?? []).map((payment) => ({ id: payment.id, amount: asNumber(payment.amount), method: payment.method, paidAt: payment.paid_at })).sort((a, b) => a.paidAt.localeCompare(b.paidAt)),
    baleCodes,
    unitPrice: asNumber(primaryItem?.unit_price),
    referenceUnitCost: asNumber(primaryItem?.reference_unit_cost),
    recommendedUnitPrice: asNumber(primaryItem?.recommended_unit_price),
    priceLines,
    items: saleItems,
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
  const { hasAcceptedCurrentLegal, isAccessActive, isProfileLoading, user } = useAuth()
  const canLoadData = Boolean(user && hasAcceptedCurrentLegal && isAccessActive && !isProfileLoading)

  return <AccountPacaDataProvider key={canLoadData ? user.id : 'guest'} userId={canLoadData ? user.id : null}>{children}</AccountPacaDataProvider>
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
      const [categories, bales, sales, customers, expenses, damagedProducts, allocations, dailySummaries, baleInventory, businessSettings, monthlyExpenses, baleOtherExpenses, businessProfile, businessTemplates] = await Promise.all([
        loadAllRows(() => supabase.from('inventory_summary').select('*').order('name').order('category_id')),
        loadAllRows(() => supabase.from('bale_summary').select('*').order('purchase_date', { ascending: false }).order('id')),
        loadAllRows(() => supabase.from('sales').select('*, additional_payments:sale_additional_payments(id, amount, method, paid_at), customer:customers(name), sale_items(id, category_id, quantity, unit_price, reference_unit_cost, recommended_unit_price, category:categories(id, name), sale_item_allocations(quantity, inventory:bale_inventory(id, bale:bales(id, code, archived_at))))').order('sold_at', { ascending: false }).order('id')),
        loadAllRows(() => supabase.from('customer_summary').select('id, name, phone, is_priority, purchases, total_spent').order('name').order('id')),
        loadAllRows(() => supabase.from('expenses').select('*').order('expense_date', { ascending: false }).order('id')),
        loadAllRows(() => supabase.from('damaged_products').select('id, quantity, reason, reported_at, inventory:bale_inventory(category:categories(name), bale:bales(code, archived_at))').order('reported_at', { ascending: false }).order('id')),
        loadAllRows(() => supabase.from('sale_item_allocations').select('quantity, sale_item:sale_items(unit_price), inventory:bale_inventory(bale_id)').order('id')),
        supabase.from('daily_summaries').select('*').order('summary_date', { ascending: false }).limit(14),
        loadAllRows(() => supabase.from('bale_inventory_pricing').select('*').order('bale_code').order('id')),
        supabase.from('business_settings').select('*').maybeSingle(),
        loadAllRows(() => supabase.from('monthly_expense_commitments').select('*').order('created_at', { ascending: false }).order('id')),
        loadAllRows(() => supabase.from('bale_other_expense_items').select('*').order('bale_id').order('sort_order').order('id')),
        supabase.from('business_profiles').select('*').maybeSingle(),
        loadAllRows(() => supabase.from('business_templates').select('*').eq('is_active', true).order('name').order('version', { ascending: false })),
      ])
      const failed = [categories, bales, sales, customers, expenses, damagedProducts, allocations, dailySummaries, baleInventory, businessSettings, monthlyExpenses, baleOtherExpenses, businessProfile, businessTemplates].find((result) => result.error)
      if (failed) throw failed.error
      if (requestId !== latestRequest.current) return

      const revenueByBale = new Map()
      allocations.data.forEach((row) => {
        const baleId = row.inventory?.bale_id
        if (baleId) revenueByBale.set(baleId, (revenueByBale.get(baleId) ?? 0) + row.quantity * asNumber(row.sale_item?.unit_price))
      })
      const mappedSales = sales.data.map(mapSale)
      const collections = allocateBaleCollections(mappedSales)
      const mappedBales = bales.data.map((row) => mapBale(row, revenueByBale.get(row.id) ?? 0, collections.get(row.id) ?? 0))
      lastRefreshAt.current = Date.now()
      setState({
        isLoading: false,
        error: '',
        lastUpdatedAt: lastRefreshAt.current,
        data: {
          businessProfile: mapBusinessProfile(businessProfile.data),
          businessTemplates: businessTemplates.data.map(mapBusinessTemplate),
          settings: mapBusinessSettings(businessSettings.data),
          categories: categories.data.map((row) => ({
            id: row.category_id,
            name: row.name,
            isUserCreated: row.is_user_created === true,
            receivedPieces: row.received_pieces,
            availablePieces: row.available_pieces,
            prices: {
              economic: asNumber(row.economic_price),
              standard: asNumber(row.standard_price),
              premium: asNumber(row.premium_price),
            },
          })),
          bales: mappedBales,
          sales: mappedSales,
          customers: customers.data.map(mapCustomer),
          expenses: expenses.data.map((row) => ({ id: row.id, concept: row.concept, category: row.category, paymentMethod: row.payment_method ?? 'unknown', notes: row.notes ?? '', baleId: row.bale_id, expenseDate: row.expense_date, dateLabel: formatShortDate(row.expense_date), amount: asNumber(row.amount) })),
          monthlyExpenses: monthlyExpenses.data.map((row) => ({ id: row.id, concept: row.concept, category: row.category, monthlyAmount: asNumber(row.monthly_amount), isActive: row.is_active })),
          baleOtherExpenses: baleOtherExpenses.data.map((row) => ({
            id: row.id,
            baleId: row.bale_id,
            concept: row.concept,
            amount: asNumber(row.amount),
            sortOrder: row.sort_order,
            createdAt: row.created_at,
          })),
          dailySummaries: dailySummaries.data.map(mapDailySummary),
          baleInventory: baleInventory.data.map((row) => ({
            id: row.id,
            baleId: row.bale_id,
            isActive: row.is_active !== false && !row.bale_archived_at,
            baleCode: row.bale_code ?? 'Paca',
            categoryId: row.category_id,
            categoryName: row.category_name ?? 'Categoría',
            receivedPieces: row.received_quantity,
            soldPieces: row.sold_quantity,
            damagedPieces: row.damaged_quantity,
            availablePieces: row.available_quantity,
            priceLevel: row.price_level,
            customRecommendedPrice: asNumber(row.custom_recommended_price),
            targetProfitAmount: asNumber(row.target_profit_amount) || DEFAULT_TARGET_PROFIT,
            estimatedUnitCost: asNumber(row.estimated_unit_cost),
            baseRecommendedPrice: asNumber(row.base_recommended_price),
            recommendedUnitPrice: asNumber(row.recommended_unit_price),
          })),
          damagedProducts: damagedProducts.data.map((row) => ({ id: row.id, isArchived: Boolean(row.inventory?.bale?.archived_at), baleCode: row.inventory?.bale?.code ?? 'Paca', category: row.inventory?.category?.name ?? 'Sin categoría', quantity: row.quantity, reason: row.reason })),
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
    const onPush = (event) => {
      if (event.data?.type === 'PACA_PUSH_RECEIVED') refresh({ silent: true })
    }
    navigator.serviceWorker?.addEventListener('message', onPush)
    document.addEventListener('visibilitychange', refreshVisible)
    window.addEventListener('focus', refreshVisible)
    window.addEventListener('online', refreshVisible)
    return () => {
      window.clearInterval(timer)
      navigator.serviceWorker?.removeEventListener('message', onPush)
      document.removeEventListener('visibilitychange', refreshVisible)
      window.removeEventListener('focus', refreshVisible)
      window.removeEventListener('online', refreshVisible)
    }
  }, [userId, refresh])

  const createBale = useCallback(async ({
    purchaseDate,
    purchaseCost,
    transportCost,
    otherExpenseItems,
    receivedPieces,
    targetProfitAmount,
    categoryEntries,
  }) => {
    const supabase = getSupabaseClient()
    const { data: bale, error: baleError } = await supabase.rpc('create_bale_with_expense_details', {
      p_purchase_date: purchaseDate,
      p_purchase_cost: purchaseCost,
      p_transport_cost: transportCost,
      p_target_profit_amount: targetProfitAmount,
      p_category_entries: categoryEntries,
      p_other_expense_items: otherExpenseItems,
    })
    if (baleError) throw baleError

    const categoryNames = []
    let damagedPieces = 0
    for (const entry of categoryEntries) {
      categoryNames.push(entry.name)
      damagedPieces += entry.damagedPieces
    }

    await refresh()
    return {
      ...mapBale({
        ...bale,
        sold_pieces: 0,
        damaged_pieces: damagedPieces,
        available_pieces: receivedPieces - damagedPieces,
        target_profit_amount: targetProfitAmount,
      }),
      categoryNames,
    }
  }, [refresh])

  const registerSale = useCallback(async ({ items, paymentMethod, customerId, fulfillmentMethod = 'pickup', paymentStatus = 'paid', paidAmount = null, deliveryCost = 0, deliveryCharge = 0 }) => {
    const { error } = await getSupabaseClient().rpc('register_sale_with_items', {
      p_items: items.map((item) => ({
        category_id: item.categoryId,
        bale_inventory_id: item.baleInventoryId,
        price_lines: item.priceLines.map((line) => ({ quantity: line.quantity, unit_price: line.unitPrice })),
      })),
      p_payment_method: paymentMethod,
      p_customer_id: customerId === 'walk-in' ? null : customerId,
      p_fulfillment_method: fulfillmentMethod,
      p_payment_status: paymentStatus,
      p_paid_amount: paidAmount,
      p_delivery_cost: deliveryCost,
      p_delivery_charge: deliveryCharge,
    })
    if (error) throw error
    await refresh()
  }, [refresh])

  const updateBale = useCallback(async (baleId, values) => {
    const { error } = await getSupabaseClient().rpc('update_bale_with_expense_details', {
      p_bale_id: baleId,
      p_purchase_date: values.purchaseDate,
      p_purchase_cost: values.purchaseCost,
      p_transport_cost: values.transportCost,
      p_target_profit_amount: values.targetProfitAmount,
      p_inventory_lines: values.inventoryLines.map((line) => ({
        bale_inventory_id: line.id,
        received_quantity: line.receivedPieces,
        price_level: line.priceLevel,
        custom_recommended_price: line.priceLevel === 'custom' ? line.customRecommendedPrice : null,
      })),
      p_other_expense_items: values.otherExpenseItems,
      p_notes: values.notes || null,
    })
    if (error) throw error
    await refresh()
  }, [refresh])

  const archiveBale = useCallback(async (baleId, archived = true, reason = '') => {
    const { error } = await getSupabaseClient().rpc('set_bale_archived', { p_bale_id: baleId, p_archived: archived, p_reason: reason || null })
    if (error) throw error
    await refresh()
  }, [refresh])

  const createExpense = useCallback(async ({ concept, amount, expenseDate, category, notes, baleId, paymentMethod }) => {
    const { error } = await getSupabaseClient().from('expenses').insert({
      concept: concept.trim(), amount, expense_date: expenseDate, category,
      notes: notes?.trim() || null, bale_id: baleId || null, payment_method: paymentMethod ?? 'unknown',
    })
    if (error) throw error
    await refresh()
  }, [refresh])

  const updateExpense = useCallback(async (id, values) => {
    const { error } = await getSupabaseClient().rpc('update_business_expense', {
      p_expense_id: id, p_concept: values.concept.trim(), p_amount: values.amount,
      p_expense_date: values.expenseDate, p_category: values.category,
      p_bale_id: values.baleId || null, p_notes: values.notes?.trim() || null,
      p_payment_method: values.paymentMethod ?? 'unknown',
    })
    if (error) throw error
    await refresh()
  }, [refresh])

  const saveMonthlyExpense = useCallback(async ({ id, concept, category, monthlyAmount }) => {
    const values = { concept: concept.trim(), category, monthly_amount: monthlyAmount }
    const table = getSupabaseClient().from('monthly_expense_commitments')
    const { error } = await (id ? table.update(values).eq('id', id) : table.insert(values))
    if (error) throw error
    await refresh()
  }, [refresh])

  const setMonthlyExpenseActive = useCallback(async (id, isActive) => {
    const { error } = await getSupabaseClient().from('monthly_expense_commitments').update({ is_active: isActive }).eq('id', id)
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

  const updateSaleOrder = useCallback(async (saleId, { items, customerId, fulfillmentMethod, deliveryCost = 0, deliveryCharge = 0, notes = '' }) => {
    const { error } = await getSupabaseClient().rpc('update_sale_order', {
      p_sale_id: saleId,
      p_items: items.map((item) => ({
        category_id: item.categoryId,
        bale_inventory_id: item.baleInventoryId,
        price_lines: item.priceLines.map((line) => ({ quantity: line.quantity, unit_price: line.unitPrice })),
      })),
      p_customer_id: customerId === 'walk-in' ? null : customerId,
      p_fulfillment_method: fulfillmentMethod,
      p_delivery_cost: deliveryCost,
      p_delivery_charge: deliveryCharge,
      p_notes: notes || null,
    })
    if (error) throw error
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

  const updateCustomer = useCallback(async (customerId, { name, phone, isPriority }) => {
    const { error } = await getSupabaseClient().from('customers').update({
      name: name.trim(),
      phone: phone.trim() || null,
      is_priority: Boolean(isPriority),
    }).eq('id', customerId)
    if (error) throw error
    await refresh()
  }, [refresh])

  const saveBusinessSettings = useCallback(async (settings) => {
    const normalized = normalizeBusinessSettings(settings)
    const { error } = await getSupabaseClient().from('business_settings').upsert({
      owner_id: userId,
      ...businessSettingsToRow(normalized),
    }, { onConflict: 'owner_id' })
    if (error) throw error
    setState((current) => ({
      ...current,
      data: { ...current.data, settings: normalized },
    }))
    await refresh({ silent: true })
  }, [refresh, userId])

  const saveBusinessProfile = useCallback(async ({ businessName, activityDescription, vocabulary }) => {
    const { data: updated, error } = await getSupabaseClient().rpc('update_business_profile', {
      p_business_name: businessName,
      p_activity_description: activityDescription || null,
      p_vocabulary: normalizeBusinessVocabulary(vocabulary),
    })
    if (error) throw error
    const mapped = mapBusinessProfile(updated)
    setState((current) => ({
      ...current,
      data: { ...current.data, businessProfile: mapped },
    }))
    await refresh({ silent: true })
    return mapped
  }, [refresh])

  const createCategory = useCallback(async (rawName) => {
    const name = rawName.trim().replace(/\s+/g, ' ')
    if (!name || name.length > 80) throw new Error('Escribe una categoría de entre 1 y 80 caracteres.')
    const existing = state.data.categories.find((category) => category.name.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'))
    const client = getSupabaseClient()
    const { error } = existing
      ? await client.from('categories').update({ is_user_created: true }).eq('id', existing.id)
      : await client.from('categories').insert({ owner_id: userId, name, slug: `category-${crypto.randomUUID()}`, is_user_created: true })
    if (error) throw new Error(/is_user_created/.test(error.message) ? 'Ejecuta la migración de categorías explícitas antes de agregar una categoría.' : error.message)
    await refresh({ silent: true })
  }, [state.data.categories, userId, refresh])

  const saveCategoryPrices = useCallback(async (rules) => {
    const { error } = await getSupabaseClient().rpc('save_category_price_rules', {
      p_rules: rules.map((rule) => ({
        category_id: rule.categoryId,
        economic_price: rule.economicPrice || null,
        standard_price: rule.standardPrice || null,
        premium_price: rule.premiumPrice || null,
      })),
    })
    if (error) throw error
    await refresh()
  }, [refresh])

  const value = useMemo(
    () => ({ ...state, refresh, createBale, updateBale, archiveBale, createExpense, updateExpense, saveMonthlyExpense, setMonthlyExpenseActive, createCustomer, updateCustomer, registerSale, updateSaleOrder, registerDamage, updateSaleDeliveryStatus, updateSalePayment, completeSalePayment, saveBusinessSettings, saveBusinessProfile, saveCategoryPrices, createCategory }),
    [state, refresh, createBale, updateBale, archiveBale, createExpense, updateExpense, saveMonthlyExpense, setMonthlyExpenseActive, createCustomer, updateCustomer, registerSale, updateSaleOrder, registerDamage, updateSaleDeliveryStatus, updateSalePayment, completeSalePayment, saveBusinessSettings, saveBusinessProfile, saveCategoryPrices, createCategory],
  )
  return <PacaDataContext.Provider value={value}>{children}</PacaDataContext.Provider>
}

function emptyData() {
  return { businessProfile: null, businessTemplates: [], categories: [], bales: [], sales: [], customers: [], expenses: [], monthlyExpenses: [], baleOtherExpenses: [], damagedProducts: [], dailySummaries: [], baleInventory: [], settings: { ...defaultBusinessSettings, dashboardKpis: [...defaultBusinessSettings.dashboardKpis] } }
}

export function usePacaData() {
  const context = useContext(PacaDataContext)
  if (!context) throw new Error('usePacaData debe usarse dentro de PacaDataProvider.')
  return context
}
