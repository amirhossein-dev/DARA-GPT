import { createSlice, PayloadAction } from '@reduxjs/toolkit'

type PersonalityState = {
  radarData: number[] // mock for now
}

const initialState: PersonalityState = {
  radarData: [0.6, 0.4, 0.7, 0.5]
}

const personalitySlice = createSlice({
  name: 'personality',
  initialState,
  reducers: {
    setRadarData(state, action: PayloadAction<number[]>) {
      state.radarData = action.payload
    }
  }
})

export const { setRadarData } = personalitySlice.actions
export default personalitySlice.reducer
