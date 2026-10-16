import React, { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import type { ResponseMode } from '../../redux/slices/uiSlice'

const layers = [1, 2, 3, 4, 5, 6] as const
type Layer = typeof layers[number]
export const MODE_LABEL: Record<ResponseMode, string> = { insight: 'INSIGHT', technical: 'TECHNICAL', narrative: 'NARRATIVE' }
const modes: { label: string; value: ResponseMode }[] = [
  { label: 'Deepen', value: 'insight' },
  { label: 'Structure', value: 'technical' },
  { label: 'Narrate', value: 'narrative' }
]

function Choice({ label, announcement = label, selected, onPress, style }: {
  label: string; announcement?: string; selected: boolean; onPress(): void; style?: StyleProp<ViewStyle>
}) {
  const [focused, setFocused] = useState(false)
  return <Pressable accessibilityRole='button' accessibilityLabel={announcement}
    accessibilityHint='Changes display only. Model requests stay the same.' accessibilityState={{ selected }}
    {...(Platform.OS === 'web' ? { 'aria-pressed': selected } : {})}
    onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={[styles.choice, style, selected && styles.selected, focused && styles.focused]}>
    <Text style={styles.label}>{label}</Text>
    <Text accessible={false} style={styles.selection}>{selected ? 'Selected' : ' '}</Text>
  </Pressable>
}

export function LayerPicker({ value, onChange }: { value: number; onChange(value: Layer): void }) {
  const { width } = useWindowDimensions()
  return <View style={styles.layerSection}>
    <View style={styles.row}>{layers.map(layer => <Choice key={layer} label={'L' + layer}
      selected={value === layer} onPress={() => onChange(layer)}
      style={[styles.layer, width < 380 && styles.narrowLayer]} />)}</View>
    <Text style={styles.caption}>L and mode are display choices only. Model requests stay the same.</Text>
  </View>
}

export function ModePicker({ value, onChange }: { value: ResponseMode; onChange(value: ResponseMode): void }) {
  return <View style={styles.modeRow}>{modes.map(mode => <Choice key={mode.value} label={mode.label}
    announcement={mode.label + ' · ' + MODE_LABEL[mode.value]} selected={value === mode.value}
    onPress={() => onChange(mode.value)} style={styles.mode} />)}</View>
}

const styles = StyleSheet.create({
  layerSection: { flexShrink: 0, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choice: { minWidth: 48, minHeight: 56, paddingHorizontal: 6, paddingVertical: 6, borderRadius: 12,
    borderWidth: 2, borderColor: '#334155', backgroundColor: '#151C29', alignItems: 'center', justifyContent: 'center' },
  selected: { borderColor: '#C6ADFF', backgroundColor: '#29233C' },
  focused: { borderColor: '#E6E8F0' },
  layer: { flexBasis: 48, flexGrow: 1 },
  narrowLayer: { flexBasis: '30%' },
  label: { color: '#E6E8F0', fontSize: 13, lineHeight: 18, fontWeight: '700', textAlign: 'center' },
  selection: { color: '#C6ADFF', fontSize: 10, lineHeight: 14, textAlign: 'center' },
  caption: { color: '#ACB4C5', fontSize: 12, lineHeight: 18, marginTop: 6 },
  modeRow: { flexShrink: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 18, paddingBottom: 8 },
  mode: { flexBasis: 80, flexGrow: 1 }
})
