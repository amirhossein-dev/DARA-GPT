import React from 'react'
import { Text, View } from 'react-native'

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0B0F1A', padding: 24, justifyContent: 'center' }}>
      <Text style={{ color: '#E6E8F0', fontSize: 22, marginBottom: 8 }}>Home · Mind Gateway</Text>
      <Text style={{ color: '#9CA3AF' }}>Routing is live. Next: UI signature.</Text>
    </View>
  )
}
