import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db, storage } from "../firebase";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import BottomNav from "../components/BottomNav";
import FloatingAskLex from "../components/FloatingAskLex";

const formatDate = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const getExpiryStatus = (expiresAt) => {
  if (!expiresAt) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const expiry = new Date(expiresAt);
  const expiryDay = new Date(
    expiry.getFullYear(),
    expiry.getMonth(),
    expiry.getDate()
  ).getTime();

  const diffDays = Math.round((expiryDay - today) / 86400000);

  if (diffDays < 0) return "expired";
  if (diffDays <= 30) return "expiring";

  return null;
};

export default function DocumentDetailPage({ user, onAsk }) {
  const navigate = useNavigate();
  const { documentId } = useParams();

  const [documentData, setDocumentData] = useState(null);
  const [status, setStatus] = useState("Loading document...");

  const primaryText = "#1E1E1E";
  const secondaryText = "#6F6A60";
  const burgundy = "#7A2E2E";
  const navy = "#24324A";
  const homeBg = "#F6F4EE";
  const goldBg = "#F5EEDB";
  const goldText = "#6E5A36";

  const loadDocument = useCallback(async () => {
    if (!documentId) return;

    try {
      const refDoc = doc(db, "documents", documentId);
      const snap = await getDoc(refDoc);

      if (!snap.exists()) {
        setStatus("Document not found.");
        return;
      }

      setDocumentData({ id: snap.id, ...snap.data() });
      setStatus("");
    } catch (e) {
      console.log("LOAD DOCUMENT ERROR:", e);
      setStatus("Could not load document.");
    }
  }, [documentId]);

  useEffect(() => {
  loadDocument();
}, [loadDocument]);

  const handleDelete = async () => {
    if (!documentData) return;

    const confirmed = window.confirm("Delete this document?");
    if (!confirmed) return;

    try {
      if (documentData.storagePath) {
        const storageRef = ref(storage, documentData.storagePath);
        await deleteObject(storageRef).catch(() => {});
      }

      await deleteDoc(doc(db, "documents", documentData.id));
      navigate("/documents");
    } catch (e) {
      console.log("DELETE DOCUMENT ERROR:", e);
      alert("Could not delete document.");
    }
  };

  const handleDownload = () => {
    if (!documentData?.fileUrl) return;
    window.open(documentData.fileUrl, "_blank");
  };

  const handleShare = async () => {
    if (!documentData) return;

    const shareText = [
      documentData.documentName || documentData.documentType || "Document",
      documentData.horseName ? `Horse: ${documentData.horseName}` : "General Document",
      documentData.fileUrl || "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      if (navigator.share) {
        await navigator.share({
          title: documentData.documentName || documentData.documentType || "Document",
          text: shareText,
          url: documentData.fileUrl || undefined,
        });
        return;
      }

      await navigator.clipboard.writeText(shareText);
      alert("Document info copied. You can paste it into text or email.");
    } catch (e) {
      console.log("SHARE DOCUMENT ERROR:", e);
      alert("Could not share document.");
    }
  };

  const renderStatusTag = () => {
    const statusType = getExpiryStatus(documentData?.expiresAt);

    if (statusType === "expired") {
      return (
        <div
          style={{
            display: "inline-block",
            padding: "6px 12px",
            borderRadius: 999,
            background: "#F2E8E7",
            color: burgundy,
            fontSize: 13,
            fontWeight: 600,
            marginTop: 10,
          }}
        >
          Expired
        </div>
      );
    }

    if (statusType === "expiring") {
      return (
        <div
          style={{
            display: "inline-block",
            padding: "6px 12px",
            borderRadius: 999,
            background: goldBg,
            color: goldText,
            fontSize: 13,
            fontWeight: 600,
            marginTop: 10,
          }}
        >
          Expiring Soon
        </div>
      );
    }

    return null;
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: homeBg,
        paddingBottom: 100,
      }}
    >
      <div style={{ paddingTop: 8 }}>
        <div
          style={{
            fontSize: 44,
            fontWeight: 600,
            color: navy,
          }}
        >
          Document
        </div>
      </div>

      {status ? (
        <div className="card" style={{ marginTop: 18, padding: 18, color: secondaryText }}>
          {status}
        </div>
      ) : documentData ? (
        <>
          <div className="card" style={{ marginTop: 18, padding: 18 }}>
            <div
              style={{
                fontSize: 24,
                fontWeight: 600,
                color: primaryText,
              }}
            >
              {documentData.documentName || documentData.documentType}
            </div>

            <div style={{ marginTop: 10, color: secondaryText }}>
              {documentData.horseName
                ? `Horse: ${documentData.horseName}`
                : "General Document"}
            </div>

            <div style={{ marginTop: 6, color: secondaryText }}>
              Uploaded: {formatDate(documentData.uploadedAt)}
            </div>

            {documentData.expiresAt ? (
              <div style={{ marginTop: 6, color: secondaryText }}>
                Expires: {formatDate(documentData.expiresAt)}
              </div>
            ) : null}

            {renderStatusTag()}
          </div>

          <div className="card" style={{ marginTop: 18, padding: 18 }}>
            {documentData.fileType?.startsWith("image/") ? (
              <img
                src={documentData.fileUrl}
                alt="document"
                style={{
                  width: "100%",
                  borderRadius: 12,
                  display: "block",
                }}
              />
            ) : (
              <div style={{ textAlign: "center" }}>
                <a
                  href={documentData.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="primary-button"
                >
                  Open Document
                </a>
              </div>
            )}
          </div>

          <div className="card" style={{ marginTop: 18, padding: 18 }}>
            <div style={{ display: "grid", gap: 12 }}>
              <button
                onClick={handleDownload}
                className="primary-button"
                style={{ width: "100%" }}
              >
                Download
              </button>

              <button
                onClick={handleShare}
                className="secondary-button"
                style={{ width: "100%" }}
              >
                Share
              </button>

              <a
                href={`sms:?&body=${encodeURIComponent(
                  `${documentData.documentName || documentData.documentType || "Document"}\n${
                    documentData.horseName ? `Horse: ${documentData.horseName}\n` : ""
                  }${documentData.fileUrl || ""}`
                )}`}
                className="secondary-button"
                style={{
                  width: "100%",
                  textAlign: "center",
                }}
              >
                Text
              </a>

              <a
                href={`mailto:?subject=${encodeURIComponent(
                  documentData.documentName || documentData.documentType || "Document"
                )}&body=${encodeURIComponent(
                  `${documentData.horseName ? `Horse: ${documentData.horseName}\n` : ""}${
                    documentData.fileUrl || ""
                  }`
                )}`}
                className="secondary-button"
                style={{
                  width: "100%",
                  textAlign: "center",
                }}
              >
                Email
              </a>

              <button
                onClick={handleDelete}
                style={{
                  width: "100%",
                  border: `1px solid ${burgundy}`,
                  borderRadius: 12,
                  padding: "12px",
                  background: "transparent",
                  color: burgundy,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Delete Document
              </button>
            </div>
          </div>
        </>
      ) : null}

      <FloatingAskLex onAsk={onAsk} />
      <BottomNav />
    </div>
  );
}