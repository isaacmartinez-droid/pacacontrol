const DAY_MS = 24 * 60 * 60 * 1000

export const accessOptions = [
  { id: 'active', label: 'Activa' },
  { id: 'suspended', label: 'Suspendida' },
  { id: 'closed', label: 'Cerrada' },
]

export const planOptions = [
  { id: 'pilot_free', label: 'Piloto gratis' },
  { id: 'paid_monthly', label: 'Mensualidad' },
  { id: 'demo', label: 'Demo' },
]

export const suspensionReasonOptions = [
  { id: '', label: 'Sin motivo' },
  { id: 'payment_overdue', label: 'Pago pendiente' },
  { id: 'trial_expired', label: 'Prueba vencida' },
  { id: 'terms_issue', label: 'Cumplimiento pendiente' },
  { id: 'support_review', label: 'Revisión de soporte' },
  { id: 'customer_request', label: 'Solicitud del cliente' },
  { id: 'other', label: 'Otro' },
]

export const accessLabels = Object.fromEntries(accessOptions.map((option) => [option.id, option.label]))
export const planLabels = {
  ...Object.fromEntries(planOptions.map((option) => [option.id, option.label])),
  internal: 'Administración interna',
}
export const suspensionReasonLabels = Object.fromEntries(suspensionReasonOptions.map((option) => [option.id, option.label]))

export const eventLabels = {
  updated: 'Actualización',
  suspended: 'Suspensión',
  closed: 'Cierre',
  reactivated: 'Reactivación',
  plan_changed: 'Cambio de plan',
  role_changed: 'Cambio de rol',
}

export function mapAccount(row) {
  const servicePlan = row.service_plan ?? row.servicePlan ?? 'pilot_free'
  const accountRole = row.account_role ?? row.accountRole ?? (servicePlan === 'internal' ? 'admin' : 'owner')

  return {
    userId: row.user_id ?? row.userId,
    email: row.email ?? '',
    displayName: row.display_name ?? row.displayName ?? '',
    accountRole,
    accessStatus: row.access_status ?? row.accessStatus ?? 'active',
    servicePlan,
    suspensionReason: row.suspension_reason ?? row.suspensionReason ?? '',
    adminNotes: row.admin_notes ?? row.adminNotes ?? '',
    trialEndsAt: row.trial_ends_at ?? row.trialEndsAt ?? null,
    nextPaymentDueAt: row.next_payment_due_at ?? row.nextPaymentDueAt ?? null,
    lastAdminActionAt: row.last_admin_action_at ?? row.lastAdminActionAt ?? null,
    lastAdminActionBy: row.last_admin_action_by ?? row.lastAdminActionBy ?? null,
    latestAdminEvent: row.latest_admin_event ?? row.latestAdminEvent ?? '',
    latestAdminEventAt: row.latest_admin_event_at ?? row.latestAdminEventAt ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
    legalTermsVersion: row.legal_terms_version ?? row.legalTermsVersion ?? '',
    termsAcceptedAt: row.terms_accepted_at ?? row.termsAcceptedAt ?? null,
    privacyVersion: row.privacy_version ?? row.privacyVersion ?? '',
    privacyAcceptedAt: row.privacy_accepted_at ?? row.privacyAcceptedAt ?? null,
    balesCount: Number(row.bales_count ?? row.balesCount ?? 0),
    salesCount: Number(row.sales_count ?? row.salesCount ?? 0),
    customersCount: Number(row.customers_count ?? row.customersCount ?? 0),
    salesTotal: Number(row.sales_total ?? row.salesTotal ?? 0),
    lastSaleAt: row.last_sale_at ?? row.lastSaleAt ?? null,
  }
}

export function isInternalAccount(account) {
  return account.accountRole === 'admin' || account.servicePlan === 'internal'
}

export function accountIdentifier(account) {
  return account.email ? account.email.split('@')[0] : 'Sin usuario'
}

export function deriveAccountHealth(account, now = Date.now()) {
  if (account.accessStatus === 'closed') {
    return health('closed', 'Cerrada', 'La cuenta está fuera de operación.')
  }
  if (account.accessStatus === 'suspended') {
    return health('critical', 'Crítica', 'El acceso está suspendido.')
  }

  const paymentDistance = distanceFromNow(account.nextPaymentDueAt, now)
  if (paymentDistance !== null && paymentDistance < 0) {
    return health('critical', 'Crítica', 'El pago registrado está vencido.')
  }

  const trialDistance = distanceFromNow(account.trialEndsAt, now)
  if (account.servicePlan === 'pilot_free' && trialDistance !== null && trialDistance < 0) {
    return health('critical', 'Crítica', 'El periodo de prueba está vencido.')
  }

  const reasons = []
  if (paymentDistance !== null && paymentDistance <= 3 * DAY_MS) reasons.push('pago próximo')
  if (account.servicePlan === 'pilot_free' && trialDistance !== null && trialDistance <= 7 * DAY_MS) reasons.push('prueba próxima a vencer')
  if (!account.termsAcceptedAt || !account.privacyAcceptedAt) reasons.push('cumplimiento pendiente')

  if (reasons.length) {
    return health('attention', 'Atención', sentenceFromReasons(reasons))
  }

  const accountAge = account.createdAt ? now - new Date(account.createdAt).getTime() : null
  if (account.salesCount === 0 && accountAge !== null && accountAge <= 7 * DAY_MS) {
    return health('new', 'Nueva', 'Todavía no hay suficiente actividad para evaluarla.')
  }

  return health('healthy', 'Saludable', 'Sin alertas administrativas inmediatas.')
}

