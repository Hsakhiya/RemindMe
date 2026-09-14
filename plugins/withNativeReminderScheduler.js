const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withNativeReminderFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const targetDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'remindme',
        'app'
      );

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // 1. ReminderAlarmReceiver.kt
      const reminderAlarmReceiverSource = `package com.remindme.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject
import java.time.Instant
import java.util.Calendar

class ReminderAlarmReceiver : BroadcastReceiver() {

  companion object {
    const val CHANNEL_ID = "reminders-channel"
  }

  override fun onReceive(context: Context, intent: Intent) {
    val reminderJsonStr = intent.getStringExtra("reminder_json") ?: return
    val reminderId = intent.getStringExtra("reminder_id") ?: return

    try {
      val json = JSONObject(reminderJsonStr)
      val title = json.optString("title", "Reminder")
      val description = json.optString("description", "")
      val category = json.optString("category", "General")
      val repeatFrequency = json.optString("repeatFrequency", "none")
      val intervalMinutes = json.optInt("intervalMinutes", 30)
      val stopAtStr = json.optString("stopAt", "")
      val disabledTimeRange = json.optJSONObject("disabledTimeRange")

      // 1. Post notification to notification tray
      postNotification(context, reminderId, title, description, category)

      // 2. Handle repeating cycles (interval, daily, weekly) in native code
      val now = System.currentTimeMillis()
      val stopAtMillis = if (stopAtStr.isNotEmpty()) {
        try { Instant.parse(stopAtStr).toEpochMilli() } catch (e: Exception) { 0L }
      } else 0L

      var nextTriggerMillis: Long? = null

      if (repeatFrequency == "interval") {
        var candidate = now + (intervalMinutes * 60 * 1000L)

        if (disabledTimeRange != null && disabledTimeRange.optBoolean("enabled", false)) {
          val startStr = disabledTimeRange.optString("startTime", "")
          val endStr = disabledTimeRange.optString("endTime", "")
          if (startStr.isNotEmpty() && endStr.isNotEmpty()) {
            candidate = adjustForDisabledRange(candidate, startStr, endStr)
          }
        }

        if (stopAtMillis == 0L || candidate <= stopAtMillis) {
          nextTriggerMillis = candidate
        }
      } else if (repeatFrequency == "daily") {
        nextTriggerMillis = now + (24 * 60 * 60 * 1000L)
      } else if (repeatFrequency == "weekly") {
        nextTriggerMillis = now + (7 * 24 * 60 * 60 * 1000L)
      }

      val prefs = context.getSharedPreferences(ReminderSchedulerModule.PREFS_NAME, Context.MODE_PRIVATE)
      val remindersMap = ReminderSchedulerModule.getStoredReminders(prefs)

      if (nextTriggerMillis != null) {
        val nextIso = Instant.ofEpochMilli(nextTriggerMillis).toString()
        json.put("scheduledTime", nextIso)
        remindersMap.put(reminderId, json)
        prefs.edit().putString(ReminderSchedulerModule.KEY_REMINDERS, remindersMap.toString()).apply()

        ReminderSchedulerModule.scheduleAlarm(context, json, nextTriggerMillis)
      } else {
        remindersMap.remove(reminderId)
        prefs.edit().putString(ReminderSchedulerModule.KEY_REMINDERS, remindersMap.toString()).apply()
      }

    } catch (e: Exception) {
      e.printStackTrace()
    }
  }

  private fun postNotification(context: Context, id: String, title: String, body: String, category: String) {
    createChannelIfNeeded(context)

    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra("reminderId", id)
    }

    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    } else {
      PendingIntent.FLAG_UPDATE_CURRENT
    }

    val pendingIntent = if (launchIntent != null) {
      PendingIntent.getActivity(context, id.hashCode(), launchIntent, flags)
    } else null

    var iconResId = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    if (iconResId == 0) {
      iconResId = context.applicationInfo.icon
    }

    val text = if (body.isNotEmpty()) body else "Reminder: $category priority task"

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(iconResId)
      .setContentTitle("⏰ $title")
      .setContentText(text)
      .setStyle(NotificationCompat.BigTextStyle().bigText(text))
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setAutoCancel(true)
      .setDefaults(NotificationCompat.DEFAULT_ALL)
      .apply {
        if (pendingIntent != null) setContentIntent(pendingIntent)
      }
      .build()

    NotificationManagerCompat.from(context).notify(id.hashCode(), notification)
  }

  private fun createChannelIfNeeded(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val existingChannel = notificationManager.getNotificationChannel(CHANNEL_ID)
      if (existingChannel == null) {
        val channel = NotificationChannel(
          CHANNEL_ID,
          "Reminders & Alarms",
          NotificationManager.IMPORTANCE_HIGH
        ).apply {
          description = "Alerts and notifications for your scheduled reminders"
          enableLights(true)
          lightColor = Color.parseColor("#6366F1")
          enableVibration(true)
          vibrationPattern = longArrayOf(0, 300, 200, 300)
          val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
          val audioAttributes = AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .build()
          setSound(soundUri, audioAttributes)
        }
        notificationManager.createNotificationChannel(channel)
      }
    }
  }

  private fun adjustForDisabledRange(targetTimeMillis: Long, startStr: String, endStr: String): Long {
    try {
      val cal = Calendar.getInstance().apply { timeInMillis = targetTimeMillis }
      val targetMins = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)

      val startParts = startStr.split(":")
      val endParts = endStr.split(":")
      val startMins = startParts[0].toInt() * 60 + startParts[1].toInt()
      val endMins = endParts[0].toInt() * 60 + endParts[1].toInt()

      val inRange = if (startMins <= endMins) {
        targetMins in startMins until endMins
      } else {
        targetMins >= startMins || targetMins < endMins
      }

      if (inRange) {
        cal.set(Calendar.HOUR_OF_DAY, endParts[0].toInt())
        cal.set(Calendar.MINUTE, endParts[1].toInt())
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        if (cal.timeInMillis <= targetTimeMillis) {
          cal.add(Calendar.DAY_OF_YEAR, 1)
        }
        return cal.timeInMillis
      }
    } catch (e: Exception) {
      e.printStackTrace()
    }
    return targetTimeMillis
  }
}
`;
      fs.writeFileSync(path.join(targetDir, 'ReminderAlarmReceiver.kt'), reminderAlarmReceiverSource, 'utf8');

      // 2. BootReceiver.kt
      const bootReceiverSource = `package com.remindme.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
        intent.action == "android.intent.action.MY_PACKAGE_REPLACED" ||
        intent.action == "android.intent.action.QUICKBOOT_POWERON") {

      try {
        val prefs = context.getSharedPreferences(ReminderSchedulerModule.PREFS_NAME, Context.MODE_PRIVATE)
        val remindersMap = ReminderSchedulerModule.getStoredReminders(prefs)
        val keys = remindersMap.keys()
        val now = System.currentTimeMillis()

        while (keys.hasNext()) {
          val id = keys.next()
          val json = remindersMap.getJSONObject(id)
          val scheduledTimeStr = json.optString("scheduledTime", "")
          if (scheduledTimeStr.isNotEmpty()) {
            val triggerMillis = ReminderSchedulerModule.parseIsoToMillis(scheduledTimeStr)
            if (triggerMillis > now) {
              ReminderSchedulerModule.scheduleAlarm(context, json, triggerMillis)
            } else {
              val repeatFrequency = json.optString("repeatFrequency", "none")
              if (repeatFrequency == "interval" || repeatFrequency == "daily" || repeatFrequency == "weekly") {
                ReminderSchedulerModule.scheduleAlarm(context, json, now + 3000L)
              }
            }
          }
        }
      } catch (e: Exception) {
        e.printStackTrace()
      }
    }
  }
}
`;
      fs.writeFileSync(path.join(targetDir, 'BootReceiver.kt'), bootReceiverSource, 'utf8');

      // 3. ReminderSchedulerModule.kt
      const reminderSchedulerModuleSource = `package com.remindme.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONObject

class ReminderSchedulerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val PREFS_NAME = "remindme_native_reminders"
    const val KEY_REMINDERS = "active_reminders"

    fun parseIsoToMillis(isoStr: String): Long {
      return try {
        java.time.Instant.parse(isoStr).toEpochMilli()
      } catch (e: Exception) {
        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
        sdf.timeZone = java.util.TimeZone.getTimeZone("UTC")
        sdf.parse(isoStr)?.time ?: System.currentTimeMillis()
      }
    }

    fun getStoredReminders(prefs: SharedPreferences): JSONObject {
      val raw = prefs.getString(KEY_REMINDERS, null)
      return if (!raw.isNullOrEmpty()) {
        try { JSONObject(raw) } catch (e: Exception) { JSONObject() }
      } else {
        JSONObject()
      }
    }

    fun scheduleAlarm(context: Context, reminderJson: JSONObject, triggerMillis: Long) {
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
      val id = reminderJson.getString("id")
      val requestCode = id.hashCode()

      val intent = Intent(context, ReminderAlarmReceiver::class.java).apply {
        action = "com.remindme.app.REMINDER_ALARM"
        putExtra("reminder_json", reminderJson.toString())
        putExtra("reminder_id", id)
      }

      val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      } else {
        PendingIntent.FLAG_UPDATE_CURRENT
      }

      val pendingIntent = PendingIntent.getBroadcast(context, requestCode, intent, flags)

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMillis, pendingIntent)
      } else {
        alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerMillis, pendingIntent)
      }
    }

    fun cancelAlarm(context: Context, reminderId: String) {
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
      val requestCode = reminderId.hashCode()

      val intent = Intent(context, ReminderAlarmReceiver::class.java).apply {
        action = "com.remindme.app.REMINDER_ALARM"
      }

      val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      } else {
        PendingIntent.FLAG_UPDATE_CURRENT
      }

      val pendingIntent = PendingIntent.getBroadcast(context, requestCode, intent, flags)
      alarmManager.cancel(pendingIntent)
    }
  }

  override fun getName(): String = "ReminderSchedulerModule"

  private fun getPrefs(): SharedPreferences {
    return reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
  }

  @ReactMethod
  fun scheduleNativeReminder(reminderJson: String, promise: Promise) {
    try {
      val json = JSONObject(reminderJson)
      val id = json.getString("id")
      val scheduledTimeStr = json.getString("scheduledTime")
      val triggerAtMillis = parseIsoToMillis(scheduledTimeStr)

      val prefs = getPrefs()
      val remindersMap = getStoredReminders(prefs)
      remindersMap.put(id, json)
      prefs.edit().putString(KEY_REMINDERS, remindersMap.toString()).apply()

      scheduleAlarm(reactContext, json, triggerAtMillis)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("SCHEDULE_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun cancelNativeReminder(reminderId: String, promise: Promise) {
    try {
      val prefs = getPrefs()
      val remindersMap = getStoredReminders(prefs)
      if (remindersMap.has(reminderId)) {
        remindersMap.remove(reminderId)
        prefs.edit().putString(KEY_REMINDERS, remindersMap.toString()).apply()
      }

      cancelAlarm(reactContext, reminderId)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("CANCEL_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun getStoredRemindersJson(promise: Promise) {
    try {
      val prefs = getPrefs()
      val str = prefs.getString(KEY_REMINDERS, "{}") ?: "{}"
      promise.resolve(str)
    } catch (e: Exception) {
      promise.reject("GET_ERROR", e.message, e)
    }
  }
}
`;
      fs.writeFileSync(path.join(targetDir, 'ReminderSchedulerModule.kt'), reminderSchedulerModuleSource, 'utf8');

      // 4. ReminderSchedulerPackage.kt
      const reminderSchedulerPackageSource = `package com.remindme.app

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager

class ReminderSchedulerPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(ReminderSchedulerModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<View, ReactShadowNode<*>>> {
    return emptyList()
  }
}
`;
      fs.writeFileSync(path.join(targetDir, 'ReminderSchedulerPackage.kt'), reminderSchedulerPackageSource, 'utf8');

      // 5. Inject ReminderSchedulerPackage into MainApplication.kt
      const mainAppFile = path.join(targetDir, 'MainApplication.kt');
      if (fs.existsSync(mainAppFile)) {
        let mainAppContent = fs.readFileSync(mainAppFile, 'utf8');
        if (!mainAppContent.includes('ReminderSchedulerPackage()')) {
          mainAppContent = mainAppContent.replace(
            'PackageList(this).packages.apply {',
            'PackageList(this).packages.apply {\n          add(ReminderSchedulerPackage())'
          );
          fs.writeFileSync(mainAppFile, mainAppContent, 'utf8');
        }
      }

      return config;
    },
  ]);
}

