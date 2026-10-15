import { ApiError, Challenge, ChatReply, ChatRequest, chatSessionKey, ClientType, NativeCredentials, SessionItem, SessionView, TokenStorage } from './types'
import { parseConversations, parseCreated, parseMessages, parseRequest, requestId } from '../chat/continuity'

function chatInput(input: ChatRequest): ChatRequest {
  if (!input || typeof input.message !== 'string' || !input.message.trim() || input.message.length > 4000 || !Array.isArray(input.history) || input.history.length > 12)
    throw new ApiError('INVALID_CHAT_REQUEST', 400)
  let total = 0
  const history = input.history.map(entry => {
    if (!entry || !['user', 'assistant'].includes(entry.role) || typeof entry.text !== 'string' || !entry.text.trim() || entry.text.length > 4000)
      throw new ApiError('INVALID_CHAT_REQUEST', 400)
    total += entry.text.length
    if (total > 16000) throw new ApiError('INVALID_CHAT_REQUEST', 400)
    return { role: entry.role, text: entry.text }
  })
  return { message: input.message, history }
}

function chatOutput(value: unknown): ChatReply {
  const v = value as ChatReply
  if (!v || v.version !== '1.0' || v.provider !== 'gemini' || typeof v.requestId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v.requestId) ||
    typeof v.replyText !== 'string' || !v.replyText.trim() || v.replyText.length > 16000 || typeof v.model !== 'string' || !/^gemini-[a-z0-9][a-z0-9.-]{0,99}$/.test(v.model) ||
    !Number.isSafeInteger(v.latencyMs) || v.latencyMs < 0)
    throw new ApiError('INVALID_CHAT_RESPONSE', 502)
  const usage: NonNullable<ChatReply['usage']> = {}
  if (v.usage !== undefined) {
    if (!v.usage || typeof v.usage !== 'object' || Array.isArray(v.usage)) throw new ApiError('INVALID_CHAT_RESPONSE', 502)
    for (const key of ['inputTokens', 'outputTokens', 'totalTokens'] as const) {
      const count = v.usage[key]
      if (count !== undefined) {
        if (!Number.isSafeInteger(count) || count < 0) throw new ApiError('INVALID_CHAT_RESPONSE', 502)
        usage[key] = count
      }
    }
  }
  return { version: '1.0', requestId: v.requestId, replyText: v.replyText, provider: 'gemini', model: v.model, latencyMs: v.latencyMs, ...(Object.keys(usage).length ? { usage } : {}) }
}

function viewOf(value: unknown, client: ClientType): SessionView {
  const v = value as SessionView
  if (
    !v ||
    !v.user?.id ||
    !v.tenant?.id ||
    !v.session?.id ||
    v.session.client !== client ||
    !Array.isArray(v.membership?.roles) ||
    !Array.isArray(v.permissions) ||
    typeof v.entitlements?.enterprise !== 'boolean' ||
    v.entitlements.paymentsEnabled !== false ||
    (client === 'web' && typeof v.csrfToken !== 'string')
  )
    throw new ApiError('INVALID_SESSION_RESPONSE', 502)
  // Never put native credentials in React/Redux state.
  return { user: v.user, tenant: v.tenant, membership: v.membership, session: v.session, permissions: v.permissions, entitlements: v.entitlements, csrfToken: v.csrfToken }
}
export class IdentityClient {
  private native: NativeCredentials | null = null
  private view: SessionView | null = null
  private generation = 0
  private queue: Promise<unknown> = Promise.resolve()
  private listeners = new Set<(value: SessionView | null) => void>()
  constructor(private readonly options: { baseUrl: string; client: ClientType; storage: TokenStorage; fetcher?: typeof fetch; clock?: () => number }) {}
  subscribe(fn: (value: SessionView | null) => void) {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
  snapshot() {
    return this.view
  }
  private publish(view: SessionView | null) {
    this.view = view
    this.generation++
    for (const fn of this.listeners) fn(view)
  }
  private now() {
    return (this.options.clock || Date.now)()
  }
  private serialized<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.queue.then(fn, fn)
    this.queue = p.catch(() => undefined)
    return p
  }
  private async raw(path: string, method: string, body?: unknown, authorized = false): Promise<unknown> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (authorized) {
      if (this.options.client === 'native') {
        if (!this.native) throw new ApiError('LOGIN_REQUIRED', 401)
        headers.Authorization = `Bearer ${this.native.accessToken}`
      } else if (method !== 'GET') {
        if (!this.view?.csrfToken) throw new ApiError('LOGIN_REQUIRED', 401)
        headers['X-DARA-CSRF'] = this.view.csrfToken
      }
    }
    const abort = new AbortController()
    const timeout = setTimeout(() => abort.abort(), 15000)
    const startedAt = Date.now()
    const url = this.options.baseUrl + path

