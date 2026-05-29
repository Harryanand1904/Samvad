import AsyncStorage from '@react-native-async-storage/async-storage';
import { SpeechLang } from '../hooks/useSpeech';

export interface Session {
  id: string;
  title: string;
  text: string;
  language: SpeechLang;
  createdAt: number;
  wordCount: number;
}

const STORAGE_KEY = 'samvad_sessions';
const MAX_SESSIONS = 50;

export function createSession(text: string, language: SpeechLang): Session {
  const trimmed = text.trim();
  const title = trimmed.length > 30 ? trimmed.slice(0, 30) + '…' : trimmed || 'अनाम सत्र';
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    text: trimmed,
    language,
    createdAt: Date.now(),
    wordCount: trimmed ? trimmed.split(/\s+/).length : 0,
  };
}

export async function loadSessions(): Promise<Session[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveSession(session: Session): Promise<void> {
  const existing = await loadSessions();
  const updated = [session, ...existing].slice(0, MAX_SESSIONS);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export async function deleteSession(id: string): Promise<void> {
  const existing = await loadSessions();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existing.filter(s => s.id !== id)));
}
