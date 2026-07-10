import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { Clock, Menu } from "lucide-react";
import { db, auth } from "../firebase";
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import lexHorseIcon from "../assets/lex-horse-icon.png";
import BottomNav from "../components/BottomNav";

const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://lex-equine-api.onrender.com";

function AskLexIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M8 10.5C8 8.6 9.6 7 11.5 7H20.5C22.4 7 24 8.6 24 10.5V16.5C24 18.4 22.4 20 20.5 20H15.2L11.2 23.5V20H11.5C9.6 20 8 18.4 8 16.5V10.5Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 12.8H20" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M12 16H17.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function SickWatchIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 30 30" fill="none" aria-hidden="true">
      <path
        d="M15 8V22M8 15H22"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HorsesIcon() {
  return (
    <img
      src={lexHorseIcon}
      alt="Horses"
      style={{
        width: 32,
        height: 32,
        objectFit: "contain",
        display: "block",
      }}
    />
  );
}

function CareIcon() {
  return <Clock size={30} strokeWidth={1.9} />;
}

function CostsIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.9" />
      <path d="M16 10.5V21.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path
        d="M19 12.8C18.4 12 17.3 11.5 16 11.5C14.1 11.5 12.7 12.5 12.7 14C12.7 15.4 13.8 16 16 16.5C18.2 17 19.3 17.6 19.3 19C19.3 20.5 17.9 21.5 16 21.5C14.7 21.5 13.5 21 12.8 20.2"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EventsIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect
        x="6"
        y="7"
        width="20"
        height="19"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path d="M10 5.5V9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M22 5.5V9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M6 12.5H26" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="12" cy="17.5" r="1.4" fill="currentColor" />
      <circle cx="16" cy="17.5" r="1.4" fill="currentColor" />
      <circle cx="20" cy="17.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

function ResourcesIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M16 26C16 26 23 19.4 23 14.2C23 10.6 19.9 7.7 16 7.7C12.1 7.7 9 10.6 9 14.2C9 19.4 16 26 16 26Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="14.2" r="2.8" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}

function DocumentsIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M11 6.5H18L23 11.5V24.5C23 25.6 22.1 26.5 21 26.5H11C9.9 26.5 9 25.6 9 24.5V8.5C9 7.4 9.9 6.5 11 6.5Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M18 6.5V11.5H23"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M12.5 16H19.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M12.5 20H19.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

const getDaysUntil = (value) => {
  if (!value) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const due = new Date(value);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();

  return Math.round((dueDay - today) / 86400000);
};

