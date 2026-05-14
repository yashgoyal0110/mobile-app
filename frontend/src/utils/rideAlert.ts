/**
 * Driver ride-alert sound + vibration.
 *
 * Plays a looping notification sound and vibrates the device when a new
 * ride request arrives while the driver app is in the foreground. Falls
 * back gracefully (vibration only) if audio fails to load.
 */
import { Platform, Vibration } from "react-native";
import { Audio } from "expo-av";

let cachedSound: Audio.Sound | null = null;
let playing = false;
let stopTimer: ReturnType<typeof setTimeout> | null = null;

async function getSound(): Promise<Audio.Sound | null> {
  if (cachedSound) return cachedSound;
  try {
    if (Platform.OS !== "web") {
      // Configure audio so it plays even in silent mode (iOS) and respects
      // the user's media volume on Android.
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    }
    const { sound } = await Audio.Sound.createAsync(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("../../assets/sounds/ride_alert.mp3"),
      { isLooping: true, volume: 1.0 }
    );
    cachedSound = sound;
    return sound;
  } catch {
    return null;
  }
}

/**
 * Start playing the alert (loops until stopped or `maxDurationMs` elapses).
 */
export async function startRideAlert(maxDurationMs = 20000) {
  if (playing) return;
  playing = true;
  // Vibrate for the duration (Android only — iOS ignores duration but pulses)
  try {
    if (Platform.OS === "android") {
      Vibration.vibrate([0, 600, 250, 600, 250, 600, 250, 600], true);
    } else {
      Vibration.vibrate(1500);
    }
  } catch {}
  const sound = await getSound();
  if (sound) {
    try {
      await sound.setPositionAsync(0);
      await sound.playAsync();
    } catch {}
  }
  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = setTimeout(() => stopRideAlert(), maxDurationMs);
}

/** Immediately stop the alert (call when driver accepts / dismisses ride). */
export async function stopRideAlert() {
  playing = false;
  try {
    Vibration.cancel();
  } catch {}
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  if (cachedSound) {
    try {
      await cachedSound.stopAsync();
    } catch {}
  }
}

/** Release audio resources (call on driver logout / unmount). */
export async function disposeRideAlert() {
  await stopRideAlert();
  if (cachedSound) {
    try {
      await cachedSound.unloadAsync();
    } catch {}
    cachedSound = null;
  }
}
