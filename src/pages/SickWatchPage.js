import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import imageCompression from "browser-image-compression";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import BottomNav from "../components/BottomNav";
import FloatingAskLex from "../components/FloatingAskLex";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

const EMPTY_ENTRY_FORM = {
  temp: "",
  manure: "",
  urine: "",
  water: "",
  appetite: "",
  symptoms: "",
  medication: "",
  notes: "",
};

const ENTRY_FIELDS = [
  "temp",
  "manure",
  "urine",
  "water",
  "appetite",
  "symptoms",
  "medication",
  "notes",
];

const ENTRY_FIELD_LABELS = {
  temp: "Temp",
  manure: "Manure",
  urine: "Urine",
  water: "Water",
  appetite: "Appetite",
  symptoms: "Symptoms",
  medication: "Medication",
  notes: "Notes",
};

const getActiveIncidentId = (horse) => {
  if (horse?.activeSickWatchId) return horse.activeSickWatchId;
  if (horse?.sickWatchStartedAt) return `${horse.id}_${horse.sickWatchStartedAt}`;
  return horse?.id ? `${horse.id}_legacy` : "";
};

export default function SickWatchPage({ horses = [], onAsk }) {
  const [searchParams] = useSearchParams();
  const horseIdFromURL = searchParams.get("horseId");

  const [entries, setEntries] = useState([]);
  const [entriesStatus, setEntriesStatus] = useState("");

  const [modalHorseId, setModalHorseId] = useState("");
  const [selectedEntryFields, setSelectedEntryFields] = useState([]);
  const [entryForm, setEntryForm] = useState(EMPTY_ENTRY_FORM);

  const [expandedHorseIds, setExpandedHorseIds] = useState({});
  const [showVetByHorseId, setShowVetByHorseId] = useState({});

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [viewerPhotoUrl, setViewerPhotoUrl] = useState("");

  const primaryText = "#1E1E1E";
  const secondaryText = "#6F6A60";
  const borderColor = "#E5E2DA";
  const navy = "#24324A";
  const navyPressed = "#1B2538";
  const burgundy = "#7A2E2E";
  const goldBorder = "#D2B46C";
  const parchment = "#F6F1E7";

  const sickWatchHorses = useMemo(() => {
    return (horses || []).filter((h) => h.sickWatchOn);
  }, [horses]);

  const sortedSickWatchHorses = useMemo(() => {
    if (!horseIdFromURL) return sickWatchHorses;

    const prioritized = [];
    const others = [];

    sickWatchHorses.forEach((horse) => {
      if (horse.id === horseIdFromURL) {
        prioritized.push(horse);
      } else {
        others.push(horse);
      }
    });

    return [...prioritized, ...others];
  }, [sickWatchHorses, horseIdFromURL]);

  const activeHorseById = useMemo(() => {
    const map = {};
    sickWatchHorses.forEach((h) => {
      map[h.id] = h;
    });
    return map;
  }, [sickWatchHorses]);

  const modalHorse = modalHorseId ? activeHorseById[modalHorseId] || null : null;

  const loadSickWatchEntries = useCallback(async () => {
    if (!sickWatchHorses.length) {
      setEntries([]);
      setEntriesStatus("");
      return;
    }

    try {
      setEntriesStatus("Loading entries...");

      const snapshots = await Promise.all(
        sickWatchHorses.map(async (horse) => {
          const incidentId = getActiveIncidentId(horse);

          const qs = query(
            collection(db, "sickwatch"),
            where("horseId", "==", horse.id),
            where("incidentId", "==", incidentId),
            orderBy("createdAt", "desc")
          );

          return getDocs(qs);
        })
      );

      const items = snapshots
        .flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      setEntries(items);
      setEntriesStatus(items.length ? "" : "No entries yet.");
    } catch (e) {
      console.log("LOAD SICK WATCH ENTRIES ERROR:", e);
      setEntries([]);
      setEntriesStatus("Could not load entries.");
    }
  }, [sickWatchHorses]);

  useEffect(() => {
    loadSickWatchEntries();
  }, [loadSickWatchEntries]);

  const latestEntryByHorse = useMemo(() => {
    const map = {};
    entries.forEach((entry) => {
      if (!entry.horseId) return;
      if (!map[entry.horseId]) {
        map[entry.horseId] = entry;
      }
    });
    return map;
  }, [entries]);

  const entriesByHorse = useMemo(() => {
    const map = {};

    entries.forEach((entry) => {
      if (!entry.horseId) return;
      if (!map[entry.horseId]) {
        map[entry.horseId] = [];
      }
      map[entry.horseId].push(entry);
    });

    Object.keys(map).forEach((horseId) => {
      map[horseId].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    });

    return map;
  }, [entries]);

  const buildHorseSummaryText = useCallback(
    (horse) => {
      if (!horse) return "";

      const horseEntries = [...(entriesByHorse[horse.id] || [])].sort(
        (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
      );

      const lines = [];

      lines.push(
        `${horse.name || "Unnamed"} — Started ${
          horse.sickWatchStartedAt
            ? new Date(horse.sickWatchStartedAt).toLocaleString()
            : "Unknown"
        }`
      );

      if (!horseEntries.length) {
        lines.push("No entries yet.");
      } else {
        horseEntries.forEach((entry) => {
          const parts = [];

          if (entry.createdAt) {
            parts.push(new Date(entry.createdAt).toLocaleString());
          }
          if (entry.temperature) parts.push(`Temp: ${entry.temperature}`);
          if (entry.manure) parts.push(`Manure: ${entry.manure}`);
          if (entry.urine) parts.push(`Urine: ${entry.urine}`);
          if (entry.water) parts.push(`Water: ${entry.water}`);
          if (entry.appetite) parts.push(`Appetite: ${entry.appetite}`);
          if (entry.symptoms) parts.push(`Symptoms: ${entry.symptoms}`);
          if (entry.medication) parts.push(`Medication: ${entry.medication}`);
          if (entry.notes) parts.push(`Notes: ${entry.notes}`);
          if (entry.photoURL) parts.push("Photo attached");

          lines.push(parts.join(" | "));
        });
      }

      return lines.join("\n").trim();
    },
    [entriesByHorse]
  );

  const resetEntryForm = () => {
    setSelectedEntryFields([]);
    setEntryForm(EMPTY_ENTRY_FORM);
    setPhotoFile(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview("");
  };

  const openEntryModal = (horseId) => {
    setModalHorseId(horseId);
    resetEntryForm();
  };

  const closeEntryModal = () => {
    setModalHorseId("");
    resetEntryForm();
  };

  const toggleEntryField = (field) => {
    setSelectedEntryFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const handleEntryChange = (field, value) => {
    setEntryForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getPhotoCountForHorse = (horseId) => {
    return (entriesByHorse[horseId] || []).filter((entry) => !!entry.photoURL).length;
  };

  const canUploadPhotoForHorse = (horseId) => {
    return getPhotoCountForHorse(horseId) < 5;
  };

  const shouldShowPhotoUpload = selectedEntryFields.some((field) =>
    ["manure", "symptoms", "notes"].includes(field)
  );

  const handlePhotoSelect = async (file) => {
    if (!file) return;

    try {
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.4,
        maxWidthOrHeight: 1400,
        useWebWorker: true,
      });

      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }

      setPhotoFile(compressedFile);
      setPhotoPreview(URL.createObjectURL(compressedFile));
    } catch (e) {
      console.log("PHOTO SELECT ERROR:", e);
      alert("Could not process photo.");
    }
  };

  const saveSickWatchEntry = async (horseId) => {
    if (!horseId) {
      alert("No horse selected.");
      return;
    }

    if (selectedEntryFields.length === 0) {
      alert("Choose at least one entry type.");
      return;
    }

    const hasAnyValue = selectedEntryFields.some(
      (field) => String(entryForm[field] || "").trim() !== ""
    );

    if (!hasAnyValue && !photoFile) {
      alert("Enter at least one update.");
      return;
    }

    if (photoFile && !canUploadPhotoForHorse(horseId)) {
      alert("This Sick Watch has reached the 5-photo limit.");
      return;
    }

    try {
      let photoURL = "";
      let photoPath = "";

      if (photoFile) {
        const safeName = photoFile.name || "entry-photo.jpg";
        const path = `sickwatch_photos/${horseId}/${Date.now()}-${safeName}`;
        const storageRef = ref(storage, path);

        await uploadBytes(storageRef, photoFile);
        photoURL = await getDownloadURL(storageRef);
        photoPath = path;
      }

      const horse = activeHorseById[horseId];
      const incidentId = getActiveIncidentId(horse);

      await addDoc(collection(db, "sickwatch"), {
        horseId,
        incidentId,
        temperature: selectedEntryFields.includes("temp") ? entryForm.temp : "",
        manure: selectedEntryFields.includes("manure") ? entryForm.manure : "",
        urine: selectedEntryFields.includes("urine") ? entryForm.urine : "",
        water: selectedEntryFields.includes("water") ? entryForm.water : "",
        appetite: selectedEntryFields.includes("appetite") ? entryForm.appetite : "",
        symptoms: selectedEntryFields.includes("symptoms") ? entryForm.symptoms : "",
        medication: selectedEntryFields.includes("medication") ? entryForm.medication : "",
        notes: selectedEntryFields.includes("notes") ? entryForm.notes : "",
        photoURL,
        photoPath,
        createdAt: Date.now(),
      });

      await loadSickWatchEntries();
      closeEntryModal();
    } catch (e) {
      console.log("SAVE SICK WATCH ENTRY ERROR:", e);
      alert("Failed to save entry.");
    }
  };

  const endSickWatch = async (horseId, horseName) => {
  if (!horseId) return;

  const confirmed = window.confirm(
    `End Sick Watch for ${horseName || "this horse"}?`
  );
  if (!confirmed) return;

  try {
    const horse =
      activeHorseById[horseId] ||
      horses.find((h) => h.id === horseId) ||
      null;

    const horseEntries = [...(entriesByHorse[horseId] || [])].sort(
      (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
    );

    const summaryText = buildHorseSummaryText(horse);

    const archiveEntries = horseEntries.map((entry) => ({
      createdAt: entry.createdAt || null,
      temperature: entry.temperature || "",
      manure: entry.manure || "",
      urine: entry.urine || "",
      water: entry.water || "",
      appetite: entry.appetite || "",
      symptoms: entry.symptoms || "",
      medication: entry.medication || "",
      notes: entry.notes || "",
      photoURL: entry.photoURL || "",
      photoPath: entry.photoPath || "",
      incidentId: entry.incidentId || "",
      horseId: entry.horseId || "",
    }));

    await addDoc(collection(db, "sickwatch_archive"), {
      horseId,
      horseName: horse?.name || horseName || "Unnamed",
      incidentId: getActiveIncidentId(horse),
      startedAt: horse?.sickWatchStartedAt || null,
      endedAt: Date.now(),
      summaryText,
      entries: archiveEntries,
      createdAt: Date.now(),
    });

    await updateDoc(doc(db, "horses", horseId), {
      sickWatchOn: false,
      sickWatchStartedAt: null,
      sickWatchEndedAt: Date.now(),
      activeSickWatchId: "",
      updatedAt: Date.now(),
    });

    if (modalHorseId === horseId) {
      closeEntryModal();
    }

    await loadSickWatchEntries();

    alert("Sick Watch ended.");
    window.location.reload();
  } catch (e) {
    console.log("END SICK WATCH ERROR:", e);
    alert(`Failed to end Sick Watch: ${e.message || "Unknown error"}`);
  }
};

  const toggleHistory = (horseId) => {
    setExpandedHorseIds((prev) => ({
      ...prev,
      [horseId]: !prev[horseId],
    }));
  };

  const toggleVetPanel = (horseId) => {
    setShowVetByHorseId((prev) => ({
      ...prev,
      [horseId]: !prev[horseId],
    }));
  };

  const sendHorseSummary = async (horse) => {
    const summaryText = buildHorseSummaryText(horse);

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${horse?.name || "Horse"} Sick Watch Summary`,
          text: summaryText,
        });
        return;
      }

      await navigator.clipboard.writeText(summaryText);
      alert("Summary copied. You can paste it into text or email.");
    } catch (e) {
      console.log("SEND HORSE SUMMARY ERROR:", e);
      alert("Could not send summary.");
    }
  };

  const renderEntryFields = () => {
    return selectedEntryFields.map((field) => {
      if (field === "notes" || field === "symptoms") {
        return (
          <textarea
            key={field}
            className="field-textarea"
            value={entryForm[field]}
            onChange={(e) => handleEntryChange(field, e.target.value)}
            placeholder={ENTRY_FIELD_LABELS[field]}
            rows={3}
            style={{ marginBottom: 10 }}
          />
        );
      }

      return (
        <input
          key={field}
          className="field-input"
          value={entryForm[field]}
          onChange={(e) => handleEntryChange(field, e.target.value)}
          placeholder={ENTRY_FIELD_LABELS[field]}
          style={{ marginBottom: 10 }}
        />
      );
    });
  };

  const renderEntryCard = (entry) => {
    if (!entry) {
      return (
        <div style={{ fontSize: 14, color: secondaryText }}>
          No entries yet.
        </div>
      );
    }

    return (
      <div
        style={{
          marginTop: 8,
          padding: 14,
          border: `1px solid ${borderColor}`,
          borderRadius: 16,
          background: "#FCFBF8",
        }}
      >
        {entry.createdAt ? (
          <div style={{ fontSize: 12, color: secondaryText, marginBottom: 8 }}>
            {new Date(entry.createdAt).toLocaleString()}
          </div>
        ) : null}

        {entry.temperature ? <div><strong>Temp:</strong> {entry.temperature}</div> : null}
        {entry.manure ? <div><strong>Manure:</strong> {entry.manure}</div> : null}
        {entry.urine ? <div><strong>Urine:</strong> {entry.urine}</div> : null}
        {entry.water ? <div><strong>Water:</strong> {entry.water}</div> : null}
        {entry.appetite ? <div><strong>Appetite:</strong> {entry.appetite}</div> : null}
        {entry.symptoms ? <div><strong>Symptoms:</strong> {entry.symptoms}</div> : null}
        {entry.medication ? <div><strong>Medication:</strong> {entry.medication}</div> : null}
        {entry.notes ? <div><strong>Notes:</strong> {entry.notes}</div> : null}

        {entry.photoURL ? (
          <div style={{ marginTop: 10 }}>
            <img
              src={entry.photoURL}
              alt="entry"
              onClick={() => setViewerPhotoUrl(entry.photoURL)}
              style={{
                width: "100%",
                maxHeight: 220,
                objectFit: "cover",
                borderRadius: 12,
                display: "block",
                cursor: "pointer",
                border: `1px solid ${borderColor}`,
              }}
            />
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 100 }}>
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
          Sick Watch
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 20,
            color: secondaryText,
            fontWeight: 400,
          }}
        >
          Monitoring and updates
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        {sortedSickWatchHorses.length === 0 ? (
          <div className="card" style={{ padding: 18, color: secondaryText }}>
            No horses currently on Sick Watch.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {sortedSickWatchHorses.map((horse) => {
              const isHighlighted = horse.id === horseIdFromURL;
              const isExpanded = !!expandedHorseIds[horse.id];
              const showVet = !!showVetByHorseId[horse.id];
              const horseEntries = entriesByHorse[horse.id] || [];
              const latestEntry = latestEntryByHorse[horse.id];
              const oldestEntry = horseEntries.length
                ? horseEntries[horseEntries.length - 1]
                : null;

              return (
                <div
                  key={horse.id}
                  className="card"
                  style={{
                    padding: 18,
                    position: "relative",
                    overflow: "hidden",
                    border: isHighlighted
                      ? `2px solid ${goldBorder}`
                      : `1px solid ${borderColor}`,
                    boxShadow: isHighlighted
                      ? "0 8px 18px rgba(182,139,58,0.14)"
                      : undefined,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      background: "#F2E8E7",
                      color: burgundy,
                      fontSize: 14,
                      fontWeight: 600,
                      padding: "12px 18px 12px 22px",
                      borderBottomLeftRadius: 18,
                    }}
                  >
                    Sick Watch Active
                  </div>

                  <div
                    style={{
                      fontSize: 28,
                      lineHeight: 1.1,
                      fontWeight: 500,
                      color: primaryText,
                      paddingRight: 130,
                    }}
                  >
                    {horse.name || "Unnamed"}
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 15,
                      color: secondaryText,
                    }}
                  >
                    Started{" "}
                    {horse.sickWatchStartedAt
                      ? new Date(horse.sickWatchStartedAt).toLocaleString()
                      : "Unknown"}
                  </div>

                  {horse.sickWatchStartedAt ? (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 14,
                        color: secondaryText,
                      }}
                    >
                      Active for{" "}
                      {Math.floor((Date.now() - horse.sickWatchStartedAt) / (1000 * 60 * 60))}h{" "}
                      {Math.floor(
                        ((Date.now() - horse.sickWatchStartedAt) % (1000 * 60 * 60)) /
                          (1000 * 60)
                      )}m
                    </div>
                  ) : null}

                  <div
                    style={{
                      height: 1,
                      background: borderColor,
                      marginTop: 16,
                      marginBottom: 14,
                    }}
                  />

                  {entriesStatus ? (
                    <div style={{ fontSize: 14, color: secondaryText }}>
                      {entriesStatus}
                    </div>
                  ) : (
                    renderEntryCard(latestEntry)
                  )}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      marginTop: 16,
                    }}
                  >
                    <button
                      onClick={() => openEntryModal(horse.id)}
                      style={{
                        border: "none",
                        borderRadius: 14,
                        padding: "14px 16px",
                        background: navy,
                        color: "#FFFFFF",
                        fontWeight: 600,
                        fontSize: 16,
                        cursor: "pointer",
                        boxShadow: "0 6px 14px rgba(0,0,0,0.10)",
                      }}
                      onMouseDown={(e) => {
                        e.currentTarget.style.background = navyPressed;
                        e.currentTarget.style.transform = "scale(0.98)";
                      }}
                      onMouseUp={(e) => {
                        e.currentTarget.style.background = navy;
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = navy;
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                    >
                      Add Entry
                    </button>

                    <button
                      onClick={() => toggleHistory(horse.id)}
                      style={{
                        border: `1px solid ${borderColor}`,
                        borderRadius: 14,
                        padding: "14px 16px",
                        background: "#FBF8F2",
                        color: "#6C6254",
                        fontWeight: 500,
                        fontSize: 16,
                        cursor: "pointer",
                      }}
                    >
                      {isExpanded ? "Hide History" : "View History"}
                    </button>

                    <button
                      onClick={() => toggleVetPanel(horse.id)}
                      style={{
                        border: `1px solid ${borderColor}`,
                        borderRadius: 14,
                        padding: "14px 16px",
                        background: "#FBF8F2",
                        color: "#6C6254",
                        fontWeight: 500,
                        fontSize: 16,
                        cursor: "pointer",
                      }}
                    >
                      Call Vet
                    </button>

                    <button
                      onClick={() => endSickWatch(horse.id, horse.name)}
                      style={{
                        border: `1px solid ${borderColor}`,
                        borderRadius: 14,
                        padding: "14px 16px",
                        background: "#FBF8F2",
                        color: burgundy,
                        fontWeight: 500,
                        fontSize: 16,
                        cursor: "pointer",
                      }}
                    >
                      End Sick Watch
                    </button>
                  </div>

                  {isExpanded ? (
                    <div
                      style={{
                        marginTop: 18,
                        paddingTop: 14,
                        borderTop: `1px solid ${borderColor}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          marginBottom: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 22,
                            fontWeight: 600,
                            color: primaryText,
                          }}
                        >
                          Current Sick Watch History
                        </div>

                        <button
                          className="small-button"
                          onClick={() => sendHorseSummary(horse)}
                        >
                          Send Summary
                        </button>
                      </div>

                      <div
                        style={{
                          fontSize: 14,
                          color: secondaryText,
                          marginBottom: 12,
                        }}
                      >
                        Incident started{" "}
                        {oldestEntry?.createdAt
                          ? new Date(oldestEntry.createdAt).toLocaleString()
                          : horse.sickWatchStartedAt
                          ? new Date(horse.sickWatchStartedAt).toLocaleString()
                          : "Unknown"}
                      </div>

                      {horseEntries.length === 0 ? (
                        <div style={{ fontSize: 14, color: secondaryText }}>
                          No entries yet.
                        </div>
                      ) : (
                        horseEntries.map((entry) => (
                          <div key={entry.id}>{renderEntryCard(entry)}</div>
                        ))
                      )}
                    </div>
                  ) : null}

                  {showVet ? (
                    <div
                      style={{
                        marginTop: 18,
                        paddingTop: 14,
                        borderTop: `1px solid ${borderColor}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 600,
                          color: primaryText,
                          marginBottom: 10,
                        }}
                      >
                        Vet Information
                      </div>

                      <div style={{ fontSize: 15, color: primaryText, lineHeight: 1.6 }}>
                        <div>
                          <strong>Clinic:</strong> {horse.vetClinicName || "No clinic saved"}
                        </div>
                        <div>
                          <strong>Doctor:</strong> {horse.vetDoctorName || "No doctor saved"}
                        </div>
                        <div>
                          <strong>Hours:</strong> {horse.vetHours || "No hours saved"}
                        </div>
                        <div>
                          <strong>Address:</strong> {horse.vetAddress || "No address saved"}
                        </div>
                        <div>
                          <strong>Email:</strong> {horse.vetEmail || "No email saved"}
                        </div>
                        <div>
                          <strong>Phone:</strong> {horse.vetPhone || "No phone saved"}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 10,
                          marginTop: 14,
                        }}
                      >
                        {horse.vetPhone ? (
                          <a
                            href={`tel:${horse.vetPhone}`}
                            className="small-button"
                            style={{ textDecoration: "none" }}
                          >
                            Call
                          </a>
                        ) : null}

                        {horse.vetPhone ? (
                          <a
                            href={`sms:${horse.vetPhone}`}
                            className="small-button"
                            style={{ textDecoration: "none" }}
                          >
                            Text
                          </a>
                        ) : null}

                        {horse.vetEmail ? (
                          <a
                            href={`mailto:${horse.vetEmail}`}
                            className="small-button"
                            style={{ textDecoration: "none" }}
                          >
                            Email
                          </a>
                        ) : null}

                        {horse.vetAddress ? (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                              horse.vetAddress
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="small-button"
                            style={{ textDecoration: "none" }}
                          >
                            Directions
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalHorse ? (
        <div className="modal-backdrop" onClick={closeEntryModal}>
          <div
            className="modal-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              paddingBottom: 0,
            }}
          >
            <div className="modal-handle" />

            <div
              style={{
                paddingBottom: 12,
                borderBottom: `1px solid ${borderColor}`,
              }}
            >
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
                  Add Entry
                </h3>

                <button
                  onClick={closeEntryModal}
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

              <div style={{ fontSize: 14, color: secondaryText }}>
                {modalHorse.name || "Unnamed"}
              </div>
            </div>

            <div
              style={{
                overflowY: "auto",
                paddingTop: 16,
                paddingBottom: 16,
                flex: 1,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                {ENTRY_FIELDS.map((field) => {
                  const active = selectedEntryFields.includes(field);

                  return (
                    <button
                      key={field}
                      type="button"
                      onClick={() => toggleEntryField(field)}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 999,
                        border: active ? `1px solid ${navy}` : `1px solid ${borderColor}`,
                        background: active ? navy : "#FFFFFF",
                        color: active ? "#FFFFFF" : primaryText,
                        cursor: "pointer",
                        fontWeight: 500,
                      }}
                    >
                      {ENTRY_FIELD_LABELS[field]}
                    </button>
                  );
                })}
              </div>

              {renderEntryFields()}

              {shouldShowPhotoUpload ? (
                <div style={{ marginTop: 10 }}>
                  {canUploadPhotoForHorse(modalHorse.id) ? (
                    <>
                      <label
                        htmlFor="sickwatch-photo-input"
                        style={{
                          display: "inline-block",
                          border: `1px solid ${borderColor}`,
                          borderRadius: 14,
                          padding: "12px 14px",
                          background: "#FBF8F2",
                          color: "#6C6254",
                          fontWeight: 500,
                          fontSize: 15,
                          cursor: "pointer",
                        }}
                      >
                        Take or Choose Photo
                      </label>

                      <input
                        id="sickwatch-photo-input"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handlePhotoSelect(e.target.files?.[0] || null)}
                        style={{ display: "none" }}
                      />

                      {photoPreview ? (
                        <div style={{ marginTop: 10 }}>
                          <img
                            src={photoPreview}
                            alt="preview"
                            style={{
                              width: "100%",
                              maxHeight: 220,
                              objectFit: "cover",
                              borderRadius: 12,
                              display: "block",
                            }}
                          />
                        </div>
                      ) : null}

                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 13,
                          color: secondaryText,
                        }}
                      >
                        {getPhotoCountForHorse(modalHorse.id)} of 5 Sick Watch photos used
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        marginTop: 6,
                        padding: 12,
                        border: `1px dashed ${borderColor}`,
                        borderRadius: 14,
                        color: secondaryText,
                        fontSize: 14,
                        background: "#FCFBF8",
                      }}
                    >
                      Photo limit reached for this Sick Watch.
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div
              style={{
                position: "sticky",
                bottom: 0,
                background: "#FFFFFF",
                borderTop: `1px solid ${borderColor}`,
                paddingTop: 12,
                paddingBottom: 14,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                className="primary-button"
                onClick={() => saveSickWatchEntry(modalHorse.id)}
              >
                Save Entry
              </button>

              <button className="secondary-button" onClick={resetEntryForm}>
                Clear
              </button>

              <button className="secondary-button" onClick={closeEntryModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewerPhotoUrl ? (
        <div
          onClick={() => setViewerPhotoUrl("")}
          style={{
            position: "fixed",
            inset: 0,
            background: parchment,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 10050,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setViewerPhotoUrl("");
            }}
            style={{
              position: "absolute",
              top: 24,
              right: 24,
              background: "transparent",
              border: "none",
              fontSize: 30,
              color: primaryText,
              cursor: "pointer",
            }}
          >
            ×
          </button>

          <img
            src={viewerPhotoUrl}
            alt="Full entry"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "92%",
              maxHeight: "88vh",
              objectFit: "contain",
              borderRadius: 18,
              boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
              display: "block",
            }}
          />
        </div>
      ) : null}

      <FloatingAskLex onAsk={onAsk} />
      <BottomNav />
    </div>
  );
}