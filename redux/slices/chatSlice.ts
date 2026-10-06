import { createSlice, nanoid, PayloadAction } from '@reduxjs/toolkit'
import type { ResponseMode } from './uiSlice'

export type MessageRole = 'user' | 'ai'

export type Message = {
  id: string
  role: MessageRole
  content: string
  mode?: ResponseMode
  layer?: 1 | 2 | 3 | 4 | 5 | 6
  timestamp: number
  memoryRefs?: string[]
}

type ChatState = {
  messages: Message[]
  activeMemoryIds: string[]
}

const initialState: ChatState = {
  messages: [
    {
      id: nanoid(),
      role: 'ai',
      content: 'Field initialized. Conscious stream is open.',
      mode: 'insight',
      layer: 5,
      timestamp: Date.now()
    }
  ],
  activeMemoryIds: []
}

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage(state, action: PayloadAction<Message>) {
      state.messages.push(action.payload)
    },
    addUserMessage(state, action: PayloadAction<{ content: string }>) {
      state.messages.push({
        id: nanoid(),
        role: 'user',
        content: action.payload.content,
        timestamp: Date.now()
      })
    },
    addAImessage(state, action: PayloadAction<{ content: string; mode: ResponseMode; layer: 1 | 2 | 3 | 4 | 5 | 6; memoryRefs?: string[] }>) {
      state.messages.push({
        id: nanoid(),
        role: 'ai',
        content: action.payload.content,
        mode: action.payload.mode,
        layer: action.payload.layer,
        timestamp: Date.now(),
        memoryRefs: action.payload.memoryRefs
      })
    },
    pushMemoryId(state, action: PayloadAction<string>) {
      if (!state.activeMemoryIds.includes(action.payload)) state.activeMemoryIds.push(action.payload)
    }
  }
})

export const { addMessage, addUserMessage, addAImessage, pushMemoryId } = chatSlice.actions
export default chatSlice.reducer
