import HorsesSection from "../HorsesSection";
import FloatingAskLex from "../components/FloatingAskLex";

export default function HorsesPage({
  user,
  role,
  horses,
  setHorses,
  horsesStatus,
  setHorsesStatus,
  activeHorseId,
  setActiveHorseId,
  onAsk,
}) {
  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <HorsesSection
        user={user}
        role={role}
        horses={horses}
        setHorses={setHorses}
        horsesStatus={horsesStatus}
        setHorsesStatus={setHorsesStatus}
        activeHorseId={activeHorseId}
        setActiveHorseId={setActiveHorseId}
        onAsk={onAsk}
      />
      <FloatingAskLex onAsk={onAsk} />
    </div>
  );
}