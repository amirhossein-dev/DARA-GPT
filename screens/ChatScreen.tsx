import { useTheme } from '@react-navigation/native'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import { useAppDispatch, useAppSelector } from '../redux/hooks'
import { addAImessage, addUserMessage, pushMemoryId } from '../redux/slices/chatSlice'
import { decLayer, incLayer, setMode, setThinking } from '../redux/slices/uiSlice'

type Mode = 'insight' | 'technical' | 'narrative'

const MODE_LABEL: Record<Mode, string> = {
  insight: 'INSIGHT',
  technical: 'TECHNICAL',
  narrative: 'NARRATIVE'
}

const MODE_ACCENT: Record<Mode, string> = {
  insight: '#AA7CFF',
  technical: '#52E3FF',
  narrative: '#5A6CFF'
}

type Suggestion = { key: string; label: string; mode: Mode }

export default function ChatScreen() {
  const { colors } = useTheme()
  const dispatch = useAppDispatch()

  type Layer = 1 | 2 | 3 | 4 | 5 | 6

  const clampLayer = (n: number): Layer => {
    if (n <= 1) return 1
    if (n >= 6) return 6
    return n as Layer
  }
  const layerRaw = useAppSelector((s) => s.ui.layer) as number
  const layer = clampLayer(layerRaw)
  const mode = useAppSelector((s) => s.ui.mode) as Mode
  const isThinking = useAppSelector((s) => s.ui.isThinking) as boolean

  const messages = useAppSelector((s) => s.chat.messages) as any[]
  const activeMemoryIds = useAppSelector((s) => s.chat.activeMemoryIds) as string[]

  const [input, setInput] = useState('')

  const scrollRef = useRef<ScrollView>(null)

  const suggestions: Suggestion[] = useMemo(
    () => [
      { key: 'deepen', label: 'Deepen', mode: 'insight' },
      { key: 'structure', label: 'Structure', mode: 'technical' },
      { key: 'narrate', label: 'Narrate', mode: 'narrative' }
    ],
    []
  )

  const accent = MODE_ACCENT[mode]

  // ------------------------------------------------------------
  // Thinking Pulse (live presence)
  // ------------------------------------------------------------
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null
    if (isThinking) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
        ])
      )
      loop.start()
    } else {
      pulse.stopAnimation()
      pulse.setValue(0)
    }
    return () => {
      if (loop) loop.stop()
    }
  }, [isThinking, pulse])

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] })
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.7] })

  const scrollToEnd = () => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }))
  }

  useEffect(() => {
    scrollToEnd()
  }, [messages.length, isThinking])

  // ------------------------------------------------------------
  // Demo AI response
  // ------------------------------------------------------------
  const mockResponse = (userText: string) => {
    if (mode === 'technical') {
      return `Understood.\n\n- Intent: ${userText}\n- Layer: L${layer}\n- Next: constraints → structure → implementation.`
    }
    if (mode === 'narrative') {
      return `The field received it.\nWe stay in L${layer}. The shape will emerge—slowly.`
    }
    return `Noted.\nIn L${layer}, the deeper question is: what are you actually trying to resolve?`
  }

  const onSend = () => {
    const text = input.trim()
    if (!text) return
    if (isThinking) return

    setInput('')
    dispatch(addUserMessage({ content: text }))
    dispatch(setThinking(true))
    scrollToEnd()

    // Demo AI
    setTimeout(() => {
      const aiText = mockResponse(text)

      dispatch(addAImessage({ content: aiText, mode, layer }))
      if (!activeMemoryIds.includes('project_context')) dispatch(pushMemoryId('project_context'))

      dispatch(setThinking(false))
      scrollToEnd()
    }, 700)
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: 'rgba(255,255,255,0.06)' }]}>
        <View>
          <Text style={styles.headerMeta}>ACTIVE</Text>
          <Text style={[styles.headerTitle, { color: accent }]}>
            L{layer} · {MODE_LABEL[mode]} STREAM
          </Text>
        </View>

        <View style={styles.headerRight}>
          <Pressable onPress={() => dispatch(decLayer())} style={({ pressed }) => [styles.layerBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <Text style={styles.layerBtnText}>−</Text>
          </Pressable>
          <Pressable onPress={() => dispatch(incLayer())} style={({ pressed }) => [styles.layerBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <Text style={styles.layerBtnText}>+</Text>
          </Pressable>
        </View>
      </View>

      {/* Stream */}
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.streamContent} onContentSizeChange={scrollToEnd}>
        {messages.map((m: any) => (
          <View key={m.id} style={{ marginBottom: 18 }}>
            {m.role === 'ai' ? <AIBlock text={m.content} mode={(m.mode ?? mode) as Mode} layer={m.layer ?? layer} /> : <UserLine text={m.content} />}
          </View>
        ))}

        {/* Memory capsule (non-intrusive) */}
        {activeMemoryIds.includes('project_context') && (
          <View style={styles.memoryCapsule}>
            <Text style={[styles.memoryText, { color: 'rgba(82,227,255,0.9)' }]}>Memory Node · Project Context Loaded</Text>
          </View>
        )}

        {/* Thinking */}
        {isThinking && (
          <View style={styles.thinkingRow}>
            <Animated.View
              style={[
                styles.thinkingDot,
                {
                  backgroundColor: accent,
                  transform: [{ scale: pulseScale }],
                  opacity: pulseOpacity
                }
              ]}
            />
            <Text style={styles.thinkingText}>thinking…</Text>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Suggested chips */}
      <View style={styles.suggestionsRow}>
        {suggestions.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => dispatch(setMode(s.mode))}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderColor: s.mode === mode ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)',
                opacity: pressed ? 0.8 : 1
              }
            ]}
          >
            <Text style={[styles.chipText, { color: s.mode === mode ? 'rgba(230,232,240,0.95)' : 'rgba(230,232,240,0.75)' }]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Input */}
      <View style={[styles.inputBar, { borderTopColor: 'rgba(255,255,255,0.06)' }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder='Enter thought…'
          placeholderTextColor='rgba(156,163,175,0.6)'
          style={styles.input}
          multiline
          returnKeyType='default'
          blurOnSubmit={false}
        />
        <Pressable
          onPress={onSend}
          disabled={isThinking || !input.trim()}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: accent,
              opacity: isThinking || !input.trim() ? 0.35 : pressed ? 0.9 : 1
            }
          ]}
        >
          <Text style={styles.sendText}>SEND</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

