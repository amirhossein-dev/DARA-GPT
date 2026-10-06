import { IconSymbol } from '@/components/ui/icon-symbol'
import { useTheme } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Dimensions, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useAppSelector } from '../redux/hooks'

const { width } = Dimensions.get('window')

type Card = { key: string; title: string; subtitle: string; href: string; icon: string }
export default function HomeScreen() {
  const { colors } = useTheme()
  const layer = useAppSelector((s) => s.ui.layer)
  const mode = useAppSelector((s) => s.ui.mode)

  const cards: Card[] = useMemo(
    () => [
      { key: 'dialogue', title: 'Inner Dialogue', subtitle: 'Conscious chat', href: '/chat', icon: 'bubble.left.and.bubble.right.fill' },
      { key: 'terminal', title: 'Terminal', subtitle: 'Text-based stream', href: '/chat', icon: 'terminal.fill' },
      { key: 'memory', title: 'Memory Field', subtitle: 'Persistent context', href: '/chat', icon: 'memorychip' },
      { key: 'calendar', title: 'Calendar', subtitle: 'Thought reminders', href: '/calendar', icon: 'calendar' },
      { key: 'personality', title: 'Personality Map', subtitle: 'Growth vectors', href: '/personality', icon: 'chart.pie.fill' },
      { key: 'plans', title: 'Plans', subtitle: 'Unlock depth', href: '/plans', icon: 'sparkles' }
    ],
    []
  )

  // ------------------------------------------------------------
  // ANIMATION: Main Pulse
  // ------------------------------------------------------------
  const breath = useRef(new Animated.Value(0)).current
  const focusScale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 3500,
          easing: Easing.bezier(0.42, 0, 0.58, 1),
          useNativeDriver: true
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 3500,
          easing: Easing.bezier(0.42, 0, 0.58, 1),
          useNativeDriver: true
        })
      ])
    )
    breathe.start()
  }, [])

  const auraScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] })
  const auraOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.25] })
  const coreScale = breath.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.0] })
  const coreGlow = breath.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] })

  const handlePressIn = () => {
    Animated.timing(focusScale, { toValue: 0.95, duration: 200, useNativeDriver: true }).start()
  }
  const handlePressOut = () => {
    Animated.timing(focusScale, { toValue: 1, duration: 400, useNativeDriver: true }).start()
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={StyleSheet.absoluteFillObject} pointerEvents='none' />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.greeting}>WELCOME BACK</Text>
          <Text style={styles.name}>Amirhossein</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.statusText, { color: colors.primary }]}>
              L{layer} · {String(mode).toUpperCase()} FIELD ACTIVE
            </Text>
          </View>
        </View>

        <View style={styles.pulseContainer}>
          <Animated.View style={{ transform: [{ scale: focusScale }] }}>
            <Animated.View
              style={[
                styles.aura,
                {
                  transform: [{ scale: auraScale }],
                  opacity: auraOpacity,
                  backgroundColor: colors.primary
                }
              ]}
            />
            <Animated.View
              style={[
                styles.core,
                {
                  transform: [{ scale: coreScale }],
                  backgroundColor: 'rgba(82,227,255,0.1)',
                  borderColor: 'rgba(82,227,255,0.3)',
                  opacity: coreGlow
                }
              ]}
            >
              <LinearGradient colors={['rgba(255,255,255,0.15)', 'transparent']} style={StyleSheet.absoluteFill} />
            </Animated.View>
          </Animated.View>
        </View>

        <View style={styles.grid}>
          {cards.map((c) => (
            <GlassCard key={c.key} item={c} onPressInGlobal={handlePressIn} onPressOutGlobal={handlePressOut} />
          ))}
        </View>

        <View style={styles.insightStrip}>
          <LinearGradient colors={['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']} style={StyleSheet.absoluteFill} />
          <View style={styles.insightHeader}>
            <IconSymbol name='sparkles' size={12} color={colors.primary} />
            <Text style={[styles.insightTitle, { color: colors.primary }]}>INSIGHT READY</Text>
          </View>
          <Text style={styles.insightBody}>Memory loaded. The field is stable. Choose a vector to begin.</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <LinearGradient colors={['transparent', colors.background]} style={styles.footerGradient} pointerEvents='none' />

        <PortalButton label='ENTER FIELD' onPress={() => router.push('/chat')} primaryColor={colors.primary} />

        <Text style={styles.footerNote}>calm interface · no pressure · depth selectable</Text>
      </View>
    </View>
  )
}

