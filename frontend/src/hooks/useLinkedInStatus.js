/**
 * Normalize LinkedIn connection status from the current user object.
 *
 * Backend contract (new):
 *   user.linkedin_connection = { status: 'active' | 'revoked' | 'expired', expires_at, scopes } | null
 *
 * Legacy fallback:
 *   user.has_linkedin_token = boolean
 *
 * If `linkedin_connection` is `undefined` (backend hasn't shipped the new field yet),
 * we fall back to `has_linkedin_token`. If the new field is explicitly `null`, it means
 * "not connected" and we do NOT fall back.
 */
export function useLinkedInStatus(user) {
  const conn = user?.linkedin_connection
  const legacyFlag = user?.has_linkedin_token
  // If backend hasn't shipped the new field, fall back to legacy flag.
  const status = conn === undefined ? (legacyFlag ? 'active' : null) : conn?.status ?? null
  const expiresAt = conn?.expires_at ? new Date(conn.expires_at) : null
  const daysUntilExpiry = expiresAt
    ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 86400000))
    : null
  return {
    isConnected: status === 'active',
    needsReconnect: status === 'revoked' || status === 'expired',
    expiringSoon:
      status === 'active' && daysUntilExpiry != null && daysUntilExpiry <= 7,
    daysUntilExpiry,
    status,
  }
}
