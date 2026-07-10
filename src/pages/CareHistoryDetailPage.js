import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function CareHistoryDetailPage() {
  const navigate = useNavigate();
  const { historyId } = useParams();
  const [item, setItem] = React.useState(null);
const [loading, setLoading] = React.useState(true);
const [selectedPhoto, setSelectedPhoto] = React.useState(null);

React.useEffect(() => {
  const loadCareHistoryItem = async () => {
    if (!historyId) {
      setItem(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const snap = await getDoc(doc(db, "care_history", historyId));

      if (snap.exists()) {
  const historyData = {
    id: snap.id,
    ...snap.data(),
  };

  console.log("CARE HISTORY DETAIL DATA:", historyData);
  console.log("CARE HISTORY PHOTOS:", historyData.photos);

  setItem(historyData);
} else {
        setItem(null);
      }
    } catch (error) {
      console.log("LOAD CARE HISTORY DETAIL ERROR:", error);
      alert("Could not load care history detail.");
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  loadCareHistoryItem();
}, [historyId]);

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
          onClick={() =>
  navigate("/horses", {
    state: {
      reopenHorse: item?.horseId,
      reopenSection: "caretakerHistory",
    },
  })
}
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
          {loading ? (
  <div style={{ color: "#6F6A60" }}>Loading care history...</div>
) : !item ? (
  <div style={{ color: "#6F6A60" }}>Care history entry not found.</div>
) : (
  <>
    <div
      style={{
        fontSize: 30,
        fontWeight: 700,
        color: "#24324A",
        marginBottom: 8,
      }}
    >
      Daily Care Completed
    </div>

    <div style={{ color: "#6F6A60", lineHeight: 1.6 }}>
  <div style={{ fontSize: 17, color: "#1E1E1E", fontWeight: 700 }}>
    {item.horseName || "Unnamed Horse"}
  </div>

  <div style={{ marginTop: 14 }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: "#24324A" }}>
      Completed
    </div>
    <div>
      {item.completedAt
        ? new Date(item.completedAt).toLocaleString()
        : "Date unavailable"}
    </div>
  </div>

  <div style={{ marginTop: 14 }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: "#24324A" }}>
      Completed By
    </div>
    <div>{item.caretakerName || "Caretaker"}</div>
  </div>
</div>


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
      fontSize: 18,
      fontWeight: 700,
      color: "#24324A",
      marginBottom: 12,
    }}
  >
    Completed Tasks
  </div>

  {(item.completedItems || []).length === 0 ? (
    <div style={{ color: "#6F6A60" }}>No completed items recorded.</div>
  ) : (
    <div style={{ display: "grid", gap: 10 }}>
      {item.completedItems.map((careItem, index) => (
        <div
          key={index}
          style={{
            border: "1px solid #E5E2DA",
            borderRadius: 14,
            padding: 14,
            background: "#FFFFFF",
          }}
        >
          <div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 12,
    color: "#24324A",
    fontSize: 16,
    fontWeight: 600,
  }}
>
  <span
    style={{
      fontSize: 18,
      color: "#24324A",
      lineHeight: 1,
    }}
  >
    ✓
  </span>

  <span>{careItem.title || "Care Item"}</span>
</div>

          
        </div>
      ))}
    </div>
  )}
</div>

{item.notes ? (
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
        fontSize: 18,
        fontWeight: 700,
        color: "#24324A",
        marginBottom: 10,
      }}
    >
      Caretaker Notes
    </div>

    <div
      style={{
        fontSize: 15,
        color: "#1E1E1E",
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
      }}
    >
      {item.notes}
    </div>
  </div>
) : null}

{Array.isArray(item.photos) && item.photos.length > 0 ? (
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
        fontSize: 18,
        fontWeight: 700,
        color: "#24324A",
        marginBottom: 12,
      }}
    >
      Photos
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
      }}
    >
      {item.photos.map((photo, index) => (
  <img
    onClick={() => setSelectedPhoto(photo.url)}
    key={photo.url || index}
    src={photo.url}
    alt={`Care attachment ${index + 1}`}
    style={{
      width: "100%",
      height: 160,
      objectFit: "cover",
      borderRadius: 14,
      border: "1px solid #E5E2DA",
      display: "block",
      cursor: "pointer",
    }}
  />
))}
    </div>
  </div>
) : null}

  </>
)}
        </div>
      </div>

      <BottomNav />
      {selectedPhoto ? (
  <div
    onClick={() => setSelectedPhoto(null)}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.85)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      zIndex: 9999,
      cursor: "pointer",
    }}
  >
    <img
      src={selectedPhoto}
      alt="Care Photo"
      style={{
        maxWidth: "100%",
        maxHeight: "100%",
        objectFit: "contain",
        borderRadius: 16,
      }}
    />
  </div>
) : null}
    </div>
  );
}