import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getSupabaseClient } from '../../src/lib/supabaseClient'
import { fromDateTimeInput, isInternalAccount, mapAccount } from './adminAccounts'

const AdminDataContext = createContext(null)

export function AdminDataProvider({ children }) {
  const [accounts, setAccounts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const { data, error: nextError } = await getSupabaseClient().rpc('admin_list_accounts')
      if (nextError) throw nextError
      setAccounts((data ?? []).map(mapAccount))
    } catch (nextError) {
      setError(nextError?.message || 'No pudimos cargar las cuentas.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const updateAccount = useCallback(async (account, draft) => {
    const client = getSupabaseClient()
    let { data, error: nextError } = await client.rpc('admin_update_account', {
      p_user_id: account.userId,
      p_access_status: draft.accessStatus,
      p_service_plan: draft.servicePlan,
      p_account_role: draft.accountRole,
      p_suspension_reason: draft.suspensionReason || null,
      p_admin_notes: draft.adminNotes || null,
      p_trial_ends_at: fromDateTimeInput(draft.trialEndsAt),
      p_next_payment_due_at: fromDateTimeInput(draft.nextPaymentDueAt),
    })

    if (isLegacyAdminRpcError(nextError)) {
      ;({ data, error: nextError } = await client.rpc('admin_update_account', {
        p_user_id: account.userId,
        p_access_status: draft.accessStatus,
        p_service_plan: draft.servicePlan,
      }))
    }
    if (nextError) throw nextError

    const updated = mapAccount(data?.[0] ?? account)
    setAccounts((current) => current.map((item) => item.userId === updated.userId ? updated : item))
    return updated
  }, [])

  const value = useMemo(() => ({
    accounts,
    customerAccounts: accounts.filter((account) => !isInternalAccount(account)),
    internalAccounts: accounts.filter(isInternalAccount),
    isLoading,
    error,
    reload,
    updateAccount,
  }), [accounts, error, isLoading, reload, updateAccount])

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>
}

export function useAdminData() {
  const context = useContext(AdminDataContext)
  if (!context) throw new Error('useAdminData debe utilizarse dentro de AdminDataProvider.')
  return context
}

function isLegacyAdminRpcError(error) {
  if (!error) return false
  const message = String(error.message ?? '')
  return error.code === 'PGRST202'
    || message.includes('p_account_role')
    || message.includes('admin_update_account')
}
