const fs = require('fs');
const path = require('path');

// 1. Patch warnOfExpoGoPushUsage for Expo Go compatibility
const targetFiles = [
  path.join(__dirname, '..', 'node_modules', 'expo-notifications', 'build', 'warnOfExpoGoPushUsage.js'),
  path.join(__dirname, '..', 'node_modules', 'expo-notifications', 'src', 'warnOfExpoGoPushUsage.ts'),
];

targetFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('throw new Error(message);')) {
      content = content.replace('throw new Error(message);', 'console.warn(message);');
      fs.writeFileSync(file, content, 'utf8');
      console.log(`[Patch] Successfully patched ${path.basename(file)} for Expo Go compatibility.`);
    }
  }
});

// 2. Patch ExpoNotificationBuilder.kt for direct Full-Screen Intent & CATEGORY_ALARM
const builderFile = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-notifications',
  'android',
  'src',
  'main',
  'java',
  'expo',
  'modules',
  'notifications',
  'notifications',
  'presentation',
  'builders',
  'ExpoNotificationBuilder.kt'
);

if (fs.existsSync(builderFile)) {
  let builderContent = fs.readFileSync(builderFile, 'utf8');

  // If already patched with previous version, normalize first
  if (builderContent.includes('val fullScreenResponseIntent = createNotificationResponseIntent')) {
    const prevPattern = /val defaultAction =[\s\S]*?if \(isFullScreen\) \{[\s\S]*?builder\.setFullScreenIntent\(fullScreenResponseIntent, true\)[\s\S]*?\}/;
    const baseCode = `    val defaultAction =
      NotificationAction(NotificationResponse.DEFAULT_ACTION_IDENTIFIER, null, true)
    builder.setContentIntent(
      createNotificationResponseIntent(
        context,
        notification,
        defaultAction
      )
    )`;
    builderContent = builderContent.replace(prevPattern, baseCode);
  }

  const targetCode = `    val defaultAction =
      NotificationAction(NotificationResponse.DEFAULT_ACTION_IDENTIFIER, null, true)
    builder.setContentIntent(
      createNotificationResponseIntent(
        context,
        notification,
        defaultAction
      )
    )`;

  const replacementCode = `    val defaultAction =
      NotificationAction(NotificationResponse.DEFAULT_ACTION_IDENTIFIER, null, true)
    val standardResponseIntent = createNotificationResponseIntent(
      context,
      notification,
      defaultAction
    )
    builder.setContentIntent(standardResponseIntent)
    val isFullScreen = try {
      notificationContent.body?.optBoolean("fullScreen", true) ?: true
    } catch (e: Throwable) {
      true
    }
    if (isFullScreen) {
      builder.setCategory(androidx.core.app.NotificationCompat.CATEGORY_ALARM)
      builder.setVisibility(androidx.core.app.NotificationCompat.VISIBILITY_PUBLIC)
      builder.priority = androidx.core.app.NotificationCompat.PRIORITY_MAX

      val directMainIntent = (context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?: android.content.Intent(context, Class.forName("\${context.packageName}.MainActivity"))).apply {
        flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK or
                android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP or
                android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP
        action = "expo.modules.notifications.OPEN_APP_ACTION"
        putExtra("notificationResponse", notification)
        putExtra("fullScreen", true)
        notificationContent.body?.let { putExtra("data", it.toString()) }
      }
      val mutableFlag = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_MUTABLE
      } else {
        android.app.PendingIntent.FLAG_UPDATE_CURRENT
      }
      val directFullScreenPendingIntent = android.app.PendingIntent.getActivity(
        context,
        notification.notificationRequest.identifier.hashCode(),
        directMainIntent,
        mutableFlag
      )
      builder.setFullScreenIntent(directFullScreenPendingIntent, true)
    }`;

  if (builderContent.includes(targetCode)) {
    builderContent = builderContent.replace(targetCode, replacementCode);
    fs.writeFileSync(builderFile, builderContent, 'utf8');
    console.log('[Patch] Successfully patched ExpoNotificationBuilder.kt with direct MainActivity Full-Screen Intent.');
  } else if (builderContent.includes('directFullScreenPendingIntent')) {
    console.log('[Patch] ExpoNotificationBuilder.kt already up to date with direct Full-Screen Intent.');
  }
}

// 3. Patch ExpoPresentationDelegate.kt to wake display via ACQUIRE_CAUSES_WAKEUP
const presentationFile = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-notifications',
  'android',
  'src',
  'main',
  'java',
  'expo',
  'modules',
  'notifications',
  'service',
  'delegates',
  'ExpoPresentationDelegate.kt'
);

if (fs.existsSync(presentationFile)) {
  let presentationContent = fs.readFileSync(presentationFile, 'utf8');
  const targetPresent = `    CoroutineScope(Dispatchers.IO).launch {
      val androidNotification = createNotification(notification, behavior)`;

  const replacementPresent = `    CoroutineScope(Dispatchers.IO).launch {
      try {
        val isAlarm = notification.notificationRequest.content.body?.optBoolean("fullScreen", false) ?: false
        if (isAlarm) {
          val pm = context.getSystemService(Context.POWER_SERVICE) as? android.os.PowerManager
          @Suppress("DEPRECATION")
          val wakeLock = pm?.newWakeLock(
            android.os.PowerManager.FULL_WAKE_LOCK or
            android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP or
            android.os.PowerManager.ON_AFTER_RELEASE,
            "RemindMe:AlarmWakeDisplay"
          )
          wakeLock?.acquire(15000)
        }
      } catch (e: Throwable) {
        // Graceful fallback
      }
      val androidNotification = createNotification(notification, behavior)`;

  if (presentationContent.includes(targetPresent)) {
    presentationContent = presentationContent.replace(targetPresent, replacementPresent);
    fs.writeFileSync(presentationFile, presentationContent, 'utf8');
    console.log('[Patch] Successfully patched ExpoPresentationDelegate.kt for ACQUIRE_CAUSES_WAKEUP display wake-up.');
  } else if (presentationContent.includes('AlarmWakeDisplay')) {
    console.log('[Patch] ExpoPresentationDelegate.kt already patched for display wake-up.');
  }
}
