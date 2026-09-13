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

  // If already patched with previous version or mutable flag, normalize first
  if (builderContent.includes('AlarmActivity') || builderContent.includes('directMainIntent') || builderContent.includes('FLAG_MUTABLE')) {
    const prevPattern = /\s*val defaultAction =[\s\S]*?builder\.setFullScreenIntent\([\s\S]*?\n\s*\}/;
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

      val directAlarmIntent = android.content.Intent(context, Class.forName("\${context.packageName}.AlarmActivity")).apply {
        flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK or
                android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP or
                android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP
        action = "com.remindme.app.ALARM_ACTION"
        putExtra("notificationResponse", notification)
        putExtra("fullScreen", true)
        putExtra("title", notificationContent.title)
        putExtra("body", notificationContent.text)
        putExtra("description", notificationContent.text)
        notificationContent.body?.let { putExtra("data", it.toString()) }
      }
      val mutableFlag = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
      } else {
        android.app.PendingIntent.FLAG_UPDATE_CURRENT
      }
      val directFullScreenPendingIntent = android.app.PendingIntent.getActivity(
        context,
        notification.notificationRequest.identifier.hashCode(),
        directAlarmIntent,
        mutableFlag
      )
      builder.setFullScreenIntent(directFullScreenPendingIntent, true)
    }`;

  if (builderContent.includes(targetCode)) {
    builderContent = builderContent.replace(targetCode, replacementCode);
    fs.writeFileSync(builderFile, builderContent, 'utf8');
    console.log('[Patch] Successfully patched ExpoNotificationBuilder.kt with direct AlarmActivity Full-Screen Intent.');
  } else if (builderContent.includes('AlarmActivity')) {
    console.log('[Patch] ExpoNotificationBuilder.kt already up to date with AlarmActivity Full-Screen Intent.');
  }
}

// 3. Patch ExpoPresentationDelegate.kt to wake display & directly launch AlarmActivity over lock screen
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

  // If already patched, normalize back to clean base code first
  if (presentationContent.includes('RemindMe:AlarmWakeDisplay')) {
    const prevPattern = /    CoroutineScope\(Dispatchers\.IO\)\.launch \{[\s\S]*?val androidNotification = createNotification\(notification, behavior\)/;
    const baseCode = `    CoroutineScope(Dispatchers.IO).launch {
      val androidNotification = createNotification(notification, behavior)`;
    presentationContent = presentationContent.replace(prevPattern, baseCode);
  }

  const targetPresent = `    CoroutineScope(Dispatchers.IO).launch {
      val androidNotification = createNotification(notification, behavior)`;

  const replacementPresent = `    CoroutineScope(Dispatchers.IO).launch {
      try {
        val content = notification.notificationRequest.content
        val bodyJson = content.body
        val hasFullScreen = bodyJson?.optBoolean("fullScreen", false) ?: false
        val hasAlarmInTitle = content.title?.contains("🚨") == true
        val hasAlarmInChannel = (notification.notificationRequest.trigger as? expo.modules.notifications.notifications.interfaces.SchedulableNotificationTrigger)?.channelId?.contains("alarm", ignoreCase = true) == true
        val isAlarm = hasFullScreen || hasAlarmInTitle || hasAlarmInChannel

        if (isAlarm) {
          // 1. Wake physical screen illumination immediately
          val pm = context.getSystemService(Context.POWER_SERVICE) as? android.os.PowerManager
          @Suppress("DEPRECATION")
          val wakeLock = pm?.newWakeLock(
            android.os.PowerManager.FULL_WAKE_LOCK or
            android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP or
            android.os.PowerManager.ON_AFTER_RELEASE,
            "RemindMe:AlarmWakeDisplay"
          )
          wakeLock?.acquire(30000)

          // 2. Directly launch AlarmActivity over lock screen
          try {
            val alarmIntent = android.content.Intent(context, Class.forName("\${context.packageName}.AlarmActivity")).apply {
              flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK or
                      android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP or
                      android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP
              action = "com.remindme.app.ALARM_ACTION"
              putExtra("notificationResponse", notification)
              putExtra("fullScreen", true)
              putExtra("title", content.title)
              putExtra("body", content.text)
              putExtra("description", content.text)
              bodyJson?.let { putExtra("data", it.toString()) }
            }
            context.startActivity(alarmIntent)
          } catch (e: Throwable) {
            android.util.Log.e("ExpoPresentationDelegate", "Direct startActivity failed", e)
            try {
              val piFlag = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
              } else {
                android.app.PendingIntent.FLAG_UPDATE_CURRENT
              }
              val pi = android.app.PendingIntent.getActivity(
                context,
                notification.notificationRequest.identifier.hashCode(),
                alarmIntent,
                piFlag
              )
              pi.send()
            } catch (pe: Throwable) {
              android.util.Log.e("ExpoPresentationDelegate", "PendingIntent fallback send failed", pe)
            }
          }
        }
      } catch (e: Throwable) {
        // Graceful fallback
      }
      val androidNotification = createNotification(notification, behavior)`;

  if (presentationContent.includes(targetPresent)) {
    presentationContent = presentationContent.replace(targetPresent, replacementPresent);
    fs.writeFileSync(presentationFile, presentationContent, 'utf8');
    console.log('[Patch] Successfully patched ExpoPresentationDelegate.kt with direct startActivity launch & ACQUIRE_CAUSES_WAKEUP.');
  } else if (presentationContent.includes('AlarmWakeDisplay')) {
    console.log('[Patch] ExpoPresentationDelegate.kt already up to date.');
  }
}
