// src/pages/CaretakersPage.js

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import BottomNav from "../components/BottomNav";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";

export default function CaretakersPage({
  user,
  horses = [],
  careHorses = [],
  isCaretakerOnly = false,
  accessState,
  onStartTrial,
  onCaretakerAccessChanged,
}) {
  const navigate = useNavigate();

  const [caretakers, setCaretakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setSaving] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [caretakerName, setCaretakerName] = useState("");
  const [selectedHorseIds, setSelectedHorseIds] = useState([]);
  const [joinInviteCode, setJoinInviteCode] = useState("");

  

  const toggleHorseSelection = (horseId) => {
    setSelectedHorseIds((current) =>
      current.includes(horseId)
        ? current.filter((id) => id !== horseId)
        : [...current, horseId]
    );
  };

  

  const generateInviteCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
};

  const handleCreateCaretakerInvite = async () => {
  if (accessState === "PREVIEW") {
    onStartTrial?.();
    return;
  }

  if (!user?.uid) {
    alert("You must be logged in to invite a caretaker.");
    return;
  }

  if (!caretakerName.trim()) {
    alert("Please enter the caretaker's name.");
    return;
  }

  if (selectedHorseIds.length === 0) {
    alert("Please assign at least one horse.");
    return;
  }

  try {
  setSaving(true);

  const inviteCode = generateInviteCode();

  await addDoc(collection(db, "caretakerAccess"), {
      ownerUid: user.uid,
      caretakerUid: "",
      caretakerName: caretakerName.trim(),
      
      horseIds: selectedHorseIds,
      status: "pending",
      inviteCode,
      invitedAt: serverTimestamp(),
      acceptedAt: null,
      updatedAt: serverTimestamp(),
    });

    setCaretakerName("");
    setSelectedHorseIds([]);
    
    setShowInviteModal(false);
  } catch (error) {
    console.log("CREATE CARETAKER INVITE ERROR:", error);
    alert("Could not create caretaker invite.");
  } finally {
    setSaving(false);
  }
};

