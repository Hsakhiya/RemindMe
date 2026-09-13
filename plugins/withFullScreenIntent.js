const { withAndroidManifest, withMainActivity } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to handle Android Full-Screen Intent securely.
 *
 * 1. AndroidManifest:
 *    - Adds required permissions: USE_FULL_SCREEN_INTENT, WAKE_LOCK, SCHEDULE_EXACT_ALARM, VIBRATE.
 *    - Ensures MainActivity does NOT statically have showWhenLocked="true", which would bypass the lock screen during normal usage.
 *    - Attaches showWhenLocked="true" and turnScreenOn="true" to NotificationForwarderActivity so the notification trampoline can execute over the lock screen.
 *
 * 2. MainActivity.kt:
 *    - Dynamically enables setShowWhenLocked(true) and setTurnScreenOn(true) ONLY when launched or awakened by an alarm notification intent.
 *    - Clears lock-screen flags on normal app launch, onPause, and onStop so the device remains securely locked during normal use.
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
      // 1. Ensure MainActivity does NOT have static showWhenLocked attributes.
      // Having showWhenLocked="true" statically on MainActivity causes the device
      // to bypass the secure lock screen even during normal app usage.
      const mainActivity = application.activity.find(
        (act) => act.$ && act.$['android:name'] === '.MainActivity'
      );
      if (mainActivity && mainActivity.$) {
        delete mainActivity.$['android:showWhenLocked'];
        delete mainActivity.$['android:turnScreenOn'];
        delete mainActivity.$['android:showOnLockScreen'];
        delete mainActivity.$['android:inheritShowWhenLocked'];
      }

      // 2. Configure NotificationForwarderActivity to allow full-screen intent trampoline on lock screen
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

  // 2. MainActivity.kt configuration for dynamic lock-screen window flags
  config = withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    // Add necessary imports if missing
    if (!contents.includes('import android.content.Intent')) {
      contents = contents.replace(
        'import android.os.Bundle',
        'import android.os.Bundle\nimport android.content.Intent\nimport android.view.WindowManager'
      );
    }

    // Call handleLockScreenIntent(intent) in onCreate
    if (!contents.includes('handleLockScreenIntent(intent)')) {
      contents = contents.replace(
        'super.onCreate(null)',
        'super.onCreate(null)\n    handleLockScreenIntent(intent)'
      );
    }

    // Add onNewIntent, onPause, onStop, and helper functions if not present
    if (!contents.includes('fun handleLockScreenIntent')) {
      const helperMethods = `
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleLockScreenIntent(intent)
  }

  override fun onPause() {
    super.onPause()
    resetLockScreenFlags()
  }

  override fun onStop() {
    super.onStop()
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