// ------------------------------------------------------------
// COMPONENT: Portal Button (0.5s Delay)
// ------------------------------------------------------------
const PortalButton = ({ label, onPress, primaryColor }: { label: string; onPress: () => void; primaryColor: string }) => {
  const [loading, setLoading] = useState(false)

  // -- Animations --
  const containerScale = useRef(new Animated.Value(1)).current
  const innerScaleX = useRef(new Animated.Value(1)).current
  const innerScaleY = useRef(new Animated.Value(1)).current

  const borderOpacity = useRef(new Animated.Value(0.3)).current
  const textOpacity = useRef(new Animated.Value(1)).current

  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null)

  // 1. IDLE BREATHING
  useEffect(() => {
    startBreathing()
    return () => stopBreathing()
  }, [])

  const startBreathing = () => {
    borderOpacity.setValue(0.3)

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(borderOpacity, {
          toValue: 0.6,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(borderOpacity, {
          toValue: 0.3,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    )

    pulseLoop.current = loop
    loop.start()
  }

  const stopBreathing = () => {
    if (pulseLoop.current) {
      pulseLoop.current.stop()
      pulseLoop.current = null
    }
  }

  // 2. INTERACTION HANDLER
  const handlePress = () => {
    if (loading) return
    setLoading(true)

    stopBreathing()

    // 3. EXECUTE CHARGE SEQUENCE
    Animated.parallel([
      // A. Max Brightness
      Animated.timing(borderOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true
      }),
      // B. Inner Thicken (Independent Axes)
      Animated.timing(innerScaleX, {
        toValue: 0.985,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }),
      Animated.timing(innerScaleY, {
        toValue: 0.93,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }),
      // C. Dim Text Focus
      Animated.timing(textOpacity, {
        toValue: 0.6,
        duration: 200,
        useNativeDriver: true
      }),
      // D. Physical Compression
      Animated.timing(containerScale, {
        toValue: 0.98,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      })
    ]).start()

    // 4. DELAY & NAVIGATE (Reduced to 0.5s)
    setTimeout(() => {
      onPress()

      // Reset Logic
      setTimeout(() => {
        setLoading(false)
        Animated.parallel([
          Animated.spring(containerScale, { toValue: 1, useNativeDriver: true }),
          Animated.spring(innerScaleX, { toValue: 1, useNativeDriver: true }),
          Animated.spring(innerScaleY, { toValue: 1, useNativeDriver: true }),
          Animated.timing(textOpacity, { toValue: 1, duration: 300, useNativeDriver: true })
        ]).start(() => startBreathing())
      }, 500)
    }, 500) // <--- Changed from 750 to 500
  }

  const handlePressIn = () => {
    // Allows glitchy overlap (Easter Egg)
    Animated.timing(containerScale, { toValue: 0.98, duration: 100, useNativeDriver: true }).start()
  }

  const handlePressOut = () => {
    // Allows glitchy overlap (Easter Egg preserved)
    Animated.timing(containerScale, { toValue: 1, duration: 300, useNativeDriver: true }).start()
  }

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handlePress} style={styles.portalWrapper}>
      <Animated.View
        style={[
          styles.portalContainer,
          {
            transform: [{ scale: containerScale }]
          }
        ]}
      >
        {/* Gradient Background (Border Color) */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: borderOpacity }]}>
          <LinearGradient colors={[primaryColor, 'transparent', primaryColor]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>

        {/* Inner Surface (The "Black Hole") */}
        <View style={{ flex: 1, padding: 1.5, width: '100%', height: '100%' }}>
          <Animated.View style={[styles.portalSurface, { transform: [{ scaleX: innerScaleX }, { scaleY: innerScaleY }] }]}>
            <Animated.Text style={[styles.portalLabel, { opacity: textOpacity }]}>{label}</Animated.Text>
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  )
}

// ------------------------------------------------------------
// COMPONENT: Glass Card
// ------------------------------------------------------------
const GlassCard = ({ item, onPressInGlobal, onPressOutGlobal }: { item: Card; onPressInGlobal: () => void; onPressOutGlobal: () => void }) => {
  const scale = useRef(new Animated.Value(1)).current

  const onPressIn = () => {
    onPressInGlobal()
    Animated.timing(scale, { toValue: 0.96, duration: 150, useNativeDriver: true }).start()
  }

  const onPressOut = () => {
    onPressOutGlobal()
    Animated.timing(scale, { toValue: 1, duration: 300, useNativeDriver: true }).start()
  }

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={() => router.push(item.href as any)} style={styles.cardWrapper}>
      <Animated.View style={[styles.cardContainer, { transform: [{ scale }] }]}>
        <LinearGradient colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.cardShine} />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
        </View>
      </Animated.View>
    </Pressable>
  )
}

// ------------------------------------------------------------
// STYLES
// ------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 140
  },
  header: {
    marginBottom: 40
  },
  greeting: {
    color: 'rgba(230,232,240,0.5)',
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '600',
    marginBottom: 8
  },
  name: {
    color: '#E6E8F0',
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: -0.5
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5
  },
  pulseContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    marginBottom: 40
  },
  aura: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -30,
    left: -30
  },
  core: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    overflow: 'hidden'
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  cardWrapper: {
    width: '48%',
    marginBottom: 16
  },
  cardContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    height: 110,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  cardShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)'
  },
  cardContent: {
    padding: 16,
    justifyContent: 'flex-end',
    flex: 1
  },
  cardTitle: {
    color: '#E6E8F0',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4
  },
  cardSubtitle: {
    color: 'rgba(156,163,175,0.8)',
    fontSize: 12
  },
  insightStrip: {
    marginTop: 12,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden'
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  insightTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginLeft: 6
  },
  insightBody: {
    color: 'rgba(230,232,240,0.7)',
    fontSize: 13,
    lineHeight: 20
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 20
  },
  footerGradient: {
    position: 'absolute',
    top: -40,
    left: 0,
    right: 0,
    bottom: 0
  },
  footerNote: {
    color: 'rgba(156,163,175,0.5)',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 16,
    letterSpacing: 0.5
  },
  // Portal Button Styles
  portalWrapper: {
    width: '100%',
    height: 60,
    justifyContent: 'center',
    alignItems: 'center'
  },
  portalContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 30, // Pill shape
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.2)'
  },
  portalSurface: {
    flex: 1,
    backgroundColor: '#0F131E',
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center'
  },
  portalLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2.0
  }
})
