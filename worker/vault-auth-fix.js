// Vault authentication fix helper: Vault must use the existing Redlighte Account session.
// This file is intentionally isolated so existing site authentication is untouched.
export function hasRedlighteSession(request) {
  return /(?:^|;\s*)redlighte_session=/.test(request.headers.get('Cookie') || '');
}
