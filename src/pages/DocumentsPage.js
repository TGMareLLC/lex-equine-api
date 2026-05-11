import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { db, storage } from "../firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import BottomNav from "../components/BottomNav";
import FloatingAskLex from "../components/FloatingAskLex";

const isOffline = () =>
  typeof navigator !== "undefined" && navigator.onLine === false;

const DOCUMENT_TYPES = [
  "Coggins",
  "Health Certificate",
  "Registration Papers",
  "Bill of Sale",
  "Vaccine Record",
  "Insurance",
  "Lease Agreement",
  "Travel Papers",
  "Invoice",
  "Other",
];

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

const getDocumentDisplayName = (item) => {
  if (item.documentType === "Other") {
    return item.documentName || "Unnamed Document";
  }
  return item.documentType || item.documentName || "Unnamed Document";
};

export default function DocumentsPage({ user, horses = [], onAsk }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const horseIdFromURL = searchParams.get("horseId") || "";

  const [documents, setDocuments] = useState([]);
  const [documentsStatus, setDocumentsStatus] = useState("Loading documents...");
  const [filterValue, setFilterValue] = useState(horseIdFromURL || "all");

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [documentType, setDocumentType] = useState("Coggins");
  const [customDocumentName, setCustomDocumentName] = useState("");
  const [documentHorseId, setDocumentHorseId] = useState(horseIdFromURL || "");
  const [expirationDate, setExpirationDate] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFilePreview, setSelectedFilePreview] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const primaryText = "#1E1E1E";
  const secondaryText = "#6F6A60";
  const borderColor = "#E5E2DA";
  const navy = "#24324A";
  const navyPressed = "#1B2538";
  const navyBorder = "#31425F";
  const burgundy = "#7A2E2E";
  const goldText = "#6E5A36";
  const goldBg = "#F5EEDB";
  const homeBg = "#F6F4EE";
  const cardShadow = "0 10px 22px rgba(24, 34, 51, 0.08)";
  const panelShadow = "0 12px 24px rgba(24, 34, 51, 0.14)";

  useEffect(() => {
    setFilterValue(horseIdFromURL || "all");
    setDocumentHorseId(horseIdFromURL || "");
  }, [horseIdFromURL]);

  const horseNameById = useMemo(() => {
    const map = {};
    horses.forEach((horse) => {
      map[horse.id] = horse.name || "Unnamed";
    });
    return map;
  }, [horses]);

  const documentSummary = useMemo(() => {
    const expiredCount = documents.filter((item) => getExpiryStatus(item.expiresAt) === "expired").length;
    const expiringCount = documents.filter((item) => getExpiryStatus(item.expiresAt) === "expiring").length;

    return {
      total: documents.length,
      expiredCount,
      expiringCount,
    };
  }, [documents]);

  const loadDocuments = async () => {
    if (!user?.uid) {
      setDocuments([]);
      setDocumentsStatus("");
      return;
    }

    try {
      setDocumentsStatus("Loading documents...");

      const qd = query(collection(db, "documents"), where("ownerUid", "==", user.uid));
      const snap = await getDocs(qd);

      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));

      setDocuments(items);
      setDocumentsStatus(items.length ? "" : "No documents uploaded yet.");
    } catch (e) {
      console.log("LOAD DOCUMENTS ERROR:", e);
      setDocuments([]);
      setDocumentsStatus("Could not load documents.");
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [user?.uid]);

  const filteredDocuments = useMemo(() => {
    if (filterValue === "all") return documents;
    if (filterValue === "general") {
      return documents.filter((item) => !item.horseId);
    }
    return documents.filter((item) => item.horseId === filterValue);
  }, [documents, filterValue]);

  const resetUploadForm = () => {
    setDocumentType("Coggins");
    setCustomDocumentName("");
    setDocumentHorseId(horseIdFromURL || "");
    setExpirationDate("");
    setSelectedFile(null);

    if (selectedFilePreview) {
      URL.revokeObjectURL(selectedFilePreview);
    }

    setSelectedFilePreview("");
    setIsUploading(false);

    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openUploadModal = () => {
    resetUploadForm();
    setIsUploadOpen(true);
  };

  const closeUploadModal = () => {
    setIsUploadOpen(false);
    resetUploadForm();
  };

  const handleFilePicked = (file) => {
    if (!file) return;

    setSelectedFile(file);

    if (selectedFilePreview) {
      URL.revokeObjectURL(selectedFilePreview);
    }

    if (file.type?.startsWith("image/")) {
      setSelectedFilePreview(URL.createObjectURL(file));
    } else {
      setSelectedFilePreview("");
    }
  };

  const handleUploadDocument = async () => {
    if (!user?.uid) {
      alert("Please log in first.");
      return;
    }

    if (isOffline()) {
  alert("You're offline. New documents can't be uploaded right now.");
  return;
}

    if (!documentType) {
      alert("Please choose a document type.");
      return;
    }

    if (documentType === "Other" && !customDocumentName.trim()) {
      alert("Please enter a document name.");
      return;
    }

    if (!selectedFile) {
      alert("Please take a photo or upload a file.");
      return;
    }

    try {
      setIsUploading(true);

      const selectedHorse =
        documentHorseId && horseNameById[documentHorseId]
          ? { id: documentHorseId, name: horseNameById[documentHorseId] }
          : null;

      const extension =
        selectedFile.name?.split(".").pop()?.toLowerCase() ||
        (selectedFile.type?.includes("pdf") ? "pdf" : "jpg");

      const timestamp = Date.now();
      const storagePath = `documents/${user.uid}/${timestamp}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;

      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, selectedFile);
      const fileUrl = await getDownloadURL(storageRef);

      await addDoc(collection(db, "documents"), {
        ownerUid: user.uid,
        horseId: selectedHorse?.id || "",
        horseName: selectedHorse?.name || "",
        documentType,
        documentName:
          documentType === "Other" ? customDocumentName.trim() : documentType,
        fileName: selectedFile.name || "document",
        fileUrl,
        fileType: selectedFile.type || "",
        storagePath,
        uploadedAt: timestamp,
        expiresAt: expirationDate
          ? new Date(`${expirationDate}T12:00:00`).getTime()
          : null,
        createdAt: timestamp,
      });

      await loadDocuments();
      closeUploadModal();
    } catch (e) {
      console.log("UPLOAD DOCUMENT ERROR:", e);
      alert("Could not upload document.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (item) => {
    const confirmed = window.confirm(`Delete ${getDocumentDisplayName(item)}?`);
    if (!confirmed) return;

    try {
      if (item.storagePath) {
        const storageRef = ref(storage, item.storagePath);
        await deleteObject(storageRef).catch((err) => {
          console.log("DELETE STORAGE FILE ERROR:", err);
        });
      }

      await deleteDoc(doc(db, "documents", item.id));
      await loadDocuments();
    } catch (e) {
      console.log("DELETE DOCUMENT ERROR:", e);
      alert("Could not delete document.");
    }
  };

  const renderStatusTag = (item) => {
    const status = getExpiryStatus(item.expiresAt);

    if (status === "expired") {
      return (
        <div
          style={{
            display: "inline-block",
            marginTop: 8,
            padding: "4px 10px",
            borderRadius: 999,
            background: "#F2E8E7",
            color: burgundy,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Expired
        </div>
      );
    }

    if (status === "expiring") {
      return (
        <div
          style={{
            display: "inline-block",
            marginTop: 8,
            padding: "4px 10px",
            borderRadius: 999,
            background: goldBg,
            color: goldText,
            fontSize: 12,
            fontWeight: 600,
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
            lineHeight: 1,
            fontWeight: 600,
            letterSpacing: "-0.03em",
            color: navy,
          }}
        >
          Documents
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 20,
            color: secondaryText,
            fontWeight: 400,
          }}
        >
          Store important horse paperwork
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
            Document Overview
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 30,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {documentSummary.total}
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 15,
              lineHeight: 1.5,
              opacity: 0.92,
            }}
          >
            {documentSummary.expiringCount} expiring soon · {documentSummary.expiredCount} expired
          </div>
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <button
          onClick={openUploadModal}
          style={{
            width: "100%",
            border: `1px solid ${navyBorder}`,
            borderRadius: 18,
            padding: "18px 20px",
            background: "linear-gradient(180deg, #2E3F5D 0%, #24324A 100%)",
            color: "#FFFFFF",
            fontWeight: 600,
            fontSize: 18,
            cursor: "pointer",
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
          + Upload Document
        </button>
      </div>

      <div
        className="card"
        style={{
          marginTop: 18,
          padding: 18,
          borderRadius: 22,
          border: `1px solid ${borderColor}`,
          background: "#FFFFFF",
          boxShadow: cardShadow,
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 600, color: primaryText }}>
          Filter
        </div>

        <div style={{ marginTop: 8, fontSize: 14, color: secondaryText }}>
          View all documents, general account documents, or paperwork for a specific horse.
        </div>

        <select
          className="field-select"
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          style={{ marginTop: 14 }}
        >
          <option value="all">All Documents</option>
          <option value="general">General Documents</option>
          {horses.map((horse) => (
            <option key={horse.id} value={horse.id}>
              {horse.name || "Unnamed"}
            </option>
          ))}
        </select>
      </div>

      <div
        className="card"
        style={{
          marginTop: 18,
          padding: 18,
          borderRadius: 22,
          border: `1px solid ${borderColor}`,
          background: "#FFFFFF",
          boxShadow: cardShadow,
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 600, color: primaryText }}>
          Uploaded Documents
        </div>

        <div style={{ height: 1, background: borderColor, marginTop: 14, marginBottom: 14 }} />

        {documentsStatus ? (
          <div style={{ fontSize: 14, color: secondaryText }}>{documentsStatus}</div>
        ) : filteredDocuments.length === 0 ? (
          <div style={{ fontSize: 14, color: secondaryText, lineHeight: 1.6 }}>
            No documents uploaded yet. Upload paperwork like Coggins, health
            certificates, registration papers, or travel documents.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {filteredDocuments.map((item) => {
              const horseLabel = item.horseName || "General";

              return (
                <div
                  key={item.id}
                  style={{
                    border: `1px solid ${borderColor}`,
                    borderRadius: 16,
                    background: "#FCFBF8",
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    <div
                      onClick={() => navigate(`/documents/${item.id}`)}
                      style={{ cursor: "pointer", flex: 1 }}
                    >
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 600,
                          color: primaryText,
                        }}
                      >
                        {getDocumentDisplayName(item)}
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 14,
                          color: secondaryText,
                          lineHeight: 1.5,
                        }}
                      >
                        {horseLabel} · Uploaded {formatDate(item.uploadedAt)}
                      </div>

                      {item.expiresAt ? (
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 14,
                            color: secondaryText,
                          }}
                        >
                          Expires {formatDate(item.expiresAt)}
                        </div>
                      ) : null}

                      {renderStatusTag(item)}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <button
                        className="small-button"
                        onClick={() => navigate(`/documents/${item.id}`)}
                      >
                        View
                      </button>

                      <button
                        className="small-button"
                        onClick={() => handleDeleteDocument(item)}
                        style={{
                          borderColor: burgundy,
                          color: burgundy,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isUploadOpen ? (
        <div className="modal-backdrop" onClick={closeUploadModal}>
          <div
            className="modal-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxHeight: "88vh",
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
                Upload Document
              </h3>

              <button
                onClick={closeUploadModal}
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

            <select
              className="field-select"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              style={{ marginTop: 12 }}
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            {documentType === "Other" ? (
              <input
                className="field-input"
                placeholder="Document Name"
                value={customDocumentName}
                onChange={(e) => setCustomDocumentName(e.target.value)}
                style={{ marginTop: 10 }}
              />
            ) : null}

            <select
              className="field-select"
              value={documentHorseId}
              onChange={(e) => setDocumentHorseId(e.target.value)}
              style={{ marginTop: 10 }}
            >
              <option value="">General Document</option>
              {horses.map((horse) => (
                <option key={horse.id} value={horse.id}>
                  {horse.name || "Unnamed"}
                </option>
              ))}
            </select>

            <input
              className="field-input"
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              style={{ marginTop: 10 }}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginTop: 12,
              }}
            >
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
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
                Take Photo
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
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
                Upload File
              </button>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*,.pdf"
              capture="environment"
              onChange={(e) => handleFilePicked(e.target.files?.[0] || null)}
              style={{ display: "none" }}
            />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => handleFilePicked(e.target.files?.[0] || null)}
              style={{ display: "none" }}
            />

            {selectedFile ? (
              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  border: `1px solid ${borderColor}`,
                  borderRadius: 14,
                  background: "#FCFBF8",
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: primaryText,
                  }}
                >
                  {selectedFile.name || "Selected file"}
                </div>

                {selectedFilePreview ? (
                  <img
                    src={selectedFilePreview}
                    alt="preview"
                    style={{
                      width: "100%",
                      maxHeight: 220,
                      objectFit: "cover",
                      borderRadius: 12,
                      display: "block",
                      marginTop: 10,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 14,
                      color: secondaryText,
                    }}
                  >
                    File selected and ready to upload.
                  </div>
                )}
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                marginTop: 16,
              }}
            >
              <button className="secondary-button" onClick={closeUploadModal}>
                Cancel
              </button>
              <button className="primary-button" onClick={handleUploadDocument}>
                {isUploading ? "Uploading..." : "Upload Document"}
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