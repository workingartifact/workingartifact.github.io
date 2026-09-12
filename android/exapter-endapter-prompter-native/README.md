# EXAPTER ENDAPTER Prompter — Native Overlay v0.1

A native Android prototype of the EXAPTER ENDAPTER teleprompter.

## Architecture

This build deliberately **does not capture camera or microphone audio itself**. It uses Android's application-overlay system to place the teleprompter above the **native Pixel Camera app**. Pixel Camera remains responsible for video resolution, stabilization, codec/bitrate, computational processing, and microphone capture.

The app itself requests **no camera or microphone permission**.

## Included in v0.1

- Local script storage
- Scroll speed
- Text size
- Prompt width
- Prompt vertical position
- Independent reading-line position
- Clear / light / dark prompt background
- None / 3 s / 5 s scroll countdown
- Optional 3 × 3 grid overlay
- Floating play/pause, reset, speed −/+, hide/show, close controls
- Draggable `EE` overlay handle
- Button to launch Pixel Camera directly in video mode
- Foreground service so the overlay remains alive while another app is in front
- No network requirement after installation

## Pixel 9 test flow

1. Install the debug APK.
2. Open **EXAPTER ENDAPTER Prompter**.
3. Allow notification permission so the active-overlay notification is visible.
4. Tap **Grant / manage overlay permission** and enable **Display over other apps**.
5. Paste the script and set the teleprompter controls.
6. Tap **Start overlay + open Pixel Camera**.
7. Pixel Camera should open in video mode with the teleprompter floating over it.
8. Drag the green `EE` handle to reposition the overlay manually if needed.
9. Record in Pixel Camera normally.
10. Use `×` in the overlay or **Stop overlay** in the app/notification when finished.

## Important note

The overlay is an Android window above Pixel Camera. Pixel Camera records the camera stream, not a screen recording, so the teleprompter overlay is not intended to be burned into the saved video.

## Build

Android Gradle Plugin 8.7.3, Gradle 8.9, compile/target SDK 35, Java 17.

```bash
gradle assembleDebug
```

Output: `app/build/outputs/apk/debug/app-debug.apk`

## License

MIT — Copyright (c) 2026 EXAPTER ENDAPTER LLC
