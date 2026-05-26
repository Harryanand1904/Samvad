import { useState, useCallback, useRef, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

export type SpeechStatus = 'idle' | 'recording' | 'error';

export interface SpeechState {
  finalText: string;
  interimText: string;
  status: SpeechStatus;
  errorMessage: string | null;
  canUndo: boolean;
}

export interface SpeechControls {
  start: () => Promise<void>;
  stop: () => void;
  clear: () => void;
  appendText: (text: string) => void;
  undoLastSegment: () => void;
}

export function useSpeech(): SpeechState & SpeechControls {
  const [finalText, setFinalText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const accumulatedRef = useRef('');
  // Stack of previous accumulatedRef values — enables undo-last-segment
  const undoStackRef = useRef<string[]>([]);
  // Drives auto-restart: true means the user wants recognition active
  const wantsActiveRef = useRef(false);
  // Tracked so it can be cancelled on stop(), error, or unmount
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          ExpoSpeechRecognitionModule.start({ lang: 'mr-IN', interimResults: true, continuous: true });
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
      const appended = accumulatedRef.current + transcript + ' ';
      accumulatedRef.current = appended;
      setFinalText(appended);
      setCanUndo(true);
      setInterimText('');
    } else {
      setInterimText(transcript);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    // no-speech is non-fatal; auto-restart will handle it
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

  // Security: stop mic when app goes to background — prevents recording without user awareness
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

  // Cleanup on unmount
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
    ExpoSpeechRecognitionModule.start({ lang: 'mr-IN', interimResults: true, continuous: true });
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

  return { finalText, interimText, status, errorMessage, canUndo, start, stop, clear, appendText, undoLastSegment };
}
