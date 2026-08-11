const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

console.log("OpenAI key loaded:", !!process.env.OPENAI_API_KEY);
console.log("Google key loaded:", !!process.env.GOOGLE_MAPS_API_KEY);

const express = require("express");
const admin = require("firebase-admin");
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  : require("./firebase-service-account.json");
const firebaseApp = admin.apps.length
  ? admin.app()
  : admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
const OpenAI = require("openai");
const multer = require("multer");

const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});

app.use(express.json());


let FAQ_CACHE = [];
const firestore = admin.firestore();

/*
AI SERVER PORT
Always 3001
*/
const PORT = process.env.PORT || 3001;

const rawClientOrigins = process.env.CLIENT_ORIGINS || "";

const allowedOrigins = rawClientOrigins
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

if (!allowedOrigins.length) {
  allowedOrigins.push(
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "capacitor://localhost"
  );
}

const isAllowedOrigin = (origin) => {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;
  if (origin === "capacitor://localhost") return true;

  return /^http:\/\/(localhost|127\.0\.0\.1|\d{1,3}(\.\d{1,3}){3}):3000$/.test(origin);
};

console.log("Allowed client origins:", allowedOrigins);

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});
  

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

const fileToDataUrl = (file) => {
  if (!file?.buffer || !file?.mimetype) return null;

  const base64 = file.buffer.toString("base64");
  return `data:${file.mimetype};base64,${base64}`;
};

/* --------------------------------
RESOURCE SEARCH
-------------------------------- */

const RESOURCE_TYPE_MAP = {
  vet: "equine veterinarian",
  "emergency-vet": "equine emergency veterinarian",
  farrier: "horse farrier",
  "hay-dealer": "hay supplier",
  "feed-store": "feed store",
  "tack-shop": "tack shop",
  "equine-dentist": "equine dentist",
  trainer: "horse trainer",
  boarding: "horse boarding",
  "trailer-repair": "horse trailer repair",
};

const toRadians = (d) => (d * Math.PI) / 180;

const getDistanceMiles = (lat1, lng1, lat2, lng2) => {
  const R = 3958.8;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const formatDistanceText = (miles) => {
  if (!Number.isFinite(miles)) return "";
  if (miles < 0.1) return "Less than 0.1 miles away";
  if (miles < 10) return `${miles.toFixed(1)} miles away`;
  return `${Math.round(miles)} miles away`;
};

const withAbortTimeout = async (url, options = {}, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

app.post("/resources-search", async (req, res) => {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({
        error: "Missing GOOGLE_MAPS_API_KEY.",
      });
    }

    const { resourceType, searchTerm, latitude, longitude } = req.body || {};

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number"
    ) {
      return res.status(400).json({
        error: "Latitude and longitude required.",
      });
    }

    const fallbackSearch = RESOURCE_TYPE_MAP[resourceType] || "horse services";

    const finalSearch =
      typeof searchTerm === "string" && searchTerm.trim()
        ? searchTerm.trim()
        : fallbackSearch;

    const requestBody = {
      textQuery: `${finalSearch} near me`,
      maxResultCount: 10,
      locationBias: {
        circle: {
          center: { latitude, longitude },
          radius: 25000,
        },
      },
    };

    const response = await withAbortTimeout(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.location",
        },
        body: JSON.stringify(requestBody),
      }
    );

    console.log("GOOGLE RAW STATUS:", response.status); // 👈 ADD HERE

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
  console.log("GOOGLE ERROR RESPONSE:", data);
  return res.status(500).json({
    error: data?.error?.message || "Places API error",
  });
}

    const places = Array.isArray(data?.places) ? data.places : [];

    const results = places
      .map((p) => {
        const lat = p?.location?.latitude;
        const lng = p?.location?.longitude;

        const miles =
          typeof lat === "number" && typeof lng === "number"
            ? getDistanceMiles(latitude, longitude, lat, lng)
            : null;

        return {
          placeId: p.id || "",
          name: p?.displayName?.text || "Unnamed business",
          address: p.formattedAddress || "",
          phone: p.internationalPhoneNumber || "",
          website: p.websiteUri || "",
          latitude: lat || null,
          longitude: lng || null,
          distanceMiles: miles,
          distanceText: formatDistanceText(miles),
          directionsUrl:
            lat && lng
              ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
              : "",
        };
      })
      .sort((a, b) => (a.distanceMiles || 9999) - (b.distanceMiles || 9999));

    return res.json({ results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Resource search failed." });
  }
});

/* --------------------------------
AI ASK ROUTE
-------------------------------- */