export function deriveAdoption(account, now = Date.now()) {
  if (account.salesCount === 0) {
    return { id: 'starting', label: 'Empezando', detail: 'Todavía no registra ventas.' }
  }
  if (!account.lastSaleAt) {
    return { id: 'unknown', label: 'Sin fecha', detail: 'Hay ventas, pero no una fecha de actividad disponible.' }
  }

  const days = Math.floor(Math.max(0, now - new Date(account.lastSaleAt).getTime()) / DAY_MS)
  if (days <= 14) return { id: 'active', label: 'Uso reciente', detail: `Última venta hace ${formatDays(days)}.` }
  if (days <= 30) return { id: 'quiet', label: 'Uso bajo', detail: `Última venta hace ${formatDays(days)}.` }
  return { id: 'inactive', label: 'Sin actividad', detail: `Última venta hace ${formatDays(days)}.` }
}

export function buildAccountAlerts(account, now = Date.now()) {
  const alerts = []
  const add = (id, severity, title, detail) => alerts.push({ id: `${account.userId}-${id}`, account, severity, title, detail })

  if (account.accessStatus === 'suspended') {
    add('suspended', 'critical', 'Acceso suspendido', suspensionReasonLabels[account.suspensionReason] || 'La cuenta requiere revisión administrativa.')
  }

  const paymentDistance = distanceFromNow(account.nextPaymentDueAt, now)
  if (paymentDistance !== null && paymentDistance < 0) {
    add('payment-overdue', 'critical', 'Pago vencido', 'La fecha de pago registrada ya pasó.')
  } else if (paymentDistance !== null && paymentDistance <= 3 * DAY_MS) {
    add('payment-due', 'attention', 'Pago próximo', 'El pago vence dentro de los próximos 3 días.')
  }

  const trialDistance = distanceFromNow(account.trialEndsAt, now)
  if (account.servicePlan === 'pilot_free' && trialDistance !== null && trialDistance < 0) {
    add('trial-expired', 'critical', 'Prueba vencida', 'La cuenta sigue activa después del fin de la prueba.')
  } else if (account.servicePlan === 'pilot_free' && trialDistance !== null && trialDistance <= 7 * DAY_MS) {
    add('trial-ending', 'attention', 'Prueba por vencer', 'El periodo de prueba termina dentro de los próximos 7 días.')
  }

  if (!account.termsAcceptedAt || !account.privacyAcceptedAt) {
    add('compliance', 'attention', 'Cumplimiento pendiente', 'Falta evidencia de aceptación de términos o privacidad.')
  }

  const adoption = deriveAdoption(account, now)
  if (adoption.id === 'inactive') add('inactive', 'attention', 'Sin actividad reciente', adoption.detail)

  return alerts
}

export function summarizeAccounts(accounts, now = Date.now()) {
  return accounts.reduce((summary, account) => {
    const healthState = deriveAccountHealth(account, now).id
    summary.total += 1
    summary[healthState] = (summary[healthState] ?? 0) + 1
    if (account.accessStatus === 'active') summary.active += 1
    if (account.servicePlan === 'paid_monthly') summary.paid += 1
    return summary
  }, { total: 0, active: 0, paid: 0, healthy: 0, attention: 0, critical: 0, new: 0, closed: 0 })
}

export function createAccountDraft(account = {}) {
  return {
    accessStatus: account.accessStatus ?? 'active',
    servicePlan: account.servicePlan === 'internal' ? 'pilot_free' : account.servicePlan ?? 'pilot_free',
    accountRole: account.accountRole ?? 'owner',
    suspensionReason: account.suspensionReason ?? '',
    adminNotes: account.adminNotes ?? '',
    trialEndsAt: toDateTimeInput(account.trialEndsAt),
    nextPaymentDueAt: toDateTimeInput(account.nextPaymentDueAt),
  }
}

export function accountDraftHasChanges(account, draft) {
  return [
    [account.accessStatus, draft.accessStatus],
    [account.servicePlan, draft.servicePlan],
    [account.accountRole, draft.accountRole],
    [account.suspensionReason ?? '', draft.suspensionReason],
    [account.adminNotes ?? '', draft.adminNotes],
    [toDateTimeInput(account.trialEndsAt), draft.trialEndsAt],
    [toDateTimeInput(account.nextPaymentDueAt), draft.nextPaymentDueAt],
  ].some(([current, next]) => current !== next)
}

export function toDateTimeInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

export function fromDateTimeInput(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function distanceFromNow(value, now) {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? null : timestamp - now
}

function health(id, label, detail) {
  return { id, label, detail }
}

function sentenceFromReasons(reasons) {
  const text = reasons.length === 1 ? reasons[0] : `${reasons.slice(0, -1).join(', ')} y ${reasons.at(-1)}`
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`
}

function formatDays(days) {
  return days === 0 ? 'menos de un día' : `${days} ${days === 1 ? 'día' : 'días'}`
}
