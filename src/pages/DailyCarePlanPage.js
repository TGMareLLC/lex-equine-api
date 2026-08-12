import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import {
  Camera,
  CameraResultType,
  CameraSource,
} from "@capacitor/camera";
import imageCompression from "browser-image-compression";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, storage } from "../firebase";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://lex-equine-api.onrender.com";

const CARE_ITEM_PRESETS = [
  "Morning Feed",
  "Evening Feed",
  "Hay",
  "Water",
  "Medication",
  "Turn Out",
  "Bring In",
  "Fly Mask",
  "Blanket",
  "Pick Stall",
  "Check Legs",
  "Custom",
];

export default function DailyCarePlanPage({ user, horses = [] }) {
  const navigate = useNavigate();
  const { horseId } = useParams();

const mode = new URLSearchParams(window.location.search).get("mode");
const isCaretaker = mode === "caretaker";
const [careItems, setCareItems] = React.useState([]);
const [specialInstructions, setSpecialInstructions] = React.useState("");
const [showPresetPicker, setShowPresetPicker] = React.useState(false);
const [checkedItems, setCheckedItems] = React.useState({});
const [caretakerNote, setCaretakerNote] = React.useState("");
const [carePhotos, setCarePhotos] = React.useState([]);
const [photoUploading, setPhotoUploading] = React.useState(false);
const [loading, setLoading] = React.useState(false);
const [saving, setSaving] = React.useState(false);


React.useEffect(() => {
  const loadDailyCarePlan = async () => {
    if (!horseId) return;

    try {
      setLoading(true);

      const planRef = doc(db, "dailyCarePlans", horseId);
      const planSnap = await getDoc(planRef);

      if (planSnap.exists()) {
        const data = planSnap.data();

        setCareItems(data.careItems || []);
        setSpecialInstructions(data.specialInstructions || "");
      } else {
        setCareItems([]);
        setSpecialInstructions("");
      }
    } catch (error) {
      console.log("LOAD DAILY CARE PLAN ERROR:", error);
      alert("Could not load Daily Care Plan.");
    } finally {
      setLoading(false);
    }
  };

  loadDailyCarePlan();
}, [horseId]);



const saveDailyCarePlan = async () => {
  if (!horseId) return;

  try {
    setSaving(true);

    await setDoc(
      doc(db, "dailyCarePlans", horseId),
      {
        horseId,
        careItems,
        specialInstructions: specialInstructions.trim(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    alert("Daily Care Plan saved.");
  } catch (error) {
    console.log("SAVE DAILY CARE PLAN ERROR:", error);
    alert("Could not save Daily Care Plan.");
  } finally {
    setSaving(false);
  }
};

const handleAddCarePhoto = async () => {
  try {
    setPhotoUploading(true);

    const image = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
    });

    if (!image?.webPath) return;

    const response = await fetch(image.webPath);
    const originalBlob = await response.blob();

    const originalFile = new File(
      [originalBlob],
      `care-photo-${Date.now()}.jpg`,
      {
        type: originalBlob.type || "image/jpeg",
      }
    );

    const compressedFile = await imageCompression(originalFile, {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1400,
      useWebWorker: true,
      initialQuality: 0.8,
    });

    const compressedBlob = new Blob([compressedFile], {
      type: compressedFile.type || "image/jpeg",
    });

    const fileExtension =
      compressedBlob.type.includes("png") ? "png" : "jpg";

    const storagePath = `care_history_photos/${user.uid}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${fileExtension}`;

    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, compressedBlob, {
      contentType: compressedBlob.type || "image/jpeg",
    });

    const downloadUrl = await getDownloadURL(storageRef);

    setCarePhotos((current) => [
      ...current,
      {
        url: downloadUrl,
        path: storagePath,
      },
    ]);
  } catch (error) {
    console.log("CARE PHOTO UPLOAD ERROR:", error);
    alert("Could not add photo.");
  } finally {
    setPhotoUploading(false);
  }
};

const notifyOwnerCareCompleted = async () => {
  const ownerUid =
  horse?.caretakerOwnerUid ||
  horse?.ownerUid ||
  "";

  if (!ownerUid) {
    console.log("CARE COMPLETION PUSH SKIPPED: Missing owner UID.");
    return;
  }

  try {
    const caretakerDisplayName =
  horse?.caretakerName ||
  "Your caretaker";

    const response = await fetch(`${API_BASE_URL}/send-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ownerUid,
        title: "Daily Care Completed",
        body: `${caretakerDisplayName} completed today's care for ${
          horse?.name || "your horse"
        }.`,
        data: {
          type: "caretaker_care_completed",
          horseId,
        },
      }),
    });

    await response.json();

    
  } catch (error) {
    console.log("CARE COMPLETION PUSH ERROR:", error);
  }
};

const completeTodaysCare = async () => {
  const confirmed = window.confirm(
    "Complete today's care?\n\nThis will send your completed checklist, notes, and photos to the horse owner."
  );

  if (!confirmed) return;

  const completedItems = careItems
  .filter((item) => checkedItems[item.id])
  .map((item) => ({
    title: item.title,
    instructions: item.instructions,
  }));

addDoc(collection(db, "care_history"), {
  ownerUid: horse?.caretakerOwnerUid || horse?.ownerUid || "",
  horseId,
  horseName: horse?.name || "",
  caretakerUid: user.uid,
  caretakerName:
  horse?.caretakerName ||
  "Caretaker",
  completedAt: Date.now(),
  completedItems,
  notes: caretakerNote.trim(),
  photos: carePhotos,
  source: "caretaker_daily_care",
  dailyCarePlanSnapshot: careItems,
  createdAt: Date.now(),
})
  .then(async () => {
  await notifyOwnerCareCompleted();

  alert("Care completed and shared with the owner.");
    setCheckedItems({});
    setCaretakerNote("");
    setCarePhotos([]);
    navigate("/");
  })
  .catch((error) => {
    console.log("COMPLETE TODAY CARE ERROR:", error);
    alert("Could not complete today's care.");
  });
};

  const horse = horses.find((h) => h.id === horseId);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F6F4EE",
        padding:
          "max(env(safe-area-inset-top), 18px) 18px max(env(safe-area-inset-bottom), 90px)",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            border: "none",
            background: "transparent",
            color: "#6F6A60",
            fontSize: 15,
            marginBottom: 16,
            cursor: "pointer",
          }}
        >
          ← Back
        </button>

        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E5E2DA",
            borderRadius: 24,
            padding: 20,
            boxShadow: "0 10px 24px rgba(24, 34, 51, 0.08)",
          }}
        >
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: "#24324A",
              marginBottom: 6,
            }}
          >
            {isCaretaker ? "Today's Care" : "Daily Care Plan"}
          </div>

          <div
            style={{
              color: "#6F6A60",
              fontSize: 16,
              lineHeight: 1.5,
              marginBottom: 20,
            }}
          >
            {horse?.name || "Unnamed Horse"}

<div
  style={{
    marginTop: 6,
    fontSize: 15,
    color: "#6F6A60",
  }}
>
  {isCaretaker
    ? "Complete today's care and leave notes for the owner."
    : "Build the recurring daily care routine for this horse."}
</div>
          </div>

          <div
  style={{
    border: "1px solid #E5E2DA",
    borderRadius: 18,
    padding: 18,
    background: "#FBF8F2",
  }}
>
  {loading ? (
    <div style={{ color: "#6F6A60" }}>Loading Daily Care Plan...</div>
  ) : careItems.length === 0 ? (
    <div style={{ color: "#6F6A60", lineHeight: 1.5 }}>
      {isCaretaker
        ? "Today's checklist will appear here once the owner creates a Daily Care Plan."
        : "Start by adding the daily tasks this horse needs when someone else is caring for them."}
    </div>
  ) : (
    <div style={{ display: "grid", gap: 10 }}>
      {careItems.map((item, index) => (
        <div
          key={item.id || index}
          style={{
            border: "1px solid #E5E2DA",
            borderRadius: 14,
            padding: 14,
            background: "#FFFFFF",
          }}
        >
          {!isCaretaker ? (
  <input
    type="text"
    placeholder="Care Item Name"
    value={item.title || ""}
    onChange={(e) => {
      const nextItems = [...careItems];
      nextItems[index] = {
        ...nextItems[index],
        title: e.target.value,
      };
      setCareItems(nextItems);
    }}
    style={{
      width: "100%",
      boxSizing: "border-box",
      border: "1px solid #E5E2DA",
      borderRadius: 12,
      padding: "12px",
      fontSize: 15,
      fontWeight: 700,
      color: "#24324A",
    }}
  />
) : (
  <label
  style={{
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 16,
    fontWeight: 700,
    color: "#24324A",
    cursor: "pointer",
  }}
>
  <input
    type="checkbox"
    checked={!!checkedItems[item.id || index]}
    onChange={(e) => {
      setCheckedItems((current) => ({
        ...current,
        [item.id || index]: e.target.checked,
      }));
    }}
    style={{
      width: 22,
      height: 22,
    }}
  />
  <span>{item.title || "Untitled Care Item"}</span>
</label>
)}

          {!isCaretaker ? (
  <textarea
    placeholder="Instructions"
    value={item.instructions || ""}
    onChange={(e) => {
      const nextItems = [...careItems];
      nextItems[index] = {
        ...nextItems[index],
        instructions: e.target.value,
      };
      setCareItems(nextItems);
    }}
    rows={3}
    style={{
      width: "100%",
      boxSizing: "border-box",
      marginTop: 10,
      border: "1px solid #E5E2DA",
      borderRadius: 12,
      padding: "12px",
      fontSize: 14,
      color: "#1E1E1E",
      lineHeight: 1.5,
      resize: "vertical",
    }}
  />
) : item.instructions ? (
  <div
    style={{
      marginTop: 6,
      fontSize: 14,
      color: "#6F6A60",
      lineHeight: 1.5,
      whiteSpace: "pre-wrap",
    }}
  >
    {item.instructions}
  </div>
) : null}
        </div>
      ))}
    </div>
  )}
</div>

{isCaretaker ? (
  <div
    style={{
      marginTop: 18,
      border: "1px solid #E5E2DA",
      borderRadius: 18,
      padding: 18,
      background: "#FBF8F2",
    }}
  >
    <div
      style={{
        fontSize: 16,
        fontWeight: 700,
        color: "#24324A",
        marginBottom: 10,
      }}
    >
      Notes for Owner
    </div>

    <textarea
      placeholder="Add a note for the owner..."
      value={caretakerNote}
      onChange={(e) => setCaretakerNote(e.target.value)}
      rows={4}
      style={{
        width: "100%",
        boxSizing: "border-box",
        border: "1px solid #E5E2DA",
        borderRadius: 12,
        padding: "12px",
        fontSize: 16,
        color: "#1E1E1E",
        lineHeight: 1.5,
        resize: "vertical",
      }}
    />
  </div>
) : null}

{isCaretaker ? (
  <div
    style={{
      marginTop: 18,
      border: "1px solid #E5E2DA",
      borderRadius: 18,
      padding: 18,
      background: "#FBF8F2",
    }}
  >
    <div
      style={{
        fontSize: 16,
        fontWeight: 700,
        color: "#24324A",
        marginBottom: 10,
      }}
    >
      Photos
    </div>

    <button
  onClick={handleAddCarePhoto}
  disabled={photoUploading}
  style={{
    width: "100%",
    border: "1px solid #24324A",
    borderRadius: 14,
    padding: "12px",
    background: "#FFFFFF",
    color: "#24324A",
    fontWeight: 700,
    fontSize: 15,
    cursor: photoUploading ? "not-allowed" : "pointer",
    opacity: photoUploading ? 0.7 : 1,
  }}
>
  {photoUploading ? "Adding Photo..." : "+ Add Photo"}
</button>

    {carePhotos.length === 0 ? (
  <div
    style={{
      marginTop: 10,
      fontSize: 14,
      color: "#6F6A60",
    }}
  >
    No photos attached.
  </div>
) : (
  <div
    style={{
      marginTop: 12,
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
    }}
  >
    {carePhotos.map((photo, index) => (
      <img
        key={photo.url || index}
        src={photo.url}
        alt={`Care attachment ${index + 1}`}
        style={{
          width: "100%",
          height: 140,
          objectFit: "cover",
          borderRadius: 14,
          border: "1px solid #E5E2DA",
          display: "block",
        }}
      />
    ))}
  </div>
)}
  </div>
) : null}

{isCaretaker ? (
  <button
  onClick={completeTodaysCare}
    style={{
      width: "100%",
      marginTop: 14,
      border: "none",
      borderRadius: 16,
      padding: "14px",
      background: "#24324A",
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: 700,
      cursor: "pointer",
    }}
  >
    Complete Today's Care
  </button>
) : null}

{!isCaretaker ? (
  <button
    onClick={() => setShowPresetPicker(true)}
    style={{
      width: "100%",
      marginTop: 18,
      border: "none",
      borderRadius: 16,
      padding: "14px",
      background: "#24324A",
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: 700,
      cursor: "pointer",
    }}
  >
    + Add Care Item
  </button>
) : null}

{!isCaretaker && showPresetPicker ? (
  <div
    style={{
      marginTop: 12,
      border: "1px solid #E5E2DA",
      borderRadius: 18,
      padding: 14,
      background: "#FBF8F2",
    }}
  >
    <div
      style={{
        fontSize: 16,
        fontWeight: 700,
        color: "#24324A",
        marginBottom: 10,
      }}
    >
      Choose Care Item
    </div>

    <div style={{ display: "grid", gap: 8 }}>
      {CARE_ITEM_PRESETS.map((preset) => (
        <button
          key={preset}
          onClick={() => {
            setCareItems((current) => [
              ...current,
              {
                id: Date.now().toString(),
                title: preset === "Custom" ? "" : preset,
                instructions: "",
              },
            ]);
            setShowPresetPicker(false);
          }}
          style={{
            width: "100%",
            border: "1px solid #E5E2DA",
            borderRadius: 14,
            padding: "12px",
            background: "#FFFFFF",
            color: "#24324A",
            fontSize: 15,
            fontWeight: 700,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          {preset}
        </button>
      ))}
    </div>
  </div>
) : null}

{!isCaretaker ? (
  <button
    onClick={saveDailyCarePlan}
    disabled={saving}
    style={{
      width: "100%",
      marginTop: 12,
      border: "1px solid #24324A",
      borderRadius: 16,
      padding: "14px",
      background: "#FFFFFF",
      color: "#24324A",
      fontSize: 16,
      fontWeight: 700,
      cursor: saving ? "not-allowed" : "pointer",
      opacity: saving ? 0.7 : 1,
    }}
  >
    {saving ? "Saving..." : "Save Daily Care Plan"}
  </button>
) : null}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}