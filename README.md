# ⏰ RemindMe - Android Reminder & Notification App

A modern, responsive Android application built with React Native and Expo that allows you to schedule reminders with exact-time notifications, sound, vibration, and local persistence.

---

## ✨ Features

- **Exact-Time Notifications**: Schedule notifications at a specific date and time using Android's notification channels and high-priority alerts (`expo-notifications`).
- **Flexible Recurrence**: Set one-time reminders, daily recurring reminders, or weekly reminders.
- **Quick-Add Presets**: Set reminders quickly for `+15 mins`, `+1 hour`, `Tonight (8 PM)`, or `Tomorrow (9 AM)` with one tap.
- **Category & Tagging**: Organize reminders into categories (`General`, `Work`, `Personal`, `Health`, `Urgent`, `Study`) with distinct color badges.
- **Persistent Storage**: All reminders and their completion statuses are saved locally using `@react-native-async-storage/async-storage` and persist across device reboots.
- **Actions**:
  - **Mark Done**: Toggle completion with visual strikethrough.
  - **Snooze**: Postpone a reminder by 10 minutes with one click.
  - **Edit & Delete**: Update reminder title, time, notes, or delete reminders.
  - **Test Alert**: A dedicated button in the header to instantly verify that notifications, sound, and vibrations work properly on your device.
- **Filtering & Search**:
  - Filter tabs: *All*, *Today*, *Upcoming*, and *Done*.
  - Fast instant text search across titles and descriptions.

---

## 📱 How to Run and Test on Your Android Phone

### Step 1: Install Expo Go on your Android Phone
Download and install **Expo Go** (free) from the Google Play Store on your Android phone:
👉 [Expo Go on Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

### Step 2: Start the Development Server
Open a terminal in the `reminder-app` directory:
```bash
cd "reminder-app"
npx expo start
```
*(Make sure your computer and phone are connected to the same Wi-Fi network, or use `npx expo start --tunnel` if on different networks).*

### Step 3: Scan the QR Code
1. Open the **Expo Go** app on your Android phone.
2. Tap **"Scan QR code"**.
3. Point your camera at the QR code shown in your computer terminal.
4. The app will bundle and load right on your phone!
5. When prompted, grant **Notification permissions** so the app can schedule alerts.

---

## 📦 Building a Standalone Android APK

If you want an installable `.apk` file:
```bash
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Login to your free Expo account
eas login

# 3. Configure and build an APK
eas build -p android --profile preview
```

---

## 📂 Project Structure

```
reminder-app/
├── App.tsx                          # Root component with state & notification listeners
├── app.json                         # Android permissions & expo-notifications plugin config
├── package.json                     # Dependencies & scripts
├── src/
│   ├── components/
│   │   ├── AddReminderModal.tsx     # Modal with native DateTimePicker & quick presets
│   │   ├── EmptyState.tsx           # Empty filter / search illustrations
│   │   ├── FilterBar.tsx            # Search bar, status tabs, and category chips
│   │   ├── Header.tsx               # Header with metrics and Test Alert trigger
│   │   └── ReminderCard.tsx         # Reminder item card with toggle, snooze, delete
│   ├── services/
│   │   ├── notificationService.ts   # Android notification channels, permissions & scheduling
│   │   └── storageService.ts        # AsyncStorage persistence and reminder CRUD
│   ├── theme/
│   │   └── theme.ts                 # Color palette & category chip styling
│   ├── types/
│   │   └── reminder.ts              # TypeScript interfaces for reminders & categories
│   └── utils/
│       └── dateUtils.ts             # Date and time formatting helpers & relative countdowns
```
