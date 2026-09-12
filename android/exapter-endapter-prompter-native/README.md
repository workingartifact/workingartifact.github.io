# EXAPTER ENDAPTER Prompter — Native Overlay v0.2

A native Android overlay teleprompter for the EXAPTER ENDAPTER recording workflow.

## Architecture

This app **does not capture camera or microphone audio itself**. It places a local Android overlay above the native Pixel Camera app. Pixel Camera remains responsible for resolution, stabilization, codec/bitrate, computational processing, and microphone capture. The prompter requests no camera or microphone permission.

## v0.2 interaction model

The overlay is now manipulated directly instead of being configured through geometry sliders:

- Drag the green `EE` handle to move the floating window.
- Drag the `↘` corner grip to resize the floating window in real time.
- Drag the green reading line itself up/down to reposition it.
- Use `− / +` in the floating bar to change scroll speed.
- Use `A− / A+` to change text size.
- Play/pause, reset, hide/show, and close remain available in the floating bar.
- Window geometry, speed, text size, and reading-line position persist locally.
- Clear / light / dark prompt background remains available in the launcher.
- None / 3 s / 5 s countdown remains available.
- Optional 3 × 3 grid remains available.

## Pixel 9 test flow

1. Install the debug APK over v0.1.
2. Open **EXAPTER ENDAPTER Prompter**.
3. Paste the script.
4. Tap **Start overlay + open Pixel Camera**.
5. Position and resize the floating prompt directly over Pixel Camera.
6. Use the floating controls to tune speed and text size while framing the shot.
7. Record in Pixel Camera normally.

## Build

Android Gradle Plugin 8.7.3, Gradle 8.9, compile/target SDK 35, Java 17.

```bash
gradle assembleDebug
```

Output: `app/build/outputs/apk/debug/app-debug.apk`

## License

MIT — Copyright (c) 2026 EXAPTER ENDAPTER LLC
