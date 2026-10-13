import test from 'node:test'
import assert from 'node:assert/strict'
import { IdentityClient } from '../auth/client'
import { ApiError, ChatReply, ChatRequest, SessionView, TokenStorage } from '../auth/types'
import { ChatRequestRunner, chatErrorMessage, recentChatHistory } from '../chat/request'
import chatReducer, { addAImessage, addUserMessage } from '../redux/slices/chatSlice'

const sidA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const sidB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const answer: ChatReply = { version: '1.0', requestId: sidA, replyText: 'Synthetic server reply', provider: 'gemini', model: 'gemini-3.5-flash-lite', latencyMs: 12, usage: { outputTokens: 3 } }
const login = { challengeId: sidA, code: '123456', firstName: 'Synthetic', lastName: 'Only' }
function view(client: 'native' | 'web' = 'native', sid = sidA): SessionView {
  return {
    user: { id: 'user', phone: '+15550001001', firstName: 'Synthetic', lastName: 'Only' },
    tenant: { id: 'tenant', slug: 'enterprise-pilot', name: 'Synthetic tenant' },
    membership: { id: 'member', roles: ['operator'], revision: 1 },
    entitlements: { enterprise: true, paymentsEnabled: false },
    session: { id: sid, client, assurance: 'development_test', expiresAt: 9999999, idleTimeoutMs: 43200000, maxActiveSessions: 2 },
    permissions: ['conversation.use'], csrfToken: client === 'web' ? 'synthetic-csrf' : null
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
function fixture(kind: 'native' | 'web' = 'native') {
  let stored: string | null = null
  let now = 1000
  let sid = sidA
  let chatResponse = async (): Promise<Response> => json(answer)
  const calls: { path: string; init: RequestInit }[] = []
  const storage: TokenStorage = { get: async () => stored, set: async value => { stored = value }, clear: async () => { stored = null } }
  const client = new IdentityClient({
    baseUrl: 'https://example.test', client: kind, storage, clock: () => now,
    fetcher: async (url, init = {}) => {
      const path = new URL(String(url)).pathname
      calls.push({ path, init })
      if (path === '/chat/reply') return chatResponse()
      if (path === '/identity/logout') return json({ revoked: true })
      if (path === '/identity/sessions') return json([])
      const refreshed = path === '/identity/refresh'
      return json({ ...view(kind, sid), ...(kind === 'native' ? { accessToken: refreshed ? 'fresh-synthetic-access' : 'synthetic-access', refreshToken: (refreshed ? 'y' : 'x').repeat(43), accessExpiresAt: now + 300000 } : {}) })
    }
  })
  return { client, calls, stored: () => stored, expireAccess: () => { now += 301000 }, setChat: (fn: () => Promise<Response>) => { chatResponse = fn }, switchLogin: async () => { sid = sidB; await client.verifyOtp(login) } }
}

test('native chat uses existing authorized transport and keeps all credentials out of body/public state', async () => {
  const f = fixture()
  await f.client.verifyOtp(login)
  const body: ChatRequest = { message: 'Synthetic question', history: [{ role: 'assistant', text: 'Synthetic history' }] }
  assert.deepEqual(await f.client.chatReply(body), answer)
  const call = f.calls.at(-1)!
  assert.equal(call.path, '/chat/reply')
  assert.equal(call.init.method, 'POST')
  assert.equal((call.init.headers as Record<string, string>).Authorization, 'Bearer synthetic-access')
  assert.equal('credentials' in call.init, false)
  assert.deepEqual(JSON.parse(String(call.init.body)), body)
  assert.equal(JSON.stringify(f.client.snapshot()).includes('synthetic-access'), false)
  assert.equal(JSON.stringify(f.client.snapshot()).includes('x'.repeat(43)), false)
})

test('chat coalesces an expired native access refresh with existing protected reads', async () => {
  const f = fixture()
  await f.client.verifyOtp(login)
  f.expireAccess()
  await Promise.all([f.client.chatReply({ message: 'Synthetic', history: [] }), f.client.sessions()])
  assert.equal(f.calls.filter(c => c.path === '/identity/refresh').length, 1)
  assert.equal(f.stored(), 'y'.repeat(43))
  assert.equal((f.calls.find(c => c.path === '/chat/reply')!.init.headers as Record<string, string>).Authorization, 'Bearer fresh-synthetic-access')
})

test('Web chat uses the existing cookie/CSRF path and no bearer', async () => {
  const f = fixture('web')
  await f.client.verifyOtp(login)
  await f.client.chatReply({ message: 'Synthetic', history: [] })
  const init = f.calls.at(-1)!.init
  assert.equal(init.credentials, 'include')
  assert.equal((init.headers as Record<string, string>)['X-DARA-CSRF'], 'synthetic-csrf')
  assert.equal('Authorization' in init.headers!, false)
  assert.equal(f.stored(), null)
})

test('chat requires a signed-in session and validates bounds before sending', async () => {
  const f = fixture()
  await assert.rejects(f.client.chatReply({ message: 'Synthetic', history: [] }), { code: 'LOGIN_REQUIRED' })
  await f.client.verifyOtp(login)
  for (const input of [
    { message: '', history: [] }, { message: 'x'.repeat(4001), history: [] },
    { message: 'x', history: Array.from({ length: 13 }, () => ({ role: 'user', text: 'x' })) },
    { message: 'x', history: [{ role: 'system', text: 'forbidden' }] },
    { message: 'x', history: [{ role: 'user', text: 'x'.repeat(4001) }] },
    { message: 'x', history: Array.from({ length: 5 }, () => ({ role: 'user', text: 'x'.repeat(4000) })) }
  ]) await assert.rejects(f.client.chatReply(input as ChatRequest), { code: 'INVALID_CHAT_REQUEST' })
  assert.equal(f.calls.filter(c => c.path === '/chat/reply').length, 0)
})

test('the client snapshots and allowlists the body before async authorization', async () => {
  const f = fixture()
  await f.client.verifyOtp(login)
  const body = { message: 'Original', history: [{ role: 'user' as const, text: 'Original history', userId: 'must-not-send' }], tenantId: 'must-not-send' }
  const pending = f.client.chatReply(body)
  body.message = 'Mutated'
  body.history[0].text = 'Mutated history'
  await pending
  assert.deepEqual(JSON.parse(String(f.calls.at(-1)!.init.body)), { message: 'Original', history: [{ role: 'user', text: 'Original history' }] })
})

test('a success from an old chat session is not returned as a current-session reply', async () => {
  const f = fixture()
  await f.client.verifyOtp(login)
  const response = deferred<Response>()
  f.setChat(() => response.promise)
  const pending = f.client.chatReply({ message: 'Synthetic A', history: [] })
  const rejected = assert.rejects(pending, { code: 'CHAT_SESSION_CHANGED' })
  await Promise.resolve()
  await f.switchLogin()
  response.resolve(json(answer))
  await rejected
  assert.equal(f.client.snapshot()!.session.id, sidB)
})

for (const [code, status] of [['AI_PROVIDER_TIMEOUT', 504], ['AI_PROVIDER_RATE_LIMITED', 429], ['AI_PROVIDER_UNAVAILABLE', 503]] as const) {
  test(`client exposes ${code} with no automatic resend or mock`, async () => {
    const f = fixture()
    await f.client.verifyOtp(login)
    f.setChat(async () => json({ error: code }, status))
    await assert.rejects(f.client.chatReply({ message: 'Synthetic', history: [] }), { code, status })
    assert.equal(f.calls.filter(c => c.path === '/chat/reply').length, 1)
  })
}

test('invalid chat responses fail closed; extra credential fields are never returned', async () => {
  const f = fixture()
  await f.client.verifyOtp(login)
  for (const value of [{}, { ...answer, replyText: '' }, { ...answer, replyText: 'x'.repeat(16001) }, { ...answer, provider: 'other' }, { ...answer, latencyMs: -1 }, { ...answer, usage: { inputTokens: -1 } }]) {
    f.setChat(async () => json(value))
    await assert.rejects(f.client.chatReply({ message: 'Synthetic', history: [] }), { code: 'INVALID_CHAT_RESPONSE' })
  }
  f.setChat(async () => json({ ...answer, accessToken: 'must-not-publish', usage: { ...answer.usage, privateData: 'must-not-publish' } }))
  assert.deepEqual(await f.client.chatReply({ message: 'Synthetic', history: [] }), answer)
})

test('history selects the newest twelve text entries in chronological order', () => {
  const messages = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'ai' as const : 'user' as const, content: `Synthetic ${i}` }))
  const history = recentChatHistory(messages)
  assert.equal(history.length, 12)
  assert.deepEqual(history[0], { role: 'user', text: 'Synthetic 18' })
  assert.deepEqual(history.at(-1), { role: 'assistant', text: 'Synthetic 29' })
})

