import test from 'node:test'
import assert from 'node:assert/strict'
import { IdentityClient } from '../auth/client'
import { ApiError, SessionView } from '../auth/types'
import { ContinuityStateController, ContinuityTransport } from '../chat/continuity-state'
import { Conversation, MessagePage, StoredRequest, parseMessages, parseRequest } from '../chat/continuity'
const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', key = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', turn = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const conversation: Conversation = { id: a, title: 'Synthetic B2', createdAt: 1, updatedAt: 2 }
function view(sid = a, kind: 'native' | 'web' = 'native'): SessionView { return { user: { id: 'user', phone: '+15550001001', firstName: 'Synthetic', lastName: 'B2' }, tenant: { id: 'tenant', slug: 'synthetic', name: 'Synthetic' }, membership: { id: 'member', roles: ['operator'], revision: 1 }, entitlements: { enterprise: false, paymentsEnabled: false }, session: { id: sid, client: kind, assurance: 'development_test', expiresAt: 99999999, idleTimeoutMs: 43200000, maxActiveSessions: 2 }, permissions: ['conversation.use'], csrfToken: kind === 'web' ? 'synthetic-csrf' : null } }
function result(id = a, requestKey = key, status: StoredRequest['status'] = 'completed'): StoredRequest { return { version: '1.0', conversationId: id, clientRequestId: requestKey, turnId: turn, order: 1, status, startedAt: 1, deadlineAt: 17001, completedAt: status === 'pending' ? null : 3, error: status === 'failed' || status === 'outcome_unknown' ? 'SYNTHETIC_FAILURE' : null, messages: [{ id: key, turnId: turn, role: 'user', text: 'Synthetic input', order: 1, createdAt: 1 }, ...(status === 'completed' ? [{ id: b, turnId: turn, role: 'assistant' as const, text: 'Synthetic reply', order: 2, createdAt: 3 }] : [])] } }
const page = (id = a): MessagePage => ({ version: '1.0', conversation: { ...conversation, id }, messages: [], requests: [], nextCursor: null })
function deferred<T>() { let resolve!: (v: T) => void; let reject!: (e: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } })
const login = { challengeId: a, code: '123456', firstName: 'Synthetic', lastName: 'B2' }
function clientFixture(kind: 'native' | 'web' = 'native') {
  let now = 1, sid = a
  const calls: { path: string; init: RequestInit }[] = []
  let handler = async (path: string, init: RequestInit) => {
    if (path.endsWith('/requests/' + key)) return json(result())
    if (path.includes('/messages')) return init.method === 'POST' ? json(result(a, JSON.parse(String(init.body)).clientRequestId)) : json(page())
    if (init.method === 'POST') return json({ version: '1.0', conversation })
    return json({ version: '1.0', conversations: [conversation], nextCursor: null })
  }
  const client = new IdentityClient({ baseUrl: 'https://example.test', client: kind, clock: () => now, storage: { get: async () => null, set: async () => undefined, clear: async () => undefined }, fetcher: async (url, init = {}) => {
    const path = new URL(String(url)).pathname; calls.push({ path, init })
    if (path.startsWith('/chat/')) return handler(path, init)
    if (path === '/identity/sessions') return json([])
    return json({ ...view(sid, kind), accessToken: 'synthetic-access', accessExpiresAt: now + 300000, refreshToken: 'x'.repeat(43) })
  } })
  return { client, calls, expire: () => { now += 301000 }, switch: async () => { sid = b; await client.verifyOtp(login) }, handler: (h: typeof handler) => { handler = h } }
}

