import "./firebase";
import "./App.css";
import { useState } from "react";

export default function App() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const onAsk = () => {
    setAnswer("Next step: we will connect this button to the AI.");
  };

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <h1>Equine App — Ask AI</h1>

      <label style={{ display: "block", marginTop: 16, marginBottom: 8 }}>
        Ask a question
      </label>

      <textarea
        rows={5}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Example: How do I clean a stall safely as a volunteer?"
        style={{ width: "100%", padding: 12, fontSize: 16 }}
      />

      <button
        onClick={onAsk}
        style={{ marginTop: 12, padding: "10px 14px", fontSize: 16 }}
      >
        Ask
      </button>

      <div style={{ marginTop: 24 }}>
        <h2>Answer</h2>
        <div
          style={{
            whiteSpace: "pre-wrap",
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 8,
            minHeight: 80,
          }}
        >
          {answer || "No answer yet."}
        </div>
      </div>
    </div>
  );
}