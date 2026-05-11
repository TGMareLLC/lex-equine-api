import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { Clock, Menu } from "lucide-react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import lexHorseIcon from "../assets/lex-horse-icon.png";

function AskLexIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M8 10.5C8 8.6 9.6 7 11.5 7H20.5C22.4 7 24 8.6 24 10.5V16.5C24 18.4 22.4 20 20.5 20H15.2L11.2 23.5V20H11.5C9.6 20 8 18.4 8 16.5V10.5Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 12.8H20" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M12 16H17.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function SickWatchIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 30 30" fill="none" aria-hidden="true">
      <path
        d="M15 8V22M8 15H22"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HorsesIcon() {
  return (
    <img
      src={lexHorseIcon}
      alt="Horses"
      style={{
        width: 32,
        height: 32,
        objectFit: "contain",
        display: "block",
      }}
    />
  );
}

function CareIcon() {
  return <Clock size={30} strokeWidth={1.9} />;
}

function CostsIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.9" />
      <path d="M16 10.5V21.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path
        d="M19 12.8C18.4 12 17.3 11.5 16 11.5C14.1 11.5 12.7 12.5 12.7 14C12.7 15.4 13.8 16 16 16.5C18.2 17 19.3 17.6 19.3 19C19.3 20.5 17.9 21.5 16 21.5C14.7 21.5 13.5 21 12.8 20.2"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EventsIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect
        x="6"
        y="7"
        width="20"
        height="19"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path d="M10 5.5V9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M22 5.5V9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M6 12.5H26" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="12" cy="17.5" r="1.4" fill="currentColor" />
      <circle cx="16" cy="17.5" r="1.4" fill="currentColor" />
      <circle cx="20" cy="17.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

function ResourcesIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M16 26C16 26 23 19.4 23 14.2C23 10.6 19.9 7.7 16 7.7C12.1 7.7 9 10.6 9 14.2C9 19.4 16 26 16 26Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="14.2" r="2.8" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}

function DocumentsIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M11 6.5H18L23 11.5V24.5C23 25.6 22.1 26.5 21 26.5H11C9.9 26.5 9 25.6 9 24.5V8.5C9 7.4 9.9 6.5 11 6.5Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M18 6.5V11.5H23"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M12.5 16H19.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M12.5 20H19.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

const getDaysUntil = (value) => {
  if (!value) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const due = new Date(value);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();

  return Math.round((dueDay - today) / 86400000);
};

const getHorseId = (item) => {
  return item?.horseId || item?.selectedHorseId || item?.horse?.id || null;
};

