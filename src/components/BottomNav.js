import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAccess } from "../context/AccessContext";
import {
  House,
  DollarSign,
  Clock,
  Compass,
  FileText,
  CalendarRange,
  MoreHorizontal,
    Activity,
  Users,
} from "lucide-react";
import lexHorseIcon from "../assets/lex-horse-icon.png";

function IconWrap({ children, active }) {
  return (
    <span
      style={{
        width: 30,
        height: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: active ? "#24324A" : "#8F8B82",
      }}
    >
      {children}
    </span>
  );
}

function HorseIcon() {
  return (
    <img
      src={lexHorseIcon}
      alt="Horses"
      style={{
        width: 26,
        height: 26,
        objectFit: "contain",
        display: "block",
        filter: "invert(1)",
      }}
    />
  );
}

export default function BottomNav() {
  const navigate = useNavigate();
  const { isCaretakerOnly } = useAccess();
  const location = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const border = "#E5E2DA";
  const navy = "#24324A";
  const muted = "#8F8B82";

  const currentPath = location.pathname;

  const isActive = (path) => {
    if (path === "/") return currentPath === "/";
    return currentPath.startsWith(path);
  };

  const mainItems = isCaretakerOnly
  ? [
      { label: "Home", path: "/", icon: House, custom: false },
    ]
  : [
      { label: "Home", path: "/", icon: House, custom: false },
      { label: "Horses", path: "/horses", icon: HorseIcon, custom: true },
      { label: "Care", path: "/care", icon: Clock, custom: false },
      { label: "Costs", path: "/costs", icon: DollarSign, custom: false },
      { label: "Docs", path: "/documents", icon: FileText, custom: false },
    ];

  const moreItems = isCaretakerOnly
  ? [
      { label: "Caretakers", path: "/caretakers", icon: Users },
    ]
  : [
      { label: "Events", path: "/events", icon: CalendarRange },
      { label: "Resources", path: "/resources", icon: Compass },
      { label: "Caretakers", path: "/caretakers", icon: Users },
      { label: "Sick Watch", path: "/sick-watch", icon: Activity },
    ];

  const isMoreActive = moreItems.some((item) => isActive(item.path));

  const goTo = (path) => {
    setIsMoreOpen(false);
    navigate(path);
  };

  return (
    <>
      {isMoreOpen ? (
        <div
          onClick={() => setIsMoreOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
          }}
        />
      ) : null}

      {isMoreOpen ? (
        <div
          style={{
            position: "fixed",
            left: 12,
            right: 12,
            bottom: 86,
            maxWidth: 760,
            margin: "0 auto",
            background: "#FFFFFF",
            border: `1px solid ${border}`,
            borderRadius: 18,
            boxShadow: "0 -8px 24px rgba(0,0,0,0.12)",
            padding: 10,
            zIndex: 1001,
          }}
        >
          {moreItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <button
                key={item.path}
                onClick={() => goTo(item.path)}
                style={{
                  width: "100%",
                  border: "none",
                  background: active ? "#F6F4EE" : "transparent",
                  borderRadius: 14,
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                  color: active ? navy : "#1E1E1E",
                  fontSize: 15,
                  fontWeight: active ? 700 : 600,
                  textAlign: "left",
                }}
              >
                <Icon size={22} strokeWidth={1.8} />
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          justifyContent: "center",
          zIndex: 1000,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 760,
            background: "rgba(255,255,255,0.96)",
            borderTop: `1px solid ${border}`,
            boxShadow: "0 -4px 14px rgba(0,0,0,0.04)",
            display: "grid",
            gridTemplateColumns: isCaretakerOnly
  ? "repeat(2, 1fr)"
  : "repeat(6, 1fr)",
            paddingTop: 8,
            paddingBottom: "max(env(safe-area-inset-bottom), 20px)",
            paddingLeft: 4,
            paddingRight: 4,
            backdropFilter: "blur(8px)",
          }}
        >
          {mainItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            return (
              <button
                key={item.path}
                onClick={() => goTo(item.path)}
                style={{
                  background: "transparent",
                  border: "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  cursor: "pointer",
                  color: active ? navy : muted,
                }}
              >
                {item.custom ? (
                  <Icon />
                ) : (
                  <IconWrap active={active}>
                    <Icon size={26} strokeWidth={1.8} />
                  </IconWrap>
                )}

                <span
                  style={{
                    fontSize: 12,
                    fontWeight: active ? 600 : 500,
                    color: active ? navy : muted,
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}

          <button
            onClick={() => setIsMoreOpen((current) => !current)}
            style={{
              background: "transparent",
              border: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              cursor: "pointer",
              color: isMoreActive ? navy : muted,
            }}
          >
            <IconWrap active={isMoreActive}>
              <MoreHorizontal size={26} strokeWidth={1.8} />
            </IconWrap>

            <span
              style={{
                fontSize: 12,
                fontWeight: isMoreActive ? 600 : 500,
                color: isMoreActive ? navy : muted,
              }}
            >
              More
            </span>
          </button>
        </div>
      </div>
    </>
  );
}