const getHorseId = (item) => {
  return item?.horseId || item?.selectedHorseId || item?.horse?.id || null;
};
const formatShortDate = (value) => {
  if (!value) return "";

  const date = new Date(value);
  const today = new Date();
  const tomorrow = new Date();

  tomorrow.setDate(today.getDate() + 1);

  const isToday = date.toDateString() === today.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  if (isToday) return "Today";
  if (isTomorrow) return "Tomorrow";

  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const formatTaskTime = (time) => {
  if (!time) return "";

  const [hourRaw, minute = "00"] = String(time).split(":");
  const hour = Number(hourRaw);

  if (Number.isNaN(hour)) return "";

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${suffix}`;
};

const getWeatherLocationName = async (latitude, longitude) => {
  try {
    const response = await fetch(
      `https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=${process.env.REACT_APP_OPENWEATHER_API_KEY}`
    );

    const data = await response.json();
    const place = data?.[0];

    if (!place) return "Current Location";

    return `${place.name}${place.state ? `, ${place.state}` : ""}`;
  } catch (e) {
    console.log("WEATHER LOCATION NAME ERROR:", e);
    return "Current Location";
  }
};

const formatWeatherTime = (timestamp) => {
  if (!timestamp) return "";

  return new Date(timestamp * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
};

const getWeatherEmoji = (condition) => {
  const value = String(condition || "").toLowerCase();

  if (value.includes("rain")) return "🌧";
  if (value.includes("storm")) return "⛈";
  if (value.includes("cloud")) return "☁️";
  if (value.includes("snow")) return "❄️";
  if (value.includes("clear")) return "☀️";
  if (value.includes("sun")) return "☀️";
  if (value.includes("fog")) return "🌫";
  if (value.includes("mist")) return "🌫";

  return "🌤";
};

const getTodayHourlyWeather = (weatherData) => {
  if (!weatherData?.hourly?.length) return [];

  const now = new Date();

  return weatherData.hourly.filter((hour) => {
    const hourDate = new Date(hour.dt * 1000);

    return (
      hourDate.getFullYear() === now.getFullYear() &&
      hourDate.getMonth() === now.getMonth() &&
      hourDate.getDate() === now.getDate()
    );
  });
};

const getWeatherTiming = (weatherData) => {
  const hours = getTodayHourlyWeather(weatherData);

  if (!hours.length) {
    return {
      highTime: "",
      lowTime: "",
      rainTime: "",
    };
  }

  const highHour = hours.reduce((highest, hour) =>
    hour.temp > highest.temp ? hour : highest
  );

  const lowHour = hours.reduce((lowest, hour) =>
    hour.temp < lowest.temp ? hour : lowest
  );

  const rainHour = hours.find((hour) => {
    const pop = Number(hour.pop || 0);
    const rainAmount = Number(hour.rain?.["1h"] || 0);
    return pop >= 0.3 || rainAmount > 0;
  });

  return {
    highTime: formatWeatherTime(highHour.dt),
    lowTime: formatWeatherTime(lowHour.dt),
    rainTime: rainHour ? formatWeatherTime(rainHour.dt) : "",
  };
};

const getNextRainHour = (weatherData) => {
  if (!weatherData?.hourly?.length) return null;

  const now = Date.now();
  const next24Hours = now + 24 * 60 * 60 * 1000;

  return weatherData.hourly.find((hour) => {
    const hourTime = hour.dt * 1000;

    if (hourTime < now || hourTime > next24Hours) {
      return false;
    }

    const pop = Number(hour.pop || 0);
    const rainAmount = Number(hour.rain?.["1h"] || 0);

    const conditionMain = String(
      hour.weather?.[0]?.main || ""
    ).toLowerCase();

    const conditionDescription = String(
      hour.weather?.[0]?.description || ""
    ).toLowerCase();

    const conditionSaysRain =
      conditionMain === "rain" ||
      conditionMain === "thunderstorm" ||
      conditionDescription.includes("rain") ||
      conditionDescription.includes("shower") ||
      conditionDescription.includes("storm");

    return (
      conditionSaysRain &&
      pop >= 0.7 &&
      rainAmount >= 0.03
    );
  });
};

const getFirstHourAtOrBelowTemp = (weatherData, threshold) => {
  if (!weatherData?.hourly?.length || threshold === "" || threshold == null) {
    return null;
  }

  const thresholdNumber = Number(threshold);

  if (Number.isNaN(thresholdNumber)) return null;

  const now = Date.now();
  const next24Hours = now + 24 * 60 * 60 * 1000;

  return weatherData.hourly.find((hour) => {
    const hourTime = hour.dt * 1000;

    if (hourTime < now || hourTime > next24Hours) {
      return false;
    }

    return Number(hour.temp) <= thresholdNumber;
  });
};

export default function HomePage({
  user,
  horses = [],
  careHorses = [],
  careHorsesStatus = "",
  onAsk,
}) {
  const navigate = useNavigate();

  const [activeReminders, setActiveReminders] = useState([]);
  const [activeEvents, setActiveEvents] = useState([]);
  const [feedInventoryItems, setFeedInventoryItems] = useState([]);
  const [weatherData, setWeatherData] = useState(null);
const [weatherStatus, setWeatherStatus] = useState("");
const [weatherLocation, setWeatherLocation] = useState(null);
const [weatherUpdatedAt, setWeatherUpdatedAt] = useState(null);
const [isWeatherModalOpen, setIsWeatherModalOpen] = useState(false);
  const [homeDataStatus, setHomeDataStatus] = useState("");

  const [isAskLexOpen, setIsAskLexOpen] = useState(false);
    const [lexQuestion, setLexQuestion] = useState("");
  const [lexAnswer, setLexAnswer] = useState("");
  const [lexLoading, setLexLoading] = useState(false);
  const [lexPhoto, setLexPhoto] = useState(null);
  const [lexPhotoPreview, setLexPhotoPreview] = useState("");

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const homeBg = "#F6F4EE";
  const cardBg = "#FFFFFF";
  const borderColor = "#E5E2DA";
  const navy = "#24324A";
  const navyPressed = "#1B2538";
  const navyBorder = "#31425F";
  const primaryText = "#1E1E1E";
  const secondaryText = "#6F6A60";
  const burgundy = "#7A2E2E";
  const upcomingGoldText = "#6E5A36";
  const upcomingGoldBg = "#F5EEDB";

  const currentTemp = Math.round(weatherData?.current?.temp || 0);

const todayHigh = Math.round(weatherData?.daily?.[0]?.temp?.max || 0);

const todayLow = Math.round(weatherData?.daily?.[0]?.temp?.min || 0);

const currentWeather =
  weatherData?.current?.weather?.[0]?.main || "Weather";

const windSpeed = Math.round(weatherData?.current?.wind_speed || 0);

const rainChance = Math.round(
  (weatherData?.daily?.[0]?.pop || 0) * 100
);

const weatherTiming = getWeatherTiming(weatherData);

const highTime = weatherTiming.highTime;
const lowTime = weatherTiming.lowTime;
const rainTime = weatherTiming.rainTime;

const todayHourlyWeather = (weatherData?.hourly || []).slice(0, 24);

  useEffect(() => {
    const loadHomeData = async () => {
      if (!user?.uid) {
  setActiveReminders([]);
  setActiveEvents([]);
  setFeedInventoryItems([]);
  setHomeDataStatus("");
  return;
}

      try {
        const reminderQuery = query(
          collection(db, "reminders"),
          where("ownerUid", "==", user.uid),
          where("completed", "==", false)
        );

        const feedQuery = query(
  collection(db, "feed_inventory"),
  where("ownerUid", "==", user.uid)
);

        const eventQuery = query(
          collection(db, "events"),
          where("ownerUid", "==", user.uid),
          where("completed", "==", false)
        );

        const [reminderSnap, eventSnap, feedSnap] = await Promise.all([
  getDocs(reminderQuery),
  getDocs(eventQuery),
  getDocs(feedQuery),
]);

        const reminderItems = reminderSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0));

        const eventItems = eventSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.eventDate || 0) - (b.eventDate || 0));
          const feedItems = feedSnap.docs
  .map((d) => ({ id: d.id, ...d.data() }))
  .sort((a, b) => {
    const aDays = a.estimatedDaysRemaining ?? 999;
    const bDays = b.estimatedDaysRemaining ?? 999;
    return aDays - bDays;
  });

        setActiveReminders(reminderItems);
setActiveEvents(eventItems);
setFeedInventoryItems(feedItems);
setHomeDataStatus("");
      } catch (e) {
        console.log("HOME DATA LOAD ERROR:", e);
        setActiveReminders([]);
setActiveEvents([]);
setFeedInventoryItems([]);
setHomeDataStatus("Could not load homepage data.");
      }
    };

    loadHomeData();
  }, [user]);

  const loadWeather = async (coords) => {
  const apiKey = process.env.REACT_APP_OPENWEATHER_API_KEY;

  if (!apiKey) {
    setWeatherStatus("Weather API key missing.");
    setWeatherData(null);
    return;
  }

  try {
    setWeatherStatus("Loading weather...");

    const latitude = coords?.latitude;
const longitude = coords?.longitude;

if (!latitude || !longitude) {
  setWeatherStatus("Location needed for weather.");
  setWeatherData(null);
  return;
}

    const response = await fetch(
      `https://api.openweathermap.org/data/3.0/onecall?lat=${latitude}&lon=${longitude}&exclude=minutely&units=imperial&appid=${apiKey}`
    );

    if (!response.ok) {
      const errorText = await response.text();
throw new Error(`Weather request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

   setWeatherData(data);
setWeatherUpdatedAt(new Date());
setWeatherStatus("");

await checkBlanketAlerts(data);
  } catch (e) {
    console.log("LOAD WEATHER ERROR:", e?.message || e);
alert(e?.message || "Weather error");
    setWeatherData(null);
    setWeatherStatus("Could not load weather.");
  }
};

const checkBlanketAlerts = async (data) => {
  if (!user?.uid || !data || !horses?.length) return;

  try {
    const userSnap = await getDoc(doc(db, "users", user.uid));
    const userData = userSnap.exists() ? userSnap.data() : null;

    if (!userData?.pushToken) return;

    const todayKey = new Date().toDateString();

    for (const horse of horses) {
      if (!horse.blanketingEnabled) continue;

      let alertTitle = "";
      let alertBody = "";

      if (horse.heavyweightEnabled) {
        const heavyHour = getFirstHourAtOrBelowTemp(
          data,
          horse.heavyweightTemp
        );

        if (
          heavyHour &&
          horse.lastHeavyBlanketPush !== todayKey
        ) {
          alertTitle = "Heavyweight Blanket Recommended";
          alertBody = `${horse.name} may need a heavyweight blanket around ${formatWeatherTime(
            heavyHour.dt
          )}. Forecast temp: ${Math.round(heavyHour.temp)}°.`;
        }
      }

      if (!alertTitle && horse.midweightEnabled) {
        const midHour = getFirstHourAtOrBelowTemp(
          data,
          horse.midweightTemp
        );

        if (
          midHour &&
          horse.lastMidBlanketPush !== todayKey
        ) {
          alertTitle = "Midweight Blanket Recommended";
          alertBody = `${horse.name} may need a midweight blanket around ${formatWeatherTime(
            midHour.dt
          )}. Forecast temp: ${Math.round(midHour.temp)}°.`;
        }
      }

      if (!alertTitle) continue;

      await fetch(`${API_BASE_URL}/send-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: userData.pushToken,
          title: alertTitle,
          body: alertBody,
          data: {
            type: "blanket_alert",
            horseId: horse.id,
          },
        }),
      });

      const updateData = {};

