# Android SDK on Windows (for `expo run:android` and `a` in Expo CLI)

Expo uses **adb** and the **Android SDK** when you press **`a`** (open Android) or run **`npm run android:build`**. If you see:

- `Failed to resolve the Android SDK path`
- `'adb' is not recognized`

install the SDK and set environment variables.

## 1. Install Android Studio

Download from [developer.android.com/studio](https://developer.android.com/studio). In the installer, include **Android SDK** and **Android SDK Platform-Tools**.

## 2. Default SDK location

Usually:

`C:\Users\<You>\AppData\Local\Android\Sdk`

## 3. Set `ANDROID_HOME` (user env)

PowerShell (current session):

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
```

Persist for new terminals (run once in PowerShell):

```powershell
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
```

Then add to your **User** `Path`:

- `%LOCALAPPDATA%\Android\Sdk\platform-tools`
- `%LOCALAPPDATA%\Android\Sdk\emulator` (if you use emulators)

Restart the terminal (and Cursor) after changing user environment variables.

## 4. Verify

```powershell
adb version
```

## 5. Expo Go vs dev build

- **`npm start`** uses **`expo start --go`** so the QR code opens in **Expo Go**.
- **`npm run start:dev`** is for a **development build** (required for Vision Camera on device).
- Press **`a`** only works after the SDK and `adb` are on your PATH.
