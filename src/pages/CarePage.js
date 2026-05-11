import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import BottomNav from "../components/BottomNav";
import FloatingAskLex from "../components/FloatingAskLex";

const isOffline = () =>
  typeof navigator !== "undefined" && navigator.onLine === false;

const ALERT_OFFSETS = {
  "Same Day": 0,
  "1 Day Before": 1,
  "2 Days Before": 2,
  "1 Week Before": 7,
};

const CARE_TYPES = [
  "Farrier",
  "Vaccines",
  "Dental",
  "Medication",
  "Deworming",
  "Vet Follow-Up",
  "Custom",
];

const REPEAT_OPTIONS = [
  "One Time",
  "Every 4 Weeks",
  "Every 6 Weeks",
  "Every 8 Weeks",
  "Monthly",
  "Every 3 Months",
  "Every 6 Months",
  "Yearly",
];

const ALERT_OPTIONS = [
  "Same Day",
  "1 Day Before",
  "2 Days Before",
  "1 Week Before",
];

const getTodayInputValue = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getCurrentTimeInputValue = () => {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const formatCareDate = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const getDaysUntil = (value) => {
  if (!value) return null;

  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const due = new Date(value);
  const dueDay = new Date(
    due.getFullYear(),
    due.getMonth(),
    due.getDate()
  ).getTime();

  return Math.round((dueDay - today) / 86400000);
};

const getNextDueDateMs = (currentDueDate, repeatInterval) => {
  const next = new Date(currentDueDate);

  switch (repeatInterval) {
    case "Every 4 Weeks":
      next.setDate(next.getDate() + 28);
      break;
    case "Every 6 Weeks":
      next.setDate(next.getDate() + 42);
      break;
    case "Every 8 Weeks":
      next.setDate(next.getDate() + 56);
      break;
    case "Monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "Every 3 Months":
      next.setMonth(next.getMonth() + 3);
      break;
    case "Every 6 Months":
      next.setMonth(next.getMonth() + 6);
      break;
    case "Yearly":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      return null;
  }

  return next.getTime();
};

const buildCareHistoryPayload = (item) => ({
  ownerUid: item.ownerUid,
  horseId: item.horseId || null,
  horseName: item.horseName || "Shared",
  type: item.type || "Custom",
  title: item.title || item.type || "Care Item",
  dueDate: item.dueDate || null,
  completedAt: Date.now(),
  time: item.time || "",
  repeatInterval: item.repeatInterval || "One Time",
  alertTiming: item.alertTiming || "1 Day Before",
  notes: item.notes || "",
costAmount: item.costAmount || null,
createdAt: item.createdAt || Date.now(),
});

export default function CarePage({ user, horses = [], onAsk }) {
  const [careItems, setCareItems] = useState([]);
  const [careStatus, setCareStatus] = useState("Loading care schedule...");

  const [isOpen, setIsOpen] = useState(false);
  const [isEditingCare, setIsEditingCare] = useState(false);
  const [editingCareId, setEditingCareId] = useState("");

  const [careType, setCareType] = useState("Farrier");
  const [careTitle, setCareTitle] = useState("");
  const [careHorseId, setCareHorseId] = useState("shared");
  const [careDate, setCareDate] = useState(getTodayInputValue());
  const [careTime, setCareTime] = useState(getCurrentTimeInputValue());
  const [repeatInterval, setRepeatInterval] = useState("One Time");
  const [alertTiming, setAlertTiming] = useState("1 Day Before");
  const [careNotes, setCareNotes] = useState("");
  const [careCost, setCareCost] = useState("");

  const primaryText = "#1E1E1E";
  const secondaryText = "#6F6A60";
  const borderColor = "#E5E2DA";
  const navy = "#24324A";
  const navyPressed = "#1B2538";
  const navyBorder = "#31425F";
  const homeBg = "#F6F4EE";
  const burgundy = "#7A2E2E";
  const goldText = "#6E5A36";
  const goldBg = "#F5EEDB";
  const blushBg = "#F2E8E7";
  const cardShadow = "0 10px 22px rgba(24, 34, 51, 0.08)";
  const panelShadow = "0 12px 24px rgba(24, 34, 51, 0.14)";

  const horseNameById = useMemo(() => {
    const map = {};
    horses.forEach((h) => {
      map[h.id] = h.name || "Unnamed";
    });
    return map;
  }, [horses]);

  const horseOptions = useMemo(() => {
    return [
      { id: "shared", name: "Shared" },
      ...horses.map((horse) => ({
        id: horse.id,
        name: horse.name || "Unnamed",
      })),
    ];
  }, [horses]);

  const clearForm = () => {
    setCareType("Farrier");
    setCareTitle("");
    setCareHorseId("shared");
    setCareDate(getTodayInputValue());
    setCareTime(getCurrentTimeInputValue());
    setRepeatInterval("One Time");
    setAlertTiming("1 Day Before");
    setCareNotes("");
    setCareCost("");
    setIsEditingCare(false);
    setEditingCareId("");
  };

  const closeModal = () => {
    setIsOpen(false);
    clearForm();
  };

  const loadCare = async () => {
    if (!user?.uid) {
      setCareItems([]);
      setCareStatus("");
      return;
    }

    try {
      setCareStatus("Loading care schedule...");

      const q = query(
        collection(db, "reminders"),
        where("ownerUid", "==", user.uid),
        where("completed", "==", false)
      );

      const snap = await getDocs(q);

      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0));

      setCareItems(items);
      setCareStatus(items.length ? "" : "No care items yet.");
    } catch (e) {
      console.log("LOAD CARE ERROR:", e);
      setCareItems([]);
      setCareStatus("Could not load care schedule.");
    }
  };

  useEffect(() => {
    loadCare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const overdue = useMemo(
    () => careItems.filter((i) => getDaysUntil(i.dueDate) < 0),
    [careItems]
  );

  const today = useMemo(
    () => careItems.filter((i) => getDaysUntil(i.dueDate) === 0),
    [careItems]
  );

  const upcoming = useMemo(
    () =>
      careItems.filter((i) => {
        const days = getDaysUntil(i.dueDate);
        return days != null && days > 0 && days <= 7;
      }),
    [careItems]
  );

  const later = useMemo(
    () => careItems.filter((i) => getDaysUntil(i.dueDate) > 7),
    [careItems]
  );

  const openAddCare = () => {
    clearForm();
    setIsOpen(true);
  };

  const openEditCare = (item) => {
    setIsEditingCare(true);
    setEditingCareId(item.id || "");
    setCareType(item.type || "Farrier");
    setCareTitle(
      item.type === "Custom" ? item.title || "" : ""
    );
    setCareHorseId(item.horseId || "shared");
    setCareDate(
      item.dueDate
        ? new Date(item.dueDate).toISOString().slice(0, 10)
        : getTodayInputValue()
    );
    setCareTime(item.time || "");
    setRepeatInterval(item.repeatInterval || "One Time");
    setAlertTiming(item.alertTiming || "1 Day Before");
    setCareNotes(item.notes || "");
    setCareCost(item.costAmount ? String(item.costAmount) : "");
    setIsOpen(true);
  };

  const saveCare = async () => {
    if (!user?.uid) {
      alert("Please log in first.");
      return;
    }

    if (isOffline()) {
  alert("You're offline. New care changes can't be saved right now.");
  return;
}

    if (!careDate) {
      alert("Please choose a due date.");
      return;
    }

    if (careType === "Custom" && !careTitle.trim()) {
      alert("Please enter a title for the custom appointment.");
      return;
    }

    const dueDateMs = new Date(`${careDate}T12:00:00`).getTime();

    if (Number.isNaN(dueDateMs)) {
      alert("Please enter a valid date.");
      return;
    }

    const selectedHorse =
      careHorseId !== "shared"
        ? horses.find((horse) => horse.id === careHorseId) || null
        : null;

    const resolvedTitle =
      careType === "Custom" ? careTitle.trim() : careType;

    const payload = {
      ownerUid: user.uid,
      horseId: careHorseId === "shared" ? null : careHorseId,
      horseName: careHorseId === "shared" ? "Shared" : selectedHorse?.name || "Unnamed",
      type: careType,
      title: resolvedTitle,
      dueDate: dueDateMs,
      alertDate: dueDateMs - (ALERT_OFFSETS[alertTiming] ?? 1) * 86400000,
      time: careTime || "",
      repeatInterval,
      alertTiming,
      notes: careNotes.trim(),
costAmount: careCost ? Number(careCost) : null,
completed: false,
    };

    try {
      if (isEditingCare) {
        if (!editingCareId) {
          alert("No care item selected.");
          return;
        }

        await updateDoc(doc(db, "reminders", editingCareId), payload);
      } else {
        await addDoc(collection(db, "reminders"), {
          ...payload,
          createdAt: Date.now(),
        });
      }

      await loadCare();
      closeModal();
    } catch (e) {
      console.log("SAVE CARE ERROR:", e);
      alert(isEditingCare ? "Failed to update care item." : "Failed to save care item.");
    }
  };

  const markDone = async (item) => {
    if (!item?.id) return;

    try {
      await addDoc(collection(db, "care_history"), buildCareHistoryPayload(item));

      await updateDoc(doc(db, "reminders", item.id), {
        completed: true,
        completedAt: Date.now(),
      });

      if (item.repeatInterval && item.repeatInterval !== "One Time") {
        const nextDue = getNextDueDateMs(item.dueDate, item.repeatInterval);

        if (nextDue) {
          const offset = ALERT_OFFSETS[item.alertTiming] ?? 1;
          const nextAlert = nextDue - offset * 86400000;

          await addDoc(collection(db, "reminders"), {
            ownerUid: item.ownerUid,
            horseId: item.horseId || null,
            horseName: item.horseName || "Shared",
            type: item.type || "Custom",
            title: item.title || item.type || "Care Item",
            dueDate: nextDue,
            alertDate: nextAlert,
            time: item.time || "",
            repeatInterval: item.repeatInterval,
            alertTiming: item.alertTiming || "1 Day Before",
            notes: item.notes || "",
            completed: false,
            createdAt: Date.now(),
          });
        }
      }

      await loadCare();
    } catch (e) {
      console.log("MARK DONE ERROR:", e);
      alert("Failed to complete care item.");
    }
  };

  const deleteItem = async (id) => {
    if (!id) return;

    const confirmed = window.confirm("Delete this care item?");
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "reminders", id));
      await loadCare();
    } catch (e) {
      console.log("DELETE CARE ITEM ERROR:", e);
      alert("Failed to delete care item.");
    }
  };

  const renderCard = (item) => {
    const horse =
      item.horseId && horseNameById[item.horseId]
        ? horseNameById[item.horseId]
        : item.horseName || "Shared";

    const days = getDaysUntil(item.dueDate);

    let status = "";
    let color = secondaryText;
    let bg = "#F5F2EB";

    if (days != null && days < 0) {
      status = "Overdue";
      color = burgundy;
      bg = blushBg;
    } else if (days === 0) {
      status = "Due Today";
      color = goldText;
      bg = goldBg;
    } else if (days != null && days > 0 && days <= 7) {
      status = `${days} day${days === 1 ? "" : "s"} away`;
      color = goldText;
      bg = goldBg;
    }

    return (
      <div
        key={item.id}
        className="card"
        style={{
          padding: 18,
          background: "#FCFBF8",
          borderRadius: 18,
          border: `1px solid ${borderColor}`,
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
          <div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: primaryText,
              }}
            >
              {item.title || item.type || "Care Item"}
            </div>

            <div
              style={{
                marginTop: 6,
                fontSize: 14,
                color: secondaryText,
              }}
            >
              {(item.type || "Custom")} · {horse}
            </div>
          </div>

          {status ? (
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                background: bg,
                color,
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {status}
            </div>
          ) : null}
        </div>

        <div
          style={{
            height: 1,
            background: borderColor,
            marginTop: 14,
            marginBottom: 14,
          }}
        />

        <div
          style={{
            fontSize: 15,
            color: primaryText,
            lineHeight: 1.55,
          }}
        >
          <div>
            <strong>Date:</strong> {formatCareDate(item.dueDate)}
          </div>

          {item.time ? (
            <div>
              <strong>Time:</strong> {item.time}
            </div>
          ) : null}

          {item.repeatInterval ? (
            <div>
              <strong>Repeats:</strong> {item.repeatInterval}
            </div>
          ) : null}

          {item.alertTiming ? (
            <div>
              <strong>Alert:</strong> {item.alertTiming}
            </div>
          ) : null}

          {item.notes ? (
            <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
              <strong>Notes:</strong> {item.notes}
            </div>
          ) : null}
        </div>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <button className="small-button" onClick={() => openEditCare(item)}>
            Edit
          </button>

          <button className="small-button" onClick={() => markDone(item)}>
            Done
          </button>

          <button
            className="small-button"
            onClick={() => deleteItem(item.id)}
            style={{ borderColor: burgundy, color: burgundy }}
          >
            Delete
          </button>
        </div>
      </div>
    );
  };

  const renderSection = (title, items, accent = "default") =>
    items.length ? (
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: primaryText,
            }}
          >
            {title}
          </div>

          {accent === "overdue" ? (
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                background: blushBg,
                color: burgundy,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Needs attention
            </div>
          ) : null}

          {accent === "today" ? (
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
              Due now
            </div>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          {items.map(renderCard)}
        </div>
      </div>
    ) : null;

  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: homeBg, paddingBottom: 100 }}>
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
          Care Schedule
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 20,
            color: secondaryText,
            fontWeight: 400,
          }}
        >
          Appointments and care reminders
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
            Current Schedule
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 30,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {careItems.length}
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 15,
              lineHeight: 1.5,
              opacity: 0.92,
            }}
          >
            {overdue.length > 0
              ? `${overdue.length} overdue · ${today.length} due today · ${upcoming.length} upcoming`
              : `${today.length} due today · ${upcoming.length} upcoming · ${later.length} later`}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <button
          onClick={openAddCare}
          style={{
            width: "100%",
            border: `1px solid ${navyBorder}`,
            borderRadius: 20,
            padding: "18px 20px",
            background: "linear-gradient(180deg, #2E3F5D 0%, #24324A 100%)",
            color: "#FFFFFF",
            fontWeight: 600,
            fontSize: 18,
            cursor: "pointer",
            boxShadow: panelShadow,
            letterSpacing: "-0.01em",
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
          + Add Care Appointment
        </button>
      </div>

      {careStatus ? (
        <div
          className="card"
          style={{
            marginTop: 18,
            padding: 18,
            color: secondaryText,
            borderRadius: 22,
            border: `1px solid ${borderColor}`,
            background: "#FFFFFF",
            boxShadow: cardShadow,
          }}
        >
          {careStatus}
        </div>
      ) : (
        <>
          {renderSection("Overdue", overdue, "overdue")}
          {renderSection("Today", today, "today")}
          {renderSection("Upcoming", upcoming)}
          {renderSection("Later", later)}
        </>
      )}

      {isOpen ? (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
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
                {isEditingCare ? "Edit Care Appointment" : "Add Care Appointment"}
              </h3>

              <button
                onClick={closeModal}
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
              value={careType}
              onChange={(e) => {
                const nextType = e.target.value;
                setCareType(nextType);
                if (nextType !== "Custom") {
                  setCareTitle("");
                }
              }}
              style={{ marginTop: 12 }}
            >
              {CARE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            {careType === "Custom" ? (
              <input
                className="field-input"
                placeholder="Title"
                value={careTitle}
                onChange={(e) => setCareTitle(e.target.value)}
                style={{ marginTop: 10 }}
              />
            ) : null}

            <select
              className="field-select"
              value={careHorseId}
              onChange={(e) => setCareHorseId(e.target.value)}
              style={{ marginTop: 10 }}
            >
              {horseOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>

            <input
              className="field-input"
              type="date"
              value={careDate}
              onChange={(e) => setCareDate(e.target.value)}
              style={{ marginTop: 10 }}
            />

            <input
              className="field-input"
              type="time"
              value={careTime}
              onChange={(e) => setCareTime(e.target.value)}
              style={{ marginTop: 10 }}
            />

            <select
              className="field-select"
              value={repeatInterval}
              onChange={(e) => setRepeatInterval(e.target.value)}
              style={{ marginTop: 10 }}
            >
              {REPEAT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <select
              className="field-select"
              value={alertTiming}
              onChange={(e) => setAlertTiming(e.target.value)}
              style={{ marginTop: 10 }}
            >
              {ALERT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <input
  className="field-input"
  type="number"
  placeholder="Cost (optional)"
  value={careCost}
  onChange={(e) => setCareCost(e.target.value)}
  style={{ marginTop: 10 }}
/>

            <textarea
              className="field-textarea"
              placeholder="Notes"
              value={careNotes}
              onChange={(e) => setCareNotes(e.target.value)}
              rows={3}
              style={{ marginTop: 10 }}
            />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="secondary-button" onClick={closeModal}>
                Cancel
              </button>
              <button className="primary-button" onClick={saveCare}>
                {isEditingCare ? "Save Changes" : "Save Appointment"}
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