if (alertTitle.includes("Heavyweight")) {
  updateData.lastHeavyBlanketPush = todayKey;
}

if (alertTitle.includes("Midweight")) {
  updateData.lastMidBlanketPush = todayKey;
}

await updateDoc(doc(db, "horses", horse.id), updateData);
    }
  } catch (e) {
    console.log("BLANKET PUSH ERROR:", e);
  }
};

useEffect(() => {
  if (!navigator.geolocation) {
    setWeatherStatus("Location is not supported on this device.");
    setWeatherData(null);
    return;
  }

  setWeatherStatus("Getting location...");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      getWeatherLocationName(coords.latitude, coords.longitude).then((locationName) => {
  setWeatherLocation({
    ...coords,
    name: locationName,
  });
});

loadWeather(coords);
    },
    (error) => {
      console.log("LOCATION ERROR:", error);
      setWeatherStatus("Location access is needed for weather.");
      setWeatherData(null);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000,
    }
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  const urgentCards = useMemo(() => {
    const grouped = {};
    const now = Date.now();
    const threeDaysFromNow = now + 3 * 24 * 60 * 60 * 1000;

    (horses || []).forEach((horse) => {
      if (!horse?.id) return;

      grouped[horse.id] = {
        horse,
        sickWatch: horse.sickWatchOn ? horse : null,
        reminder: null,
        event: null,
      };
    });

    activeReminders.forEach((item) => {
      const horseId = getHorseId(item);
      if (!horseId) return;

      const due = item?.dueDate || 0;
      if (due < now || due > threeDaysFromNow) return;

      if (!grouped[horseId]) {
        grouped[horseId] = {
          horse: { id: horseId, name: item.horseName || "Unnamed" },
          sickWatch: null,
          reminder: null,
          event: null,
        };
      }

      const existing = grouped[horseId].reminder;
      if (!existing || due < (existing.dueDate || 0)) {
        grouped[horseId].reminder = item;
      }
    });

    activeEvents.forEach((event) => {
      const horseId = getHorseId(event);
      if (!horseId) return;

      const days = getDaysUntil(event.eventDate);
      if (days !== 3) return;

      if (!grouped[horseId]) {
        grouped[horseId] = {
          horse: { id: horseId, name: event.horseName || "Unnamed" },
          sickWatch: null,
          reminder: null,
          event: null,
        };
      }

      const existing = grouped[horseId].event;
      if (!existing || (event.eventDate || 0) < (existing.eventDate || 0)) {
        grouped[horseId].event = event;
      }
    });

    return Object.values(grouped)
      .filter((item) => item.sickWatch || item.reminder || item.event)
      .sort((a, b) => (a.horse?.name || "").localeCompare(b.horse?.name || ""));
  }, [horses, activeReminders, activeEvents]);

  const upcomingTasks = useMemo(() => {
  const reminderTasks = activeReminders.map((item) => ({
    id: item.id,
    type: "reminder",
    horseName: item.horseName || "Unnamed",
    title: item.title || item.type || "Care Item",
    date: item.dueDate,
    time: item.time || "",
  }));

  const eventTasks = activeEvents.map((event) => ({
    id: event.id,
    type: "event",
    horseName: event.horseName || "Unnamed",
    title: event.title || event.eventType || "Event",
    date: event.eventDate,
    time: event.time || "",
  }));

  return [...reminderTasks, ...eventTasks]
  .filter((item) => {
    const days = getDaysUntil(item.date);
    return days != null && days >= -999 && days <= 3;
  })
  .sort((a, b) => (a.date || 0) - (b.date || 0))
  .slice(0, 3);
}, [activeReminders, activeEvents]);

const urgentAlerts = useMemo(() => {
  const alerts = [];

  horses.forEach((horse) => {
    if (!horse?.blanketingEnabled || !weatherData) return;

    const horseName = horse.name || "Unnamed";

    if (horse.rainSheetEnabled) {
      const rainHour = getNextRainHour(weatherData);

      if (rainHour) {
        alerts.push({
          id: `rain-${horse.id}`,
          type: "blanket-rain",
          title: "Rain Sheet Recommended",
          detail: `${horseName} may need a rain sheet around ${formatWeatherTime(rainHour.dt)}.`,
          route: "/horses",
        });
      }
    }

    if (horse.heavyweightEnabled) {
      const heavyThreshold = Number(horse.heavyweightTemp);
      const heavyHour = getFirstHourAtOrBelowTemp(weatherData, heavyThreshold);

      if (!Number.isNaN(heavyThreshold) && heavyHour) {
        alerts.push({
          id: `heavy-${horse.id}`,
          type: "blanket-heavy",
          title: "Heavyweight Blanket Recommended",
          detail: `${horseName} may need a heavyweight blanket around ${formatWeatherTime(
            heavyHour.dt
          )}. Forecast temp: ${Math.round(heavyHour.temp)}°.`,
          route: "/horses",
        });

        return;
      }
    }

    if (horse.midweightEnabled) {
      const midThreshold = Number(horse.midweightTemp);
      const midHour = getFirstHourAtOrBelowTemp(weatherData, midThreshold);

      if (!Number.isNaN(midThreshold) && midHour) {
        alerts.push({
          id: `mid-${horse.id}`,
          type: "blanket-mid",
          title: "Midweight Blanket Recommended",
          detail: `${horseName} may need a midweight blanket around ${formatWeatherTime(
            midHour.dt
          )}. Forecast temp: ${Math.round(midHour.temp)}°.`,
          route: "/horses",
        });
      }
    }
  });

  horses.forEach((horse) => {
    if (horse?.sickWatchOn) {
      alerts.push({
        id: `sick-${horse.id}`,
        type: "sickwatch",
        title: "Active Sick Watch",
        detail: `${horse.name || "Unnamed"} is currently being monitored.`,
        route: `/sick-watch?horseId=${horse.id}`,
      });
    }
  });

  feedInventoryItems.forEach((item) => {
    const days = item.estimatedDaysRemaining;

    if (days != null && days <= (item.lowThresholdDays || 3)) {
      alerts.push({
        id: `feed-${item.id}`,
        type: "feed",
        title: days <= 0 ? "Feed Supply Empty" : "Low Feed Supply",
        detail: `${item.horseName || "Unnamed"} — ${
          item.itemName || "Feed item"
        }: about ${days} day(s) remaining.`,
        route: "/horses",
      });
    }
  });

  activeReminders.forEach((item) => {
    const days = getDaysUntil(item.dueDate);

    if (days != null && days < 0) {
      alerts.push({
        id: `overdue-${item.id}`,
        type: "overdue",
        title: "Overdue Care",
        detail: `${item.horseName || "Unnamed"} — ${
          item.title || item.type || "Care item"
        } was due ${Math.abs(days)} day(s) ago.`,
        route: "/care",
      });
    }
  });

  return alerts.slice(0, 6);
}, [horses, feedInventoryItems, activeReminders, weatherData]);
const openWeatherModal = () => {
  setIsWeatherModalOpen(true);
};

const closeWeatherModal = () => {
  setIsWeatherModalOpen(false);
};

const startOrOpenSickWatch = async (horse) => {
  if (!horse?.id) return;

  if (horse.sickWatchOn) {
    navigate(`/sick-watch?horseId=${horse.id}`);
    return;
  }

  const confirmed = window.confirm(
    `Start Sick Watch for ${horse.name || "this horse"}?`
  );

  if (!confirmed) return;

  try {
    const startedAt = Date.now();

    await updateDoc(doc(db, "horses", horse.id), {
  sickWatchOn: true,
  sickWatchStartedAt: startedAt,
  activeSickWatchId: `${horse.id}_${startedAt}`,
  updatedAt: startedAt,
});

navigate(`/sick-watch?horseId=${horse.id}`, {
  state: {
    justStartedSickWatch: true,
    horseId: horse.id,
    startedAt,
  },
});
  } catch (e) {
    console.log("START SICK WATCH ERROR:", e);
    alert("Could not start Sick Watch.");
  }
};

    const openAskLex = () => {
    setIsAskLexOpen(true);
    setLexQuestion("");
    setLexAnswer("");
    setLexLoading(false);
    setLexPhoto(null);
    setLexPhotoPreview("");
  };

  const closeAskLex = () => {
    setIsAskLexOpen(false);
    setLexQuestion("");
    setLexAnswer("");
    setLexLoading(false);
    setLexPhoto(null);
    setLexPhotoPreview("");
  };

    const handleLexPhotoSelect = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      return;
    }

    setLexPhoto(file);
    setLexPhotoPreview(URL.createObjectURL(file));
    setLexAnswer("");
  };

    const handleAskLex = async () => {
    if (!lexQuestion.trim() && !lexPhoto) {
      alert("Type a question or choose a photo first.");
      return;
    }

    setLexLoading(true);
    setLexAnswer("");

    try {
      if (typeof onAsk === "function") {
                const result = await onAsk(lexQuestion.trim(), lexPhoto);

        if (typeof result === "string") {
          setLexAnswer(result);
        } else if (result?.answer) {
          setLexAnswer(result.answer);
        } else {
          setLexAnswer("Lex did not return an answer.");
        }
      } else {
        setLexAnswer("Ask Lex is not connected yet.");
      }
    } catch (e) {
      console.log("HOME ASK LEX ERROR:", e);
      setLexAnswer("Something went wrong while asking Lex.");
    } finally {
      setLexLoading(false);
    }
  };

  const copyLexAnswer = async () => {
    if (!lexAnswer) return;

    try {
      await navigator.clipboard.writeText(lexAnswer);
      alert("Answer copied.");
    } catch (e) {
      console.log("COPY LEX ANSWER ERROR:", e);
      alert("Could not copy answer.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsMenuOpen(false);
    } catch (e) {
      console.log("LOGOUT ERROR:", e);
      alert("Could not log out.");
    }
  };

  const openManageAccount = () => {
    setIsMenuOpen(false);
    navigate("/account");
  };

  const openPrivacyPolicy = () => {
    setIsMenuOpen(false);
    window.open("https://lexequine.com/#privacy", "_blank");
  };

  const tileBaseStyle = {
    minHeight: 154,
    borderRadius: 24,
    border: `1px solid ${navyBorder}`,
    background: navy,
    color: "#FFFFFF",
    boxShadow: "0 12px 24px rgba(24, 34, 51, 0.14)",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "flex-start",
    textAlign: "left",
    cursor: "pointer",
    position: "relative",
    overflow: "hidden",
  };

  const tiles = [
    {
      key: "horses",
      title: "Horses",
      subtitle: "Profiles",
      icon: <HorsesIcon />,
      onClick: () => navigate("/horses"),
      featured: false,
    },
    {
      key: "sickwatch",
      title: "Sick Watch",
      subtitle: "Monitoring",
      icon: <SickWatchIcon />,
      onClick: () => navigate("/sick-watch"),
      featured: false,
    },
    {
      key: "care",
      title: "Care",
      subtitle: "Schedule",
      icon: <CareIcon />,
      onClick: () => navigate("/care"),
      featured: false,
    },
    {
      key: "costs",
      title: "Costs",
      subtitle: "Tracking",
      icon: <CostsIcon />,
      onClick: () => navigate("/costs"),
      featured: false,
    },
    {
      key: "events",
      title: "Events",
      subtitle: "Competitions",
      icon: <EventsIcon />,
      onClick: () => navigate("/events"),
      featured: false,
    },
    {
      key: "resources",
      title: "Resources",
      subtitle: "Nearby help",
      icon: <ResourcesIcon />,
      onClick: () => navigate("/resources"),
      featured: false,
    },
    {
      key: "documents",
      title: "Documents",
      subtitle: "Paperwork",
      icon: <DocumentsIcon />,
      onClick: () => navigate("/documents"),
      featured: false,
    },
  
  ];

  return (
  <div
    style={{
      minHeight: "100vh",
      width: "100%",
      maxWidth: "100vw",
      overflowX: "hidden",
      boxSizing: "border-box",
      background: homeBg,
      color: primaryText,
      paddingBottom: 120,
    }}
  >
 <div
  style={{
    paddingTop: 8,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  }}
>
  <div>
    <button
      onClick={openAskLex}
      style={{
        border: `1px solid ${navyBorder}`,
        borderRadius: 999,
        padding: "10px 16px",
        background: navy,
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: 700,
        cursor: "pointer",
        boxShadow: "0 8px 18px rgba(24, 34, 51, 0.18)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <img
  src={lexHorseIcon}
  alt=""
  aria-hidden="true"
  style={{
    width: 22,
    height: 22,
    objectFit: "contain",
    display: "block",
    filter: "brightness(0) invert(1)",
  }}
/>
      Ask Lex
    </button>

    <div
      style={{
        marginTop: 10,
        fontSize: 20,
        color: secondaryText,
        fontWeight: 400,
      }}
    >
      Equine Care Intelligence
    </div>
  </div>

  {user ? (
    <button
      onClick={() => setIsMenuOpen(true)}
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: 14,
        width: 48,
        height: 48,
        background: "#FFFFFF",
        color: primaryText,
        cursor: "pointer",
        boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-label="Open account menu"
    >
      <Menu size={22} strokeWidth={2} />
    </button>
  ) : null}
</div>

      
     <div
  style={{
    marginTop: 22,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    alignItems: "stretch",
  }}
>
  <div
  onClick={openWeatherModal}
  style={{
    background: cardBg,
    cursor: "pointer",
      border: `1px solid ${borderColor}`,
      borderRadius: 20,
      padding: 14,
      boxShadow: "0 6px 14px rgba(0,0,0,0.04)",
    }}
  >
    <div
      style={{
        fontSize: 18,
        fontWeight: 700,
        color: primaryText,
        marginBottom: 8,
      }}
    >
      Weather
    </div>

    {weatherStatus ? (
      <div style={{ fontSize: 14, color: secondaryText }}>
        {weatherStatus}
      </div>
    ) : weatherData ? (
      <>
        <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  }}
>
  <div
    style={{
      fontSize: 34,
      fontWeight: 700,
      color: navy,
      lineHeight: 1,
    }}
  >
    {currentTemp}°
  </div>

  <div
    style={{
      fontSize: 14,
      color: secondaryText,
      textAlign: "right",
      marginTop: 4,
    }}
  >
    {currentWeather}
  </div>
</div>

<div
  style={{
    marginTop: 8,
    fontSize: 13,
    color: secondaryText,
    lineHeight: 1.4,
  }}
>
  {weatherLocation?.name || "Current Location"}
</div>

{weatherUpdatedAt ? (
  <div
    style={{
      marginTop: 2,
      fontSize: 12,
      color: secondaryText,
      lineHeight: 1.4,
    }}
  >
    Updated{" "}
    {weatherUpdatedAt.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}
  </div>
) : null}

<div
  style={{
    marginTop: 10,
    fontSize: 14,
    color: secondaryText,
    lineHeight: 1.5,
  }}
>
  High {todayHigh}° {highTime ? `at ${highTime}` : ""}
</div>

<div
  style={{
    fontSize: 14,
    color: secondaryText,
    lineHeight: 1.5,
  }}
>
  Low {todayLow}° {lowTime ? `at ${lowTime}` : ""}
</div>

        <div
  style={{
    marginTop: 10,
    fontSize: 13,
    color: secondaryText,
    lineHeight: 1.5,
  }}
>
  Wind {windSpeed} mph
</div>

<div
  style={{
    fontSize: 13,
    color: secondaryText,
    lineHeight: 1.5,
  }}
>
  Rain {rainChance}%
  {rainTime ? ` around ${rainTime}` : ""}
</div>
      </>
    ) : (
      <div style={{ fontSize: 14, color: secondaryText }}>
        Weather unavailable.
      </div>
    )}
  </div>

  <div
    style={{
      background: cardBg,
      border: `1px solid ${borderColor}`,
      borderRadius: 20,
      padding: 14,
      boxShadow: "0 6px 14px rgba(0,0,0,0.04)",
    }}
  >
    <div
      style={{
        fontSize: 18,
        fontWeight: 700,
        color: primaryText,
        marginBottom: 12,
      }}
    >
      Upcoming
    </div>

    {homeDataStatus ? (
      <div style={{ fontSize: 14, color: burgundy }}>
        {homeDataStatus}
      </div>
    ) : upcomingTasks.length === 0 ? (
      <div style={{ fontSize: 14, color: secondaryText }}>
        No upcoming tasks right now.
      </div>
    ) : (
      <div style={{ display: "grid", gap: 10 }}>
        {upcomingTasks.map((task) => (
          <div
            key={`${task.type}-${task.id}`}
            onClick={() =>
              navigate(task.type === "event" ? "/events" : "/care")
            }
            style={{
              border: `1px solid ${borderColor}`,
              borderRadius: 14,
              padding: "10px 12px",
              background: "#FBF8F2",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: primaryText,
                lineHeight: 1.25,
              }}
            >
              {task.title}
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 13,
                color: secondaryText,
                lineHeight: 1.35,
              }}
            >
              {task.horseName} · {formatShortDate(task.date)}
              {task.time ? ` ${formatTaskTime(task.time)}` : ""}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
</div>

{urgentAlerts.length > 0 ? (
  <div
    style={{
      marginTop: 14,
      background: cardBg,
      border: `1px solid ${borderColor}`,
      borderRadius: 22,
      padding: 16,
      boxShadow: "0 8px 18px rgba(0,0,0,0.05)",
    }}
  >
    <div
      style={{
        fontSize: 18,
        fontWeight: 700,
        color: primaryText,
        marginBottom: 12,
      }}
    >
      Urgent Alerts
    </div>

    <div style={{ display: "grid", gap: 10 }}>
      {urgentAlerts.map((alert) => (
  <div
    key={alert.id}
          style={{
            border: `1px solid ${borderColor}`,
            borderRadius: 16,
            padding: "12px 14px",
            background: "#F2E8E7",
            cursor: "default",
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: burgundy,
              lineHeight: 1.25,
            }}
          >
            {alert.title}
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              color: primaryText,
              lineHeight: 1.35,
            }}
          >
            {alert.detail}
          </div>
        </div>
      ))}
    </div>
  </div>
) : null}

<div
  style={{
    marginTop: 14,
    background: cardBg,
    border: `1px solid ${borderColor}`,
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 8px 18px rgba(0,0,0,0.05)",
  }}
>
  <div
    style={{
      fontSize: 18,
      fontWeight: 700,
      color: primaryText,
      marginBottom: 12,
    }}
  >
    My Horses
  </div>

  <div style={{ display: "grid", gap: 12 }}>
    {horses.map((horse) => (
      <div
  key={horse.id}
  onClick={() => navigate("/horses")}
  style={{
  border: `1px solid ${navyBorder}`,
  borderRadius: 16,
  padding: 14,
  background: navy,
  boxShadow: "0 8px 18px rgba(0,0,0,0.05)",
}}
      >
        <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  }}
>
  <div>
    <div
      style={{
        fontSize: 20,
        fontWeight: 700,
        color: "#FFFFFF",
      }}
    >
      {horse.name || "Unnamed"}
    </div>

    <div
      style={{
        marginTop: 4,
        fontSize: 14,
        color: "rgba(255,255,255,0.82)",
      }}
    >
      {horse.age ? `${horse.age} yrs` : ""}
      {horse.sex ? ` • ${horse.sex}` : ""}
    </div>
  </div>

  {horse.photoUrl ? (
    <img
      src={horse.photoUrl}
      alt={horse.name}
      style={{
        width: 64,
        height: 64,
        borderRadius: "50%",
        objectFit: "cover",
        border: "2px solid rgba(255,255,255,0.8)",
      }}
    />
  ) : null}
</div>

<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    marginTop: 14,
  }}
>
  {[
  { label: "Log", route: `/horses?horseId=${horse.id}&openLog=true` },
  { label: "Care", route: `/care?horseId=${horse.id}` },
  { label: "Costs", route: `/costs?horseId=${horse.id}` },
  { label: "Feed", route: `/horses?horseId=${horse.id}&openFeedInventory=true` },
  { label: "Docs", route: `/documents?horseId=${horse.id}` },
  { label: "Sick Watch", action: () => startOrOpenSickWatch(horse) },
].map((item) => (
    <button
      key={item.label}
onClick={(e) => {
  e.stopPropagation();

  if (item.action) {
    item.action();
    return;
  }

  navigate(item.route);
}}
      style={{
        border: "1px solid rgba(255,255,255,0.35)",
        borderRadius: 12,
        padding: "10px 6px",
        background: "rgba(255,255,255,0.12)",
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {item.label}
    </button>
  ))}
</div>

      </div>
    ))}
  </div>
</div>

{careHorses.length > 0 || careHorsesStatus ? (
  <div
    style={{
      marginTop: 14,
      background: cardBg,
      border: `1px solid ${borderColor}`,
      borderRadius: 22,
      padding: 16,
      boxShadow: "0 8px 18px rgba(0,0,0,0.05)",
    }}
  >
    <div
      style={{
        fontSize: 18,
        fontWeight: 700,
        color: primaryText,
        marginBottom: 12,
      }}
    >
      Care Horses
    </div>

    {careHorsesStatus ? (
      <div style={{ fontSize: 14, color: secondaryText }}>
        {careHorsesStatus}
      </div>
    ) : (
      <div style={{ display: "grid", gap: 12 }}>
        {careHorses.map((horse) => (
  <div
    key={horse.id}
    style={{
      border: `1px solid ${borderColor}`,
      borderRadius: 16,
      padding: 14,
      background: "#FBF8F2",
      boxShadow: "0 8px 18px rgba(0,0,0,0.04)",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: primaryText,
          }}
        >
          {horse.name || "Unnamed"}
        </div>

        <div
          style={{
            marginTop: 4,
            fontSize: 14,
            color: secondaryText,
          }}
        >
          {horse.age ? `${horse.age} yrs` : ""}
          {horse.sex ? ` • ${horse.sex}` : ""}
        </div>
      </div>

      {horse.photoUrl ? (
        <img
          src={horse.photoUrl}
          alt={horse.name}
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            objectFit: "cover",
            border: `2px solid ${borderColor}`,
          }}
        />
      ) : null}
    </div>

    <button
  onClick={() => navigate(`/daily-care/${horse.id}?mode=caretaker`)}
  style={{
    width: "100%",
    marginTop: 14,
    border: `1px solid ${borderColor}`,
    borderRadius: 14,
    padding: "12px",
    background: "#FFFFFF",
    color: primaryText,
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  }}
>
  Today's Care
</button>
  </div>
))}
      </div>
    )}
  </div>
) : null}

      {isMenuOpen ? (
        <div className="modal-backdrop" onClick={() => setIsMenuOpen(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />

            <div
              style={{
                fontSize: 30,
                fontWeight: 600,
                color: navy,
                marginBottom: 16,
              }}
            >
              Account Menu
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <button className="secondary-button" onClick={openManageAccount}>
                Manage Account
              </button>

              <button className="secondary-button" onClick={openPrivacyPolicy}>
                Privacy Policy/Terms & Disclaimers
              </button>

              <button
                className="secondary-button"
                onClick={handleLogout}
                style={{ borderColor: burgundy, color: burgundy }}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isWeatherModalOpen ? (
  <div
    onClick={closeWeatherModal}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      zIndex: 2000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "100%",
        maxWidth: 520,
        maxHeight: "85vh",
        overflowY: "auto",
        background: "#FFFFFF",
        borderRadius: 22,
        padding: 18,
        boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: primaryText,
            }}
          >
            Hourly Weather
          </div>

          <div
            style={{
              fontSize: 14,
              color: secondaryText,
              marginTop: 4,
            }}
          >
            Next 24 hours
          </div>
        </div>

        <button
          onClick={closeWeatherModal}
          style={{
            border: "none",
            background: "transparent",
            fontSize: 28,
            cursor: "pointer",
            color: secondaryText,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {todayHourlyWeather.map((hour) => {
          const rainChance = Math.round((hour.pop || 0) * 100);

          return (
            <div
              key={hour.dt}
              style={{
                border: `1px solid ${borderColor}`,
                borderRadius: 16,
                padding: "12px 14px",
                background: "#FBF8F2",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: primaryText,
                    }}
                  >
                    {formatWeatherTime(hour.dt)}
                  </div>

                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 13,
                      color: secondaryText,
                    }}
                  >
                    {getWeatherEmoji(hour.weather?.[0]?.main)} {hour.weather?.[0]?.main || "Weather"}
                  </div>
                </div>

                <div
                  style={{
                    textAlign: "right",
                  }}
                >
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: navy,
                    }}
                  >
                    {Math.round(hour.temp)}°
                  </div>

                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 13,
                      color: secondaryText,
                    }}
                  >
                    Rain {rainChance}%
                  </div>

                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 13,
                      color: secondaryText,
                    }}
                  >
                    Wind {Math.round(hour.wind_speed || 0)} mph
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
) : null}

      
      {isAskLexOpen ? (
        <div className="modal-backdrop" onClick={closeAskLex}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 30,
                  fontWeight: 600,
                  color: navy,
                }}
              >
                Ask Lex
              </h3>

              <button
                onClick={closeAskLex}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 24,
                  cursor: "pointer",
                  color: secondaryText,
                }}
              >
                ×
              </button>
            </div>

            <textarea
              className="field-textarea"
              placeholder="Ask Lex anything..."
              value={lexQuestion}
              onChange={(e) => setLexQuestion(e.target.value)}
              rows={5}
              style={{ marginTop: 12 }}
            />

                        <div style={{ marginTop: 12 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 600,
                  color: primaryText,
                  marginBottom: 6,
                }}
              >
                Add a photo for Lex to review
              </label>

              <input
                className="field-input"
                type="file"
                accept="image/*"
                onChange={handleLexPhotoSelect}
              />

              {lexPhotoPreview ? (
                <div style={{ marginTop: 10 }}>
                  <img
                    src={lexPhotoPreview}
                    alt="Selected for Lex review"
                    style={{
                      width: "100%",
                      maxHeight: 260,
                      objectFit: "cover",
                      borderRadius: 16,
                      border: `1px solid ${borderColor}`,
                    }}
                  />

                  <button
                    className="small-button"
                    style={{ marginTop: 10 }}
                    onClick={() => {
                      setLexPhoto(null);
                      setLexPhotoPreview("");
                    }}
                  >
                    Remove Photo
                  </button>
                </div>
              ) : null}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="secondary-button" onClick={closeAskLex}>
                Cancel
              </button>
              <button className="primary-button" onClick={handleAskLex}>
                {lexLoading ? "Asking..." : "Ask Lex"}
              </button>
            </div>

            {lexLoading || lexAnswer ? (
              <div
                style={{
                  marginTop: 18,
                  padding: 16,
                  border: `1px solid ${borderColor}`,
                  borderRadius: 16,
                  background: "#FFFFFF",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 18,
                    marginBottom: 8,
                    color: primaryText,
                  }}
                >
                  Lex
                </div>

                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    fontSize: 15,
                    lineHeight: 1.55,
                    color: primaryText,
                  }}
                >
                  {lexLoading ? "Thinking..." : lexAnswer}
                </div>

                {!lexLoading && lexAnswer ? (
                  <button
                    className="small-button"
                    style={{ marginTop: 14 }}
                    onClick={copyLexAnswer}
                  >
                    Copy Answer
                  </button>
                ) : null}
              </div>
                        ) : null}
          </div>
        </div>
      ) : null}

      <BottomNav />
    </div>
  );
}