import { useLocation, useNavigate } from "react-router-dom";
import {
  House,
  DollarSign,
  Clock,
  Compass,
  FileText,
  CalendarRange,
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
  const location = useLocation();

  const border = "#E5E2DA";
  const navy = "#24324A";
  const muted = "#8F8B82";

  const allItems = [
    { label: "Home", path: "/", icon: House, custom: false },
    { label: "Horses", path: "/horses", icon: HorseIcon, custom: true },
    { label: "Costs", path: "/costs", icon: DollarSign, custom: false },
    { label: "Care", path: "/care", icon: Clock, custom: false },
    { label: "Events", path: "/events", icon: CalendarRange, custom: false },
    { label: "Resources", path: "/resources", icon: Compass, custom: false },
    { label: "Documents", path: "/documents", icon: FileText, custom: false },
  ];

  const currentPath = location.pathname;

  const visibleItems = allItems.filter((item) => {
    if (item.path === "/") return true;
    return !currentPath.startsWith(item.path);
  });

  const isActive = (path) => {
    if (path === "/") return currentPath === "/";
    return currentPath.startsWith(path);
  };

  return (
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
          gridTemplateColumns: `repeat(${visibleItems.length}, 1fr)`,

          // 🔥 SAFE AREA FIX (THE IMPORTANT PART)
          paddingTop: 8,
          paddingBottom: "max(env(safe-area-inset-bottom), 20px)",

          paddingLeft: 4,
          paddingRight: 4,

          backdropFilter: "blur(8px)",
        }}
      >
        {visibleItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
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
      </div>
    </div>
  );
}