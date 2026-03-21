const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

console.log("OpenAI key loaded:", !!process.env.OPENAI_API_KEY);
console.log("Google key loaded:", !!process.env.GOOGLE_MAPS_API_KEY);

const express = require("express");
const OpenAI = require("openai");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());

admin.initializeApp({
  credential: admin.credential.cert(
    require(path.join(__dirname, "serviceAccountKey.json"))
  ),
});

let FAQ_CACHE = [];
const firestore = admin.firestore();

/*
AI SERVER PORT
Always 3001
*/
const PORT = 3001;

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

app.post("/ask", async (req, res) => {
  try {
    const question = req.body?.question;

    if (!question) {
      return res.status(400).json({ error: "Question required" });
    }

    const activeHorseId = req.body?.activeHorseId || null;

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
    }

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

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: question,
        },
      ],
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

app.listen(PORT, "0.0.0.0", async () => {
  const snap = await firestore
    .collection("faq")
    .where("isActive", "==", true)
    .get();

  FAQ_CACHE = snap.docs.map((doc) => doc.data());

  console.log(`Loaded ${FAQ_CACHE.length} FAQs`);
  console.log(`AI server running on http://0.0.0.0:${PORT}`);
});