import { Platform } from 'react-native'

// Dara Signature Palette
const DARA = {
  bg: '#0B0F1A',
  surface: 'rgba(255,255,255,0.06)',
  glass: 'rgba(255,255,255,0.12)',
  primary: '#5A6CFF',
  secondary: '#52E3FF',
  insight: '#AA7CFF',
  textPrimary: '#E6E8F0',
  textSecondary: '#9CA3AF'
}

export const Colors = {
  light: {
    // If you ever enable light mode, keep it calm and neutral.
    text: '#11181C',
    background: '#FFFFFF',
    tint: DARA.primary,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: DARA.primary,

    bg: '#FFFFFF',
    surface: 'rgba(0,0,0,0.04)',
    primary: DARA.primary,
    secondary: DARA.secondary,
    insight: DARA.insight,
    textPrimary: '#11181C',
    textSecondary: '#6B7280'
  },

  dark: {
    // Dara Dark-first
    text: DARA.textPrimary,
    background: DARA.bg,
    tint: DARA.secondary,
    icon: 'rgba(230,232,240,0.75)',
    tabIconDefault: 'rgba(230,232,240,0.45)',
    tabIconSelected: DARA.secondary,

    bg: DARA.bg,
    surface: DARA.surface,
    glass: DARA.glass,
    primary: DARA.primary,
    secondary: DARA.secondary,
    insight: DARA.insight,
    textPrimary: DARA.textPrimary,
    textSecondary: DARA.textSecondary
  }
}

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace'
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace'
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
  }
})
