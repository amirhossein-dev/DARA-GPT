import { ApiError } from '../auth/types'

export interface Conversation { id: string; title: string; createdAt: number; updatedAt: number }
export interface StoredMessage { id: string; turnId: string; role: 'user' | 'assistant'; text: string; order: number; createdAt: number }
export interface StoredRequest {
  version: '1.0'; conversationId: string; clientRequestId: string; turnId: string; order: number
  status: 'pending' | 'completed' | 'failed' | 'outcome_unknown'
  startedAt: number; deadlineAt: number; completedAt: number | null; error: string | null; messages: StoredMessage[]
}
export interface ConversationPage { version: '1.0'; conversations: Conversation[]; nextCursor: string | null }
export interface MessagePage { version: '1.0'; conversation: Conversation; messages: StoredMessage[]; requests: StoredRequest[]; nextCursor: string | null }
const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const bad = (): never => { throw new ApiError('INVALID_CONVERSATION_RESPONSE', 502) }
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : bad()
const id = (v: unknown): string => typeof v === 'string' && idPattern.test(v) ? v : bad()
const integer = (v: unknown): number => Number.isSafeInteger(v) && Number(v) >= 0 ? Number(v) : bad()
const text = (v: unknown, max: number): string => typeof v === 'string' && !!v.trim() && v.length <= max ? v : bad()
const version = (r: Record<string, unknown>) => { if (r.version !== '1.0') bad() }
const cursor = (v: unknown): string | null => v === null ? null : typeof v === 'string' && /^[1-9]\d{0,14}$/.test(v) ? v : bad()
const array = <T>(v: unknown, max: number, parse: (v: unknown) => T): T[] => Array.isArray(v) && v.length <= max ? v.map(parse) : bad()
export function requestId(value: string): string { if (!idPattern.test(value)) throw new ApiError('INVALID_CONVERSATION_REQUEST', 400); return value.toLowerCase() }
export function newRequestId(): string {
  // Correlation/idempotency only, never an authentication secret. Native RN need
  // not expose browser crypto; server UUID + uniqueness provide authoritative IDs.
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const n = Math.floor(Math.random() * 16); return (c === 'x' ? n : (n & 3) | 8).toString(16) })
}
function conversation(v: unknown): Conversation {
  const r = record(v); return { id: id(r.id), title: text(r.title, 80), createdAt: integer(r.createdAt), updatedAt: integer(r.updatedAt) }
}
function message(v: unknown): StoredMessage {
  const r = record(v)
  if (!['user', 'assistant'].includes(String(r.role))) bad()
  return { id: id(r.id), turnId: id(r.turnId), role: r.role as StoredMessage['role'], text: text(r.text, 16000), order: integer(r.order), createdAt: integer(r.createdAt) }
}
function ordered(messages: StoredMessage[]) {
  if (messages.some((m, i) => !m.order || (i > 0 && m.order <= messages[i - 1].order)) || new Set(messages.map(m => m.id)).size !== messages.length) bad()
  return messages
}
export function parseCreated(value: unknown): Conversation { const r = record(value); version(r); return conversation(r.conversation) }
export function parseConversations(value: unknown): ConversationPage {
  const r = record(value); version(r)
  const conversations = array(r.conversations, 50, conversation)
  if (new Set(conversations.map(c => c.id)).size !== conversations.length) bad()
  return { version: '1.0', conversations, nextCursor: cursor(r.nextCursor) }
}
export function parseRequest(value: unknown, conversationId: string, clientRequestId?: string): StoredRequest {
  const r = record(value); version(r)
  if (id(r.conversationId) !== conversationId || (clientRequestId && id(r.clientRequestId) !== clientRequestId) || !['pending', 'completed', 'failed', 'outcome_unknown'].includes(String(r.status))) bad()
  const status = r.status as StoredRequest['status'], messages = ordered(array(r.messages, 2, message)), turnId = id(r.turnId), order = integer(r.order)
  if (!order || messages.length < 1 || messages[0].role !== 'user' || messages.some(m => m.turnId !== turnId) || messages[0].order !== order * 2 - 1) bad()
  if (status === 'completed' ? messages.length !== 2 || messages[1].role !== 'assistant' || messages[1].order !== order * 2 : messages.length !== 1) bad()
  const error = r.error === null ? null : text(r.error, 64)
  if ((status === 'failed' || status === 'outcome_unknown') !== (error !== null) || (status === 'pending') !== (r.completedAt === null)) bad()
  const startedAt = integer(r.startedAt), deadlineAt = integer(r.deadlineAt)
  if (deadlineAt <= startedAt) bad()
  return { version: '1.0', conversationId, clientRequestId: id(r.clientRequestId), turnId, order, status, startedAt, deadlineAt, completedAt: r.completedAt === null ? null : integer(r.completedAt), error, messages }
}
export function parseMessages(value: unknown, conversationId: string): MessagePage {
  const r = record(value); version(r); const c = conversation(r.conversation)
  if (c.id !== conversationId) bad()
  return { version: '1.0', conversation: c, messages: ordered(array(r.messages, 50, message)), requests: array(r.requests, 51, v => parseRequest(v, conversationId)), nextCursor: cursor(r.nextCursor) }
}
export function continuityError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) return 'Your access could not be confirmed. Check your account before continuing.'
    if (error.status === 404) return 'This conversation or request is not available to your account.'
    if (error.code === 'CONVERSATION_BUSY') return 'A request is already in progress. Check its status before sending another.'
    if (error.code === 'REQUEST_KEY_CONFLICT') return 'This request identifier already belongs to another message. Reload the conversation.'
    if (error.code === 'INVALID_CONVERSATION_REQUEST') return 'Enter a message of 1–4,000 characters.'
    if (error.code === 'INVALID_CONVERSATION_QUERY') return 'The conversation list could not be loaded. Reload this page and try again.'
  }
  return 'The server result could not be confirmed. Check status or reload; no message is sent automatically.'
}
export function requestLabel(r: StoredRequest): string {
  if (r.status === 'pending') return 'Message saved. Waiting for a reply…'
  if (r.status === 'outcome_unknown') return 'Message saved; the model outcome is unknown. Sending again starts a separate request.'
  if (r.status === 'failed') return 'Message saved, but no usable reply was saved. You may send a new request.'
  return 'Reply saved'
}
