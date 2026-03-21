import { useState } from "react";
import lexHorseIcon from "../assets/lex-horse-icon.png";

export default function FloatingAskLex({ onAsk }) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const navy = "#24324A";
  const borderColor = "#E5E2DA";
  const primaryText = "#1E1E1E";
  const secondaryText = "#6F6A60";

  const openModal = () => {
    setIsOpen(true);
    setQuestion("");
    setAnswer("");
    setLoading(false);
  };

  const closeModal = () => {
    setIsOpen(false);
    setQuestion("");
    setAnswer("");
    setLoading(false);
  };

  const handleAsk = async () => {
    if (!question.trim()) {
      alert("Type a question first.");
      return;
    }

    setLoading(true);
    setAnswer("");

    try {
      if (typeof onAsk === "function") {
        const result = await onAsk(question.trim());

        if (typeof result === "string") {
          setAnswer(result);
        } else if (result?.answer) {
          setAnswer(result.answer);
        } else {
          setAnswer("Lex did not return an answer.");
        }
      } else {
        setAnswer("Ask Lex is not connected yet.");
      }
    } catch (e) {
      console.log("FLOATING ASK LEX ERROR:", e);
      setAnswer("Something went wrong while asking Lex.");
    } finally {
      setLoading(false);
    }
  };

  const copyAnswer = async () => {
    if (!answer) return;

    try {
      await navigator.clipboard.writeText(answer);
      alert("Answer copied.");
    } catch (e) {
      console.log("COPY FLOATING LEX ANSWER ERROR:", e);
      alert("Could not copy answer.");
    }
  };

  return (
    <>
      <button
        onClick={openModal}
        style={{
          position: "fixed",
          right: 18,
          bottom: 88,
          zIndex: 1200,
          border: "none",
          borderRadius: 999,
          padding: "12px 16px",
          background: navy,
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontWeight: 600,
          fontSize: 14,
          cursor: "pointer",
          boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
        }}
      >
        <img
          src={lexHorseIcon}
          alt="Ask Lex"
          style={{
            width: 24,
            height: 24,
            objectFit: "contain",
            display: "block",
          }}
        />
        <span>Ask Lex</span>
      </button>

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
                Ask Lex
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

            <textarea
              className="field-textarea"
              placeholder="Ask Lex anything..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={5}
              style={{ marginTop: 12 }}
            />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="secondary-button" onClick={closeModal}>
                Cancel
              </button>
              <button className="primary-button" onClick={handleAsk}>
                {loading ? "Asking..." : "Ask Lex"}
              </button>
            </div>

            {loading || answer ? (
              <div
                style={{
                  marginTop: 18,
                  padding: 16,
                  border: `1px solid ${borderColor}`,
                  borderRadius: 16,
                  background: "#FCFBF8",
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
                  {loading ? "Thinking..." : answer}
                </div>

                {!loading && answer ? (
                  <button
                    className="small-button"
                    style={{ marginTop: 14 }}
                    onClick={copyAnswer}
                  >
                    Copy Answer
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}