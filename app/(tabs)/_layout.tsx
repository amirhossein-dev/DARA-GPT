import { IconSymbol } from '@/components/ui/icon-symbol'
import { Colors } from '@/constants/theme'
import { useTheme } from '@react-navigation/native'
import { Tabs } from 'expo-router'
import React from 'react'

export default function TabLayout() {
  const { colors } = useTheme()

  const active = colors.primary

  const inactive = Colors.dark.tabIconDefault ?? 'rgba(230,232,240,0.45)'

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,

        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border ?? Colors.dark.surface,
          height: 64,
          paddingTop: 8
        }
      }}
    >
      <Tabs.Screen
        name='index'
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol name='house.fill' color={color} />
        }}
      />
      <Tabs.Screen
        name='chat'
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => <IconSymbol name='bubble.left.and.bubble.right.fill' color={color} />
        }}
      />
      <Tabs.Screen
        name='calendar'
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color }) => <IconSymbol name='calendar' color={color} />
        }}
      />
      <Tabs.Screen
        name='personality'
        options={{
          title: 'Personality',
          tabBarIcon: ({ color }) => <IconSymbol name='chart.pie.fill' color={color} />
        }}
      />
      <Tabs.Screen
        name='plans'
        options={{
          title: 'Plans',
          tabBarIcon: ({ color }) => <IconSymbol name='sparkles' color={color} />
        }}
      />
    </Tabs>
  )
}