function AIBlock({ text, mode, layer }: { text: string; mode: Mode; layer: number }) {
  const accent = MODE_ACCENT[mode]
  const isTech = mode === 'technical'
  const isNarr = mode === 'narrative'

  return (
    <View
      style={[
        styles.aiBlock,
        {
          borderColor: 'rgba(255,255,255,0.06)'
        }
      ]}
    >
      <Text style={[styles.aiTag, { color: accent }]}>
        L{layer} · {MODE_LABEL[mode]}
      </Text>

      <Text
        style={[
          styles.aiText,
          {
            fontFamily: isTech ? (Platform.OS === 'ios' ? 'Menlo' : 'monospace') : undefined,
            lineHeight: isNarr ? 22 : 20
          }
        ]}
      >
        {text}
      </Text>
    </View>
  )
}

function UserLine({ text }: { text: string }) {
  return (
    <View style={styles.userLine}>
      <Text style={styles.userText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end'
  },
  headerMeta: {
    paddingTop: 20,
    color: 'rgba(230,232,240,0.45)',
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '700'
  },
  headerTitle: {
    marginTop: 6,
    fontSize: 13,
    letterSpacing: 0.6,
    fontWeight: '800'
  },
  headerRight: { flexDirection: 'row', gap: 10 },
  layerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  layerBtnText: { color: 'rgba(230,232,240,0.9)', fontSize: 18, fontWeight: '800' },

  streamContent: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14 },

  aiBlock: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1
  },
  aiTag: { fontSize: 10, letterSpacing: 1.2, fontWeight: '900', marginBottom: 8 },
  aiText: { color: 'rgba(230,232,240,0.92)', fontSize: 14, lineHeight: 20 },

  userLine: { alignSelf: 'flex-end', maxWidth: '88%' },
  userText: { color: 'rgba(230,232,240,0.92)', fontSize: 14, lineHeight: 20 },

  memoryCapsule: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  memoryText: { fontSize: 12, letterSpacing: 0.3, fontWeight: '700' },

  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10 },
  thinkingDot: { width: 8, height: 8, borderRadius: 4 },
  thinkingText: { color: 'rgba(156,163,175,0.8)', fontSize: 12 },

  suggestionsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingBottom: 10 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1
  },
  chipText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },

  inputBar: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: 'rgba(230,232,240,0.95)',
    fontSize: 14,
    lineHeight: 20
  },
  sendBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  // sendText: { color: '#0B0F1A', fontWeight: '900', letterSpacing: 1.2, fontSize: 12 }
  sendText: { color: '#f6f9ffff', fontWeight: '900', letterSpacing: 1.2, fontSize: 12 }
})
