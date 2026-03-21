import { useEffect, useMemo, useState } from "react";
import { db, auth } from "../firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";


import BottomNav from "../components/BottomNav";
import FloatingAskLex from "../components/FloatingAskLex";
import { CapacitorHttp } from "@capacitor/core";

const API_BASE_URL = "http://192.168.12.157:3001";

const RESOURCE_TYPES = [
  { key: "vet", label: "Vet", query: "equine veterinarian" },
  { key: "emergency-vet", label: "Emergency Vet", query: "equine emergency veterinarian" },
  { key: "farrier", label: "Farrier", query: "horse farrier" },
  { key: "hay-dealer", label: "Hay Dealer", query: "hay supplier" },
  { key: "feed-store", label: "Feed Store", query: "feed store" },
  { key: "tack-shop", label: "Tack Shop", query: "tack shop" },
  { key: "equine-dentist", label: "Equine Dentist", query: "equine dentist" },
  { key: "trainer", label: "Trainer", query: "horse trainer" },
  { key: "boarding", label: "Boarding", query: "horse boarding" },
  { key: "trailer-repair", label: "Trailer Repair", query: "horse trailer repair" },
];

export default function ResourcesPage({ onAsk }) {
  const [selectedType, setSelectedType] = useState("vet");
  const [results, setResults] = useState([]);
  const [resultsStatus, setResultsStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [savedResources, setSavedResources] = useState([]);
  const [savedStatus, setSavedStatus] = useState("Loading saved resources...");
  const [horsesList, setHorsesList] = useState([]);

  const [savingPlaceId, setSavingPlaceId] = useState("");
  const [settingPrimaryId, setSettingPrimaryId] = useState("");
  const [removingSavedId, setRemovingSavedId] = useState("");

  const [assignHorseId, setAssignHorseId] = useState("");

  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignResource, setAssignResource] = useState(null);
  const [selectedHorseIds, setSelectedHorseIds] = useState([]);

  const primaryText = "#1E1E1E";
  const secondaryText = "#6F6A60";
  const borderColor = "#E5E2DA";
  const navy = "#24324A";
  const burgundy = "#7A2E2E";
  const homeBg = "#F6F4EE";

  const selectedResource = useMemo(() => {
    return RESOURCE_TYPES.find((item) => item.key === selectedType);
  }, [selectedType]);

  const fullWidthFieldStyle = {
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
  };

  const loadSavedResources = async () => {
    if (!auth.currentUser?.uid) return;

    const qs = query(
      collection(db, "saved_resources"),
      where("ownerUid", "==", auth.currentUser.uid)
    );

    const snap = await getDocs(qs);

    const items = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    setSavedResources(items);
    setSavedStatus(items.length ? "" : "No saved resources yet.");
  };

  const loadHorses = async () => {
    if (!auth.currentUser?.uid) return;

    const qs = query(
      collection(db, "horses"),
      where("ownerUid", "==", auth.currentUser.uid)
    );

    const snap = await getDocs(qs);

    const items = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    setHorsesList(items);
  };

  useEffect(() => {
    loadSavedResources();
    loadHorses();
  }, []);

  const searchNearby = async () => {
  try {
    console.log("SEARCH CLICKED");

    setIsLoading(true);
    setResults([]);
    setResultsStatus("");

    const latitude = 42.3732;
    const longitude = -72.5199;

    console.log("API URL:", `${API_BASE_URL}/resources-search`);

    const response = await CapacitorHttp.post({
  url: `${API_BASE_URL}/resources-search`,
  headers: {
    "Content-Type": "application/json",
  },
  data: {
    resourceType: selectedResource.key,
    searchTerm: selectedResource.query,
    latitude,
    longitude,
  },
});

console.log("RES STATUS:", response.status);

const data = response.data || {};
console.log("GOOGLE RESPONSE:", data);

    const items = Array.isArray(data?.results) ? data.results : [];

    setResults(items);
    setResultsStatus(items.length ? "" : data?.error || "No results found.");
  } catch (e) {
    console.log("SEARCH RESOURCES ERROR:", e);
    setResults([]);
    setResultsStatus(e?.message || "Could not search resources.");
  } finally {
    setIsLoading(false);
  }
};

  const isSavedResult = (placeId) => {
    return savedResources.some((item) => item.placeId === placeId);
  };

  const saveResource = async (result) => {
    if (!auth.currentUser?.uid) return;

    if (isSavedResult(result.placeId)) {
      alert("Already saved.");
      return;
    }

    try {
      setSavingPlaceId(result.placeId);

      await addDoc(collection(db, "saved_resources"), {
        ownerUid: auth.currentUser.uid,
        resourceType: selectedType,
        placeId: result.placeId,
        name: result.name || "",
        address: result.address || "",
        phone: result.phone || "",
        website: result.website || "",
        directionsUrl: result.directionsUrl || "",
        distanceText: result.distanceText || "",
        horseId: assignHorseId || null,
        isPrimary: false,
        createdAt: Date.now(),
      });

      await loadSavedResources();
    } catch (e) {
      console.log("SAVE RESOURCE ERROR:", e);
      alert("Could not save resource.");
    } finally {
      setSavingPlaceId("");
    }
  };

  const removeSavedResource = async (savedId) => {
    try {
      setRemovingSavedId(savedId);
      await deleteDoc(doc(db, "saved_resources", savedId));
      await loadSavedResources();
    } catch (e) {
      console.log("REMOVE RESOURCE ERROR:", e);
      alert("Could not remove resource.");
    } finally {
      setRemovingSavedId("");
    }
  };

  const setPrimaryResource = async (savedRecord) => {
    try {
      setSettingPrimaryId(savedRecord.id);

      const sameType = savedResources.filter(
        (item) =>
          item.resourceType === savedRecord.resourceType &&
          item.horseId === savedRecord.horseId
      );

      await Promise.all(
        sameType.map((item) =>
          updateDoc(doc(db, "saved_resources", item.id), {
            isPrimary: item.id === savedRecord.id,
          })
        )
      );

      await loadSavedResources();
    } catch (e) {
      console.log("SET PRIMARY RESOURCE ERROR:", e);
      alert("Could not set primary resource.");
    } finally {
      setSettingPrimaryId("");
    }
  };

  const saveHorseAssignments = async () => {
    if (!assignResource) return;

    try {
      const field =
        assignResource.resourceType === "vet"
          ? "vetId"
          : assignResource.resourceType === "farrier"
          ? "farrierId"
          : assignResource.resourceType === "trainer"
          ? "trainerId"
          : assignResource.resourceType === "equine-dentist"
          ? "dentistId"
          : null;

      if (!field) {
        alert("This resource type cannot be assigned to horses.");
        return;
      }

      for (const horseId of selectedHorseIds) {
        await updateDoc(doc(db, "horses", horseId), {
          [field]: assignResource.id,
        });
      }

      setIsAssignOpen(false);
      setAssignResource(null);
      setSelectedHorseIds([]);
      alert("Assignments saved.");
    } catch (e) {
      console.log("ASSIGN ERROR:", e);
      alert("Failed to assign resource.");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: homeBg,
        paddingBottom: 100,
        width: "100%",
        maxWidth: "100%",
        overflowX: "hidden",
        boxSizing: "border-box",
      }}
    >
      <div style={{ fontSize: 40, fontWeight: 600, color: navy }}>
        Resources
      </div>

      <div style={{ marginTop: 6, color: secondaryText }}>
        Find services near you
      </div>

      <div className="card" style={{ marginTop: 20, padding: 18, width: "100%", boxSizing: "border-box" }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>
          Saved Resources
        </div>

        {savedStatus ? (
          <div style={{ color: secondaryText }}>{savedStatus}</div>
        ) : (
          savedResources.map((item) => (
            <div
              key={item.id}
              style={{
                border: `1px solid ${borderColor}`,
                borderRadius: 14,
                padding: 14,
                marginBottom: 10,
                background: "#FCFBF8",
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
              }}
            >
              <div style={{ fontWeight: 600, color: primaryText, wordBreak: "break-word" }}>
                {item.name}
              </div>

              <div style={{ fontSize: 13, color: secondaryText, marginTop: 4 }}>
                {item.horseId ? "Horse specific" : "All horses"}
              </div>

              {item.phone ? (
                <div style={{ marginTop: 6, color: primaryText, wordBreak: "break-word" }}>
                  {item.phone}
                </div>
              ) : null}

              {item.address ? (
                <div
                  style={{
                    marginTop: 6,
                    color: secondaryText,
                    fontSize: 14,
                    wordBreak: "break-word",
                  }}
                >
                  {item.address}
                </div>
              ) : null}

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 10,
                  flexWrap: "wrap",
                }}
              >
                {item.phone ? (
                  <a href={`tel:${item.phone}`} className="small-button">
                    Call
                  </a>
                ) : null}

                {item.directionsUrl ? (
                  <a
                    href={item.directionsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="small-button"
                  >
                    Directions
                  </a>
                ) : null}

                <button
                  className="small-button"
                  onClick={() => {
                    setAssignResource(item);
                    setSelectedHorseIds([]);
                    setIsAssignOpen(true);
                  }}
                >
                  Assign to Horses
                </button>

                {!item.isPrimary ? (
                  <button
                    className="small-button"
                    onClick={() => setPrimaryResource(item)}
                    disabled={settingPrimaryId === item.id}
                  >
                    {settingPrimaryId === item.id ? "Saving..." : "Set Primary"}
                  </button>
                ) : null}

                <button
                  className="small-button"
                  style={{ borderColor: burgundy, color: burgundy }}
                  onClick={() => removeSavedResource(item.id)}
                  disabled={removingSavedId === item.id}
                >
                  {removingSavedId === item.id ? "Removing..." : "Remove"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card" style={{ marginTop: 18, padding: 18, width: "100%", boxSizing: "border-box" }}>
        <div style={{ fontWeight: 600 }}>Service Type</div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          {RESOURCE_TYPES.map((resource) => {
            const active = resource.key === selectedType;

            return (
              <button
                key={resource.key}
                onClick={() => setSelectedType(resource.key)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: active ? `1px solid ${navy}` : `1px solid ${borderColor}`,
                  background: active ? navy : "#FFFFFF",
                  color: active ? "#FFFFFF" : primaryText,
                  cursor: "pointer",
                }}
              >
                {resource.label}
              </button>
            );
          })}
        </div>

        {horsesList.length > 0 ? (
          <select
            value={assignHorseId}
            onChange={(e) => setAssignHorseId(e.target.value)}
            className="field-select"
            style={{ ...fullWidthFieldStyle, marginTop: 12 }}
          >
            <option value="">All Horses</option>
            {horsesList.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        ) : null}

        <button
          onClick={searchNearby}
          disabled={isLoading}
          style={{
            width: "100%",
            marginTop: 14,
            border: "none",
            borderRadius: 12,
            padding: "14px",
            background: navy,
            color: "#FFF",
            fontWeight: 600,
            cursor: "pointer",
            boxSizing: "border-box",
          }}
        >
          {isLoading ? "Searching..." : `Search Nearby ${selectedResource.label}`}
        </button>
      </div>

      <div className="card" style={{ marginTop: 18, padding: 18, width: "100%", boxSizing: "border-box" }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>
          Results
        </div>

        {resultsStatus ? (
          <div style={{ color: secondaryText }}>{resultsStatus}</div>
        ) : (
          results.map((result) => {
            const saved = savedResources.find((item) => item.placeId === result.placeId);

            return (
              <div
                key={result.placeId}
                style={{
                  border: `1px solid ${borderColor}`,
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 10,
                  background: "#FCFBF8",
                  width: "100%",
                  maxWidth: "100%",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ fontWeight: 600, color: primaryText, wordBreak: "break-word" }}>
                  {result.name}
                </div>

                {result.distanceText ? (
                  <div style={{ fontSize: 14, color: secondaryText }}>
                    {result.distanceText}
                  </div>
                ) : null}

                {result.address ? (
                  <div
                    style={{
                      marginTop: 6,
                      color: primaryText,
                      wordBreak: "break-word",
                    }}
                  >
                    {result.address}
                  </div>
                ) : null}

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 10,
                    flexWrap: "wrap",
                  }}
                >
                  {result.phone ? (
                    <a href={`tel:${result.phone}`} className="small-button">
                      Call
                    </a>
                  ) : null}

                  {result.directionsUrl ? (
                    <a
                      href={result.directionsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="small-button"
                    >
                      Directions
                    </a>
                  ) : null}

                  {!saved ? (
                    <button
                      className="small-button"
                      onClick={() => saveResource(result)}
                      disabled={savingPlaceId === result.placeId}
                    >
                      {savingPlaceId === result.placeId ? "Saving..." : "Save"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {isAssignOpen && assignResource ? (
        <div
          onClick={() => setIsAssignOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
            boxSizing: "border-box",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 20,
              width: "100%",
              maxWidth: 420,
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              boxSizing: "border-box",
            }}
          >
            <div className="modal-handle" />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
                gap: 12,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 28,
                  fontWeight: 600,
                  color: navy,
                }}
              >
                Assign Resource
              </h3>

              <button
                onClick={() => setIsAssignOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 24,
                  cursor: "pointer",
                  color: secondaryText,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                fontSize: 15,
                color: primaryText,
                marginBottom: 12,
                wordBreak: "break-word",
              }}
            >
              {assignResource.name || "Unnamed resource"}
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {horsesList.length === 0 ? (
                <div style={{ color: secondaryText }}>No horses found.</div>
              ) : (
                horsesList.map((horse) => {
                  const checked = selectedHorseIds.includes(horse.id);

                  return (
                    <label
                      key={horse.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: 12,
                        border: `1px solid ${borderColor}`,
                        borderRadius: 12,
                        background: "#FCFBF8",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedHorseIds((prev) => [...prev, horse.id]);
                          } else {
                            setSelectedHorseIds((prev) =>
                              prev.filter((id) => id !== horse.id)
                            );
                          }
                        }}
                      />
                      <span style={{ color: primaryText }}>{horse.name}</span>
                    </label>
                  );
                })
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                marginTop: 18,
                flexWrap: "wrap",
              }}
            >
              <button
                className="secondary-button"
                onClick={() => setIsAssignOpen(false)}
              >
                Cancel
              </button>

              <button
                className="primary-button"
                onClick={saveHorseAssignments}
              >
                Save Assignments
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <FloatingAskLex onAsk={onAsk} />
      <BottomNav />
    </div>
  );
}