import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type ResponseMode = 'insight' | 'technical' | 'narrative'

type UIState = {
  layer: 1 | 2 | 3 | 4 | 5 | 6
  mode: ResponseMode
  isThinking: boolean
}

const initialState: UIState = {
  layer: 5,
  mode: 'insight',
  isThinking: false
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLayer(state, action: PayloadAction<UIState['layer']>) {
      state.layer = action.payload
    },
    incLayer(state) {
      state.layer = Math.min(6, state.layer + 1) as UIState['layer']
    },
    decLayer(state) {
      state.layer = Math.max(1, state.layer - 1) as UIState['layer']
    },
    setMode(state, action: PayloadAction<ResponseMode>) {
      state.mode = action.payload
    },
    setThinking(state, action: PayloadAction<boolean>) {
      state.isThinking = action.payload
    }
  }
})

export const { setLayer, incLayer, decLayer, setMode, setThinking } = uiSlice.actions
export default uiSlice.reducer
