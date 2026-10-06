import { configureStore } from '@reduxjs/toolkit'
import calendarReducer from './slices/calendarSlice'
import chatReducer from './slices/chatSlice'
import personalityReducer from './slices/personalitySlice'
import planReducer from './slices/planSlice'
import uiReducer from './slices/uiSlice'

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    chat: chatReducer,
    plan: planReducer,
    calendar: calendarReducer,
    personality: personalityReducer
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
