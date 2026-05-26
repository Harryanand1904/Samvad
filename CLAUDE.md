# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

```
samvad/
├── index.html          # Original single-file web app (kept for reference)
└── mobile/             # React Native / Expo mobile app (iOS + Android)
    ├── App.tsx         # Single screen; UI state and animations
    ├── index.ts        # Expo entry point (registerRootComponent)
    ├── app.json        # Expo config, plugin declarations, permission strings
    ├── src/
    │   ├── hooks/useSpeech.ts   # All speech recognition logic
    │   └── theme.ts             # Colors, font size constants, FONT_PRESETS
    └── package.json
```

---

## Web app (`index.html`)

Zero-dependency single-file Marathi speech-to-text PWA. Serve over localhost (not `file://`):

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

**Chrome/Edge only** — `webkitSpeechRecognition` is unavailable in Firefox.

---

## Mobile app (`mobile/`)

**Stack:** Expo SDK 56 · React Native 0.85 · TypeScript · `expo-speech-recognition` · `expo-clipboard` · Noto Sans Devanagari

> **Expo version note:** Always consult the versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing Expo-specific code — APIs change significantly between SDK versions.

### Dev commands

```bash
cd mobile

npx expo start              # start Metro + show QR for Expo Go / dev build
npx expo run:ios            # build and launch on iOS simulator (requires Xcode)
npx expo run:android        # build and launch on Android emulator (requires Android Studio)
npx tsc --noEmit            # type-check only
```

> **iOS simulator note:** `expo-speech-recognition` requires a real device for speech — the simulator has no mic input. Use `npx expo run:ios --device` to target a physical iPhone.

> **Android note:** On Android < 13, the OS ends the recognition session after ~5 s of silence. The `useSpeech` hook auto-restarts within 150 ms via `wantsActiveRef` so the user does not need to tap again.

### Building for release (EAS)

```bash
npm install -g eas-cli
eas login
eas build --platform ios      # requires Apple Developer account
eas build --platform android  # produces .aab for Play Store
```

### Architecture

**`App.tsx`** — single screen. Owns font loading (blocks rendering until Noto Sans Devanagari is ready — shows a Marathi loading text while waiting), UI state (`fontSize`, `copyLabel`, `isStarting`), and the mic pulse animation. Delegates all speech state to `useSpeech`. Renders four stacked sections: header → mic bar → scrollable text area → font preset bar.

Key non-obvious behaviors in `App.tsx`:
- `isStarting` guards against double-tap while the async permission dialog is open — `handleMicPress` returns early if `true`.
- The pulse animation is stopped via a `useEffect` that watches `status !== 'recording'`, covering all exit paths (permission denial, errors, background transition).
- The text area uses `TextInput` (not `Text`) so the user can manually edit the transcript. `onChangeText` calls `appendText`, which clears the undo stack since the snapshot is no longer meaningful.

**`src/hooks/useSpeech.ts`** — all speech recognition logic:
- Calls `ExpoSpeechRecognitionModule.requestPermissionsAsync()` before first start (triggers OS dialog on first use).
- Accumulates final transcript in `accumulatedRef` (a ref, not state) to avoid stale-closure bugs in event handlers; mirrors it into `finalText` state for rendering.
- `wantsActiveRef` distinguishes "engine stopped naturally" from "user pressed stop" — when `true`, `onend` restarts the engine automatically within 150 ms.
- `undoStackRef` is a stack of prior `accumulatedRef` snapshots, pushed on each final `result` event. `undoLastSegment` pops it. Manual text edits (`appendText`) reset the stack.
- `no-speech` errors are silently ignored; all other errors flip `status` to `'error'` and surface a Marathi message.
- AppState listener stops the mic (via `abort()`) when the app moves to background — prevents background recording without user awareness.

**`src/theme.ts`** — color palette, font size constants, and `FONT_PRESETS` array. The color values exactly mirror the CSS custom properties in `index.html` — keep them in sync when updating colors.

**`app.json`** — declares `expo-speech-recognition` plugin with Marathi permission strings (injected into `Info.plist` on iOS and `AndroidManifest.xml` on Android automatically during `expo prebuild` / EAS build). Also sets `orientation: portrait`.
