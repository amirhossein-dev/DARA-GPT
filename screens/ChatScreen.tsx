import { useTheme } from '@react-navigation/native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAppDispatch, useAppSelector } from '../redux/hooks'
import { decLayer, incLayer, setMode, setThinking } from '../redux/slices/uiSlice'
import { useIdentity } from '../auth/provider'
import type { IdentityClient } from '../auth/client'
import { chatSessionKey } from '../auth/types'
import { Conversation, StoredMessage, continuityError, newRequestId, requestLabel } from '../chat/continuity'
import { ContinuityStateController } from '../chat/continuity-state'

type Mode = 'insight' | 'technical' | 'narrative'
const MODE_LABEL: Record<Mode, string> = { insight: 'INSIGHT', technical: 'TECHNICAL', narrative: 'NARRATIVE' }
const MODE_ACCENT: Record<Mode, string> = { insight: '#AA7CFF', technical: '#52E3FF', narrative: '#5A6CFF' }
const suggestions: { label: string; mode: Mode }[] = [{ label: 'Deepen', mode: 'insight' }, { label: 'Structure', mode: 'technical' }, { label: 'Narrate', mode: 'narrative' }]

export default function ChatScreen() {
  const { client, session } = useIdentity()
  return session ? <ChatSession key={chatSessionKey(session)} client={client} /> : null
}

function Action({ label, onPress, disabled = false }: { label: string; onPress(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole='button' accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}><Text style={styles.actionText}>{label}</Text></Pressable>
}

function ConversationList({ client, onOpen }: { client: IdentityClient; onOpen(id: string): void }) {
  const [items, setItems] = useState<Conversation[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const alive = useRef(true), locked = useRef(false), createKey = useRef<string | null>(null)
  const load = async (more = false) => {
    if (locked.current) return
    locked.current = true; setBusy(true); setError('')
    try {
      const page = await client.conversations(more ? cursor || undefined : undefined)
      if (alive.current) { setItems(previous => more ? [...previous, ...page.conversations.filter(c => !previous.some(x => x.id === c.id))] : page.conversations); setCursor(page.nextCursor) }
    } catch (e) { if (alive.current) setError(continuityError(e)) }
    finally { locked.current = false; if (alive.current) setBusy(false) }
  }
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false } }, [client])
  const create = async () => {
    if (locked.current) return
    locked.current = true; setBusy(true); setError(''); createKey.current ||= newRequestId()
    try { const conversation = await client.createConversation(createKey.current); if (alive.current) { createKey.current = null; onOpen(conversation.id) } }
    catch (e) { if (alive.current) setError(continuityError(e)) }
    finally { locked.current = false; if (alive.current) setBusy(false) }
  }
  return <View style={styles.stream}>
    <View style={styles.listHeading}><Text accessibilityRole='header' style={styles.listTitle}>Your conversations</Text><Text style={styles.caption}>Private to your account in this workspace. Saved on the server.</Text></View>
    <View style={styles.navRow}><Action label={createKey.current ? 'Retry create' : 'New conversation'} disabled={busy} onPress={() => void create()} /><Action label='Refresh list' disabled={busy} onPress={() => void load()} /></View>
    <FlatList data={items} keyExtractor={item => item.id} style={styles.stream} contentContainerStyle={styles.streamContent}
      renderItem={({ item }) => <Pressable accessibilityRole='button' accessibilityLabel={'Open conversation: ' + item.title} onPress={() => onOpen(item.id)} style={({ pressed }) => [styles.conversationRow, { opacity: pressed ? 0.7 : 1 }]}><Text numberOfLines={2} style={styles.conversationTitle}>{item.title}</Text><Text style={styles.caption}>{new Date(item.updatedAt).toLocaleString()}</Text></Pressable>}
      ListEmptyComponent={!busy && !error ? <Text style={styles.caption}>No conversations yet. Create one to begin.</Text> : null}
      ListFooterComponent={<>{busy && <ActivityIndicator color='#AA7CFF' />}{!!error && <Text accessibilityRole='alert' style={styles.error}>{error}</Text>}{!!cursor && <Action label='Load more conversations' disabled={busy} onPress={() => void load(true)} />}</>}
    />
  </View>
}

