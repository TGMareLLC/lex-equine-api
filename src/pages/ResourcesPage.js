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

const API_BASE_URL = "https://lex-equine-api.onrender.com";

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
  const navyPressed = "#1B2538";
  const navyBorder = "#31425F";
  const burgundy = "#7A2E2E";
  const goldBg = "#F5EEDB";
  const goldText = "#6E5A36";
  const homeBg = "#F6F4EE";
  const cardShadow = "0 10px 22px rgba(24, 34, 51, 0.08)";
  const panelShadow = "0 12px 24px rgba(24, 34, 51, 0.14)";

  const selectedResource = useMemo(() => {
    return RESOURCE_TYPES.find((item) => item.key === selectedType);
  }, [selectedType]);

  const loadSavedResources = async () => {
    if (!auth.currentUser?.uid) return;

    try {
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
    } catch (e) {
      console.log("LOAD SAVED RESOURCES ERROR:", e);
      setSavedResources([]);
      setSavedStatus("Could not load saved resources.");
    }
  };

  const loadHorses = async () => {
    if (!auth.currentUser?.uid) return;

    try {
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
    } catch (e) {
      console.log("LOAD HORSES ERROR:", e);
      setHorsesList([]);
    }
  };

  useEffect(() => {
    loadSavedResources();
    loadHorses();
  }, []);

  const savedSummary = useMemo(() => {
    const primaryCount = savedResources.filter((item) => item.isPrimary).length;
    return {
      total: savedResources.length,
      primaryCount,
    };
  }, [savedResources]);

  const searchNearby = async () => {
    try {
      setIsLoading(true);
      setResults([]);
      setResultsStatus("");

      const latitude = 42.3732;
      const longitude = -72.5199;

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

      const data = response.data || {};
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
      <div style={{ paddingTop: 8 }}>
        <div
          style={{
            fontSize: 44,
            lineHeight: 1,
            fontWeight: 600,
            letterSpacing: "-0.03em",
            color: navy,
          }}
        >
          Resources
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 20,
            color: secondaryText,
            fontWeight: 400,
          }}
        >
          Find services near you
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div
          style={{
            padding: 20,
            borderRadius: 22,
            border: `1px solid ${navyBorder}`,
            background: "linear-gradient(180deg, #2E3F5D 0%, #24324A 100%)",
            color: "#FFFFFF",
            boxShadow: panelShadow,
          }}
        >
          <div
            style={{
              fontSize: 14,
              opacity: 0.82,
            }}
          >
            Resource Overview
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 30,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {savedSummary.total}
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 15,
              lineHeight: 1.5,
              opacity: 0.92,
            }}
          >
            {savedSummary.primaryCount} primary resource
            {savedSummary.primaryCount === 1 ? "" : "s"} saved across your account
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginTop: 18,
          padding: 18,
          width: "100%",
          boxSizing: "border-box",
          borderRadius: 22,
          border: `1px solid ${borderColor}`,
          background: "#FFFFFF",
          boxShadow: cardShadow,
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 600, color: primaryText }}>
          Search Nearby
        </div>

        <div style={{ marginTop: 8, color: secondaryText, fontSize: 14 }}>
          Choose a service type, optionally assign it to a horse while saving, then search.
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {RESOURCE_TYPES.map((resource) => {
            const active = resource.key === selectedType;

            return (
              <button
                key={resource.key}
                onClick={() => setSelectedType(resource.key)}
                style={{
                  padding: "9px 13px",
                  borderRadius: 999,
                  border: active ? `1px solid ${navy}` : `1px solid ${borderColor}`,
                  background: active ? navy : "#FFFFFF",
                  color: active ? "#FFFFFF" : primaryText,
                  cursor: "pointer",
                  fontWeight: 500,
                  fontSize: 14,
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
            style={{ marginTop: 12 }}
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
            border: `1px solid ${navyBorder}`,
            borderRadius: 18,
            padding: "16px 18px",
            background: "linear-gradient(180deg, #2E3F5D 0%, #24324A 100%)",
            color: "#FFF",
            fontWeight: 600,
            fontSize: 17,
            cursor: "pointer",
            boxSizing: "border-box",
            boxShadow: panelShadow,
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.background = navyPressed;
            e.currentTarget.style.transform = "scale(0.995)";
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.background =
              "linear-gradient(180deg, #2E3F5D 0%, #24324A 100%)";
            e.currentTarget.style.transform = "scale(1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              "linear-gradient(180deg, #2E3F5D 0%, #24324A 100%)";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          {isLoading ? "Searching..." : `Search Nearby ${selectedResource.label}`}
        </button>
      </div>

      <div
        className="card"
        style={{
          marginTop: 18,
          padding: 18,
          width: "100%",
          boxSizing: "border-box",
          borderRadius: 22,
          border: `1px solid ${borderColor}`,
          background: "#FFFFFF",
          boxShadow: cardShadow,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 600, color: primaryText }}>
            Saved Resources
          </div>

          {savedSummary.primaryCount > 0 ? (
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                background: goldBg,
                color: goldText,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {savedSummary.primaryCount} primary
            </div>
          ) : null}
        </div>

        <div style={{ height: 1, background: borderColor, marginTop: 14, marginBottom: 14 }} />

        {savedStatus ? (
          <div style={{ color: secondaryText }}>{savedStatus}</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {savedResources.map((item) => (
              <div
                key={item.id}
                style={{
                  border: `1px solid ${borderColor}`,
                  borderRadius: 16,
                  padding: 14,
                  background: "#FCFBF8",
                  width: "100%",
                  maxWidth: "100%",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: primaryText, wordBreak: "break-word" }}>
                      {item.name}
                    </div>

                    <div style={{ fontSize: 13, color: secondaryText, marginTop: 4 }}>
                      {item.horseId
                        ? `Horse specific · ${
                            horsesList.find((horse) => horse.id === item.horseId)?.name || "Assigned"
                          }`
                        : "All horses"}
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
                          lineHeight: 1.5,
                        }}
                      >
                        {item.address}
                      </div>
                    ) : null}
                  </div>

                  {item.isPrimary ? (
                    <div
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: goldBg,
                        color: goldText,
                        fontSize: 12,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Primary
                    </div>
                  ) : null}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 12,
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
            ))}
          </div>
        )}
      </div>

      <div
        className="card"
        style={{
          marginTop: 18,
          padding: 18,
          width: "100%",
          boxSizing: "border-box",
          borderRadius: 22,
          border: `1px solid ${borderColor}`,
          background: "#FFFFFF",
          boxShadow: cardShadow,
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 600, color: primaryText }}>
          Results
        </div>

        <div style={{ height: 1, background: borderColor, marginTop: 14, marginBottom: 14 }} />

        {resultsStatus ? (
          <div style={{ color: secondaryText }}>{resultsStatus}</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {results.map((result) => {
              const saved = savedResources.find((item) => item.placeId === result.placeId);

              return (
                <div
                  key={result.placeId}
                  style={{
                    border: `1px solid ${borderColor}`,
                    borderRadius: 16,
                    padding: 14,
                    background: "#FCFBF8",
                    width: "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: primaryText, wordBreak: "break-word" }}>
                        {result.name}
                      </div>

                      {result.distanceText ? (
                        <div style={{ fontSize: 14, color: secondaryText, marginTop: 4 }}>
                          {result.distanceText}
                        </div>
                      ) : null}

                      {result.address ? (
                        <div
                          style={{
                            marginTop: 6,
                            color: primaryText,
                            wordBreak: "break-word",
                            lineHeight: 1.5,
                          }}
                        >
                          {result.address}
                        </div>
                      ) : null}
                    </div>

                    {saved ? (
                      <div
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: goldBg,
                          color: goldText,
                          fontSize: 12,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Saved
                      </div>
                    ) : null}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      marginTop: 12,
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
            })}
          </div>
        )}
      </div>

      {isAssignOpen && assignResource ? (
        <div className="modal-backdrop" onClick={() => setIsAssignOpen(false)}>
          <div
            className="modal-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxHeight: "80vh",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
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