const handleJoinCaretakerInvite = async () => {
  if (!user?.uid) {
    alert("You must be logged in to join as a caretaker.");
    return;
  }

  const code = joinInviteCode.trim().toUpperCase();

if (!code) {
  alert("Please enter an invite code.");
  return;
}

try {
  const q = query(
    collection(db, "caretakerAccess"),
    where("inviteCode", "==", code),
    where("status", "==", "pending"),
    where("caretakerUid", "==", "")
  );

  const snap = await getDocs(q);

  console.log("INVITE QUERY FOUND:", snap.size);

  if (snap.empty) {
    alert("Invite code not found.");
    return;
  }

  const inviteDoc = snap.docs[0];
  const inviteData = inviteDoc.data();

  if (inviteData.status === "revoked") {
    alert("This invite has been revoked by the horse owner.");
    return;
  }

    const activeAccessId = `${inviteData.ownerUid}_${user.uid}`;

await setDoc(doc(db, "caretakerAccess", activeAccessId), {
  ...inviteData,
  sourceInviteId: inviteDoc.id,
  caretakerUid: user.uid,
  status: "active",
  acceptedAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

await deleteDoc(doc(db, "caretakerAccess", inviteDoc.id));

if (typeof onCaretakerAccessChanged === "function") {
  await onCaretakerAccessChanged();
}

setJoinInviteCode("");
alert("Caretaker access added.");
  } catch (error) {
    console.log("JOIN CARETAKER INVITE ERROR:", error);
    alert("Could not join caretaker invite.");
  }
};

  useEffect(() => {
    if (!user?.uid) {
      setCaretakers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    



    const q = query(
      collection(db, "caretakerAccess"),
      where("ownerUid", "==", user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        setCaretakers(rows);


setLoading(false);
      },
      (error) => {
        console.log("LOAD CARETAKERS ERROR:", error);
        setCaretakers([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);

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
          }}
        >
          ← Back
        </button>

        {!isCaretakerOnly ? (
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
              marginBottom: 8,
            }}
          >
            Caretakers
          </div>

          <div
            style={{
              fontSize: 15,
              color: "#6F6A60",
              lineHeight: 1.5,
              marginBottom: 20,
            }}
          >
            Invite and manage the people who help care for your horses.
          </div>

          <button
            onClick={() => {
  if (accessState === "PREVIEW") {
    onStartTrial?.();
    return;
  }

  setShowInviteModal(true);
}}
            style={{
              width: "100%",
              border: "none",
              borderRadius: 16,
              padding: "15px 16px",
              background: "#24324A",
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: 16,
              marginBottom: 18,
            }}
          >
            + Invite Caretaker
          </button>

                    {loading ? (
            <div style={{ color: "#6F6A60" }}>Loading caretakers...</div>
          ) : caretakers.length === 0 ? (
            <div
              style={{
                border: "1px dashed #D8D2C6",
                borderRadius: 18,
                padding: 18,
                textAlign: "center",
                color: "#6F6A60",
                lineHeight: 1.5,
                background: "#FBF8F2",
              }}
            >
              No caretakers added yet.
              <br />
              Add someone who helps with feeding, chores, medications, or daily
              care.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {caretakers.map((caretaker) => (
                <div
                  key={caretaker.id}
                  style={{
                    border: "1px solid #E5E2DA",
                    borderRadius: 18,
                    padding: 16,
                    background: "#FBF8F2",
                  }}
                >
                  <div
                    style={{
                      color: "#24324A",
                      fontWeight: 700,
                      fontSize: 16,
                      marginBottom: 4,
                    }}
                  >
                    {caretaker.caretakerName || "Unnamed Caretaker"}
                  </div>

                  

                  <div
  style={{
    color: "#6F6A60",
    fontSize: 13,
    lineHeight: 1.5,
    marginBottom: 12,
  }}
>
  Status: {caretaker.status || "pending"}
  <br />
  Horses assigned:{" "}
  {caretaker.horseIds?.length
    ? caretaker.horseIds
        .map((horseId) => horses.find((horse) => horse.id === horseId)?.name)
        .filter(Boolean)
        .join(", ")
    : "None"}
</div>

<button
  onClick={() => {
  if (accessState === "PREVIEW") {
    onStartTrial?.();
    return;
  }

  navigate(`/caretakers/${caretaker.id}`);
}}
  style={{
    width: "100%",
    border: "1px solid #E5E2DA",
    borderRadius: 14,
    padding: "12px",
    background: "#FFFFFF",
    color: "#24324A",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  }}
>
  View Details
</button>
                </div>
              ))}
            </div>
                    )}
        </div>
      ) : null}
    </div>

    <div
      style={{
        maxWidth: 720,
        margin: "20px auto 0",
      }}
    >
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
    fontSize: 22,
    fontWeight: 700,
    color: "#24324A",
    marginBottom: 8,
  }}
>
  {careHorses.length > 0
    ? "Join Another Horse"
    : "Join as a Caretaker"}
</div>

          <div
            style={{
              color: "#6F6A60",
              lineHeight: 1.5,
              marginBottom: 18,
            }}
          >
            If a horse owner invited you, enter your Invite Code below.
          </div>

          <input
            type="text"
            placeholder="Invite Code"
            value={joinInviteCode}
            onChange={(e) =>
              setJoinInviteCode(e.target.value.toUpperCase())
            }
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "14px 16px",
              borderRadius: 14,
              border: "1px solid #E5E2DA",
              fontSize: 16,
              marginBottom: 16,
            }}
          />

          <button
          onClick={handleJoinCaretakerInvite}
            style={{
              width: "100%",
              border: "none",
              borderRadius: 14,
              padding: "14px",
              background: "#24324A",
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Join
                    </button>
        </div>
      </div>

      {isCaretakerOnly ? (
        <div
          style={{
            maxWidth: 720,
            margin: "20px auto 0",
          }}
        >
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
                fontSize: 22,
                fontWeight: 700,
                color: "#24324A",
                marginBottom: 14,
              }}
            >
              Horses You Care For
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {careHorses.map((horse) => (
                <div
                  key={horse.id}
                  style={{
                    border: "1px solid #E5E2DA",
                    borderRadius: 16,
                    padding: 14,
                    background: "#FBF8F2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: "#24324A",
                        fontSize: 17,
                        fontWeight: 700,
                      }}
                    >
                      {horse.name || "Unnamed Horse"}
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        color: "#6F6A60",
                        fontSize: 14,
                      }}
                    >
                      {horse.age ? `${horse.age} yrs` : ""}
                      {horse.sex ? ` • ${horse.sex}` : ""}
                    </div>
                  </div>

                  {horse.photoUrl ? (
                    <img
                      src={horse.photoUrl}
                      alt={horse.name || "Horse"}
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "2px solid #E5E2DA",
                        flexShrink: 0,
                      }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showInviteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
        >
          <div
            style={{
              width: "90%",
              maxWidth: 500,
              background: "#FFFFFF",
              borderRadius: 24,
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: 6,
                color: "#24324A",
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              Invite Caretaker
            </h2>

            <p
              style={{
                color: "#6F6A60",
                marginBottom: 22,
                lineHeight: 1.5,
              }}
            >
              Invite someone to help care for one or more of your horses.
            </p>

            <div style={{ display: "grid", gap: 16 }}>
              <input
                type="text"
                placeholder="Caretaker Name"
                value={caretakerName}
                onChange={(e) => setCaretakerName(e.target.value)}
                style={{
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid #E5E2DA",
                  fontSize: 16,
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />

              
            </div>

            <div
              style={{
                marginTop: 24,
                marginBottom: 10,
                color: "#24324A",
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              Assign Horses
            </div>

            <div
              style={{
                border: "1px solid #E5E2DA",
                borderRadius: 14,
                padding: 12,
                marginBottom: 24,
                color: "#6F6A60",
              }}
            >
              {horses.length === 0 ? (
                <div>No horses found.</div>
              ) : (
                horses.map((horse) => {
                  const checked = selectedHorseIds.includes(horse.id);

                  return (
                    <button
                      key={horse.id}
                      onClick={() => toggleHorseSelection(horse.id)}
                      style={{
                        width: "100%",
                        border: "none",
                        background: checked ? "#F6F4EE" : "transparent",
                        borderRadius: 12,
                        padding: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        color: "#24324A",
                        fontWeight: 600,
                        fontSize: 15,
                        cursor: "pointer",
                      }}
                    >
                      <span>{horse.name || "Unnamed Horse"}</span>
                      <span>{checked ? "✓" : ""}</span>
                    </button>
                  );
                })
              )}
                        </div>

            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 24,
              }}
            >
              <button
                onClick={() => setShowInviteModal(false)}
                style={{
                  flex: 1,
                  padding: "14px",
                  borderRadius: 14,
                  border: "1px solid #E5E2DA",
                  background: "#FFFFFF",
                  color: "#24324A",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

             <button
  onClick={handleCreateCaretakerInvite}
  style={{
    flex: 1,
    padding: "14px",
    border: "none",
    borderRadius: 14,
    background: "#24324A",
    color: "#FFFFFF",
    fontWeight: 600,
    cursor: "pointer",
  }}
>
  Continue
</button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}