test('durable methods reuse native transport and coalesce expired access refresh without auth queue deadlock', { timeout: 3000 }, async () => {
  const f = clientFixture(); await f.client.verifyOtp(login); f.expire()
  await Promise.all([f.client.conversations(), f.client.conversationMessages(a), f.client.sessions()])
  assert.equal(f.calls.filter(c => c.path === '/identity/refresh').length, 1)
  await f.client.createConversation(key); await f.client.sendConversationMessage(a, key, 'Synthetic'); await f.client.conversationRequest(a, key)
  const writes = f.calls.filter(c => c.path.startsWith('/chat/') && c.init.method === 'POST')
  assert.deepEqual(JSON.parse(String(writes[1].init.body)), { clientRequestId: key, text: 'Synthetic' })
  assert.equal((writes[1].init.headers as Record<string, string>).Authorization, 'Bearer synthetic-access')
  assert.equal(f.calls.some(c => c.path === '/chat/reply'), false)
})
test('durable Web calls keep cookie and CSRF transport, with no native bearer', async () => {
  const f = clientFixture('web'); await f.client.verifyOtp(login); await f.client.createConversation(key); await f.client.sendConversationMessage(a, key, 'Synthetic')
  const write = f.calls.at(-1)!.init
  assert.equal(write.credentials, 'include'); assert.equal((write.headers as Record<string, string>)['X-DARA-CSRF'], 'synthetic-csrf'); assert.equal('Authorization' in write.headers!, false)
})
test('invalid envelope, wrong conversation/request, invented assistant and inconsistent ordering fail closed', () => {
  for (const v of [{ ...result(), version: '2' }, { ...result(), conversationId: b }, { ...result(), clientRequestId: b }, { ...result(), status: 'pending', completedAt: null }, { ...result(), messages: result().messages.reverse() }, { ...result(), messages: [] }]) assert.throws(() => parseRequest(v, a, key), { code: 'INVALID_CONVERSATION_RESPONSE' })
  assert.throws(() => parseMessages({ ...page(), conversation: { ...conversation, id: b } }, a), { code: 'INVALID_CONVERSATION_RESPONSE' })
  assert.equal(parseRequest(result(a, key, 'outcome_unknown'), a, key).status, 'outcome_unknown')
})
test('old identity success and error are rejected by the existing client transport', async () => {
  for (const reject of [false, true]) {
    const f = clientFixture(), d = deferred<Response>(); await f.client.verifyOtp(login); f.handler(() => d.promise)
    const call = f.client.conversationMessages(a); await new Promise(r => setTimeout(r, 0)); await f.switch()
    if (reject) d.reject(new Error('old transport')); else d.resolve(json(page()))
    await assert.rejects(call, { code: 'CHAT_SESSION_CHANGED' })
  }
})
function stateFixture() {
  let session: SessionView | null = view(), posts = 0, gets = 0, lastKey = ''
  let post = async (id: string, k: string, _text: string) => result(id, k)
  let read = async (id: string) => page(id)
  let status = async (id: string, k: string) => result(id, k)
  const transport: ContinuityTransport = { snapshot: () => session, conversationMessages: (id) => read(id), sendConversationMessage: (id, k, text) => { posts++; lastKey = k; return post(id, k, text) }, conversationRequest: (id, k) => { gets++; return status(id, k) } }
  const state = new ContinuityStateController(transport)
  return { state, posts: () => posts, gets: () => gets, lastKey: () => lastKey, switch: () => { session = view(b) }, post: (h: typeof post) => { post = h }, read: (h: typeof read) => { read = h }, status: (h: typeof status) => { status = h } }
}
test('double send starts one POST and completed receipt updates only the active conversation', async () => {
  const f = stateFixture(), d = deferred<StoredRequest>(); await f.state.open(a); f.post(() => d.promise)
  const sending = f.state.send('Synthetic'); assert.equal(await f.state.send('Double tap'), false)
  d.resolve(result(a, f.lastKey())); await sending
  assert.equal(f.posts(), 1); assert.equal(f.state.snapshot().messages.length, 2); assert.equal(f.state.snapshot().sending, false)
})
test('conversation switch and identity switch suppress both late success and late error', async () => {
  for (const identity of [false, true]) for (const reject of [false, true]) {
    const f = stateFixture(), d = deferred<StoredRequest>(); await f.state.open(a); f.post(() => d.promise)
    const sending = f.state.send('Synthetic'); if (identity) f.switch(); else await f.state.open(b)
    const before = f.state.snapshot(); if (reject) d.reject(new Error('late failure')); else d.resolve(result(a, f.lastKey()))
    await sending; assert.deepEqual(f.state.snapshot(), before)
  }
})
test('late history read cannot overwrite a newly selected conversation', async () => {
  const f = stateFixture(), d = deferred<MessagePage>(); f.read(id => id === a ? d.promise : Promise.resolve(page(id)))
  const old = f.state.open(a); await f.state.open(b); d.resolve(page(a)); await old
  assert.equal(f.state.snapshot().conversation?.id, b)
})
test('client timeout blocks another send and reconciles with GET, never an automatic POST retry', async () => {
  const f = stateFixture(); await f.state.open(a); f.post(async () => { throw new ApiError('NETWORK_ERROR', 0) })
  await f.state.send('Synthetic timeout'); assert.ok(f.state.snapshot().unresolvedKey); assert.equal(await f.state.send('must not send'), false)
  await f.state.reconcile(); assert.equal(f.posts(), 1); assert.equal(f.gets(), 1); assert.equal(f.state.snapshot().requests[0].status, 'completed'); assert.equal(f.state.snapshot().unresolvedKey, null)
})
test('pending survives reopen from server and status reconciliation never creates an assistant placeholder', async () => {
  const f = stateFixture(); f.read(async () => ({ ...page(), requests: [result(a, key, 'pending')], messages: result(a, key, 'pending').messages }))
  await f.state.open(a); assert.equal(await f.state.send('blocked'), false); assert.equal(f.state.snapshot().messages.length, 1)
  await f.state.reconcile(); assert.equal(f.state.snapshot().messages.length, 2); assert.equal(f.posts(), 0)
})
test('outcome_unknown stays terminal with no retry until a new explicit user action', async () => {
  const f = stateFixture(); await f.state.open(a); f.post(async (id, k) => result(id, k, 'outcome_unknown'))
  await f.state.send('Synthetic unknown'); await f.state.reconcile(); assert.equal(f.posts(), 1); assert.equal(f.gets(), 0)
  const previous = f.lastKey(); await f.state.send('Explicit new request'); assert.notEqual(f.lastKey(), previous); assert.equal(f.posts(), 2)
})
test('dispose clears private transient data and drops delayed completion', async () => {
  const f = stateFixture(), d = deferred<StoredRequest>(); await f.state.open(a); f.post(() => d.promise)
  const sending = f.state.send('Synthetic'); f.state.dispose(); d.resolve(result(a, f.lastKey())); await sending
  assert.equal(f.state.snapshot().id, null); assert.deepEqual(f.state.snapshot().messages, [])
})

