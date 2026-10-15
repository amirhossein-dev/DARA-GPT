import { ApiError, chatSessionKey, SessionView } from '../auth/types'
import { Conversation, MessagePage, StoredMessage, StoredRequest, continuityError, newRequestId } from './continuity'

export interface ContinuityTransport {
  snapshot(): SessionView | null
  conversationMessages(id: string, before?: string): Promise<MessagePage>
  sendConversationMessage(id: string, key: string, text: string): Promise<StoredRequest>
  conversationRequest(id: string, key: string): Promise<StoredRequest>
}
export interface ContinuityState {
  id: string | null; conversation: Conversation | null; messages: StoredMessage[]; requests: StoredRequest[]
  loading: boolean; sending: boolean; checking: boolean; error: string; nextCursor: string | null; unresolvedKey: string | null; canRecoverOriginal: boolean
}
const empty = (): ContinuityState => ({ id: null, conversation: null, messages: [], requests: [], loading: false, sending: false, checking: false, error: '', nextCursor: null, unresolvedKey: null, canRecoverOriginal: false })
const merge = (a: StoredMessage[], b: StoredMessage[]) => Array.from(new Map([...a, ...b].map(m => [m.id, m])).values()).sort((a, b) => a.order - b.order)

// Transient view state only. The server is authoritative across navigation/reload.
export class ContinuityStateController {
  private state = empty()
  private epoch = 0
  private receipt: { key: string; onSaved(): void } | null = null
  private outstanding = new Map<string, { key: string; text: string; inFlight: boolean }>()
  private readonly owner: string
  private listeners = new Set<(s: ContinuityState) => void>()
  constructor(private readonly client: ContinuityTransport) { this.owner = chatSessionKey(client.snapshot()) }
  snapshot = () => this.state
  subscribe(fn: (s: ContinuityState) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  dispose() { this.epoch++; this.receipt = null; this.outstanding.clear(); this.listeners.clear(); this.state = empty() }
  private update(patch: Partial<ContinuityState>) { this.state = { ...this.state, ...patch }; for (const fn of this.listeners) fn(this.state) }
  private guard() {
    const epoch = this.epoch, identity = chatSessionKey(this.client.snapshot()), id = this.state.id
    return () => !!identity && identity === this.owner && epoch === this.epoch && identity === chatSessionKey(this.client.snapshot()) && id === this.state.id
  }
  async open(id: string | null) {
    this.epoch++; this.receipt = null; this.state = empty()
    if (chatSessionKey(this.client.snapshot()) !== this.owner) { this.outstanding.clear(); this.update({}); return }
    const outstanding = id ? this.outstanding.get(id) : undefined
    this.update({ id, loading: !!id, unresolvedKey: outstanding?.key || null, sending: !!outstanding?.inFlight })
    if (!id) return
    const current = this.guard()
    try {
      const page = await this.client.conversationMessages(id)
      if (current()) {
        const known = this.outstanding.get(id)
        if (known && page.requests.some(r => r.clientRequestId === known.key && r.status !== 'pending')) this.outstanding.delete(id)
        const remaining = this.outstanding.get(id)
        this.update({ conversation: page.conversation, messages: page.messages, requests: page.requests, nextCursor: page.nextCursor, unresolvedKey: remaining?.key || null, sending: !!remaining?.inFlight })
      }
    } catch (e) { if (current()) this.update({ error: continuityError(e) }) }
    finally { if (current()) this.update({ loading: false }) }
  }
  async older() {
    if (!this.state.id || !this.state.nextCursor || this.state.loading) return
    const current = this.guard(), id = this.state.id, cursor = this.state.nextCursor
    this.update({ loading: true })
    try {
      const page = await this.client.conversationMessages(id, cursor)
      if (current()) this.update({ messages: merge(page.messages, this.state.messages), requests: this.mergeRequests(page.requests), nextCursor: page.nextCursor, error: '' })
    } catch (e) { if (current()) this.update({ error: continuityError(e) }) }
    finally { if (current()) this.update({ loading: false }) }
  }
  private mergeRequests(values: StoredRequest[]) {
    const requests = new Map(this.state.requests.map(r => [r.clientRequestId, r]))
    for (const r of values) {
      const existing = requests.get(r.clientRequestId)
      if (!existing || existing.status === 'pending') requests.set(r.clientRequestId, r)
    }
    return Array.from(requests.values()).sort((a, b) => a.order - b.order)
  }
  private accept(result: StoredRequest) {
    if (result.status !== 'pending') this.outstanding.delete(result.conversationId)
    this.update({ messages: merge(this.state.messages, result.messages), requests: this.mergeRequests([result]), unresolvedKey: result.status === 'pending' ? result.clientRequestId : null, canRecoverOriginal: false, error: '' })
    if (this.receipt?.key === result.clientRequestId) { const receipt = this.receipt; this.receipt = null; receipt.onSaved() }
  }
  async send(text: string, onSaved: () => void = () => undefined): Promise<boolean> {
    const id = this.state.id
    if (chatSessionKey(this.client.snapshot()) !== this.owner || !id || !this.state.conversation || this.state.loading || this.state.sending || this.state.unresolvedKey || this.outstanding.has(id) || this.state.requests.some(r => r.status === 'pending')) return false
    if (!text.trim() || text.length > 4000) { this.update({ error: continuityError(new ApiError('INVALID_CONVERSATION_REQUEST', 400)) }); return false }
    const key = newRequestId()
    this.receipt = { key, onSaved }
    this.outstanding.set(id, { key, text, inFlight: true })
    await this.dispatch(id, key, text)
    return true
  }
  async recoverOriginal(): Promise<boolean> {
    const id = this.state.id, original = id ? this.outstanding.get(id) : undefined
    if (chatSessionKey(this.client.snapshot()) !== this.owner || !id || !original || !this.state.canRecoverOriginal || this.state.loading || this.state.sending || this.state.checking || original.inFlight || this.state.unresolvedKey !== original.key) return false
    // Explicit user action only. Reuse exact payload/key: a delayed original
    // and this recovery still share the server's single admission identity.
    original.inFlight = true
    await this.dispatch(id, original.key, original.text)
    return true
  }
  private async dispatch(id: string, key: string, text: string) {
    const current = this.guard()
    this.update({ sending: true, unresolvedKey: key, canRecoverOriginal: false, error: '' })
    try {
      const result = await this.client.sendConversationMessage(id, key, text)
      if (current() && this.state.unresolvedKey === key) this.accept(result)
    } catch (e) {
      const rejected = e instanceof ApiError && [400, 401, 403, 404, 409].includes(e.status)
      if (rejected && this.outstanding.get(id)?.key === key) this.outstanding.delete(id)
      if (current()) {
        // A timeout/transport/invalid response never proves the write failed.
        if (rejected) this.receipt = null
        this.update({ error: continuityError(e), unresolvedKey: rejected ? null : key })
        if (e instanceof ApiError && e.code === 'CONVERSATION_BUSY') await this.open(id)
      }
    } finally {
      const outstanding = this.outstanding.get(id)
      if (outstanding?.key === key) outstanding.inFlight = false
      if (current()) this.update({ sending: false })
      else if (chatSessionKey(this.client.snapshot()) === this.owner && this.state.id === id && this.state.unresolvedKey === key) {
        // Reopened same conversation: release the transport wait only. GET must
        // reconcile the stored result; the old callback never appends messages.
        this.update({ sending: false, unresolvedKey: outstanding?.key || null })
      }
    }
  }
  async reconcile() {
    const key = this.state.unresolvedKey || this.state.requests.find(r => r.status === 'pending')?.clientRequestId
    if (!this.state.id || !key || this.state.checking || this.state.sending) return
    const current = this.guard(), id = this.state.id
    this.update({ checking: true })
    try { const result = await this.client.conversationRequest(id, key); if (current()) this.accept(result) }
    catch (e) {
      if (current()) {
        const missing = e instanceof ApiError && e.code === 'REQUEST_NOT_FOUND' && e.status === 404
        const canRecoverOriginal = missing && this.outstanding.get(id)?.key === key
        this.update({ canRecoverOriginal, error: missing ? canRecoverOriginal
          ? 'No saved receipt was found yet. Check again, or recover the original request with its unchanged text and request ID. Recovery may start generation if the server never accepted it.'
          : 'No saved receipt was found yet. Check status again; no new request was sent.' : continuityError(e) })
      }
    }
    finally { if (current()) this.update({ checking: false }) }
  }
}
