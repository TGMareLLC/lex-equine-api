import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";

export default function LoginPage({
  email,
  setEmail,
  password,
  setPassword,
  auth,
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const homeBg = "#F6F4EE";
  const borderColor = "#E5E2DA";
  const navy = "#24324A";
  const primaryText = "#1E1E1E";
  const secondaryText = "#6F6A60";
  const linkBlue = "#2F5EFF";

  const openPrivacy = () => {
    window.open("https://lexequine.com/#privacy", "_blank");
  };

  const openTerms = () => {
    window.open("https://lexequine.com/#terms", "_blank");
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
  alert("Enter email and password to create account.");
  return;
}

if (password.length < 6) {
  alert("Password must be at least 6 characters.");
  return;
}

    try {
      setLoading(true);
      console.log("LOGIN START");

      const result = await signInWithEmailAndPassword(auth, email.trim(), password);

      console.log("LOGIN SUCCESS", result);

      navigate("/");
    } catch (e) {
      console.log("LOGIN ERROR:", e);
      alert("Could not sign in. Check your email and password.");
    } finally {
      console.log("LOGIN END");
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!email.trim() || !password.trim()) {
      alert("Enter email and password to create account.");
      return;
    }

    try {
      setLoading(true);
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      navigate("/");
    } catch (e) {
  console.log("CREATE ACCOUNT ERROR:", e);

  switch (e.code) {
    case "auth/email-already-in-use":
      alert("An account already exists with this email.");
      break;

    case "auth/invalid-email":
      alert("Please enter a valid email address.");
      break;

    case "auth/weak-password":
      alert("Password must be at least 6 characters.");
      break;

        default:
      alert("Could not create account. Please try again.");
      break;
  }
} finally {
  setLoading(false);
}
};

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      alert("Enter your email to reset password.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      alert("Password reset email sent.");
    } catch (e) {
      console.log("RESET ERROR:", e);
      alert("Could not send reset email.");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: homeBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "#FFFFFF",
          border: `1px solid ${borderColor}`,
          borderRadius: 22,
          padding: 24,
          boxShadow: "0 10px 24px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            fontSize: 42,
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
            fontSize: 18,
            color: secondaryText,
          }}
        >
          Equine Care Intelligence
        </div>

        <div
          style={{
            marginTop: 24,
            fontSize: 24,
            fontWeight: 600,
            color: primaryText,
          }}
        >
          Sign In
        </div>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            marginTop: 16,
            padding: "14px 16px",
            borderRadius: 14,
            border: `1px solid ${borderColor}`,
            fontSize: 16,
            boxSizing: "border-box",
            background: "#FFF",
          }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleLogin();
          }}
          style={{
            width: "100%",
            marginTop: 12,
            padding: "14px 16px",
            borderRadius: 14,
            border: `1px solid ${borderColor}`,
            fontSize: 16,
            boxSizing: "border-box",
            background: "#FFF",
          }}
        />

        <div
          style={{
            marginTop: 14,
            fontSize: 13,
            color: secondaryText,
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          By creating an account, you agree to our{" "}
          <span
            onClick={openPrivacy}
            style={{
              color: linkBlue,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Privacy Policy
          </span>{" "}
          and{" "}
          <span
            onClick={openTerms}
            style={{
              color: linkBlue,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Terms &amp; Disclaimers
          </span>
          .
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: "100%",
            marginTop: 16,
            border: "none",
            borderRadius: 14,
            padding: "14px 16px",
            background: navy,
            color: "#FFFFFF",
            fontWeight: 600,
            fontSize: 16,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.75 : 1,
          }}
        >
          {loading ? "Signing In..." : "Sign In"}
        </button>

        <button
          onClick={handleCreateAccount}
          disabled={loading}
          style={{
            width: "100%",
            marginTop: 10,
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
          Create Account
        </button>

        <div
          onClick={handlePasswordReset}
          style={{
            marginTop: 14,
            textAlign: "center",
            fontSize: 14,
            color: navy,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Forgot Password?
        </div>
      </div>
    </div>
  );
}