test('history enforces per-entry and total character bounds without sending metadata', () => {
  const history = recentChatHistory(Array.from({ length: 12 }, () => ({ role: 'ai' as const, content: 'x'.repeat(8000), privateMetadata: 'must-not-send' })))
  assert.equal(history.length, 4)
  assert.equal(history.reduce((n, x) => n + x.text.length, 0), 16000)
  assert.ok(history.every(x => x.text.length === 4000 && Object.keys(x).sort().join() === 'role,text'))
})

function runnerFixture() {
  let session: SessionView | null = view()
  const result = deferred<ChatReply>()
  const requests: ChatRequest[] = []
  const client = { snapshot: () => session, chatReply: async (input: ChatRequest) => { requests.push(input); return result.promise } }
  const runner = new ChatRequestRunner(client)
  const state = { starts: [] as string[], replies: [] as ChatReply[], errors: [] as string[], busy: [] as boolean[] }
  const callbacks = { onStart: (text: string) => { state.starts.push(text) }, onReply: (reply: ChatReply) => { state.replies.push(reply) }, onError: (message: string) => { state.errors.push(message) }, onBusy: (busy: boolean) => { state.busy.push(busy) } }
  return { runner, result, requests, state, callbacks, switchIdentity: () => { session = view('native', sidB) }, logout: () => { session = null } }
}

