const fs = require('fs');
const path = require('path');

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

// 2. Patch ExpoNotificationBuilder.kt for Full-Screen Intent
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
    val fullScreenResponseIntent = createNotificationResponseIntent(
      context,
      notification,
      defaultAction
    )
    builder.setContentIntent(fullScreenResponseIntent)
    val isFullScreen = try {
      notificationContent.body?.optBoolean("fullScreen", true) ?: true
    } catch (e: Throwable) {
      true
    }
    if (isFullScreen) {
      builder.setFullScreenIntent(fullScreenResponseIntent, true)
    }`;

  if (builderContent.includes(targetCode)) {
    builderContent = builderContent.replace(targetCode, replacementCode);
    fs.writeFileSync(builderFile, builderContent, 'utf8');
    console.log('[Patch] Successfully patched ExpoNotificationBuilder.kt for Full-Screen Intent support.');
  } else if (builderContent.includes('builder.setFullScreenIntent')) {
    console.log('[Patch] ExpoNotificationBuilder.kt already patched for Full-Screen Intent.');
  }
}