function withNativeReminderManifest(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];
    if (!mainApplication) return config;

    if (!mainApplication.receiver) {
      mainApplication.receiver = [];
    }

    // Add ReminderAlarmReceiver if not already present
    const hasAlarmReceiver = mainApplication.receiver.some(
      (r) => r.$?.['android:name'] === '.ReminderAlarmReceiver'
    );
    if (!hasAlarmReceiver) {
      mainApplication.receiver.push({
        $: {
          'android:name': '.ReminderAlarmReceiver',
          'android:exported': 'false',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'com.remindme.app.REMINDER_ALARM',
                },
              },
            ],
          },
        ],
      });
    }

    // Add BootReceiver if not already present
    const hasBootReceiver = mainApplication.receiver.some(
      (r) => r.$?.['android:name'] === '.BootReceiver'
    );
    if (!hasBootReceiver) {
      mainApplication.receiver.push({
        $: {
          'android:name': '.BootReceiver',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
              { $: { 'android:name': 'android.intent.action.MY_PACKAGE_REPLACED' } },
              { $: { 'android:name': 'android.intent.action.QUICKBOOT_POWERON' } },
            ],
          },
        ],
      });
    }

    return config;
  });
}

module.exports = function withNativeReminderScheduler(config) {
  config = withNativeReminderFiles(config);
  config = withNativeReminderManifest(config);
  return config;
};