app.post("/ask", upload.single("photo"), async (req, res) => {
  try {
            const startTime = Date.now();

            console.log("ASK BODY:", req.body);
    console.log("ASK FILE:", req.file ? req.file.originalname : "no file");

    const question =
      req.body?.question ||
      req.body?.rawQuestion ||
      "";

    const uploadedPhoto = req.file || null;

    console.log("ASK QUESTION:", question);

    if (!question) {
      return res.status(400).json({ error: "Question required" });
    }

    const activeHorseId = req.body?.activeHorseId || null;
        const contextStartTime = Date.now();

    let horseContext = "";

    if (activeHorseId) {
      const horseDoc = await firestore.collection("horses").doc(activeHorseId).get();

      if (horseDoc.exists) {
        const h = horseDoc.data();

        horseContext = `
HORSE CONTEXT
Name: ${h.name || ""}
Feed: ${h.feed || ""}
Meds: ${h.meds || ""}
Medical Issues: ${h.medicalIssues || ""}
Notes: ${h.notes || ""}
`;
      }

      const costsSnap = await firestore
        .collection("costs")
        .where("horseId", "==", activeHorseId)
        .orderBy("date", "desc")
        .limit(3)
        .get();

      const recentCosts = costsSnap.docs
        .map((doc) => {
          const c = doc.data();

          return `- ${c.category || "Expense"}: $${c.amount || 0} on ${c.date || "Unknown date"}`;
        })
        .join("\n");

      horseContext += `

RECENT COSTS
${recentCosts || "No recent costs found."}
`;

      const remindersSnap = await firestore
        .collection("reminders")
        .where("horseId", "==", activeHorseId)
        .orderBy("dueDate", "asc")
        .limit(3)
        .get();

      const upcomingCare = remindersSnap.docs
        .map((doc) => {
          const r = doc.data();

          return `- ${r.title || r.type || "Care Item"} due on ${r.dueDate || "Unknown date"}${r.notes ? ` (${r.notes})` : ""}`;
        })
        .join("\n");

      horseContext += `

UPCOMING CARE
${upcomingCare || "No upcoming care found."}
`;

      const sickWatchSnap = await firestore
        .collection("sickwatch")
        .where("horseId", "==", activeHorseId)
        .orderBy("createdAt", "desc")
        .limit(3)
        .get();

      const recentHealthLogs = sickWatchSnap.docs
        .map((doc) => {
          const s = doc.data();

          return `
- Symptoms: ${s.symptoms || "None"}
- Appetite: ${s.appetite || "Not logged"}
- Water: ${s.water || "Not logged"}
- Temperature: ${s.temperature || "Not logged"}
- Notes: ${(s.notes || "None").slice(0, 120)}
`;
        })
        .join("\n");

      horseContext += `

RECENT HEALTH LOGS
${recentHealthLogs || "No recent health logs found."}
`;

      const logsSnap = await firestore
        .collection("logs")
        .where("horseId", "==", activeHorseId)
        .orderBy("createdAt", "desc")
        .limit(3)
        .get();

      const recentLogs = logsSnap.docs
        .map((doc) => {
          const l = doc.data();

          return `- ${(l.text || "No details").slice(0, 120)} (${l.type || "note"})`;
        })
        .join("\n");

      horseContext += `

RECENT NOTES
${recentLogs || "No recent notes found."}
`;

      const eventsSnap = await firestore
        .collection("events")
        .where("horseId", "==", activeHorseId)
        .orderBy("eventDate", "asc")
        .limit(3)
        .get();

      const upcomingEvents = eventsSnap.docs
        .map((doc) => {
          const e = doc.data();

          return `- ${e.name || "Event"} on ${e.eventDate ? new Date(e.eventDate).toLocaleDateString() : "Unknown date"} at ${e.location || "Unknown location"}`;
        })
        .join("\n");

      horseContext += `

UPCOMING EVENTS
${upcomingEvents || "No upcoming events found."}
`;

      const documentsSnap = await firestore
        .collection("documents")
        .where("horseId", "==", activeHorseId)
        .orderBy("createdAt", "desc")
        .limit(3)
        .get();

      const recentDocuments = documentsSnap.docs
        .map((doc) => {
          const d = doc.data();

          return `- ${d.documentName || "Document"} (${d.documentType || "Unknown type"})`;
        })
        .join("\n");

      horseContext += `

DOCUMENTS
${recentDocuments || "No documents found."}
`;
    }

    console.log("Context timing:", {
      contextMs: Date.now() - contextStartTime,
    });
    const systemPrompt = `
You are Lex, an equine care assistant.

Rules:
- You are not a veterinarian.
- Do not diagnose.
- Do not give medication dosages.
- Prioritize safety.
- Give calm, practical horse care advice.
- If something sounds urgent, recommend contacting a veterinarian.

Never reference clinics, courses, or training programs.
Speak naturally to the horse owner.

${horseContext}
`;

        const photoDataUrl = fileToDataUrl(uploadedPhoto);

    const userContent = photoDataUrl
      ? [
          {
            type: "input_text",
            text: question,
          },
          {
            type: "input_image",
            image_url: photoDataUrl,
          },
        ]
      : question;

    const openAIStartTime = Date.now();
    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userContent,
        },
      ],
    });

    console.log("AI timing:", {
      totalMs: Date.now() - startTime,
      openAIMs: Date.now() - openAIStartTime,
    });

    return res.json({
      answer: response.output_text,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "AI request failed" });
  }
});



