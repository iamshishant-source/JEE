# JEE Pilot Android app

JEE Pilot is a local-first Android study companion built around safe accountability:

- **Commitment mode:** a focused 25-minute session with an explicit, safe exit.
- **Adaptive plan:** the lowest mastery topics automatically become today's mission.
- **Progress map:** tap a topic after honest revision to update its mastery.
- **Study log:** completed focus sessions and tasks stay on the device.

## Build the APK

Open this folder in Android Studio (Hedgehog or newer), let Gradle sync, then choose **Build > Build APK(s)**. The generated debug APK will be under `app/build/outputs/apk/debug/`.

This environment does not include Java, Gradle, or the Android SDK, so the APK cannot be compiled here. The project is intentionally dependency-free beyond the Android Gradle plugin.
