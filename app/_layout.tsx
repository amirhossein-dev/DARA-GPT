import { store } from '@/redux/store'
import { DarkTheme, Theme, ThemeProvider } from '@react-navigation/native'
import { Stack } from 'expo-router'
import { IdentityProvider, useIdentity } from '@/auth/provider'
import { StatusBar } from 'expo-status-bar'
import 'react-native-reanimated'
import { Provider } from 'react-redux'
import '../global.css'

import { Colors } from '@/constants/theme'

export const unstable_settings = {
  anchor: '(tabs)'
}

export default function RootLayout() {
  const DaraDarkTheme: Theme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: Colors.dark.bg,
      card: Colors.dark.bg,
      text: Colors.dark.textPrimary ?? Colors.dark.text,
      border: Colors.dark.surface,
      primary: Colors.dark.secondary ?? Colors.dark.tint
    }
  }

  return (
    <Provider store={store}>
      <ThemeProvider value={DaraDarkTheme}>
        <IdentityProvider><AuthenticatedStack /></IdentityProvider>

        <StatusBar style='light' />
      </ThemeProvider>
    </Provider>
  )
}

function AuthenticatedStack() {
  const { session } = useIdentity()
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Protected guard={!session}>
      <Stack.Screen name='sign-in' />
    </Stack.Protected>
    <Stack.Protected guard={!!session}>
      <Stack.Screen name='(tabs)' />
      <Stack.Screen name='account' />
      <Stack.Screen name='modal' options={{ presentation: 'modal', title: 'Modal' }} />
    </Stack.Protected>
  </Stack>
}
