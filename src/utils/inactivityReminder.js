import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const LAST_ACTIVE_KEY = "lex_last_active_at";
const REMINDER_NOTIFICATION_ID = 3001;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const isNativeApp = () => Capacitor.getPlatform() !== "web";

const getReminderTitle = (horses = []) => {
  if (horses.length === 1) {
    return `Any updates for ${horses[0]?.name || "your horse"}?`;
  }

  return "Any updates for your horses?";
};

export const getLastActiveAt = () => {
  const raw = localStorage.getItem(LAST_ACTIVE_KEY);
  const parsed = Number(raw || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const markAppActiveNow = async () => {
  localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));

  if (!isNativeApp()) return;

  try {
    await LocalNotifications.cancel({
      notifications: [{ id: REMINDER_NOTIFICATION_ID }],
    });

    await LocalNotifications.removeAllDeliveredNotifications();
  } catch (e) {
    console.log("CLEAR REMINDER NOTIFICATIONS ERROR:", e);
  }
};

export const ensureReminderPermissions = async () => {
  if (!isNativeApp()) return false;

  try {
    const current = await LocalNotifications.checkPermissions();

    if (current.display === "granted") {
      return true;
    }

    const requested = await LocalNotifications.requestPermissions();
    return requested.display === "granted";
  } catch (e) {
    console.log("NOTIFICATION PERMISSION ERROR:", e);
    return false;
  }
};

export const syncInactivityReminder = async ({ horses = [] } = {}) => {
  if (!isNativeApp()) return false;

  const hasPermission = await ensureReminderPermissions();
  if (!hasPermission) return false;

  try {
    await LocalNotifications.cancel({
      notifications: [{ id: REMINDER_NOTIFICATION_ID }],
    });
  } catch (e) {
    console.log("CANCEL REMINDER ERROR:", e);
  }

  const lastActiveAt = getLastActiveAt() || Date.now();
  const notifyAt = new Date(lastActiveAt + THREE_DAYS_MS);

  if (notifyAt.getTime() <= Date.now()) {
    return false;
  }

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REMINDER_NOTIFICATION_ID,
          title: getReminderTitle(horses),
          body: "Tap to add a cost, care appointment, or log.",
          schedule: {
            at: notifyAt,
          },
          extra: {
            type: "lex_inactivity_reminder",
          },
        },
      ],
    });

    return true;
  } catch (e) {
    console.log("SCHEDULE REMINDER ERROR:", e);
    return false;
  }
};

export const isInactivityReminderAction = (notificationAction) => {
  return (
    notificationAction?.notification?.id === REMINDER_NOTIFICATION_ID ||
    notificationAction?.notification?.extra?.type === "lex_inactivity_reminder"
  );
};