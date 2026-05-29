import { useState, useCallback, useRef, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

export type SpeechStatus = 'idle' | 'recording' | 'error';
export type SpeechLang = 'mr-IN' | 'en-IN';

export interface SpeechState {
  finalText: string;
  interimText: string;
  status: SpeechStatus;
  errorMessage: string | null;
  canUndo: boolean;
  currentLang: SpeechLang;
}

export interface SpeechControls {
  start: () => Promise<void>;
  stop: () => void;
  clear: () => void;
  appendText: (text: string) => void;
  undoLastSegment: () => void;
  setLang: (lang: SpeechLang) => void;
}

const QUESTION_WORDS = ['का', 'कसे', 'कुठे', 'काय', 'कोण', 'केव्हा', 'कधी'];
const EXCLAMATION_WORDS = ['अरे', 'वा'];

function applyPunctuation(transcript: string, lang: SpeechLang): string {
  const trimmed = transcript.trimEnd();
  if (!trimmed) return trimmed;
  if (lang !== 'mr-IN') {
    if (/[.?!]$/.test(trimmed)) return trimmed;
    return trimmed + '.';
  }
  if (/[।.?!,]$/.test(trimmed)) return trimmed;
  const words = trimmed.split(/\s+/);
  if (words.some(w => QUESTION_WORDS.includes(w))) return trimmed + '?';
  if (words.length <= 3 && EXCLAMATION_WORDS.some(w => trimmed.includes(w))) return trimmed + '!';
  return trimmed + '.';
}

export function useSpeech(): SpeechState & SpeechControls {
  const [finalText, setFinalText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [currentLang, setCurrentLangState] = useState<SpeechLang>('mr-IN');

  const accumulatedRef = useRef('');
  const undoStackRef = useRef<string[]>([]);
  const wantsActiveRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentLangRef = useRef<SpeechLang>('mr-IN');

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  useSpeechRecognitionEvent('start', () => {
    setStatus('recording');
    setErrorMessage(null);
  });

  useSpeechRecognitionEvent('end', () => {
    setInterimText('');
    if (wantsActiveRef.current) {
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        if (wantsActiveRef.current) {
          ExpoSpeechRecognitionModule.start({ lang: currentLangRef.current, interimResults: true, continuous: true });
        }
      }, 150);
    } else {
      setStatus('idle');
    }
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript ?? '';
    if (event.isFinal) {
      undoStackRef.current = [...undoStackRef.current, accumulatedRef.current];
      const punctuated = applyPunctuation(transcript, currentLangRef.current);
      const appended = accumulatedRef.current + punctuated + ' ';
      accumulatedRef.current = appended;
      setFinalText(appended);
      setCanUndo(true);
      setInterimText('');
    } else {
      setInterimText(transcript);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'no-speech') {
      setInterimText('');
      return;
    }
    wantsActiveRef.current = false;
    clearRestartTimer();
    setStatus('error');
    setInterimText('');

    const msgs: Record<string, string> = {
      'not-allowed':         'मायक्रोफोन परवानगी नाकारली गेली. सेटिंग्जमध्ये परवानगी द्या.',
      'service-not-allowed': 'भाषण सेवेला परवानगी नाही. सेटिंग्जमध्ये परवानगी द्या.',
      'network':             'नेटवर्क त्रुटी. इंटरनेट कनेक्शन तपासा.',
      'audio-capture':       'मायक्रोफोन उपलब्ध नाही. दुसरे ॲप बंद करा.',
    };
    setErrorMessage(msgs[event.error] ?? `त्रुटी: ${event.error}`);
  });

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState !== 'active' && wantsActiveRef.current) {
        wantsActiveRef.current = false;
        clearRestartTimer();
        ExpoSpeechRecognitionModule.abort();
        setStatus('idle');
        setInterimText('');
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [clearRestartTimer]);

  useEffect(() => {
    return () => {
      wantsActiveRef.current = false;
      clearRestartTimer();
      ExpoSpeechRecognitionModule.abort();
    };
  }, [clearRestartTimer]);

  const start = useCallback(async () => {
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      setErrorMessage('मायक्रोफोन परवानगी नाकारली गेली. सेटिंग्जमध्ये परवानगी द्या.');
      setStatus('error');
      return;
    }
    setErrorMessage(null);
    wantsActiveRef.current = true;
    ExpoSpeechRecognitionModule.start({ lang: currentLangRef.current, interimResults: true, continuous: true });
  }, []);

  const stop = useCallback(() => {
    wantsActiveRef.current = false;
    clearRestartTimer();
    ExpoSpeechRecognitionModule.stop();
  }, [clearRestartTimer]);

  const clear = useCallback(() => {
    accumulatedRef.current = '';
    undoStackRef.current = [];
    setFinalText('');
    setInterimText('');
    setErrorMessage(null);
    setCanUndo(false);
    if (status === 'error') setStatus('idle');
  }, [status]);

  const appendText = useCallback((text: string) => {
    accumulatedRef.current = text;
    undoStackRef.current = [];
    setFinalText(text);
    setCanUndo(false);
  }, []);

  const undoLastSegment = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const previous = stack[stack.length - 1];
    undoStackRef.current = stack.slice(0, -1);
    accumulatedRef.current = previous;
    setFinalText(previous);
    setCanUndo(stack.length - 1 > 0);
  }, []);

  const setLang = useCallback((lang: SpeechLang) => {
    currentLangRef.current = lang;
    setCurrentLangState(lang);
    // If recording, stop — the 'end' handler will auto-restart with new lang
    if (wantsActiveRef.current) {
      ExpoSpeechRecognitionModule.stop();
    }
  }, []);

  return { finalText, interimText, status, errorMessage, canUndo, currentLang, start, stop, clear, appendText, undoLastSegment, setLang };
}
