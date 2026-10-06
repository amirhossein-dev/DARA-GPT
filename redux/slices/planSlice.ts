import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type Plan = 'free' | 'personal' | 'team' | 'business'

type PlanState = {
  currentPlan: Plan
  unlocked: {
    calendar: boolean
    personality: boolean
    advancedLayers: boolean
    memoryDepth: 'low' | 'high'
  }
}

const initialState: PlanState = {
  currentPlan: 'free',
  unlocked: {
    calendar: false,
    personality: false,
    advancedLayers: false,
    memoryDepth: 'low'
  }
}

function deriveUnlocked(plan: Plan): PlanState['unlocked'] {
  if (plan === 'free') return { calendar: false, personality: false, advancedLayers: false, memoryDepth: 'low' }
  return { calendar: true, personality: true, advancedLayers: true, memoryDepth: 'high' }
}
const planSlice = createSlice({
  name: 'plan',
  initialState,
  reducers: {
    setPlan(state, action: PayloadAction<Plan>) {
      state.currentPlan = action.payload
      state.unlocked = deriveUnlocked(action.payload)
    }
  }
})

export const { setPlan } = planSlice.actions
export default planSlice.reducer