    try {
      const init: RequestInit = {
        method,
        headers,
        cache: 'no-store',
        signal: abort.signal,
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      }
      if (this.options.client === 'web') {
        init.credentials = 'include'
      }

      if (__DEV__) {
        console.info(
          '[DARA_HTTP_START]',
          JSON.stringify({
            client: this.options.client,
            method,
            path,
            baseUrl: this.options.baseUrl,
            authorized,
            hasBody: body !== undefined
          })
        )
      }

      const response = await (this.options.fetcher || fetch)(url, init)

      if (__DEV__) {
        console.info(
          '[DARA_HTTP_RESPONSE]',
          JSON.stringify({
            method,
            path,
            status: response.status,
            ok: response.ok,
            elapsedMs: Date.now() - startedAt
          })
        )
      }

      let value: unknown
      try {
        value = await response.json()
      } catch {
        throw new ApiError('INVALID_SERVER_RESPONSE', 502)
      }

      if (!response.ok) {
        throw new ApiError(typeof (value as { error?: unknown })?.error === 'string' ? (value as { error: string }).error : `HTTP_${response.status}`, response.status)
      }

      return value
    } catch (error) {
      if (error instanceof ApiError) throw error

      if (__DEV__) {
        const e = error as {
          name?: unknown
          message?: unknown
        }

        console.warn(
          '[DARA_HTTP_TRANSPORT_ERROR]',
          JSON.stringify({
            method,
            path,
            baseUrl: this.options.baseUrl,
            name: typeof e?.name === 'string' ? e.name : typeof error,
            message: typeof e?.message === 'string' ? e.message : 'non-Error transport failure',
            signalAborted: abort.signal.aborted,
            elapsedMs: Date.now() - startedAt
          })
        )
      }

      throw new ApiError('NETWORK_ERROR', 0)
    } finally {
      clearTimeout(timeout)
    }
  }
  async config() {
    return this.raw('/identity/config', 'GET') as Promise<{ otpMode: string; maxActiveSessions: number }>
  }
  private async conversationCall(path: string, method: string, body?: unknown): Promise<unknown> {
    const origin = chatSessionKey(this.snapshot())
    if (!origin) throw new ApiError('LOGIN_REQUIRED', 401)
    // ensureAccess may enter the auth queue itself. Network work stays outside it.
    await this.ensureAccess()
    if (chatSessionKey(this.snapshot()) !== origin) throw new ApiError('CHAT_SESSION_CHANGED', 409)
    try {
      const value = await this.raw(path, method, body, true)
      if (chatSessionKey(this.snapshot()) !== origin) throw new ApiError('CHAT_SESSION_CHANGED', 409)
      return value
    } catch (error) {
      if (chatSessionKey(this.snapshot()) !== origin) throw new ApiError('CHAT_SESSION_CHANGED', 409)
      throw error
    }
  }
  async createConversation(clientRequestId: string) {
    return parseCreated(await this.conversationCall('/chat/conversations', 'POST', { clientRequestId: requestId(clientRequestId) }))
  }
  async conversations(cursor?: string) {
    return parseConversations(await this.conversationCall('/chat/conversations?limit=30' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), 'GET'))
  }
  async conversationMessages(conversationId: string, before?: string) {
    const id = requestId(conversationId)
    return parseMessages(await this.conversationCall(`/chat/conversations/${id}/messages?limit=30` + (before ? '&before=' + encodeURIComponent(before) : ''), 'GET'), id)
  }
  async sendConversationMessage(conversationId: string, clientRequestId: string, text: string) {
    const id = requestId(conversationId), key = requestId(clientRequestId)
    if (typeof text !== 'string' || !text.trim() || text.length > 4000 || text.includes('\0')) throw new ApiError('INVALID_CONVERSATION_REQUEST', 400)
    return parseRequest(await this.conversationCall(`/chat/conversations/${id}/messages`, 'POST', { clientRequestId: key, text }), id, key)
  }
  async conversationRequest(conversationId: string, clientRequestId: string) {
    const id = requestId(conversationId), key = requestId(clientRequestId)
    return parseRequest(await this.conversationCall(`/chat/conversations/${id}/requests/${key}`, 'GET'), id, key)
  }
  requestOtp(input: { phone: string; tenant: string; deviceName: string }): Promise<Challenge> {
    return this.raw('/identity/otp/request', 'POST', { ...input, client: this.options.client }) as Promise<Challenge>
  }
  private async adopt(value: unknown) {
    const view = viewOf(value, this.options.client)
    if (this.options.client === 'native') {
      const v = value as NativeCredentials
      if (typeof v.accessToken !== 'string' || !v.accessToken || !/^[-_A-Za-z0-9]{43}$/.test(v.refreshToken) || !Number.isSafeInteger(v.accessExpiresAt))
        throw new ApiError('INVALID_TOKEN_RESPONSE', 502)
      const creds = { accessToken: v.accessToken, accessExpiresAt: v.accessExpiresAt, refreshToken: v.refreshToken }
      try {
        await this.options.storage.set(creds.refreshToken)
      } catch {
        // Best-effort revoke the newly issued session if secure storage failed.
        this.native = creds
        try {
          await this.raw('/identity/logout', 'POST', {}, true)
        } catch {
          /* outcome unknown; never report server revocation */
        }
        this.native = null
        this.publish(null)
        try {
          await this.options.storage.clear()
        } catch {
          /* do not fall back to plaintext */
        }
        throw new ApiError('SECURE_STORAGE_FAILED', 0)
      }
      this.native = creds
    }
    this.publish(view)
    return view
  }
  verifyOtp(input: { challengeId: string; code: string; firstName: string; lastName: string }) {
    return this.serialized(async () => this.adopt(await this.raw('/identity/otp/verify', 'POST', { ...input, client: this.options.client })))
  }
  private async clear() {
    this.native = null
    this.publish(null)
    await this.options.storage.clear()
  }
  private async renew() {
    const refreshToken = this.native?.refreshToken || (await this.options.storage.get())
    if (!refreshToken) throw new ApiError('LOGIN_REQUIRED', 401)
    try {
      return await this.adopt(await this.raw('/identity/refresh', 'POST', { refreshToken }))
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) await this.clear()
      throw error
    }
  }
  restore(): Promise<SessionView | null> {
    return this.serialized(async () => {
      try {
        if (this.options.client === 'native') {
          const token = await this.options.storage.get()
          if (!token) {
            this.publish(null)
            return null
          }
          return await this.renew()
        }
        const view = viewOf(await this.raw('/identity/me', 'GET'), this.options.client)
        this.publish(view)
        return view
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await this.clear()
          return null
        }
        throw error
      }
    })
  }
  private async ensureAccess() {
    if (this.options.client === 'native' && (!this.native || this.native.accessExpiresAt <= this.now() + 15000)) {
      await this.serialized(async () => {
        if (!this.native || this.native.accessExpiresAt <= this.now() + 15000) await this.renew()
      })
    }
  }
  async me(): Promise<SessionView> {
    await this.ensureAccess()
    const generation = this.generation
    try {
      const view = viewOf(await this.raw('/identity/me', 'GET', undefined, true), this.options.client)
      if (generation === this.generation) this.publish(view)
      return view
    } catch (error) {
      if (error instanceof ApiError && error.status === 401 && generation === this.generation)
        await this.serialized(async () => {
          if (generation === this.generation) await this.clear()
        })
      throw error
    }
  }
  async sessions(): Promise<SessionItem[]> {
    await this.ensureAccess()
    return this.raw('/identity/sessions', 'GET', undefined, true) as Promise<SessionItem[]>
  }
  async chatReply(input: ChatRequest): Promise<ChatReply> {
    const body = chatInput(input)
    const origin = chatSessionKey(this.view)
    if (!origin) throw new ApiError('LOGIN_REQUIRED', 401)
    await this.ensureAccess()
    if (chatSessionKey(this.view) !== origin) throw new ApiError('CHAT_SESSION_CHANGED', 0)
    const response = await this.raw('/chat/reply', 'POST', body, true)
    if (chatSessionKey(this.view) !== origin) throw new ApiError('CHAT_SESSION_CHANGED', 0)
    return chatOutput(response)
  }
  revokeSession(id: string) {
    return this.serialized(async () => {
      if (!/^[a-f0-9-]{36}$/i.test(id)) throw new ApiError('INVALID_IDENTIFIER', 400)
      if (this.options.client === 'native' && (!this.native || this.native.accessExpiresAt <= this.now() + 15000)) await this.renew()
      await this.raw(`/identity/sessions/${id}`, 'DELETE', undefined, true)
      if (id === this.view?.session.id) await this.clear()
    })
  }
  logout(all = false) {
    return this.serialized(async () => {
      if (this.options.client === 'native' && (!this.native || this.native.accessExpiresAt <= this.now() + 15000)) await this.renew()
      try {
        await this.raw(all ? '/identity/logout-all' : '/identity/logout', 'POST', {}, true)
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) throw error
      }
      await this.clear()
    })
  }
}