export default function HomePage({ user, horses = [], onAsk }) {
  const navigate = useNavigate();

  const [activeReminders, setActiveReminders] = useState([]);
  const [activeEvents, setActiveEvents] = useState([]);

  const [isAskLexOpen, setIsAskLexOpen] = useState(false);
  const [lexQuestion, setLexQuestion] = useState("");
  const [lexAnswer, setLexAnswer] = useState("");
  const [lexLoading, setLexLoading] = useState(false);

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const homeBg = "#F6F4EE";
  const cardBg = "#FFFFFF";
  const borderColor = "#E5E2DA";
  const navy = "#24324A";
  const navyPressed = "#1B2538";
  const navyBorder = "#31425F";
  const primaryText = "#1E1E1E";
  const secondaryText = "#6F6A60";
  const burgundy = "#7A2E2E";
  const upcomingGoldText = "#6E5A36";
  const upcomingGoldBg = "#F5EEDB";

  useEffect(() => {
    const loadHomeData = async () => {
      if (!user?.uid) {
        setActiveReminders([]);
        setActiveEvents([]);
        return;
      }

      try {
        const reminderQuery = query(
          collection(db, "reminders"),
          where("ownerUid", "==", user.uid),
          where("completed", "==", false)
        );

        const eventQuery = query(
          collection(db, "events"),
          where("ownerUid", "==", user.uid),
          where("completed", "==", false)
        );

        const [reminderSnap, eventSnap] = await Promise.all([
          getDocs(reminderQuery),
          getDocs(eventQuery),
        ]);

        const reminderItems = reminderSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0));

        const eventItems = eventSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.eventDate || 0) - (b.eventDate || 0));

        setActiveReminders(reminderItems);
        setActiveEvents(eventItems);
      } catch (e) {
        console.log("HOME DATA LOAD ERROR:", e);
        setActiveReminders([]);
        setActiveEvents([]);
      }
    };

    loadHomeData();
  }, [user]);

  const urgentCards = useMemo(() => {
    const grouped = {};
    const now = Date.now();
    const threeDaysFromNow = now + 3 * 24 * 60 * 60 * 1000;

    (horses || []).forEach((horse) => {
      if (!horse?.id) return;

      grouped[horse.id] = {
        horse,
        sickWatch: horse.sickWatchOn ? horse : null,
        reminder: null,
        event: null,
      };
    });

    activeReminders.forEach((item) => {
      const horseId = getHorseId(item);
      if (!horseId) return;

      const due = item?.dueDate || 0;
      if (due < now || due > threeDaysFromNow) return;

      if (!grouped[horseId]) {
        grouped[horseId] = {
          horse: { id: horseId, name: item.horseName || "Unnamed" },
          sickWatch: null,
          reminder: null,
          event: null,
        };
      }

      const existing = grouped[horseId].reminder;
      if (!existing || due < (existing.dueDate || 0)) {
        grouped[horseId].reminder = item;
      }
    });

    activeEvents.forEach((event) => {
      const horseId = getHorseId(event);
      if (!horseId) return;

      const days = getDaysUntil(event.eventDate);
      if (days !== 3) return;

      if (!grouped[horseId]) {
        grouped[horseId] = {
          horse: { id: horseId, name: event.horseName || "Unnamed" },
          sickWatch: null,
          reminder: null,
          event: null,
        };
      }

      const existing = grouped[horseId].event;
      if (!existing || (event.eventDate || 0) < (existing.eventDate || 0)) {
        grouped[horseId].event = event;
      }
    });

    return Object.values(grouped)
      .filter((item) => item.sickWatch || item.reminder || item.event)
      .sort((a, b) => (a.horse?.name || "").localeCompare(b.horse?.name || ""));
  }, [horses, activeReminders, activeEvents]);

  const openAskLex = () => {
    setIsAskLexOpen(true);
    setLexQuestion("");
    setLexAnswer("");
    setLexLoading(false);
  };

  const closeAskLex = () => {
    setIsAskLexOpen(false);
    setLexQuestion("");
    setLexAnswer("");
    setLexLoading(false);
  };

  const handleAskLex = async () => {
    if (!lexQuestion.trim()) {
      alert("Type a question first.");
      return;
    }

    setLexLoading(true);
    setLexAnswer("");

    try {
      if (typeof onAsk === "function") {
        const result = await onAsk(lexQuestion.trim());

        if (typeof result === "string") {
          setLexAnswer(result);
        } else if (result?.answer) {
          setLexAnswer(result.answer);
        } else {
          setLexAnswer("Lex did not return an answer.");
        }
      } else {
        setLexAnswer("Ask Lex is not connected yet.");
      }
    } catch (e) {
      console.log("HOME ASK LEX ERROR:", e);
      setLexAnswer("Something went wrong while asking Lex.");
    } finally {
      setLexLoading(false);
    }
  };

  const copyLexAnswer = async () => {
    if (!lexAnswer) return;

    try {
      await navigator.clipboard.writeText(lexAnswer);
      alert("Answer copied.");
    } catch (e) {
      console.log("COPY LEX ANSWER ERROR:", e);
      alert("Could not copy answer.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsMenuOpen(false);
    } catch (e) {
      console.log("LOGOUT ERROR:", e);
      alert("Could not log out.");
    }
  };

  const openManageAccount = () => {
    setIsMenuOpen(false);
    navigate("/account");
  };

  const openPrivacyPolicy = () => {
    setIsMenuOpen(false);
    window.open("https://lexequine.com/#privacy", "_blank");
  };

  const tileBaseStyle = {
    minHeight: 154,
    borderRadius: 24,
    border: `1px solid ${navyBorder}`,
    background: navy,
    color: "#FFFFFF",
    boxShadow: "0 12px 24px rgba(24, 34, 51, 0.14)",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "flex-start",
    textAlign: "left",
    cursor: "pointer",
    position: "relative",
    overflow: "hidden",
  };

  const tiles = [
    {
      key: "horses",
      title: "Horses",
      subtitle: "Profiles",
      icon: <HorsesIcon />,
      onClick: () => navigate("/horses"),
      featured: false,
    },
    {
      key: "sickwatch",
      title: "Sick Watch",
      subtitle: "Monitoring",
      icon: <SickWatchIcon />,
      onClick: () => navigate("/sick-watch"),
      featured: false,
    },
    {
      key: "care",
      title: "Care",
      subtitle: "Schedule",
      icon: <CareIcon />,
      onClick: () => navigate("/care"),
      featured: false,
    },
    {
      key: "costs",
      title: "Costs",
      subtitle: "Tracking",
      icon: <CostsIcon />,
      onClick: () => navigate("/costs"),
      featured: false,
    },
    {
      key: "events",
      title: "Events",
      subtitle: "Competitions",
      icon: <EventsIcon />,
      onClick: () => navigate("/events"),
      featured: false,
    },
    {
      key: "resources",
      title: "Resources",
      subtitle: "Nearby help",
      icon: <ResourcesIcon />,
      onClick: () => navigate("/resources"),
      featured: false,
    },
    {
      key: "documents",
      title: "Documents",
      subtitle: "Paperwork",
      icon: <DocumentsIcon />,
      onClick: () => navigate("/documents"),
      featured: false,
    },
    {
      key: "asklex",
      title: "Ask Lex",
      subtitle: "Ask anything",
      icon: <AskLexIcon />,
      onClick: openAskLex,
      featured: true,
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: homeBg,
        color: primaryText,
        paddingBottom: 28,
      }}
    >
      <div
        style={{
          paddingTop: 8,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 44,
              lineHeight: 1,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              color: navy,
            }}
          >
            Lex
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 20,
              color: secondaryText,
              fontWeight: 400,
            }}
          >
            Equine Care Intelligence
          </div>
        </div>

        {user ? (
          <button
            onClick={() => setIsMenuOpen(true)}
            style={{
              border: `1px solid ${borderColor}`,
              borderRadius: 14,
              width: 48,
              height: 48,
              background: "#FFFFFF",
              color: primaryText,
              cursor: "pointer",
              boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Open account menu"
          >
            <Menu size={22} strokeWidth={2} />
          </button>
        ) : null}

      </div>

      {urgentCards.length > 0 ? (
        <div style={{ marginTop: 22, display: "grid", gap: 12 }}>
          {urgentCards.map((card) => {
            const horse = card.horse;
            const horseName = horse?.name || "Unnamed";

            return (
              <div
                key={horse.id}
                onClick={() => {
                  if (card.sickWatch) {
                    navigate(`/sick-watch?horseId=${horse.id}`);
                    return;
                  }
                  if (card.reminder) {
                    navigate("/care");
                    return;
                  }
                  if (card.event) {
                    navigate("/events");
                  }
                }}
                style={{
                  background: cardBg,
                  border: `1px solid ${borderColor}`,
                  borderRadius: 18,
                  padding: "14px 16px",
                  boxShadow: "0 8px 18px rgba(0,0,0,0.05)",
                  cursor: "pointer",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  {card.sickWatch ? (
                    <div
                      style={{
                        background: "#F2E8E7",
                        color: burgundy,
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "6px 10px",
                        borderRadius: 999,
                      }}
                    >
                      Active Sick Watch
                    </div>
                  ) : null}

                  {card.reminder ? (
                    <div
                      style={{
                        background: upcomingGoldBg,
                        color: upcomingGoldText,
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "6px 10px",
                        borderRadius: 999,
                      }}
                    >
                      Upcoming Care
                    </div>
                  ) : null}

                  {card.event ? (
                    <div
                      style={{
                        background: upcomingGoldBg,
                        color: upcomingGoldText,
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "6px 10px",
                        borderRadius: 999,
                      }}
                    >
                      Event Reminder
                    </div>
                  ) : null}
                </div>

                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    color: primaryText,
                    lineHeight: 1.15,
                  }}
                >
                  {horseName}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div
        style={{
          marginTop: urgentCards.length ? 18 : 28,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          alignContent: "stretch",
        }}
      >
        {tiles.map((tile) => (
          <button
            key={tile.key}
            onClick={tile.onClick}
            style={{
              ...tileBaseStyle,
              background: tile.featured
                ? "linear-gradient(180deg, #2E3F5D 0%, #24324A 100%)"
                : navy,
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.background = tile.featured
                ? "linear-gradient(180deg, #273650 0%, #1B2538 100%)"
                : navyPressed;
              e.currentTarget.style.transform = "scale(0.985)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.background = tile.featured
                ? "linear-gradient(180deg, #2E3F5D 0%, #24324A 100%)"
                : navy;
              e.currentTarget.style.transform = "scale(1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = tile.featured
                ? "linear-gradient(180deg, #2E3F5D 0%, #24324A 100%)"
                : navy;
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 42%)",
              }}
            />

            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.09)",
                color: "#FFFFFF",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                position: "relative",
                zIndex: 1,
              }}
            >
              {tile.icon}
            </div>

            <div style={{ position: "relative", zIndex: 1 }}>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  lineHeight: 1.1,
                  color: "#FFFFFF",
                  letterSpacing: "-0.02em",
                }}
              >
                {tile.title}
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  color: "rgba(255,255,255,0.82)",
                }}
              >
                {tile.subtitle}
              </div>
            </div>
          </button>
        ))}
      </div>

      {isMenuOpen ? (
        <div className="modal-backdrop" onClick={() => setIsMenuOpen(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />

            <div
              style={{
                fontSize: 30,
                fontWeight: 600,
                color: navy,
                marginBottom: 16,
              }}
            >
              Account Menu
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <button className="secondary-button" onClick={openManageAccount}>
                Manage Account
              </button>

              <button className="secondary-button" onClick={openPrivacyPolicy}>
                Privacy Policy/Terms & Disclaimers
              </button>

              <button
                className="secondary-button"
                onClick={handleLogout}
                style={{ borderColor: burgundy, color: burgundy }}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAskLexOpen ? (
        <div className="modal-backdrop" onClick={closeAskLex}>
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
                Ask Lex
              </h3>

              <button
                onClick={closeAskLex}
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

            <textarea
              className="field-textarea"
              placeholder="Ask Lex anything..."
              value={lexQuestion}
              onChange={(e) => setLexQuestion(e.target.value)}
              rows={5}
              style={{ marginTop: 12 }}
            />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="secondary-button" onClick={closeAskLex}>
                Cancel
              </button>
              <button className="primary-button" onClick={handleAskLex}>
                {lexLoading ? "Asking..." : "Ask Lex"}
              </button>
            </div>

            {lexLoading || lexAnswer ? (
              <div
                style={{
                  marginTop: 18,
                  padding: 16,
                  border: `1px solid ${borderColor}`,
                  borderRadius: 16,
                  background: "#FFFFFF",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 18,
                    marginBottom: 8,
                    color: primaryText,
                  }}
                >
                  Lex
                </div>

                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    fontSize: 15,
                    lineHeight: 1.55,
                    color: primaryText,
                  }}
                >
                  {lexLoading ? "Thinking..." : lexAnswer}
                </div>

                {!lexLoading && lexAnswer ? (
                  <button
                    className="small-button"
                    style={{ marginTop: 14 }}
                    onClick={copyLexAnswer}
                  >
                    Copy Answer
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}