app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/refresh-faq", async (req, res) => {
  const snap = await firestore
    .collection("faq")
    .where("isActive", "==", true)
    .get();

  FAQ_CACHE = snap.docs.map((d) => d.data());

  return res.json({ ok: true, count: FAQ_CACHE.length });
});

app.post("/send-push", async (req, res) => {
  try {
    const { token, ownerUid, title, body, data } = req.body;

    let finalToken = token || "";

    if (!finalToken && ownerUid) {
      const ownerSnap = await firestore
        .collection("users")
        .doc(ownerUid)
        .get();

      if (!ownerSnap.exists) {
        return res.status(404).json({
          error: "Owner user record not found.",
        });
      }

      const ownerData = ownerSnap.data();
      finalToken = ownerData?.pushToken || "";
    }

    if (!finalToken || !title || !body) {
      return res.status(400).json({
        error: "Missing push token, title, or body.",
      });
    }

    const message = {
      token: finalToken,
      notification: {
        title,
        body,
      },
      data: data || {},
    };

    const response = await admin
      .messaging(firebaseApp)
      .send(message);

    console.log("PUSH SENT:", response);

    res.json({
      success: true,
      response,
    });
  } catch (e) {
    console.log("SEND PUSH ERROR:", e);

    res.status(500).json({
      error: e.message,
    });
  }
});

app.get("/process-event-reminders", async (req, res) => {
  try {
    const now = Date.now();

    const snap = await firestore
      .collection("events")
      .where("eventAlertPushSent", "==", false)
      .get();

    let sentCount = 0;

    for (const eventDoc of snap.docs) {
      const event = eventDoc.data();

      if (event.completed) continue;
      if (!event.reminderAt) continue;
      if (event.reminder === "none") continue;
      if (event.reminderAt > now) continue;

      const ownerUid = event.ownerUid;

      if (!ownerUid) continue;

      const ownerSnap = await firestore
        .collection("users")
        .doc(ownerUid)
        .get();

      if (!ownerSnap.exists) continue;

      const ownerData = ownerSnap.data();
      const pushToken = ownerData?.pushToken;

      if (!pushToken) continue;

      const message = {
        token: pushToken,
        notification: {
          title: "Upcoming Event",
          body: `${event.name || "Your event"} is coming up${
            event.time ? ` at ${event.time}` : ""
          }.`,
        },
        data: {
          type: "event_alert",
          eventId: eventDoc.id,
          horseId: event.horseId || "",
        },
      };

      await admin.messaging(firebaseApp).send(message);

      await eventDoc.ref.update({
        eventAlertPushSent: true,
        eventAlertPushSentAt: Date.now(),
      });

      sentCount += 1;
    }

    res.json({
      success: true,
      sentCount,
    });
  } catch (e) {
    console.log("PROCESS EVENT REMINDERS ERROR:", e);

    res.status(500).json({
      error: e.message,
    });
  }
});

