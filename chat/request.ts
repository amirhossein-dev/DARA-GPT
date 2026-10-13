import { ApiError, chatSessionKey } from '../auth/types'
import type { ChatHistoryMessage, ChatReply, ChatRequest, SessionView } from '../auth/types'

type MessageText = { role: 'user' | 'ai'; content: string }
type ChatTransport = { snapshot(): SessionView | null; chatReply(input: ChatRequest): Promise<ChatReply> }
type Callbacks = {
  onStart(text: string): void
  onReply(reply: ChatReply): void
  onError(message: string): void
  onBusy(busy: boolean): void
}

export function recentChatHistory(messages: readonly MessageText[]): ChatHistoryMessage[] {
  const history: ChatHistoryMessage[] = []
  let budget = 16000
  for (let i = messages.length - 1; i >= 0 && history.length < 12 && budget > 0; i--) {
    const message = messages[i]
    if (!['user', 'ai'].includes(message.role) || typeof message.content !== 'string') continue
    const text = message.content.slice(0, Math.min(4000, budget)).trim()
    if (!text) continue
    history.unshift({ role: message.role === 'ai' ? 'assistant' : 'user', text })
    budget -= text.length
  }
  return history
}

export function chatErrorMessage(error: unknown): string {
  const messages: Record<string, string> = {
    AI_PROVIDER_NOT_CONFIGURED: 'Chat is not configured on the server.',
    AI_PROVIDER_TIMEOUT: 'The model took too long to respond. You can send again.',
    AI_PROVIDER_RATE_LIMITED: 'The model quota or rate limit was reached. Try again later.',
    AI_PROVIDER_UNAVAILABLE: 'The model is unavailable. Try again later.',
    AI_INVALID_RESPONSE: 'The model did not return a usable reply. You can send again.',
    INVALID_CHAT_RESPONSE: 'The server returned an invalid chat reply.',
    INVALID_CHAT_REQUEST: 'Enter a message of 1–4,000 characters.',
    NETWORK_ERROR: 'The connection failed. No reply was received.',
    LOGIN_REQUIRED: 'Sign in before sending a message.',
    CHAT_SESSION_CHANGED: 'Your session changed. Send again from the current account.'
  }
  if (!(error instanceof ApiError)) return 'The message could not be completed. You can try again.'
  if (error.status === 401 || error.status === 403) return 'Your session could not be authorized. Check your account before sending again.'
  return messages[error.code] || 'The message could not be completed. You can try again.'
}

export class ChatRequestRunner {
  private active: symbol | null = null
  constructor(private readonly client: ChatTransport) {}

  invalidate() { this.active = null }

  async send(text: string, messages: readonly MessageText[], callbacks: Callbacks): Promise<boolean> {
    if (this.active) return false
    const message = text.trim()
    if (!message || message.length > 4000) {
      callbacks.onError(chatErrorMessage(new ApiError('INVALID_CHAT_REQUEST', 400)))
      return false
    }
    const origin = chatSessionKey(this.client.snapshot())
    if (!origin) {
      callbacks.onError(chatErrorMessage(new ApiError('LOGIN_REQUIRED', 401)))
      return false
    }
    const request = { message, history: recentChatHistory(messages) }
    const ticket = Symbol('chat-request')
    this.active = ticket
    const current = () => this.active === ticket && chatSessionKey(this.client.snapshot()) === origin
    callbacks.onBusy(true)
    callbacks.onStart(message)
    try {
      const reply = await this.client.chatReply(request)
      if (current()) callbacks.onReply(reply)
    } catch (error) {
      if (current()) callbacks.onError(chatErrorMessage(error))
    } finally {
      if (current()) callbacks.onBusy(false)
      if (this.active === ticket) this.active = null
    }
    return true
  }
}
