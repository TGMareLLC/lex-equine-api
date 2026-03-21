import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import BottomNav from "../components/BottomNav";
import FloatingAskLex from "../components/FloatingAskLex";

const TIME_VIEWS = ["month", "quarter", "season", "year"];

const getTodayInputValue = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getSeasonLabel = (monthIndex) => {
  if ([11, 0, 1].includes(monthIndex)) return "Winter";
  if ([2, 3, 4].includes(monthIndex)) return "Spring";
  if ([5, 6, 7].includes(monthIndex)) return "Summer";
  return "Fall";
};

const formatCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;

const capitalize = (value) => {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const groupMonthLabel = (year, monthIndex) =>
  new Date(year, monthIndex, 1).toLocaleString([], {
    month: "long",
    year: "numeric",
  });

const formatEventDate = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

export default function EventsPage({ user, horses = [], onAsk }) {
  const [events, setEvents] = useState([]);

  const [horseFilter, setHorseFilter] = useState("all");
  const [timeView, setTimeView] = useState("month");
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState("add");
  const [editingEventId, setEditingEventId] = useState("");

  const [eventName, setEventName] = useState("");
  const [eventHorseId, setEventHorseId] = useState("shared");
  const [eventLocation, setEventLocation] = useState("");
  const [eventCost, setEventCost] = useState("");
  const [eventDate, setEventDate] = useState(getTodayInputValue());
  const [eventNotes, setEventNotes] = useState("");

  const primaryText = "#1E1E1E";
  const secondaryText = "#6F6A60";
  const borderColor = "#E5E2DA";
  const navy = "#24324A";
  const homeBg = "#F6F4EE";
  const burgundy = "#7A2E2E";
  const goldBg = "#F5EEDB";
  const goldText = "#6E5A36";

  const horseNameById = useMemo(() => {
    const map = {};
    horses.forEach((horse) => {
      map[horse.id] = horse.name || "Unnamed";
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

  const clearEventForm = () => {
    setEventName("");
    setEventHorseId("shared");
    setEventLocation("");
    setEventCost("");
    setEventDate(getTodayInputValue());
    setEventNotes("");
    setEditingEventId("");
    setMode("add");
  };

  const closeModal = () => {
    setIsOpen(false);
    clearEventForm();
  };

  const openAdd = () => {
    clearEventForm();
    setMode("add");
    setIsOpen(true);
  };

  const openEdit = (event) => {
    setMode("edit");
    setEditingEventId(event.id || "");
    setEventName(event.name || "");
    setEventHorseId(event.horseId || "shared");
    setEventLocation(event.location || "");
    setEventCost(event.cost != null ? String(event.cost) : "");
    setEventDate(
      event.eventDate
        ? new Date(event.eventDate).toISOString().slice(0, 10)
        : getTodayInputValue()
    );
    setEventNotes(event.notes || "");
    setIsOpen(true);
  };

  const loadEvents = async () => {
    if (!user?.uid) {
      setEvents([]);
      return;
    }

    try {
      const qe = query(collection(db, "events"), where("ownerUid", "==", user.uid));
      const snap = await getDocs(qe);

      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.eventDate || 0) - (a.eventDate || 0));

      setEvents(items);
    } catch (e) {
      console.log("LOAD EVENTS ERROR:", e);
      setEvents([]);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [user?.uid]);

  const saveEvent = async () => {
    if (!user?.uid) {
      alert("Please log in first.");
      return;
    }

    if (!eventName.trim()) {
      alert("Please enter an event name.");
      return;
    }

    if (!eventDate) {
      alert("Please choose an event date.");
      return;
    }

    try {
      const selectedHorse =
        eventHorseId !== "shared"
          ? horses.find((horse) => horse.id === eventHorseId) || null
          : null;

      const eventDateMs = new Date(`${eventDate}T12:00:00`).getTime();

      const payload = {
        ownerUid: user.uid,
        horseId: eventHorseId === "shared" ? null : eventHorseId,
        horseName: eventHorseId === "shared" ? "Shared" : selectedHorse?.name || "Unnamed",
        name: eventName.trim(),
        location: eventLocation.trim(),
        cost: eventCost === "" ? 0 : Number(eventCost),
        notes: eventNotes.trim(),
        eventDate: Number.isNaN(eventDateMs) ? Date.now() : eventDateMs,
        completed: false,
      };

      if (mode === "add") {
        await addDoc(collection(db, "events"), {
          ...payload,
          createdAt: Date.now(),
        });
      } else {
        if (!editingEventId) {
          alert("No event selected to edit.");
          return;
        }

        await updateDoc(doc(db, "events", editingEventId), payload);
      }

      await loadEvents();
      closeModal();
    } catch (e) {
      console.log("SAVE EVENT ERROR:", e);
      alert(mode === "add" ? "Failed to save event." : "Failed to update event.");
    }
  };

  const deleteEvent = async (eventId) => {
    if (!eventId) return;

    const confirmed = window.confirm("Delete this event?");
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "events", eventId));
      await loadEvents();
    } catch (e) {
      console.log("DELETE EVENT ERROR:", e);
      alert("Failed to delete event.");
    }
  };

  const markDone = async (eventId) => {
    if (!eventId) return;

    try {
      await updateDoc(doc(db, "events", eventId), {
        completed: true,
        completedAt: Date.now(),
      });
      await loadEvents();
    } catch (e) {
      console.log("MARK EVENT DONE ERROR:", e);
      alert("Failed to complete event.");
    }
  };

  const activeEvents = useMemo(() => {
    return events
      .filter((event) => !event.completed)
      .sort((a, b) => (a.eventDate || 0) - (b.eventDate || 0));
  }, [events]);

  const completedEvents = useMemo(() => {
    return events.filter((event) => event.completed);
  }, [events]);

  const filteredCompletedEvents = useMemo(() => {
    return completedEvents.filter((event) => {
      if (horseFilter === "shared" && event.horseId !== null) return false;
      if (horseFilter !== "all" && horseFilter !== "shared" && event.horseId !== horseFilter) {
        return false;
      }
      return true;
    });
  }, [completedEvents, horseFilter]);

  const availableYears = useMemo(() => {
    const yearSet = new Set(
      completedEvents
        .map((event) => new Date(event.eventDate || 0).getFullYear())
        .filter(Boolean)
    );
    yearSet.add(new Date().getFullYear());

    return Array.from(yearSet).sort((a, b) => b - a);
  }, [completedEvents]);

  const chartData = useMemo(() => {
    const selectedYear = Number(yearFilter);
    const yearEvents = filteredCompletedEvents.filter(
      (event) => new Date(event.eventDate || 0).getFullYear() === selectedYear
    );

    if (timeView === "year") {
      const totalsByYear = new Map();

      filteredCompletedEvents.forEach((event) => {
        const year = new Date(event.eventDate || 0).getFullYear();
        totalsByYear.set(year, (totalsByYear.get(year) || 0) + 1);
      });

      return Array.from(totalsByYear.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([label, total]) => ({
          label: String(label),
          total,
        }));
    }

    if (timeView === "quarter") {
      const buckets = [
        { label: "Q1", total: 0 },
        { label: "Q2", total: 0 },
        { label: "Q3", total: 0 },
        { label: "Q4", total: 0 },
      ];

      yearEvents.forEach((event) => {
        const month = new Date(event.eventDate || 0).getMonth();
        const quarterIndex = Math.floor(month / 3);
        buckets[quarterIndex].total += 1;
      });

      return buckets;
    }

    if (timeView === "season") {
      const buckets = [
        { label: "Winter", total: 0 },
        { label: "Spring", total: 0 },
        { label: "Summer", total: 0 },
        { label: "Fall", total: 0 },
      ];

      yearEvents.forEach((event) => {
        const month = new Date(event.eventDate || 0).getMonth();
        const season = getSeasonLabel(month);
        const bucket = buckets.find((b) => b.label === season);
        if (bucket) bucket.total += 1;
      });

      return buckets;
    }

    const monthlyBuckets = Array.from({ length: 12 }, (_, monthIndex) => ({
      label: new Date(selectedYear, monthIndex, 1).toLocaleString([], { month: "short" }),
      total: 0,
    }));

    yearEvents.forEach((event) => {
      const month = new Date(event.eventDate || 0).getMonth();
      monthlyBuckets[month].total += 1;
    });

    return monthlyBuckets;
  }, [filteredCompletedEvents, timeView, yearFilter]);

  const maxChartValue = useMemo(() => {
    return Math.max(...chartData.map((item) => item.total), 0);
  }, [chartData]);

  const monthlyHistory = useMemo(() => {
    const map = new Map();

    filteredCompletedEvents.forEach((event) => {
      const d = new Date(event.eventDate || 0);
      const key = `${d.getFullYear()}-${d.getMonth()}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          year: d.getFullYear(),
          monthIndex: d.getMonth(),
          label: groupMonthLabel(d.getFullYear(), d.getMonth()),
          items: [],
        });
      }

      map.get(key).items.push(event);
    });

    return Array.from(map.values())
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.monthIndex - a.monthIndex;
      })
      .map((group) => ({
        ...group,
        items: [...group.items].sort((a, b) => (b.eventDate || 0) - (a.eventDate || 0)),
      }));
  }, [filteredCompletedEvents]);

  const renderActiveEventCard = (event) => {
    const horseLabel =
      event.horseId === null
        ? "Shared"
        : horseNameById[event.horseId] || event.horseName || "Unnamed";

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const eventDay = new Date(
      new Date(event.eventDate || 0).getFullYear(),
      new Date(event.eventDate || 0).getMonth(),
      new Date(event.eventDate || 0).getDate()
    ).getTime();

    const diffDays = Math.round((eventDay - today) / 86400000);

    let statusText = "";
    let statusBg = "#F5F2EB";
    let statusColor = secondaryText;

    if (diffDays < 0) {
      statusText = "Past Due";
      statusBg = "#F2E8E7";
      statusColor = burgundy;
    } else if (diffDays === 0) {
      statusText = "Today";
      statusBg = goldBg;
      statusColor = goldText;
    } else if (diffDays > 0 && diffDays <= 7) {
      statusText = `${diffDays} day${diffDays === 1 ? "" : "s"} away`;
      statusBg = goldBg;
      statusColor = goldText;
    }

    return (
      <div
        key={event.id}
        className="card"
        style={{
          padding: 18,
          background: "#FCFBF8",
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
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: primaryText, fontSize: 20 }}>
              {event.name || "Unnamed event"}
            </div>

            <div style={{ fontSize: 14, color: secondaryText, marginTop: 6 }}>
              {formatEventDate(event.eventDate)} · {horseLabel}
              {event.location ? ` · ${event.location}` : ""}
            </div>

            {Number(event.cost || 0) > 0 ? (
              <div style={{ fontSize: 14, color: secondaryText, marginTop: 4 }}>
                Cost: {formatCurrency(event.cost)}
              </div>
            ) : null}

            {event.notes ? (
              <div
                style={{
                  fontSize: 14,
                  color: primaryText,
                  marginTop: 8,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.5,
                }}
              >
                {event.notes}
              </div>
            ) : null}
          </div>

          {statusText ? (
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                background: statusBg,
                color: statusColor,
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {statusText}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <button className="small-button" onClick={() => markDone(event.id)}>
            Done
          </button>

          <button className="small-button" onClick={() => openEdit(event)}>
            Edit
          </button>

          <button
            className="small-button"
            onClick={() => deleteEvent(event.id)}
            style={{ borderColor: burgundy, color: burgundy }}
          >
            Delete
          </button>
        </div>
      </div>
    );
  };

  if (!user) return null;

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
          Events
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 20,
            color: secondaryText,
            fontWeight: 400,
          }}
        >
          Competitions, clinics, classes, and more
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <button
          onClick={openAdd}
          style={{
            width: "100%",
            border: `1px solid ${borderColor}`,
            borderRadius: 18,
            padding: "18px 20px",
            background: "#FBF8F2",
            color: "#6E5A36",
            fontWeight: 500,
            fontSize: 18,
            cursor: "pointer",
            boxShadow: "0 8px 18px rgba(0,0,0,0.05)",
          }}
        >
          + Add Event
        </button>
      </div>

      <div className="card" style={{ marginTop: 18, padding: 18 }}>
        <div style={{ fontSize: 26, fontWeight: 600, color: primaryText }}>
          Upcoming / Active Events
        </div>

        <div style={{ marginTop: 8, fontSize: 14, color: secondaryText }}>
          Events you still have coming up or have not marked done yet.
        </div>

        <div style={{ height: 1, background: borderColor, marginTop: 14, marginBottom: 14 }} />

        {activeEvents.length === 0 ? (
          <div style={{ fontSize: 14, color: secondaryText }}>
            No upcoming or active events.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {activeEvents.map(renderActiveEventCard)}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 18, padding: 18 }}>
        <div style={{ fontSize: 26, fontWeight: 600, color: primaryText }}>
          Completed Event Filters
        </div>

        <div style={{ marginTop: 8, fontSize: 14, color: secondaryText }}>
          Filter your past events and view them by month, quarter, season, or year.
        </div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr", marginTop: 14 }}>
          <select className="field-select" value={timeView} onChange={(e) => setTimeView(e.target.value)}>
            {TIME_VIEWS.map((view) => (
              <option key={view} value={view}>
                {capitalize(view)}
              </option>
            ))}
          </select>

          <select className="field-select" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            {availableYears.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </select>

          <select className="field-select" value={horseFilter} onChange={(e) => setHorseFilter(e.target.value)}>
            <option value="all">All Horses</option>
            <option value="shared">Shared</option>
            {horses.map((horse) => (
              <option key={horse.id} value={horse.id}>
                {horse.name || "Unnamed"}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 18 }}>
          {chartData.length === 0 || maxChartValue === 0 ? (
            <div style={{ fontSize: 14, color: secondaryText }}>No completed event data yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {chartData.map((item) => {
                const widthPercent = maxChartValue ? (item.total / maxChartValue) * 100 : 0;

                return (
                  <div key={item.label}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 6,
                        fontSize: 14,
                        color: primaryText,
                      }}
                    >
                      <span>{item.label}</span>
                      <span style={{ fontWeight: 600 }}>{item.total}</span>
                    </div>

                    <div
                      style={{
                        width: "100%",
                        height: 18,
                        background: "#EFEAE0",
                        borderRadius: 999,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${widthPercent}%`,
                          minWidth: item.total > 0 ? 8 : 0,
                          height: "100%",
                          background: navy,
                          borderRadius: 999,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, color: primaryText }}>
              Completed Event History
            </div>
            <div style={{ marginTop: 8, fontSize: 14, color: secondaryText }}>
              Completed events saved by month.
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: borderColor, marginTop: 14, marginBottom: 14 }} />

        {monthlyHistory.length === 0 ? (
          <div style={{ fontSize: 14, color: secondaryText }}>
            No completed events found.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {monthlyHistory.map((group) => (
              <details
                key={group.key}
                style={{
                  border: `1px solid ${borderColor}`,
                  borderRadius: 16,
                  background: "#FCFBF8",
                  padding: 14,
                }}
              >
                <summary style={{ cursor: "pointer", listStyle: "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div style={{ fontWeight: 600, color: primaryText }}>{group.label}</div>
                    <div style={{ fontSize: 14, color: secondaryText, fontWeight: 600 }}>
                      {group.items.length} event{group.items.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </summary>

                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {group.items.map((event) => {
                    const horseLabel =
                      event.horseId === null
                        ? "Shared"
                        : horseNameById[event.horseId] || event.horseName || "Unnamed";

                    return (
                      <div key={event.id} style={{ borderTop: "1px solid #eee", paddingTop: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: primaryText }}>
                              {event.name || "Unnamed event"}
                            </div>

                            <div style={{ fontSize: 14, color: secondaryText, marginTop: 4 }}>
                              {formatEventDate(event.eventDate)} · {horseLabel}
                              {event.location ? ` · ${event.location}` : ""}
                            </div>

                            {Number(event.cost || 0) > 0 ? (
                              <div style={{ fontSize: 14, color: secondaryText, marginTop: 4 }}>
                                Cost: {formatCurrency(event.cost)}
                              </div>
                            ) : null}

                            {event.notes ? (
                              <div
                                style={{
                                  fontSize: 14,
                                  color: primaryText,
                                  marginTop: 6,
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                {event.notes}
                              </div>
                            ) : null}

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                              <button className="small-button" onClick={() => openEdit(event)}>
                                Edit
                              </button>

                              <button
                                className="small-button"
                                onClick={() => deleteEvent(event.id)}
                                style={{ borderColor: burgundy, color: burgundy }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          <div style={{ fontSize: 12, color: secondaryText, whiteSpace: "nowrap" }}>
                            {event.eventDate ? new Date(event.eventDate).toLocaleDateString() : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      {isOpen ? (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 30, fontWeight: 600, color: navy }}>
                {mode === "add" ? "Add Event" : "Edit Event"}
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

            <input
              className="field-input"
              placeholder="Event Name"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              style={{ marginTop: 12 }}
            />

            <select
              className="field-select"
              value={eventHorseId}
              onChange={(e) => setEventHorseId(e.target.value)}
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
              placeholder="Where / address"
              value={eventLocation}
              onChange={(e) => setEventLocation(e.target.value)}
              style={{ marginTop: 10 }}
            />

            <input
              className="field-input"
              type="number"
              step="0.01"
              placeholder="Cost (optional)"
              value={eventCost}
              onChange={(e) => setEventCost(e.target.value)}
              style={{ marginTop: 10 }}
            />

            <input
              className="field-input"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              style={{ marginTop: 10 }}
            />

            <textarea
              className="field-textarea"
              placeholder="Notes, deadlines, requirements"
              value={eventNotes}
              onChange={(e) => setEventNotes(e.target.value)}
              rows={3}
              style={{ marginTop: 10 }}
            />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="secondary-button" onClick={closeModal}>
                Cancel
              </button>
              <button className="primary-button" onClick={saveEvent}>
                {mode === "add" ? "Save Event" : "Save Changes"}
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