app.get("/process-care-reminders", async (req, res) => {
  try {
    const now = Date.now();

    const snap = await firestore
      .collection("reminders")
      .where("upcomingCarePushSent", "==", false)
      .where("completed", "==", false)
      .get();

    let sentCount = 0;

    for (const reminderDoc of snap.docs) {
      const reminder = reminderDoc.data();

      if (!reminder.alertDate) continue;
      if (reminder.alertDate > now) continue;

      const ownerUid = reminder.ownerUid;
      if (!ownerUid) continue;

      const ownerSnap = await firestore
        .collection("users")
        .doc(ownerUid)
        .get();

      if (!ownerSnap.exists) continue;

      const ownerData = ownerSnap.data();
      const pushToken = ownerData?.pushToken;
      if (!pushToken) continue;

      const message = {
        token: pushToken,
        notification: {
          title: "Upcoming Care Reminder",
          body: `${reminder.title || reminder.type || "Care item"} is coming up for ${
            reminder.horseName || "your horse"
          }${reminder.time ? ` at ${reminder.time}` : ""}.`,
        },
        data: {
          type: "care_alert",
          reminderId: reminderDoc.id,
          horseId: reminder.horseId || "",
        },
      };

      await admin.messaging(firebaseApp).send(message);

      await reminderDoc.ref.update({
        upcomingCarePushSent: true,
        upcomingCarePushSentAt: Date.now(),
      });

      sentCount += 1;
    }

    res.json({
      success: true,
      sentCount,
    });
  } catch (e) {
    console.log("PROCESS CARE REMINDERS ERROR:", e);

    res.status(500).json({
      error: e.message,
    });
  }
});

app.get("/process-feed-inventory-reminders", async (req, res) => {
  try {
    const now = Date.now();

    const snap = await firestore
      .collection("feed_inventory")
      .where("lowFeedPushSent", "==", false)
      .get();

    let sentCount = 0;

    for (const itemDoc of snap.docs) {
      const item = itemDoc.data();

      const quantity = Number(item.currentQuantity || 0);
      const dailyUse = Number(item.dailyUse || 0);
      const lowThresholdDays = Number(item.lowThresholdDays || 3);

      const quantityUpdatedAt = Number(
        item.quantityUpdatedAt ||
          item.updatedAt ||
          item.createdAt ||
          now
      );

      const daysPassed = Math.max(
        0,
        Math.floor((now - quantityUpdatedAt) / 86400000)
      );

      const adjustedQuantity =
        dailyUse > 0
          ? Math.max(0, quantity - daysPassed * dailyUse)
          : quantity;

      if (!dailyUse || dailyUse <= 0) continue;

      const daysRemaining = Math.floor(adjustedQuantity / dailyUse);

      if (daysRemaining > lowThresholdDays) continue;

      const ownerUid = item.ownerUid;
      if (!ownerUid) continue;

      const ownerSnap = await firestore
        .collection("users")
        .doc(ownerUid)
        .get();

      if (!ownerSnap.exists) continue;

      const ownerData = ownerSnap.data();
      const pushToken = ownerData?.pushToken;
      if (!pushToken) continue;

      const message = {
        token: pushToken,
        notification: {
          title: "Low Feed Alert",
          body:
            adjustedQuantity <= 0
              ? `${item.itemName || "Feed"} is empty.`
              : `${item.itemName || "Feed"} may run out in about ${daysRemaining} day(s).`,
        },
        data: {
          type: "low_feed",
          horseId: item.horseId || "",
          feedItemId: itemDoc.id,
        },
      };

      await admin.messaging(firebaseApp).send(message);

      await itemDoc.ref.update({
        lowFeedPushSent: true,
        lowFeedPushSentAt: Date.now(),
      });

      sentCount += 1;
    }

    res.json({
      success: true,
      sentCount,
    });
  } catch (e) {
    console.log("PROCESS FEED INVENTORY REMINDERS ERROR:", e);

    res.status(500).json({
      error: e.message,
    });
  }
});

app.get("/test-push", async (req, res) => {
  try {
    const message = {
      token: "fuhupo9oOEhUuo3N9xX4og:APA91bGaNW_xOTcoYcMrCCdKMQG7Pg7ns_etxxYr7awWlUdICdbNMTC8bjm0lEqvCHRBYTkRKssjhDnQEFcgCCQd32yc1brd_TWFtB3yZB-9-qI0hfuw8Ec",
      notification: {
        title: "Lex Equine",
        body: "Push notifications are working.",
      },
      apns: {
  payload: {
    aps: {
      "mutable-content": 1,
    },
  },
},
    };

    const response = await admin.messaging(firebaseApp).send(message);

    console.log(response);

    res.json({
      success: true,
      response,
    });
  } catch (e) {
    console.log(e);

    res.status(500).json({
      error: e.message,
    });
  }
});

app.listen(PORT, "0.0.0.0", async () => {
  const snap = await firestore
    .collection("faq")
    .where("isActive", "==", true)
    .get();

  FAQ_CACHE = snap.docs.map((doc) => doc.data());

  console.log(`Loaded ${FAQ_CACHE.length} FAQs`);
  console.log(`AI server running on http://0.0.0.0:${PORT}`);
});