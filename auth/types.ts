export type ClientType = 'web' | 'native'
export type Role = 'operator' | 'manager' | 'reviewer' | 'tenant_admin'
export interface SessionView {
  user: { id: string; phone: string; firstName: string; lastName: string }
  tenant: { id: string; slug: string; name: string }
  membership: { id: string; roles: Role[]; revision: number }
  entitlements: { enterprise: boolean; paymentsEnabled: false }
  session: { id: string; client: ClientType; assurance: 'development_test' | 'sms_otp'; expiresAt: number; idleTimeoutMs: number; maxActiveSessions: number }
  permissions: string[]
  csrfToken: string | null
}
export interface SessionItem { id: string; tenantId: string; deviceName: string; client: ClientType; assurance: string; createdAt: number; lastSeenAt: number; expiresAt: number; current: boolean }
export interface NativeCredentials { accessToken: string; refreshToken: string; accessExpiresAt: number }
export interface TokenStorage { get(): Promise<string | null>; set(value: string): Promise<void>; clear(): Promise<void> }
export interface Challenge { challengeId: string; expiresInSeconds: number; resendAfterSeconds: number; deliveryMode: 'sms' | 'development_test'; message: string }
export interface ChatHistoryMessage { role: 'user' | 'assistant'; text: string }
export interface ChatRequest { message: string; history: ChatHistoryMessage[] }
export interface ChatReply {
  version: '1.0'
  requestId: string
  replyText: string
  provider: 'gemini'
  model: string
  latencyMs: number
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
}
export function chatSessionKey(view: SessionView | null): string {
  return view ? JSON.stringify([view.user.id, view.tenant.id, view.session.id]) : ''
}
export class ApiError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code) }
}