test('draft clearance waits for a stored receipt, including reconciliation after transport failure', async () => {
  const f = stateFixture(); await f.state.open(a); let cleared = 0
  f.post(async () => { throw new ApiError('NETWORK_ERROR', 0) })
  await f.state.send('Synthetic draft', () => { cleared++ }); assert.equal(cleared, 0)
  await f.state.reconcile(); assert.equal(cleared, 1)
  f.post(async () => { throw new ApiError('INVALID_CONVERSATION_REQUEST', 400) })
  await f.state.send('Rejected draft', () => { cleared++ }); assert.equal(cleared, 1)
})

test('leaving and reopening before admission retains unresolved key and blocks a second fresh POST', async () => {
  const f = stateFixture(), d = deferred<StoredRequest>(); await f.state.open(a); f.post(() => d.promise)
  const sending = f.state.send('Synthetic delayed admission'), originalKey = f.lastKey()
  await f.state.open(null); await f.state.open(a)
  assert.equal(f.state.snapshot().unresolvedKey, originalKey)
  assert.equal(await f.state.send('Must not start a fresh request'), false)
  d.resolve(result(a, originalKey)); await sending
  assert.equal(f.state.snapshot().messages.length, 0)
  assert.equal(await f.state.send('Still must reconcile first'), false)
  await f.state.reconcile(); assert.equal(f.posts(), 1); assert.equal(f.gets(), 1); assert.equal(f.state.snapshot().messages.length, 2)
})

test('missing receipt offers only explicit recovery with the original key and exact payload, even after navigation', async () => {
  const f = stateFixture(), sent: { key: string; text: string }[] = []
  await f.state.open(a)
  f.post(async (_id, k, text) => { sent.push({ key: k, text }); throw new ApiError('NETWORK_ERROR', 0) })
  await f.state.send('Original exact draft'); const original = f.lastKey()
  f.status(async () => { throw new ApiError('REQUEST_NOT_FOUND', 404) })
  await f.state.reconcile(); await f.state.open(null); await f.state.open(a); await f.state.reconcile()
  assert.equal(f.posts(), 1); assert.equal(await f.state.send('Changed draft'), false)
  assert.equal(f.state.snapshot().canRecoverOriginal, true)
  const response = deferred<StoredRequest>()
  f.post((_id, k, text) => { sent.push({ key: k, text }); return response.promise })
  const recovery = f.state.recoverOriginal()
  assert.equal(await f.state.recoverOriginal(), false)
  response.resolve(result(a, original)); await recovery
  assert.deepEqual(sent, [{ key: original, text: 'Original exact draft' }, { key: original, text: 'Original exact draft' }])
  assert.equal(f.state.snapshot().unresolvedKey, null); assert.equal(f.state.snapshot().canRecoverOriginal, false)
  assert.equal(f.state.snapshot().messages.length, 2)
})
test('original-request recovery is unavailable without a missing receipt or after identity change/dispose', async () => {
  const f = stateFixture(); await f.state.open(a)
  f.post(async () => { throw new ApiError('NETWORK_ERROR', 0) }); await f.state.send('Private transient draft')
  assert.equal(await f.state.recoverOriginal(), false)
  f.status(async () => { throw new ApiError('REQUEST_NOT_FOUND', 404) }); await f.state.reconcile()
  f.switch(); assert.equal(await f.state.recoverOriginal(), false); f.state.dispose()
  assert.equal(await f.state.recoverOriginal(), false); assert.equal(f.posts(), 1)
})
