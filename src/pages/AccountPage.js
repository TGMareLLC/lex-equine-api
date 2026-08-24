import { useState, useEffect } from "react";
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
  getDoc,
  query,
  where,
  deleteDoc,
  doc,
  setDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { Purchases } from "@revenuecat/purchases-capacitor";
import { Capacitor } from "@capacitor/core";

export default function AccountPage({
  refreshUserState,
}) {
  const navigate = useNavigate();

  
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [userType, setUserType] = useState("");

  const [subscriptionStatus, setSubscriptionStatus] = useState("Loading...");
const [isSubscribed, setIsSubscribed] = useState(false);
const [selectedPlanId, setSelectedPlanId] = useState("$rc_monthly");
const [purchasing, setPurchasing] = useState(false);
const [monthlyPrice, setMonthlyPrice] = useState("");
const [annualPrice, setAnnualPrice] = useState("");

  
  const secondaryText = "#6F6A60";
  const navy = "#24324A";
  const burgundy = "#7A2E2E";
  const homeBg = "#F6F4EE";

  const user = auth.currentUser;
  

  useEffect(() => {
  const loadAccountData = async () => {
    if (!user?.uid) return;

    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      const userData = userSnap.exists() ? userSnap.data() : null;

      

      setUserType(userData?.userType || "");
      
    } catch (e) {
      console.log("LOAD ACCOUNT DATA ERROR:", e);
      
      setUserType("");
    }
  };

  loadAccountData();
}, [user?.uid]);

  // 🔥 CHECK SUBSCRIPTION
  useEffect(() => {
    const checkSubscription = async () => {
      try {
        if (Capacitor.getPlatform() === "ios") {
          const info = await Purchases.getCustomerInfo();

          console.log("SUB STATUS:", info);

          const active =
            info?.customerInfo?.entitlements?.active?.premium ||
            info?.entitlements?.active?.premium;

          if (active) {
            setIsSubscribed(true);
            setSubscriptionStatus("Active Subscription");
          } else {
            setIsSubscribed(false);
            setSubscriptionStatus("No Active Subscription");
          }
        } else {
          setSubscriptionStatus("Not available on this device");
        }
      } catch (e) {
        console.log("SUB ERROR:", e);
        setSubscriptionStatus("Could not load subscription");
      }
    };

    checkSubscription();
  }, []);

  useEffect(() => {
  const loadSubscriptionPrices = async () => {
    try {
      if (Capacitor.getPlatform() !== "ios") return;

      const offerings = await Purchases.getOfferings();
      const current = offerings.current;

      if (!current) return;
      console.log(
  "REVENUECAT SUBSCRIPTION PACKAGES:",
  current.availablePackages
);

      const monthlyPackage = current.availablePackages.find(
        (item) => item.identifier === "$rc_monthly"
      );

      const annualPackage = current.availablePackages.find(
        (item) => item.identifier === "$rc_annual"
      );

      setMonthlyPrice(
        monthlyPackage?.product?.priceString ||
        monthlyPackage?.storeProduct?.priceString ||
        ""
      );

      setAnnualPrice(
        annualPackage?.product?.priceString ||
        annualPackage?.storeProduct?.priceString ||
        ""
      );
    } catch (e) {
      console.log("LOAD SUBSCRIPTION PRICES ERROR:", e);
    }
  };

  loadSubscriptionPrices();
}, []);

  const handleStartSubscription = async () => {
  try {
    setPurchasing(true);

    const offerings = await Purchases.getOfferings();
    const current = offerings.current;

    if (!current || !current.availablePackages.length) {
      alert("No subscription options are available right now.");
      return;
    }

    const pkg =
      current.availablePackages.find(
        (item) => item.identifier === selectedPlanId
      ) || current.availablePackages[0];

    await Purchases.purchasePackage({
      aPackage: pkg,
    });

    const updatedInfo = await Purchases.getCustomerInfo();

    const active =
      updatedInfo?.customerInfo?.entitlements?.active?.premium ||
      updatedInfo?.entitlements?.active?.premium;

    if (active) {
  setIsSubscribed(true);
  setSubscriptionStatus("Active Subscription");

  if (userType !== "owner" && user?.uid) {
    await setDoc(
      doc(db, "users", user.uid),
      {
        userType: "owner",
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    if (typeof refreshUserState === "function") {
      await refreshUserState(user);
    }

    setUserType("owner");
  }

  alert("Subscription activated.");
}
  } catch (e) {
    console.log("SUBSCRIPTION PURCHASE ERROR:", e);

    if (!e?.userCancelled) {
      alert("Subscription purchase failed.");
    }
  } finally {
    setPurchasing(false);
  }
};

  

const handleBecomeOwner = async () => {
  if (!user?.uid) return;

  const confirmed = window.confirm(
    "Become a horse owner? You can add one horse and explore Lex before starting your 14-day free trial."
  );

  if (!confirmed) return;

  try {
    setLoading(true);

    await setDoc(
      doc(db, "users", user.uid),
      {
        userType: "owner",
        subscriptionOverride: false,
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    if (typeof refreshUserState === "function") {
      await refreshUserState(user);
    }

    setUserType("owner");

    navigate("/");
  } catch (e) {
    console.log("BECOME OWNER ERROR:", e);
    alert("Could not enable owner access.");
  } finally {
    setLoading(false);
  }
};

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
    <div style={{ minHeight: "100vh", background: homeBg, paddingBottom: 40 }}>
      
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ border: "none", background: "transparent", cursor: "pointer", color: navy }}
        >
          <ArrowLeft size={24} />
        </button>

        <div style={{ fontSize: 36, fontWeight: 600, color: navy }}>
          Manage Account
        </div>
      </div>

      <div style={{ marginTop: 6, color: secondaryText }}>
        Update your account settings
      </div>

      

      {/* EMAIL */}
      <div className="card" style={{ marginTop: 20, padding: 18 }}>
        <div style={{ fontWeight: 600 }}>Email</div>
        <div style={{ marginTop: 6 }}>{user?.email}</div>
      </div>

      {/* SUBSCRIPTION SECTION */}
{userType === "owner" && (
  <div className="card" style={{ marginTop: 18, padding: 18 }}>
    <div style={{ fontWeight: 600 }}>
      Subscription & Billing
    </div>

    <div style={{ marginTop: 8 }}>
      {subscriptionStatus}
    </div>

    {!isSubscribed && (
      <>
        <div
          style={{
            marginTop: 10,
            color: secondaryText,
            lineHeight: 1.5,
          }}
        >
          Choose a plan to start your 14-day free trial. You will not be
          charged until the trial ends.
        </div>

        <div
          style={{
            marginTop: 14,
            display: "grid",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedPlanId("$rc_monthly")}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 14,
              border:
                selectedPlanId === "$rc_monthly"
                  ? "2px solid #24324A"
                  : "1px solid #E5E2DA",
              background:
                selectedPlanId === "$rc_monthly"
                  ? "#F5EEDB"
                  : "#FFFFFF",
              color: "#24324A",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ fontWeight: 700 }}>
              Monthly
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 14,
                color: secondaryText,
              }}
            >
              {monthlyPrice
                ? `14 days free, then ${monthlyPrice} per month`
                : "Monthly subscription"}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPlanId("$rc_annual")}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 14,
              border:
                selectedPlanId === "$rc_annual"
                  ? "2px solid #24324A"
                  : "1px solid #E5E2DA",
              background:
                selectedPlanId === "$rc_annual"
                  ? "#F5EEDB"
                  : "#FFFFFF",
              color: "#24324A",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ fontWeight: 700 }}>
              Annual
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 14,
                color: secondaryText,
              }}
            >
              {annualPrice
                ? `14 days free, then ${annualPrice} per year`
                : "Annual subscription"}
            </div>
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={handleStartSubscription}
            disabled={purchasing}
            style={{
              width: "100%",
              marginTop: 4,
            }}
          >
            {purchasing
              ? "Processing..."
              : "Start 14-Day Free Trial"}
          </button>
        </div>
      </>
    )}

    {isSubscribed && (
      <div
        style={{
          marginTop: 10,
          color: secondaryText,
        }}
      >
        Your subscription is active.
      </div>
    )}

    <div
      style={{
        marginTop: 12,
        fontSize: 13,
        color: secondaryText,
      }}
    >
      Manage subscriptions in your Apple account settings.
    </div>
  </div>
)}

      {userType !== "owner" && (
  <div className="card" style={{ marginTop: 18, padding: 18 }}>
    <div style={{ fontWeight: 600 }}>
      Become a Horse Owner
    </div>

    <div
      style={{
        marginTop: 8,
        fontSize: 14,
        color: secondaryText,
        lineHeight: 1.5,
      }}
    >
      Create your horse profile and explore Lex before deciding whether to
      start your 14-day free trial.
    </div>

    <button
      className="primary-button"
      onClick={handleBecomeOwner}
      disabled={loading}
      style={{ marginTop: 12 }}
    >
      Become a Horse Owner
    </button>
  </div>
)}

      {/* CHANGE EMAIL */}
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
          type="password"
          placeholder="Current password"
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

      {/* PASSWORD */}
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

      {/* DELETE */}
      <div className="card" style={{ marginTop: 18, padding: 18, borderColor: burgundy }}>
        <div style={{ fontWeight: 600, color: burgundy }}>
          Delete Account
        </div>

        <div style={{ marginTop: 8, fontSize: 14, color: secondaryText }}>
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