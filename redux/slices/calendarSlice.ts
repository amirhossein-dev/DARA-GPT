import { createSlice, nanoid, PayloadAction } from '@reduxjs/toolkit'

export type Task = { id: string; title: string; done: boolean; date?: string }

const calendarSlice = createSlice({
  name: 'calendar',
  initialState: { tasks: [] as Task[] },
  reducers: {
    addTask(state, action: PayloadAction<{ title: string; date?: string }>) {
      state.tasks.push({ id: nanoid(), title: action.payload.title, date: action.payload.date, done: false })
    },
    toggleTask(state, action: PayloadAction<string>) {
      const t = state.tasks.find((x) => x.id === action.payload)
      if (t) t.done = !t.done
    }
  }
})

export const { addTask, toggleTask } = calendarSlice.actions
export default calendarSlice.reducer
