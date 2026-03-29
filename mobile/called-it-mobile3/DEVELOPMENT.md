# Native development (Called It mobile)

## Vision Camera and Expo Go

`react-native-vision-camera` is a **native module**. It does **not** run in **Expo Go**.

1. Install a dev client: `npx expo prebuild` then `npx expo run:android` or `npx expo run:ios` (or use EAS Build).
2. Start Metro with: `npm run start:dev` (or `npx expo start --dev-client`).
3. Open the **development build** app on the device, not Expo Go.

## Windows: Android SDK, `adb`, and `ANDROID_HOME`

If you see `Failed to resolve the Android SDK path` or `'adb' is not recognized`:

1. Install [Android Studio](https://developer.android.com/studio) and open **SDK Manager**. Note the **Android SDK Location** (often `C:\Users\<you>\AppData\Local\Android\Sdk`).
2. Set environment variables (User or System):
   - `ANDROID_HOME` = that SDK path (e.g. `C:\Users\dunsi\AppData\Local\Android\Sdk`).
   - Add to **Path**: `%ANDROID_HOME%\platform-tools` (for `adb`) and optionally `%ANDROID_HOME%\emulator`.
3. Restart the terminal (and Cursor) so the new variables apply.
4. Run `npx expo run:android` or `npm run android:build` with a device or emulator running.

## Babel / worklets

Reanimated 4 pulls in `react-native-worklets`. Nested transforms expect these **devDependencies** (already in this project):

- `@babel/plugin-proposal-optional-chaining`
- `@babel/plugin-proposal-nullish-coalescing-operator`

If Metro reports a missing Babel plugin, run `npm install` in this folder and clear cache: `npx expo start --clear`.
