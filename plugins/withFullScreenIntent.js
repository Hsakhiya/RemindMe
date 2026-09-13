const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to enable Android Full-Screen Intent on the lock screen.
 * Adds required permissions and sets window flags on MainActivity:
 * - android:showWhenLocked="true"
 * - android:turnScreenOn="true"
 * - android:showOnLockScreen="true"
 * - android:inheritShowWhenLocked="true"
 */
const withFullScreenIntent = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;

    if (!androidManifest.manifest) {
      return config;
    }

    // 1. Ensure permissions exist
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

    // 2. Configure MainActivity for lock-screen display
    const application = androidManifest.manifest.application?.[0];
    if (application && Array.isArray(application.activity)) {
      const mainActivity = application.activity.find(
        (act) => act.$ && act.$['android:name'] === '.MainActivity'
      );

      if (mainActivity) {
        mainActivity.$['android:showWhenLocked'] = 'true';
        mainActivity.$['android:turnScreenOn'] = 'true';
        mainActivity.$['android:showOnLockScreen'] = 'true';
        mainActivity.$['android:inheritShowWhenLocked'] = 'true';
      }
    }

    return config;
  });
};

module.exports = withFullScreenIntent;
