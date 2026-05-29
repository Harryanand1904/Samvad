import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Animated,
  Platform,
  Alert,
  Linking,
  KeyboardAvoidingView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import {
  useFonts,
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_500Medium,
  NotoSansDevanagari_700Bold,
} from '@expo-google-fonts/noto-sans-devanagari';

import { useSpeech } from './src/hooks/useSpeech';
import {
  colors,
  DEFAULT_FONT_SIZE,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  FONT_PRESETS,
} from './src/theme';
import { WaveformVisualizer } from './src/components/WaveformVisualizer';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { createSession, saveSession } from './src/storage/sessions';

export default function App() {
  const [fontsLoaded] = useFonts({
    NotoSansDevanagari_400Regular,
    NotoSansDevanagari_500Medium,
    NotoSansDevanagari_700Bold,
  });

  const { finalText, interimText, status, errorMessage, canUndo, currentLang, start, stop, clear, appendText, undoLastSegment, setLang } = useSpeech();
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [copyLabel, setCopyLabel] = useState('कॉपी');
  const [saveLabel, setSaveLabel] = useState('जतन');
  const [historyVisible, setHistoryVisible] = useState(false);
  // Prevents double-tap while the async permission dialog is open
  const [isStarting, setIsStarting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const startPulse = useCallback(() => {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseLoop.current?.stop();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  useEffect(() => {
    if (status !== 'recording') {
      stopPulse();
    }
  }, [status, stopPulse]);

  const handleMicPress = useCallback(async () => {
    if (status === 'recording') {
      stop();
    } else {
      if (isStarting) return;
      setIsStarting(true);
      startPulse();
      await start();
      setIsStarting(false);
    }
  }, [status, isStarting, start, stop, startPulse]);

  const handleCopy = useCallback(async () => {
    const text = finalText.trim();
    if (!text) return;
    await Clipboard.setStringAsync(text);
    setCopyLabel('✓ झाले');
    setTimeout(() => setCopyLabel('कॉपी'), 2000);
  }, [finalText]);

  const handleSave = useCallback(async () => {
    if (!finalText.trim()) return;
    const session = createSession(finalText, currentLang);
    await saveSession(session);
    setSaveLabel('✓ जतन');
    setTimeout(() => setSaveLabel('जतन'), 2000);
  }, [finalText, currentLang]);

  const handleClear = useCallback(() => {
    if (!finalText.trim() && !interimText) return;
    Alert.alert('मजकूर साफ करा', 'सर्व मजकूर हटवायचा आहे का?', [
      { text: 'रद्द करा', style: 'cancel' },
      {
        text: 'साफ करा',
        style: 'destructive',
        onPress: () => {
          if (status === 'recording') stop();
          clear();
        },
      },
    ]);
  }, [finalText, interimText, status, stop, clear]);

  const applyFontSize = useCallback((size: number) => {
    setFontSize(Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size)));
  }, []);

  const isRecording = status === 'recording';
  const micDisabled = isStarting;
  const hasText = finalText.trim().length > 0;
  const isMarathi = currentLang === 'mr-IN';
  const devFont = fontsLoaded ? 'NotoSansDevanagari_400Regular' : undefined;
  const devFontBold = fontsLoaded ? 'NotoSansDevanagari_700Bold' : undefined;
  const textFont = isMarathi ? devFont : undefined;

  const pillState: { label: string; bg: string; color: string; border: string } =
    isStarting
      ? { label: 'परवानगी मागत आहे…',    bg: colors.yellowBg,  color: colors.yellow,    border: colors.yellowBorder }
      : isRecording
      ? { label: isMarathi ? 'ऐकत आहे… बोला' : 'Listening… speak', bg: colors.redBg, color: colors.red, border: '#f0a9a4' }
      : status === 'error'
      ? { label: 'त्रुटी आली',             bg: colors.yellowBg,  color: colors.yellow,    border: colors.yellowBorder }
      : hasText
      ? { label: isMarathi ? 'झाले! मजकूर तयार ✓' : 'Done! Text ready ✓', bg: colors.greenBg, color: colors.green, border: '#9dcfb6' }
      : { label: isMarathi ? 'बोलण्यासाठी बटण दाबा' : 'Press button to speak', bg: colors.accentLight, color: colors.accentDeep, border: colors.border };

  if (!fontsLoaded) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textMuted, fontSize: 16 }}>लोड होत आहे…</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar style="dark" />

        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.headerTitle, { fontFamily: devFontBold }]}>मराठी वाचा</Text>
            <Text style={[styles.headerSub, { fontFamily: devFont }]}>बोलून टाइप करा · Speech to Text</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.historyBtn}
              onPress={() => setHistoryVisible(true)}
              accessibilityLabel="इतिहास"
            >
              <Text style={[styles.historyBtnText, { fontFamily: devFont }]}>📋 इतिहास</Text>
            </TouchableOpacity>
            <Text style={styles.om} accessibilityElementsHidden={true}>ॐ</Text>
          </View>
        </View>

        <KeyboardAvoidingView
          style={styles.flex1}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* ERROR BANNER */}
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Text style={[styles.bannerText, { fontFamily: devFont }]}>🚫 {errorMessage}</Text>
              <TouchableOpacity onPress={() => Linking.openSettings()}>
                <Text style={[styles.bannerLink, { fontFamily: devFont }]}>सेटिंग्ज उघडा →</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* MIC BAR */}
          <View style={styles.micBar}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={[styles.micBtn, isRecording && styles.micBtnRecording, micDisabled && styles.micBtnDisabled]}
                onPress={handleMicPress}
                disabled={micDisabled}
                activeOpacity={0.8}
                accessibilityLabel={isRecording ? 'बोलणे थांबवा' : 'बोलणे सुरू करा'}
                accessibilityRole="button"
              >
                <Text style={styles.micIcon}>{isRecording ? '⏹' : '🎙️'}</Text>
              </TouchableOpacity>
            </Animated.View>

            <WaveformVisualizer isActive={isRecording} color={isRecording ? colors.red : colors.accent} height={36} />

            <View style={styles.statusBlock}>
              <View style={[styles.statusPill, { backgroundColor: pillState.bg, borderColor: pillState.border }]}>
                <View style={[styles.statusDot, { backgroundColor: pillState.color }]} />
                <Text
                  style={[styles.statusText, { color: pillState.color, fontFamily: devFont }]}
                  numberOfLines={1}
                >
                  {pillState.label}
                </Text>
              </View>
              <View style={styles.micHintRow}>
                <Text style={[styles.micHint, { fontFamily: devFont }]}>
                  {isMarathi ? 'मराठीत बोला · आपोआप मजकूर होईल' : 'Speak in English · Text appears automatically'}
                </Text>
                <TouchableOpacity
                  style={[styles.langToggle, !isMarathi && styles.langToggleEn]}
                  onPress={() => setLang(isMarathi ? 'en-IN' : 'mr-IN')}
                  accessibilityLabel="भाषा बदला"
                >
                  <Text style={[styles.langToggleText, { fontFamily: isMarathi ? devFont : undefined }]}>
                    {isMarathi ? 'मराठी' : 'English'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* TEXT AREA */}
          <View style={styles.textWrap}>
            <View style={styles.textToolbar}>
              <Text style={[styles.tbarLabel, { fontFamily: devFontBold }]}>📝 मजकूर</Text>
              <View style={styles.tbarBtns}>
                <TouchableOpacity style={styles.tbtn} onPress={handleCopy} disabled={!hasText} activeOpacity={0.7}>
                  <Text style={[styles.tbtnText, !hasText && styles.tbtnDisabled, { fontFamily: devFont }]}>
                    {copyLabel}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tbtn} onPress={handleSave} disabled={!hasText} activeOpacity={0.7}>
                  <Text style={[styles.tbtnText, !hasText && styles.tbtnDisabled, { fontFamily: devFont }]}>
                    {saveLabel}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tbtn} onPress={undoLastSegment} disabled={!canUndo} activeOpacity={0.7}>
                  <Text style={[styles.tbtnText, !canUndo && styles.tbtnDisabled, { fontFamily: devFont }]}>
                    ↩ मागे
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tbtn, styles.tbtnDanger]} onPress={handleClear} disabled={!hasText && !interimText} activeOpacity={0.7}>
                  <Text style={[styles.tbtnText, !hasText && !interimText && styles.tbtnDisabled, { fontFamily: devFont }]}>
                    साफ
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.outputScroll}
              contentContainerStyle={styles.outputContent}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              keyboardShouldPersistTaps="handled"
            >
              <TextInput
                style={[styles.outputText, { fontSize, fontFamily: textFont, lineHeight: fontSize * 1.8 }]}
                value={finalText}
                onChangeText={appendText}
                multiline
                placeholder={isMarathi ? 'येथे भाषण मजकूर दिसेल…' : 'Speech text will appear here…'}
                placeholderTextColor={colors.textMuted}
                textAlignVertical="top"
                accessibilityLabel="ओळखलेला मजकूर"
              />
              {interimText ? (
                <Text style={[styles.interimText, { fontSize: fontSize * 0.82, fontFamily: textFont, lineHeight: fontSize * 1.5 }]}>
                  …{interimText}
                </Text>
              ) : null}
            </ScrollView>
          </View>

          {/* FONT BAR */}
          <View style={styles.fontBar}>
            <Text style={[styles.fontBarLabel, { fontFamily: devFont }]}>अक्षर:</Text>
            {FONT_PRESETS.map((p) => (
              <TouchableOpacity
                key={p.size}
                style={[styles.fsBtn, fontSize === p.size && styles.fsBtnActive]}
                onPress={() => applyFontSize(p.size)}
                activeOpacity={0.75}
              >
                <Text style={[
                  styles.fsBtnText,
                  { fontFamily: devFont },
                  fontSize === p.size && styles.fsBtnTextActive,
                ]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

        </KeyboardAvoidingView>

        <HistoryScreen visible={historyVisible} onClose={() => setHistoryVisible(false)} devFont={devFont} />

      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.accentDeep,
    lineHeight: 26,
  },
  headerSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  historyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  historyBtnText: {
    fontSize: 12,
    color: colors.accentDeep,
    fontWeight: '600',
  },
  om: {
    fontSize: 26,
    color: colors.accent,
    opacity: 0.65,
  },
  errorBanner: {
    backgroundColor: colors.redBg,
    borderBottomWidth: 1.5,
    borderBottomColor: '#f0a9a4',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 4,
  },
  bannerText: {
    fontSize: 13,
    color: colors.red,
    lineHeight: 18,
  },
  bannerLink: {
    fontSize: 13,
    color: colors.red,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  micBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
  },
  micBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios:     { shadowColor: colors.accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.38, shadowRadius: 6 },
      android: { elevation: 6 },
    }),
  },
  micBtnRecording: {
    backgroundColor: colors.red,
    ...Platform.select({
      ios:     { shadowColor: colors.red, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 6 },
      android: { elevation: 8 },
    }),
  },
  micBtnDisabled: {
    opacity: 0.5,
  },
  micIcon: {
    fontSize: 22,
  },
  statusBlock: {
    flex: 1,
    minWidth: 0,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
  micHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  micHint: {
    fontSize: 11,
    color: colors.textMuted,
    flex: 1,
  },
  langToggle: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.accentLight,
  },
  langToggleEn: {
    backgroundColor: '#e8f0fe',
    borderColor: '#b3c8f5',
  },
  langToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accentDeep,
  },
  textWrap: {
    flex: 1,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  textToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.accentLight,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
  },
  tbarLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentDeep,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tbarBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  tbtn: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  tbtnDanger: {
    borderColor: colors.border,
  },
  tbtnText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  tbtnDisabled: {
    opacity: 0.35,
  },
  outputScroll: {
    flex: 1,
  },
  outputContent: {
    padding: 16,
    flexGrow: 1,
  },
  outputText: {
    color: colors.textPrimary,
    minHeight: 80,
  },
  interimText: {
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  fontBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1.5,
    borderTopColor: colors.border,
  },
  fontBarLabel: {
    fontSize: 11,
    color: colors.textMuted,
    flexShrink: 0,
  },
  fsBtn: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 7,
    backgroundColor: colors.bg,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  fsBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accentDeep,
  },
  fsBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  fsBtnTextActive: {
    color: colors.white,
  },
});
