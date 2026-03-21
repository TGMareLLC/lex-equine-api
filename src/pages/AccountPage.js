import { useState } from "react";
import { auth, db } from "../firebase";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  sendPasswordResetEmail,
  deleteUser,
} from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function AccountPage() {
  const navigate = useNavigate();

  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const primaryText = "#1E1E1E";
  const secondaryText = "#6F6A60";
  const borderColor = "#E5E2DA";
  const navy = "#24324A";
  const burgundy = "#7A2E2E";
  const homeBg = "#F6F4EE";

  const user = auth.currentUser;

  const handleChangeEmail = async () => {
    if (!newEmail || !password) {
      alert("Enter new email and current password.");
      return;
    }

    try {
      setLoading(true);

      const credential = EmailAuthProvider.credential(
        user.email,
        password
      );

      await reauthenticateWithCredential(user, credential);
      await updateEmail(user, newEmail);

      alert("Email updated successfully.");
      setNewEmail("");
      setPassword("");
    } catch (e) {
      console.log("EMAIL UPDATE ERROR:", e);
      alert("Failed to update email.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      await sendPasswordResetEmail(auth, user.email);
      alert("Password reset email sent.");
    } catch (e) {
      console.log("RESET ERROR:", e);
      alert("Could not send reset email.");
    }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(
      "Are you sure? This will permanently delete your account and all data."
    );

    if (!confirmDelete) return;

    try {
      setLoading(true);

      const uid = user.uid;

      const collectionsToDelete = [
        "horses",
        "events",
        "reminders",
        "saved_resources",
      ];

      for (const col of collectionsToDelete) {
        const q = query(
          collection(db, col),
          where("ownerUid", "==", uid)
        );

        const snap = await getDocs(q);

        await Promise.all(
          snap.docs.map((d) => deleteDoc(doc(db, col, d.id)))
        );
      }

      await deleteUser(user);

      alert("Account deleted.");
      navigate("/");
    } catch (e) {
      console.log("DELETE ERROR:", e);

      if (e.code === "auth/requires-recent-login") {
        alert("Please log out and log back in, then try again.");
      } else {
        alert("Failed to delete account.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: homeBg,
        paddingBottom: 40,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: navy,
            padding: 0,
          }}
          aria-label="Go back"
        >
          <ArrowLeft size={24} />
        </button>

        <div
          style={{
            fontSize: 36,
            fontWeight: 600,
            color: navy,
          }}
        >
          Manage Account
        </div>
      </div>

      <div style={{ marginTop: 6, color: secondaryText }}>
        Update your account settings
      </div>

      <div className="card" style={{ marginTop: 20, padding: 18 }}>
        <div style={{ fontWeight: 600 }}>Email</div>
        <div style={{ marginTop: 6, color: primaryText }}>
          {user?.email}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18, padding: 18 }}>
        <div style={{ fontWeight: 600 }}>Change Email</div>

        <input
          className="field-input"
          placeholder="New email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          style={{ marginTop: 10 }}
        />

        <input
          className="field-input"
          placeholder="Current password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ marginTop: 10 }}
        />

        <button
          className="primary-button"
          onClick={handleChangeEmail}
          disabled={loading}
          style={{ marginTop: 12 }}
        >
          Update Email
        </button>
      </div>

      <div className="card" style={{ marginTop: 18, padding: 18 }}>
        <div style={{ fontWeight: 600 }}>Password</div>

        <button
          className="secondary-button"
          onClick={handleResetPassword}
          style={{ marginTop: 12 }}
        >
          Send Password Reset Email
        </button>
      </div>

      <div
        className="card"
        style={{
          marginTop: 18,
          padding: 18,
          borderColor: burgundy,
        }}
      >
        <div style={{ fontWeight: 600, color: burgundy }}>
          Delete Account
        </div>

        <div
          style={{
            marginTop: 8,
            fontSize: 14,
            color: secondaryText,
          }}
        >
          This action is permanent and cannot be undone.
        </div>

        <button
          onClick={handleDeleteAccount}
          disabled={loading}
          style={{
            marginTop: 12,
            border: `1px solid ${burgundy}`,
            color: burgundy,
            background: "transparent",
            padding: "10px 14px",
            borderRadius: 10,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Delete My Account
        </button>
      </div>
    </div>
  );
}