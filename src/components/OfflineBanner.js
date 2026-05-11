import useOnlineStatus from "../hooks/useOnlineStatus";

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "env(safe-area-inset-top)",
        left: 0,
        right: 0,
        width: "100%",
        background: "#7A2E2E",
        color: "#FFFFFF",
        textAlign: "center",
        padding: "12px 16px",
        fontSize: 14,
        fontWeight: 600,
        zIndex: 99999,
        boxSizing: "border-box",
        boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
      }}
    >
      You’re offline. Saved data is available. New changes won’t be saved.
    </div>
  );
}