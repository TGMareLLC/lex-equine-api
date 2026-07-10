// src/pages/CaretakerDetailPage.js

import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function CaretakerDetailPage({ user, horses = [] }) {
  const navigate = useNavigate();
  const { caretakerId } = useParams();

  const [caretaker, setCaretaker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editEmail, setEditEmail] = useState("");
  const [editHorseIds, setEditHorseIds] = useState([]);
  const [editPermissions, setEditPermissions] = useState({});

  useEffect(() => {
    if (!caretakerId) {
      setCaretaker(null);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, "caretakerAccess", caretakerId),
      (snap) => {
        if (!snap.exists()) {
          setCaretaker(null);
          setLoading(false);
          return;
        }

        setCaretaker({ id: snap.id, ...snap.data() });
        setLoading(false);
      },
      (error) => {
        console.log("LOAD CARETAKER DETAIL ERROR:", error);
        setCaretaker(null);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [caretakerId]);

  const startEditing = () => {
    setEditEmail(caretaker.caretakerEmail || "");
    setEditHorseIds(caretaker.horseIds || []);
    setEditPermissions({
      viewHorse: caretaker.permissions?.viewHorse ?? true,
      completeCare: caretaker.permissions?.completeCare ?? true,
      addLogs: caretaker.permissions?.addLogs ?? true,
      viewEmergencyContacts:
        caretaker.permissions?.viewEmergencyContacts ?? true,
    });
    setIsEditing(true);
  };

  const toggleEditHorse = (horseId) => {
    setEditHorseIds((current) =>
      current.includes(horseId)
        ? current.filter((id) => id !== horseId)
        : [...current, horseId]
    );
  };

  const toggleEditPermission = (key) => {
    setEditPermissions((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const handleSaveChanges = async () => {
    if (!caretaker?.id) return;

    if (!editEmail.trim()) {
      alert("Please enter an email address.");
      return;
    }

    if (editHorseIds.length === 0) {
      alert("Please assign at least one horse.");
      return;
    }

    try {
      await updateDoc(doc(db, "caretakerAccess", caretaker.id), {
        caretakerEmail: editEmail.trim().toLowerCase(),
        horseIds: editHorseIds,
        permissions: editPermissions,
      });

      setIsEditing(false);
    } catch (error) {
      console.log("SAVE CARETAKER CHANGES ERROR:", error);
      alert("Could not save caretaker changes.");
    }
  };

  const handleRemoveAccess = async () => {
  if (!caretaker?.id) return;

  const confirmRemove = window.confirm(
    "Remove this caretaker's access? They will no longer be able to view or update these horses."
  );

  if (!confirmRemove) return;

  try {
    await updateDoc(doc(db, "caretakerAccess", caretaker.id), {
      status: "revoked",
      revokedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.log("REMOVE CARETAKER ACCESS ERROR:", error);
    alert("Could not remove caretaker access.");
  }
};

const handleRestoreAccess = async () => {
  if (!caretaker?.id) return;

  try {
    await updateDoc(doc(db, "caretakerAccess", caretaker.id), {
      status: "active",
      revokedAt: null,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.log("RESTORE CARETAKER ACCESS ERROR:", error);
    alert("Could not restore caretaker access.");
  }
};

const handleDeleteCaretaker = async () => {
  if (!caretaker?.id) return;

  const confirmDelete = window.confirm(
    "Permanently delete this caretaker record? This cannot be undone."
  );

  if (!confirmDelete) return;

  try {
    await deleteDoc(doc(db, "caretakerAccess", caretaker.id));
    navigate("/caretakers");
  } catch (error) {
    console.log("DELETE CARETAKER ERROR:", error);
    alert("Could not delete caretaker.");
  }
};

  const permissionRows = [
    ["viewHorse", "View Horse Information"],
    ["completeCare", "Complete Care Tasks"],
    ["addLogs", "Add Logs"],
    ["viewEmergencyContacts", "View Emergency Contacts"],
  ];
  const inviteCode = caretaker?.inviteCode || caretaker?.id || "";

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
      <div
  style={{
    width: "100%",
    margin: "0 auto",
  }}
>
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
            <div style={{ color: "#6F6A60" }}>Loading caretaker...</div>
          ) : !caretaker ? (
            <div style={{ color: "#6F6A60" }}>Caretaker not found.</div>
          ) : (
            <>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#24324A",
                  marginBottom: 4,
                }}
              >
                {caretaker.caretakerName || "Unnamed Caretaker"}
              </div>

              {isEditing ? (
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Email Address"
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
              ) : (
                <div
                  style={{
                    color: "#6F6A60",
                    fontSize: 15,
                    marginBottom: 16,
                  }}
                >
                  {caretaker.caretakerEmail || "No email"}
                </div>
              )}

              <div
                style={{
                  border: "1px solid #E5E2DA",
                  borderRadius: 16,
                  padding: 14,
                  background: "#FBF8F2",
                  color: "#24324A",
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                Status:{" "}
{caretaker.status === "active"
  ? "Active"
  : caretaker.status === "revoked"
  ? "Access Removed"
  : "Pending Invitation"}
              </div>

              {inviteCode && (
  <div
    style={{
      border: "1px solid #E5E2DA",
      borderRadius: 16,
      padding: 14,
      background: "#FBF8F2",
      marginBottom: 16,
    }}
  >
    <div
      style={{
        color: "#24324A",
        fontWeight: 700,
        fontSize: 16,
        marginBottom: 8,
      }}
    >
      Invite Code
    </div>

    <div
      style={{
        color: "#6F6A60",
        fontSize: 14,
        wordBreak: "break-all",
        marginBottom: 12,
      }}
    >
      {inviteCode}
    </div>

    <button
      onClick={async () => {
  try {
    await navigator.clipboard.writeText(inviteCode);
    alert("Invite Code copied.");
  } catch (error) {
    console.log("COPY Invite Code ERROR:", error);
    window.prompt("Copy this Invite Code:", inviteCode);
  }
}}
      style={{
        border: "none",
        borderRadius: 14,
        padding: "12px 14px",
        background: "#24324A",
        color: "#FFFFFF",
        fontWeight: 700,
        fontSize: 14,
        cursor: "pointer",
      }}
    >
      Copy Invite Code
    </button>
  </div>
)}

              <div
                style={{
                  marginBottom: 10,
                  color: "#24324A",
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                Assigned Horses
              </div>

              <div
                style={{
                  border: "1px solid #E5E2DA",
                  borderRadius: 16,
                  padding: isEditing ? 12 : 14,
                  background: "#FBF8F2",
                  color: "#24324A",
                  fontWeight: 600,
                }}
              >
                {isEditing ? (
                  horses.length === 0 ? (
                    <div style={{ color: "#6F6A60" }}>No horses found.</div>
                  ) : (
                    horses.map((horse) => {
                      const checked = editHorseIds.includes(horse.id);

                      return (
                        <button
                          key={horse.id}
                          onClick={() => toggleEditHorse(horse.id)}
                          style={{
                            width: "100%",
                            border: "none",
                            background: checked ? "#F6F4EE" : "transparent",
                            borderRadius: 12,
                            padding: "12px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-start",
gap: 12,
                            color: "#24324A",
                            fontWeight: 600,
                            fontSize: 15,
                            cursor: "pointer",
                          }}
                        >
                          <span
  style={{
    fontSize: 30,
    lineHeight: 1,
    marginRight: 12,
  }}
>
  {checked ? "☑" : "☐"}
</span>

<span>{horse.name || "Unnamed Horse"}</span>
                        </button>
                      );
                    })
                  )
                ) : (
                  <>
                    {caretaker.horseIds?.length
                      ? caretaker.horseIds
                          .map(
                            (horseId) =>
                              horses.find((horse) => horse.id === horseId)
                                ?.name
                          )
                          .filter(Boolean)
                          .join(", ")
                      : "None"}
                  </>
                )}
              </div>

              <div
                style={{
                  marginTop: 20,
                  marginBottom: 10,
                  color: "#24324A",
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                Permissions
              </div>

              <div
                style={{
                  border: "1px solid #E5E2DA",
                  borderRadius: 16,
                  padding: 12,
                  background: "#FBF8F2",
                }}
              >
                {permissionRows.map(([key, label]) => {
                  const checked = isEditing
                    ? editPermissions[key]
                    : caretaker.permissions?.[key];

                  return (
                    <button
                      key={key}
                      disabled={!isEditing}
                      onClick={() => {
                        if (isEditing) toggleEditPermission(key);
                      }}
                      style={{
                        padding: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-start",
gap: 12,
                        color: "#24324A",
                        fontWeight: 600,
                        fontSize: 15,
                        width: "100%",
                        border: "none",
                        background:
                          isEditing && checked ? "#F6F4EE" : "transparent",
                        cursor: isEditing ? "pointer" : "default",
                        borderRadius: 12,
                      }}
                    >
                      <span
  style={{
    fontSize: isEditing ? 30 : 22,
    lineHeight: 1,
    marginRight: 12,
    minWidth: 32,
    textAlign: "center",
  }}
>
  {isEditing ? (checked ? "☑" : "☐") : checked ? "✓" : ""}
</span>

<span>{label}</span>
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginTop: 20,
                }}
              >
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      style={{
                        flex: 1,
                        border: "1px solid #E5E2DA",
                        borderRadius: 14,
                        padding: "14px",
                        background: "#FFFFFF",
                        color: "#24324A",
                        fontWeight: 700,
                        fontSize: 15,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      onClick={handleSaveChanges}
                      style={{
                        flex: 1,
                        border: "none",
                        borderRadius: 14,
                        padding: "14px",
                        background: "#24324A",
                        color: "#FFFFFF",
                        fontWeight: 700,
                        fontSize: 15,
                        cursor: "pointer",
                      }}
                    >
                      Save Changes
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={startEditing}
                      style={{
                        flex: 1,
                        border: "none",
                        borderRadius: 14,
                        padding: "14px",
                        background: "#24324A",
                        color: "#FFFFFF",
                        fontWeight: 700,
                        fontSize: 15,
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>

                    {caretaker.status === "revoked" ? (
  <button
    onClick={handleRestoreAccess}
    style={{
      flex: 1,
      border: "1px solid #E5E2DA",
      borderRadius: 14,
      padding: "14px",
      background: "#FFFFFF",
      color: "#24324A",
      fontWeight: 700,
      fontSize: 15,
      cursor: "pointer",
    }}
  >
    Restore Access
  </button>
) : (
  <button
    onClick={handleRemoveAccess}
    style={{
      flex: 1,
      border: "1px solid #E5E2DA",
      borderRadius: 14,
      padding: "14px",
      background: "#FFFFFF",
      color: "#24324A",
      fontWeight: 700,
      fontSize: 15,
      cursor: "pointer",
    }}
  >
    Remove Access
  </button>
)}
                  </>
                )}
              </div>
              {!isEditing && (
  <button
    onClick={handleDeleteCaretaker}
    style={{
      width: "100%",
      marginTop: 12,
      border: "1px solid #D8B4B4",
      borderRadius: 14,
      padding: "14px",
      background: "#FFFFFF",
      color: "#9F2A2A",
      fontWeight: 700,
      fontSize: 15,
      cursor: "pointer",
    }}
  >
    Delete Caretaker
  </button>
)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}