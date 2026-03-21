import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";

export default function LogPage({ user, horses = [], activeHorseId, setActiveHorseId }) {
  const { horseId } = useParams();
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
  if (horseId && setActiveHorseId) {
    setActiveHorseId(horseId);
  }
}, [horseId, setActiveHorseId]);
  const activeHorse = useMemo(
    () => horses.find((h) => h.id === activeHorseId) || null,
    [horses, activeHorseId]
  );

  const saveObservation = async () => {
    if (!user) {
      alert("Please log in first.");
      return;
    }

    if (!activeHorseId) {
      alert("Select a horse first.");
      return;
    }

    if (!note.trim()) {
      alert("Type an observation first.");
      return;
    }

    try {
      setStatus("Saving...");

      // For now: we store the latest observation in the horse's notes (append),
      // and bump updatedAt so Home Status reflects a recent update.
      const existingNotes = activeHorse?.notes ? String(activeHorse.notes) : "";
      const timestamp = new Date().toLocaleString();

      const nextNotes = existingNotes
        ? `${existingNotes}\n\n[${timestamp}] ${note.trim()}`
        : `[${timestamp}] ${note.trim()}`;

      await updateDoc(doc(db, "horses", activeHorseId), {
        notes: nextNotes,
        updatedAt: Date.now(),
      });

      setNote("");
      setStatus("Saved.");
      setTimeout(() => setStatus(""), 1200);
    } catch (e) {
      console.log("SAVE OBSERVATION ERROR:", e);
      setStatus("");
      alert("Failed to save observation.");
    }
  };

  if (!user) {
    return (
      <div>
        <h2>Log</h2>
        <div style={{ opacity: 0.75 }}>Please log in on Home first.</div>
      </div>
    );
  }

  return (
    <div>
      <h2>Log</h2>

      <div style={{ marginTop: 12, opacity: 0.9, fontSize: 14 }}>
        What’s happening with your horse right now?
      </div>

      {/* HORSE PICKER (tap a name) */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Choose horse</div>

        {horses.length === 0 ? (
          <div style={{ fontSize: 14, opacity: 0.7 }}>No horses yet. Add one on Horses.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {horses.map((h) => (
              <button
                key={h.id}
                onClick={() => setActiveHorseId(h.id)}
                style={{
                  textAlign: "left",
                  padding: 10,
                  borderRadius: 8,
                  border: h.id === activeHorseId ? "2px solid #111" : "1px solid #ddd",
                  background: h.id === activeHorseId ? "rgba(0,0,0,0.03)" : "#fff",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 700 }}>{h.name || "Unnamed"}</div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  {h.age ? `Age: ${h.age}` : "Age: —"}{" · "}
                  {h.sex ? `Sex: ${h.sex}` : "Sex: —"}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* OBSERVATION INPUT */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>
          Observation {activeHorse ? `for ${activeHorse.name || "Unnamed"}` : ""}
        </div>

        <textarea
          rows={5}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Example: Didn’t finish grain, seems dull, manure smaller than normal."
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ddd",
          }}
        />

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
          <button onClick={saveObservation}>Save update</button>
          {status ? <div style={{ fontSize: 13, opacity: 0.75 }}>{status}</div> : null}
        </div>
      </div>
    </div>
  );
}