test('one active UI request: double-send is rejected and only real response invokes onReply', async () => {
  const f = runnerFixture()
  const first = f.runner.send('  Synthetic latest  ', [{ role: 'user', content: 'Previous' }], f.callbacks)
  assert.equal(await f.runner.send('Duplicate', [], f.callbacks), false)
  assert.deepEqual(f.state.replies, [])
  assert.deepEqual(f.requests, [{ message: 'Synthetic latest', history: [{ role: 'user', text: 'Previous' }] }])
  f.result.resolve(answer)
  assert.equal(await first, true)
  assert.deepEqual(f.state.replies, [answer])
  assert.deepEqual(f.state.busy, [true, false])
})

test('provider failure shows an explicit error, releases sending and never dispatches fake assistant text', async () => {
  const f = runnerFixture()
  const pending = f.runner.send('Synthetic', [], f.callbacks)
  f.result.reject(new ApiError('AI_PROVIDER_UNAVAILABLE', 503))
  await pending
  assert.equal(f.state.errors.length, 1)
  assert.deepEqual(f.state.replies, [])
  assert.deepEqual(f.state.busy, [true, false])
  assert.equal(f.requests.length, 1)
})

for (const outcome of ['success', 'error'] as const) {
  test(`a ${outcome} arriving after the chat identity changes cannot update the current UI`, async () => {
    const f = runnerFixture()
    const pending = f.runner.send('Synthetic A', [], f.callbacks)
    f.switchIdentity()
    if (outcome === 'success') f.result.resolve(answer)
    else f.result.reject(new ApiError('AI_PROVIDER_TIMEOUT', 504))
    await pending
    assert.deepEqual(f.state.replies, [])
    assert.deepEqual(f.state.errors, [])
    assert.deepEqual(f.state.busy, [true])
  })
}

test('unmount invalidates request callbacks', async () => {
  const f = runnerFixture()
  const pending = f.runner.send('Synthetic', [], f.callbacks)
  f.runner.invalidate()
  f.result.resolve(answer)
  await pending
  assert.deepEqual(f.state.replies, [])
  assert.deepEqual(f.state.errors, [])
  assert.deepEqual(f.state.busy, [true])
})

test('missing session or invalid message never starts a UI request', async () => {
  const f = runnerFixture()
  assert.equal(await f.runner.send(' ', [], f.callbacks), false)
  f.logout()
  assert.equal(await f.runner.send('Synthetic', [], f.callbacks), false)
  assert.deepEqual(f.requests, [])
  assert.deepEqual(f.state.starts, [])
})

test('error labels never echo raw errors or unknown server code content', () => {
  assert.equal(chatErrorMessage(new Error('PRIVATE_DETAIL')).includes('PRIVATE_DETAIL'), false)
  assert.equal(chatErrorMessage(new ApiError('PRIVATE_DETAIL', 500)).includes('PRIVATE_DETAIL'), false)
})

test('Redux starts empty and retains the message representation for real exchanges', () => {
  const initial = chatReducer(undefined, { type: 'init' })
  assert.deepEqual(initial.messages, [])
  const asked = chatReducer(initial, addUserMessage({ content: 'Synthetic' }))
  const replied = chatReducer(asked, addAImessage({ content: answer.replyText, mode: 'insight', layer: 5 }))
  assert.deepEqual(replied.messages.map(x => ({ role: x.role, content: x.content })), [{ role: 'user', content: 'Synthetic' }, { role: 'ai', content: answer.replyText }])
  assert.deepEqual(replied.activeMemoryIds, [])
})