function ChatSession({ client }: { client: IdentityClient }) {
  const { colors } = useTheme(), insets = useSafeAreaInsets(), dispatch = useAppDispatch(), router = useRouter()
  const params = useLocalSearchParams<{ conversation?: string | string[] }>()
  const selected = typeof params.conversation === 'string' && params.conversation ? params.conversation : null
  const controller = useMemo(() => new ContinuityStateController(client), [client])
  const [state, setState] = useState(controller.snapshot())
  const [input, setInput] = useState('')
  const listRef = useRef<FlatList<StoredMessage>>(null), followEnd = useRef(true)
  const layer = Math.max(1, Math.min(6, useAppSelector(s => s.ui.layer)))
  const mode = useAppSelector(s => s.ui.mode) as Mode, accent = MODE_ACCENT[mode]
  const pendingKey = state.unresolvedKey || state.requests.find(r => r.status === 'pending')?.clientRequestId
  const isThinking = state.sending || state.requests.some(r => r.status === 'pending')
  const blocked = !!pendingKey || state.sending || state.loading || !state.conversation

  useEffect(() => { const unsubscribe = controller.subscribe(setState); return () => { unsubscribe(); controller.dispose(); dispatch(setThinking(false)) } }, [controller, dispatch])
  useEffect(() => { setInput(''); followEnd.current = true; void controller.open(selected) }, [controller, selected])
  useEffect(() => { dispatch(setThinking(isThinking)) }, [dispatch, isThinking])
  // Bounded GET reconciliation only. A network uncertainty never triggers POST.
  useEffect(() => {
    if (!pendingKey || state.sending) return
    let attempts = 0
    const timer = setInterval(() => { if (++attempts > 18) { clearInterval(timer); return }; void controller.reconcile() }, 2000)
    return () => clearInterval(timer)
  }, [controller, pendingKey, state.sending])
  const open = (id: string | null) => { Keyboard.dismiss(); router.setParams({ conversation: id || '' }) }
  const scrollToEnd = () => { if (followEnd.current) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false })) }
  const onSend = () => { const submitted = input; followEnd.current = true; void controller.send(submitted, () => setInput(current => current === submitted ? '' : current)) }

  return <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]} behavior='padding' keyboardVerticalOffset={0}>
    {/* B1: custom header owns top/sides, tab navigator owns bottom; one IME adjustment. */}
    <View style={styles.readingWidth}>
      <View style={[styles.header, { borderBottomColor: 'rgba(255,255,255,0.06)' }]}>
        <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.headerMeta}>SAVED HISTORY · LIMITED MODEL CONTEXT</Text><Text style={[styles.headerTitle, { color: accent }]}>L{layer} · {MODE_LABEL[mode]} CHAT</Text></View>
        <View style={styles.headerRight}>
          <Pressable accessibilityRole='button' accessibilityLabel='Decrease layer' onPress={() => dispatch(decLayer())} style={styles.layerBtn}><Text style={styles.layerBtnText}>−</Text></Pressable>
          <Pressable accessibilityRole='button' accessibilityLabel='Increase layer' onPress={() => dispatch(incLayer())} style={styles.layerBtn}><Text style={styles.layerBtnText}>+</Text></Pressable>
        </View>
      </View>
      {!selected ? <ConversationList client={client} onOpen={id => open(id)} /> : <>
        <View style={styles.navRow}><Action label='Conversations' onPress={() => open(null)} /><Text numberOfLines={1} style={[styles.conversationTitle, { flex: 1, minWidth: 0 }]}>{state.conversation?.title || 'Conversation'}</Text></View>
        <FlatList ref={listRef} data={state.messages} keyExtractor={m => m.id} style={styles.stream} contentContainerStyle={styles.streamContent}
          keyboardShouldPersistTaps='handled' automaticallyAdjustKeyboardInsets={false} contentInsetAdjustmentBehavior='never' onContentSizeChange={scrollToEnd}
          onScrollBeginDrag={() => { followEnd.current = false }}
          onScroll={({ nativeEvent: e }) => { followEnd.current = e.contentSize.height - e.layoutMeasurement.height - e.contentOffset.y < 60 }} scrollEventThrottle={100}
          ListHeaderComponent={state.nextCursor ? <Action label='Load earlier messages' disabled={state.loading} onPress={() => { followEnd.current = false; void controller.older() }} /> : null}
          renderItem={({ item: m }) => { const r = state.requests.find(r => r.turnId === m.turnId); return <View style={{ marginBottom: 18 }}>{m.role === 'assistant' ? <AIBlock text={m.text} /> : <UserLine text={m.text} />}{m.role === 'user' && r && r.status !== 'completed' && <Text style={styles.caption}>{requestLabel(r)}</Text>}</View> }}
          ListEmptyComponent={!state.loading && !state.error ? <Text style={styles.caption}>Send a message to begin. Your draft stays on this screen until you send it.</Text> : null}
          ListFooterComponent={<View style={{ paddingBottom: 16 }}>
            {state.loading && <ActivityIndicator color={accent} accessibilityLabel='Loading messages' />}
            {state.sending && <Text accessibilityLiveRegion='polite' style={styles.caption}>Sending… Waiting for the server receipt.</Text>}
            {!!state.error && <Text accessibilityRole='alert' style={styles.error}>{state.error}</Text>}
            {!!pendingKey && !state.sending && <Action label={state.checking ? 'Checking status…' : 'Check status'} disabled={state.checking} onPress={() => void controller.reconcile()} />}
            {state.canRecoverOriginal && <Action label='Recover original request' disabled={state.sending || state.checking || state.loading} onPress={() => void controller.recoverOriginal()} />}
            {!!state.error && <Action label='Reload conversation' disabled={state.loading || state.sending} onPress={() => void controller.open(selected)} />}
          </View>}
        />
        <View style={styles.suggestionsRow}>{suggestions.map(s => <Pressable key={s.mode} accessibilityRole='button' accessibilityState={{ selected: s.mode === mode }} onPress={() => dispatch(setMode(s.mode))} style={[styles.chip, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: s.mode === mode ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)' }]}><Text style={[styles.chipText, { color: 'rgba(230,232,240,0.95)' }]}>{s.label}</Text></Pressable>)}</View>
        <View style={[styles.inputBar, { borderTopColor: 'rgba(255,255,255,0.06)' }]}>
          <TextInput accessibilityLabel='Message' value={input} onChangeText={setInput} placeholder='Enter thought…' placeholderTextColor='#9CA3AF' style={styles.input} maxLength={4000} multiline returnKeyType='default' blurOnSubmit={false} />
          <Pressable accessibilityRole='button' accessibilityLabel='Send message' accessibilityState={{ disabled: blocked || !input.trim() }} onPress={onSend} disabled={blocked || !input.trim()} style={({ pressed }) => [styles.sendBtn, { backgroundColor: accent, opacity: blocked || !input.trim() ? 0.35 : pressed ? 0.9 : 1 }]}><Text style={styles.sendText}>SEND</Text></Pressable>
        </View>
      </>}
    </View>
  </KeyboardAvoidingView>
}

function AIBlock({ text }: { text: string }) {
  return (
    <View
      style={[
        styles.aiBlock,
        {
          borderColor: 'rgba(255,255,255,0.06)'
        }
      ]}
    >
      <Text style={[styles.aiTag, { color: MODE_ACCENT.insight }]}>
        ASSISTANT · SAVED
      </Text>

      <Text selectable style={styles.aiText}>
        {text}
      </Text>
    </View>
  )
}

function UserLine({ text }: { text: string }) {
  return (
    <View style={styles.userLine}>
      <Text selectable style={styles.userText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  readingWidth: { flex: 1, minHeight: 0, width: '100%', maxWidth: 860, alignSelf: 'center' },
  action: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, justifyContent: 'center', borderRadius: 12 },
  actionText: { color: '#C6ADFF', fontSize: 14, fontWeight: '700' },
  navRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: 6, flexShrink: 0, gap: 4 },
  listHeading: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 8 },
  listTitle: { color: '#E6E8F0', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  caption: { color: '#ACB4C5', fontSize: 12, lineHeight: 18, marginTop: 6 },
  error: { color: '#FFB4AB', lineHeight: 22, marginVertical: 12 },
  conversationRow: { minHeight: 72, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  conversationTitle: { color: '#E6E8F0', fontSize: 15, fontWeight: '600' },

  header: {
    flexShrink: 0,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end'
  },
  headerMeta: {
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

  stream: { flex: 1, minHeight: 0 },
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

  suggestionsRow: { flexShrink: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingBottom: 10 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1
  },
  chipText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },

  inputBar: {
    flexShrink: 0,
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
