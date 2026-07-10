import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";

export default function CaretakerInvitePage({ user }) {
  const navigate = useNavigate();
  const { inviteId } = useParams();

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!inviteId) {
      setInvite(null);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, "caretakerAccess", inviteId),
      (snap) => {
        if (!snap.exists()) {
          setInvite(null);
          setLoading(false);
          return;
        }

        setInvite({ id: snap.id, ...snap.data() });
        setLoading(false);
      },
      (error) => {
        console.log("LOAD CARETAKER INVITE ERROR:", error);
        setInvite(null);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [inviteId]);

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
      <div style={{ width: "100%", margin: "0 auto" }}>
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
            <div style={{ color: "#6F6A60" }}>Loading invite...</div>
          ) : !invite ? (
            <>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: "#24324A",
                  marginBottom: 8,
                }}
              >
                Invite Not Found
              </div>

              <div style={{ color: "#6F6A60", fontSize: 15 }}>
                This caretaker invite may have been removed or is no longer available.
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#24324A",
                  marginBottom: 8,
                }}
              >
                Caretaker Invite
              </div>

              <div
                style={{
                  color: "#6F6A60",
                  fontSize: 15,
                  marginBottom: 18,
                }}
              >
                You have been invited to access horse care information in Lex Equine.
              </div>

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
                    marginBottom: 6,
                  }}
                >
                  Invite For
                </div>

                <div style={{ color: "#6F6A60", fontSize: 15 }}>
                  {invite.caretakerEmail || "Caretaker"}
                </div>
              </div>

              <button
                onClick={() => alert("Accept invite coming next.")}
                style={{
                  width: "100%",
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
                Accept Invite
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}