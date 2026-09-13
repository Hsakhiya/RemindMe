const { withAndroidManifest, withMainActivity, withMainApplication, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const ALARM_MODULE_KOTLIN = `package com.remindme.app

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AlarmModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val TAG = "AlarmModule"
    private var ringtone: Ringtone? = null

    fun stopRingtone() {
      try {
        ringtone?.let {
          if (it.isPlaying) {
            it.stop()
          }
        }
        ringtone = null
      } catch (e: Throwable) {
        Log.w(TAG, "Error stopping ringtone statically", e)
      }
    }
  }

  override fun getName(): String = "AlarmModule"

  @ReactMethod
  fun playAlarmSound() {
    Handler(Looper.getMainLooper()).post {
      try {
        if (ringtone == null || ringtone?.isPlaying != true) {
          val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

          ringtone = RingtoneManager.getRingtone(reactContext.applicationContext, alarmUri)?.apply {
            audioAttributes = AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_ALARM)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build()

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
              isLooping = true
            }
            play()
          }
        }
      } catch (e: Throwable) {
        Log.e(TAG, "Error playing alarm ringtone", e)
      }
    }
  }

  @ReactMethod
  fun stopAlarmSound() {
    Handler(Looper.getMainLooper()).post {
      stopRingtone()
    }
  }

  @ReactMethod
  fun wakeScreen() {
    try {
      val powerManager = reactContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
      @Suppress("DEPRECATION")
      val wakeLock = powerManager?.newWakeLock(
        PowerManager.FULL_WAKE_LOCK or
        PowerManager.ACQUIRE_CAUSES_WAKEUP or
        PowerManager.ON_AFTER_RELEASE,
        "RemindMe:AlarmModuleWake"
      )
      wakeLock?.acquire(10000)
    } catch (e: Throwable) {
      Log.e(TAG, "Error acquiring wake lock", e)
    }
  }

  @ReactMethod
  fun canUseFullScreenIntent(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        val notificationManager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        promise.resolve(notificationManager?.canUseFullScreenIntent() ?: true)
      } else {
        promise.resolve(true)
      }
    } catch (e: Throwable) {
      promise.resolve(true)
    }
  }

  @ReactMethod
  fun openFullScreenIntentSettings() {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
          data = Uri.parse("package:\${reactContext.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactContext.startActivity(intent)
      } else {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
          data = Uri.parse("package:\${reactContext.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactContext.startActivity(intent)
      }
    } catch (e: Throwable) {
      Log.e(TAG, "Error opening full screen intent settings", e)
    }
  }
}
`;

const ALARM_PACKAGE_KOTLIN = `package com.remindme.app

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager

class AlarmPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(AlarmModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<View, ReactShadowNode<*>>> {
    return emptyList()
  }
}
`;

/**
 * Expo Config Plugin to handle Android Full-Screen Intent securely.
 */
const withFullScreenIntent = (config) => {
  // 1. AndroidManifest configuration
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;

    if (!androidManifest.manifest) {
      return config;
    }

    // Ensure permissions exist
    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }
    const permissions = androidManifest.manifest['uses-permission'];

    const requiredPermissions = [
      'android.permission.USE_FULL_SCREEN_INTENT',
      'android.permission.WAKE_LOCK',
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.VIBRATE',
    ];

    requiredPermissions.forEach((permName) => {
      const exists = permissions.some((p) => p.$ && p.$['android:name'] === permName);
      if (!exists) {
        permissions.push({
          $: {
            'android:name': permName,
          },
        });
      }
    });

    const application = androidManifest.manifest.application?.[0];
    if (application && Array.isArray(application.activity)) {
      const mainActivity = application.activity.find(
        (act) => act.$ && act.$['android:name'] === '.MainActivity'
      );
      if (mainActivity && mainActivity.$) {
        delete mainActivity.$['android:showWhenLocked'];
        delete mainActivity.$['android:turnScreenOn'];
        delete mainActivity.$['android:showOnLockScreen'];
        delete mainActivity.$['android:inheritShowWhenLocked'];
      }

      let forwarderActivity = application.activity.find(
        (act) => act.$ && act.$['android:name'] === 'expo.modules.notifications.service.NotificationForwarderActivity'
      );
      if (!forwarderActivity) {
        forwarderActivity = {
          $: {
            'android:name': 'expo.modules.notifications.service.NotificationForwarderActivity',
          },
        };
        application.activity.push(forwarderActivity);
      }
      forwarderActivity.$['android:showWhenLocked'] = 'true';
      forwarderActivity.$['android:turnScreenOn'] = 'true';
    }

    return config;
  });

  // 2. DangerousMod: Write AlarmModule.kt and AlarmPackage.kt into native Android directory
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const targetDir = path.join(projectRoot, 'app', 'src', 'main', 'java', 'com', 'remindme', 'app');

      if (fs.existsSync(targetDir)) {
        fs.writeFileSync(path.join(targetDir, 'AlarmModule.kt'), ALARM_MODULE_KOTLIN, 'utf8');
        fs.writeFileSync(path.join(targetDir, 'AlarmPackage.kt'), ALARM_PACKAGE_KOTLIN, 'utf8');
      }
      return config;
    },
  ]);

  // 3. MainApplication.kt: Register AlarmPackage
  config = withMainApplication(config, (config) => {
    let contents = config.modResults.contents;
    if (!contents.includes('add(AlarmPackage())')) {
      if (contents.includes('// add(MyReactNativePackage())')) {
        contents = contents.replace(
          '// add(MyReactNativePackage())',
          '// add(MyReactNativePackage())\n          add(AlarmPackage())'
        );
      } else if (contents.includes('PackageList(this).packages.apply {')) {
        contents = contents.replace(
          'PackageList(this).packages.apply {',
          'PackageList(this).packages.apply {\n          add(AlarmPackage())'
        );
      }
    }
    config.modResults.contents = contents;
    return config;
  });

  // 4. MainActivity.kt configuration for dynamic lock-screen window flags
  config = withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('import android.content.Intent')) {
      contents = contents.replace(
        'import android.os.Bundle',
        'import android.os.Bundle\nimport android.content.Intent\nimport android.view.WindowManager\nimport android.os.PowerManager\nimport android.content.Context'
      );
    }

    if (!contents.includes('handleLockScreenIntent(intent)')) {
      contents = contents.replace(
        'super.onCreate(null)',
        'super.onCreate(null)\n    handleLockScreenIntent(intent)'
      );
    }

    if (!contents.includes('fun handleLockScreenIntent')) {
      const helperMethods = `
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleLockScreenIntent(intent)
  }

  override fun onPause() {
    super.onPause()
    AlarmModule.stopRingtone()
    resetLockScreenFlags()
  }

  override fun onStop() {
    super.onStop()
    AlarmModule.stopRingtone()
    resetLockScreenFlags()
  }

  private fun handleLockScreenIntent(intent: Intent?) {
    if (isAlarmNotificationIntent(intent)) {
      enableLockScreenFlags()
    } else {
      resetLockScreenFlags()
    }
  }

  private fun isAlarmNotificationIntent(intent: Intent?): Boolean {
    if (intent == null) return false
    if (intent.action == "expo.modules.notifications.OPEN_APP_ACTION") return true
    if (intent.hasExtra("notificationResponse") || intent.hasExtra("notification")) return true
    val extras = intent.extras
    if (extras != null) {
      for (key in extras.keySet()) {
        if (key.contains("notification", ignoreCase = true) || key.contains("alarm", ignoreCase = true)) {
          return true
        }
      }
    }
    return false
  }

  private fun enableLockScreenFlags() {
    runOnUiThread {
      try {
        val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
        @Suppress("DEPRECATION")
        val wakeLock = powerManager?.newWakeLock(
          PowerManager.FULL_WAKE_LOCK or
          PowerManager.ACQUIRE_CAUSES_WAKEUP or
          PowerManager.ON_AFTER_RELEASE,
          "RemindMe:MainActivityWake"
        )
        wakeLock?.acquire(10000)
      } catch (e: Throwable) {
        // Fallback gracefully
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        setShowWhenLocked(true)
        setTurnScreenOn(true)
      } else {
        @Suppress("DEPRECATION")
        window.addFlags(
          WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        )
      }
    }
  }

  private fun resetLockScreenFlags() {
    runOnUiThread {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        setShowWhenLocked(false)
        setTurnScreenOn(false)
      } else {
        @Suppress("DEPRECATION")
        window.clearFlags(
          WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        )
      }
    }
  }
`;
      const lastIndex = contents.lastIndexOf('}');
      if (lastIndex !== -1) {
        contents = contents.slice(0, lastIndex) + helperMethods + '\n' + contents.slice(lastIndex);
      }
    }

    config.modResults.contents = contents;
    return config;
  });

  return config;
};

module.exports = withFullScreenIntent;
