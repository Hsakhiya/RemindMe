const { withAndroidManifest, withMainActivity, withMainApplication, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const ALARM_MODULE_KOTLIN = `package com.remindme.app

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
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
  fun scheduleAlarmClock(id: String, triggerAtMillis: Double, title: String, body: String, data: String) {
    try {
      val am = reactContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
      val alarmIntent = Intent(reactContext, AlarmActivity::class.java).apply {
        action = "com.remindme.app.ALARM_ACTION"
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
        putExtra("id", id)
        putExtra("title", title)
        putExtra("body", body)
        putExtra("description", body)
        putExtra("data", data)
        putExtra("fullScreen", true)
      }

      val requestCode = id.hashCode()
      val piFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      } else {
        PendingIntent.FLAG_UPDATE_CURRENT
      }

      val operation = PendingIntent.getActivity(
        reactContext,
        requestCode,
        alarmIntent,
        piFlag
      )

      val showIntent = PendingIntent.getActivity(
        reactContext,
        requestCode + 100000,
        alarmIntent,
        piFlag
      )

      val triggerTime = triggerAtMillis.toLong()
      val info = AlarmManager.AlarmClockInfo(triggerTime, showIntent)
      am.setAlarmClock(info, operation)
      Log.i(TAG, "Successfully scheduled setAlarmClock for id=$id at $triggerTime")
    } catch (e: Throwable) {
      Log.e(TAG, "Failed to schedule alarm via setAlarmClock", e)
    }
  }

  @ReactMethod
  fun cancelAlarmClock(id: String) {
    try {
      val am = reactContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
      val alarmIntent = Intent(reactContext, AlarmActivity::class.java).apply {
        action = "com.remindme.app.ALARM_ACTION"
      }
      val requestCode = id.hashCode()
      val piFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      } else {
        PendingIntent.FLAG_UPDATE_CURRENT
      }
      val operation = PendingIntent.getActivity(
        reactContext,
        requestCode,
        alarmIntent,
        piFlag
      )
      am.cancel(operation)
      Log.i(TAG, "Successfully cancelled setAlarmClock for id=$id")
    } catch (e: Throwable) {
      Log.e(TAG, "Failed to cancel setAlarmClock", e)
    }
  }

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

const ALARM_ACTIVITY_KOTLIN = `package com.remindme.app

import android.app.Activity
import android.app.AlarmManager
import android.app.KeyguardManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class AlarmActivity : Activity() {

  companion object {
    private const val TAG = "AlarmActivity"
  }

  private var ringtone: Ringtone? = null
  private var vibrator: Vibrator? = null
  private var wakeLock: PowerManager.WakeLock? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    setupWindowFlags()
    super.onCreate(savedInstanceState)

    acquireWakeLock()
    startAlarmSound()
    startVibration()

    val title = extractTitle(intent)
    val body = extractBody(intent)
    val category = extractCategory(intent)

    val contentView = buildUI(title, body, category)
    setContentView(contentView)
  }

  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    setIntent(intent)
  }

  private fun setupWindowFlags() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
      val km = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
      km?.requestDismissKeyguard(this, null)
    }
    @Suppress("DEPRECATION")
    window.addFlags(
      WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
      WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
      WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
      WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
    )
  }

  private fun acquireWakeLock() {
    try {
      val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
      @Suppress("DEPRECATION")
      wakeLock = pm?.newWakeLock(
        PowerManager.FULL_WAKE_LOCK or
        PowerManager.ACQUIRE_CAUSES_WAKEUP or
        PowerManager.ON_AFTER_RELEASE,
        "RemindMe:AlarmActivityWake"
      )
      wakeLock?.acquire(60000)
    } catch (e: Throwable) {
      Log.w(TAG, "Error acquiring wake lock", e)
    }
  }

  private fun startAlarmSound() {
    try {
      val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

      ringtone = RingtoneManager.getRingtone(applicationContext, alarmUri)?.apply {
        audioAttributes = AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          isLooping = true
        }
        play()
      }
    } catch (e: Throwable) {
      Log.e(TAG, "Error starting alarm sound", e)
    }
  }

  private fun startVibration() {
    try {
      vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        vm?.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
      }

      val pattern = longArrayOf(0, 800, 400, 800, 400, 1000)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val effect = VibrationEffect.createWaveform(pattern, 0)
        vibrator?.vibrate(effect)
      } else {
        @Suppress("DEPRECATION")
        vibrator?.vibrate(pattern, 0)
      }
    } catch (e: Throwable) {
      Log.w(TAG, "Error starting vibration", e)
    }
  }

  private fun stopAllAlerts() {
    try {
      ringtone?.let {
        if (it.isPlaying) it.stop()
      }
      ringtone = null
    } catch (e: Throwable) {
      Log.w(TAG, "Error stopping ringtone", e)
    }

    try {
      AlarmModule.stopRingtone()
    } catch (e: Throwable) {}

    try {
      vibrator?.cancel()
      vibrator = null
    } catch (e: Throwable) {
      Log.w(TAG, "Error canceling vibration", e)
    }

    try {
      if (wakeLock?.isHeld == true) {
        wakeLock?.release()
      }
      wakeLock = null
    } catch (e: Throwable) {
      Log.w(TAG, "Error releasing wakelock", e)
    }
  }

  private fun extractTitle(intent: Intent?): String {
    if (intent == null) return "Reminder Alert"
    val dataStr = intent.getStringExtra("data")
    if (!dataStr.isNullOrEmpty()) {
      try {
        val json = JSONObject(dataStr)
        if (json.has("title")) return json.getString("title")
      } catch (e: Throwable) {}
    }
    return intent.getStringExtra("title") ?: "Reminder Alert"
  }

  private fun extractBody(intent: Intent?): String {
    if (intent == null) return "Scheduled reminder is due now"
    val dataStr = intent.getStringExtra("data")
    if (!dataStr.isNullOrEmpty()) {
      try {
        val json = JSONObject(dataStr)
        if (json.has("description")) return json.getString("description")
        if (json.has("body")) return json.getString("body")
      } catch (e: Throwable) {}
    }
    return intent.getStringExtra("body") ?: intent.getStringExtra("description") ?: "Scheduled reminder is due now"
  }

  private fun extractCategory(intent: Intent?): String {
    if (intent == null) return "General"
    val dataStr = intent.getStringExtra("data")
    if (!dataStr.isNullOrEmpty()) {
      try {
        val json = JSONObject(dataStr)
        if (json.has("category")) return json.getString("category")
      } catch (e: Throwable) {}
    }
    return intent.getStringExtra("category") ?: "General"
  }

  private fun buildUI(title: String, body: String, category: String): View {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setBackgroundColor(Color.parseColor("#0F172A"))
      setPadding(dp(28), dp(48), dp(28), dp(40))
      layoutParams = ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
    }

    val alarmBadge = TextView(this).apply {
      text = "🚨  REMINDER ALARM"
      setTextColor(Color.parseColor("#EF4444"))
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
      typeface = Typeface.DEFAULT_BOLD
      setPadding(dp(16), dp(6), dp(16), dp(6))
      val bg = GradientDrawable().apply {
        setColor(Color.parseColor("#331E293B"))
        setStroke(dp(1), Color.parseColor("#EF4444"))
        cornerRadius = dp(20).toFloat()
      }
      background = bg
    }
    root.addView(alarmBadge)

    val timeFormat = SimpleDateFormat("hh:mm a", Locale.getDefault())
    val clockView = TextView(this).apply {
      text = timeFormat.format(Date())
      setTextColor(Color.parseColor("#F8FAFC"))
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 44f)
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      val lp = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        topMargin = dp(24)
        bottomMargin = dp(16)
      }
      layoutParams = lp
    }
    root.addView(clockView)

    val card = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      val bg = GradientDrawable().apply {
        setColor(Color.parseColor("#1E293B"))
        cornerRadius = dp(24).toFloat()
        setStroke(dp(1), Color.parseColor("#334155"))
      }
      background = bg
      setPadding(dp(24), dp(24), dp(24), dp(24))
      val lp = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        0,
        1f
      ).apply {
        topMargin = dp(8)
        bottomMargin = dp(28)
      }
      layoutParams = lp
    }

    val catBadge = TextView(this).apply {
      text = category.uppercase(Locale.getDefault())
      setTextColor(Color.parseColor("#818CF8"))
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
      typeface = Typeface.DEFAULT_BOLD
      setPadding(dp(12), dp(4), dp(12), dp(4))
      val bg = GradientDrawable().apply {
        setColor(Color.parseColor("#312E81"))
        cornerRadius = dp(12).toFloat()
      }
      background = bg
      val lp = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        bottomMargin = dp(14)
      }
      layoutParams = lp
    }
    card.addView(catBadge)

    val titleView = TextView(this).apply {
      text = title
      setTextColor(Color.WHITE)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      val lp = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        bottomMargin = dp(12)
      }
      layoutParams = lp
    }
    card.addView(titleView)

    val descView = TextView(this).apply {
      text = body
      setTextColor(Color.parseColor("#94A3B8"))
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
      gravity = Gravity.CENTER
      setLineSpacing(0f, 1.25f)
    }
    card.addView(descView)

    root.addView(card)

    val buttonRow = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      val lp = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      )
      layoutParams = lp
    }

    val dismissBtn = Button(this).apply {
      text = "Dismiss Alarm"
      setTextColor(Color.WHITE)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
      typeface = Typeface.DEFAULT_BOLD
      val bg = GradientDrawable().apply {
        setColor(Color.parseColor("#DC2626"))
        cornerRadius = dp(16).toFloat()
      }
      background = bg
      val lp = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        dp(56)
      ).apply {
        bottomMargin = dp(12)
      }
      layoutParams = lp
      setOnClickListener {
        stopAllAlerts()
        dismissNotification()
        finishAndRemoveTask()
      }
    }
    buttonRow.addView(dismissBtn)

    val snoozeBtn = Button(this).apply {
      text = "Snooze (+10m)"
      setTextColor(Color.parseColor("#F8FAFC"))
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
      typeface = Typeface.DEFAULT_BOLD
      val bg = GradientDrawable().apply {
        setColor(Color.parseColor("#334155"))
        cornerRadius = dp(16).toFloat()
        setStroke(dp(1), Color.parseColor("#475569"))
      }
      background = bg
      val lp = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        dp(52)
      ).apply {
        bottomMargin = dp(12)
      }
      layoutParams = lp
      setOnClickListener {
        stopAllAlerts()
        dismissNotification()
        snoozeReminder()
        finishAndRemoveTask()
      }
    }
    buttonRow.addView(snoozeBtn)

    val openAppBtn = TextView(this).apply {
      text = "Open RemindMe App →"
      setTextColor(Color.parseColor("#818CF8"))
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
      gravity = Gravity.CENTER
      typeface = Typeface.DEFAULT_BOLD
      setPadding(dp(8), dp(8), dp(8), dp(8))
      setOnClickListener {
        stopAllAlerts()
        dismissNotification()
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        if (launchIntent != null) {
          launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          startActivity(launchIntent)
        }
        finishAndRemoveTask()
      }
    }
    buttonRow.addView(openAppBtn)

    root.addView(buttonRow)
    return root
  }

  private fun dismissNotification() {
    try {
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
      nm?.cancelAll()
    } catch (e: Throwable) {
      Log.w(TAG, "Error cancelling notification", e)
    }
  }

  private fun snoozeReminder() {
    try {
      val snoozeIntent = Intent(this, AlarmActivity::class.java).apply {
        action = "com.remindme.app.ALARM_ACTION"
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
        putExtra("title", intent.getStringExtra("title") ?: "Snoozed Reminder")
        putExtra("body", intent.getStringExtra("body") ?: "Snoozed reminder is due now")
        putExtra("data", intent.getStringExtra("data"))
      }
      val piFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      } else {
        PendingIntent.FLAG_UPDATE_CURRENT
      }
      val pi = PendingIntent.getActivity(
        this,
        (System.currentTimeMillis() % 100000).toInt(),
        snoozeIntent,
        piFlag
      )
      val am = getSystemService(Context.ALARM_SERVICE) as? AlarmManager
      val triggerAtMillis = System.currentTimeMillis() + 10 * 60 * 1000
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        am?.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi)
      } else {
        am?.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pi)
      }
    } catch (e: Throwable) {
      Log.w(TAG, "Error snoozing reminder", e)
    }
  }

  private fun dp(value: Int): Int {
    return (value * resources.displayMetrics.density).toInt()
  }

  override fun onDestroy() {
    super.onDestroy()
    stopAllAlerts()
  }

  override fun onPause() {
    super.onPause()
    if (isFinishing) {
      stopAllAlerts()
    }
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

      let alarmActivity = application.activity.find(
        (act) => act.$ && act.$['android:name'] === '.AlarmActivity'
      );
      if (!alarmActivity) {
        alarmActivity = {
          $: {
            'android:name': '.AlarmActivity',
          },
        };
        application.activity.push(alarmActivity);
      }
      alarmActivity.$['android:exported'] = 'true';
      alarmActivity.$['android:showWhenLocked'] = 'true';
      alarmActivity.$['android:turnScreenOn'] = 'true';
      alarmActivity.$['android:showOnLockScreen'] = 'true';
      alarmActivity.$['android:excludeFromRecents'] = 'true';
      alarmActivity.$['android:noHistory'] = 'true';
      alarmActivity.$['android:launchMode'] = 'singleInstance';
      alarmActivity.$['android:taskAffinity'] = 'com.remindme.app.alarm';
      alarmActivity.$['android:screenOrientation'] = 'portrait';
      alarmActivity.$['android:theme'] = '@style/AppTheme';
    }

    return config;
  });

  // 2. DangerousMod: Write AlarmModule.kt, AlarmPackage.kt, and AlarmActivity.kt into native Android directory
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const targetDir = path.join(projectRoot, 'app', 'src', 'main', 'java', 'com', 'remindme', 'app');

      if (fs.existsSync(targetDir)) {
        fs.writeFileSync(path.join(targetDir, 'AlarmModule.kt'), ALARM_MODULE_KOTLIN, 'utf8');
        fs.writeFileSync(path.join(targetDir, 'AlarmPackage.kt'), ALARM_PACKAGE_KOTLIN, 'utf8');
        fs.writeFileSync(path.join(targetDir, 'AlarmActivity.kt'), ALARM_ACTIVITY_KOTLIN, 'utf8');
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
