import "./App.css";
import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  getDoc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { App as CapApp } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { Capacitor } from "@capacitor/core";
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";

import HomePage from "./pages/HomePage";
import HorsesPage from "./pages/HorsesPage";
import CostsPage from "./pages/CostsPage";
import EventsPage from "./pages/EventsPage";
import SickWatchPage from "./pages/SickWatchPage";
import ResourcesPage from "./pages/ResourcesPage";
import CarePage from "./pages/CarePage";
import LoginPage from "./pages/LoginPage";
import DocumentsPage from "./pages/DocumentsPage";
import DocumentDetailPage from "./pages/DocumentDetailPage";
import AccountPage from "./pages/AccountPage";
import OfflineBanner from "./components/OfflineBanner";
import CaretakersPage from "./pages/CaretakersPage";
import CaretakerDetailPage from "./pages/CaretakerDetailPage";
import CaretakerInvitePage from "./pages/CaretakerInvitePage";
import DailyCarePlanPage from "./pages/DailyCarePlanPage";
import CareHistoryDetailPage from "./pages/CareHistoryDetailPage";
import { AccessProvider } from "./context/AccessContext";


import {
  markAppActiveNow,
  syncInactivityReminder,
  isInactivityReminderAction,
} from "./utils/inactivityReminder";

import useSubscription from "./utils/useSubscription";
import useOnlineStatus from "./hooks/useOnlineStatus";


const API_BASE_URL = "https://lex-equine-api.onrender.com";
const REVENUECAT_APPLE_API_KEY = "appl_YCPSrlftkAWXgFJKxjnMJzDDfak"
const TRIAL_LENGTH_DAYS = 14;
const TRIAL_LENGTH_MS = TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000;

async function ensureUserAccessDoc(user) {
  if (!user?.uid) return null;

  const userRef = doc(db, "users", user.uid);
  let snap;

try {
  snap = await getDocFromServer(userRef);
} catch (e) {
  snap = await getDoc(userRef);
}

  if (snap.exists()) {
    return snap.data();
  }

  const now = Date.now();

  const newUserAccess = {
    email: user.email || "",
    trialStartedAt: now,
    trialEndsAt: now + TRIAL_LENGTH_MS,
    subscriptionOverride: false,
    overrideReason: "",
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(userRef, newUserAccess);

  return newUserAccess;
}

async function registerForPushNotifications(user) {
  if (!user?.uid) return;

  if (Capacitor.getPlatform() === "web") {
    return;
  }

  try {
    let permissionStatus = await PushNotifications.checkPermissions();

    if (permissionStatus.receive !== "granted") {
      permissionStatus = await PushNotifications.requestPermissions();
    }

    if (permissionStatus.receive !== "granted") {
      console.log("PUSH PERMISSION NOT GRANTED");
      return;
    }

    await PushNotifications.removeAllListeners();

    await PushNotifications.addListener(
      "registration",
      async (apnsToken) => {
        try {
          console.log("APNS TOKEN:", apnsToken.value);

          const fcmTokenResult = await FirebaseMessaging.getToken();
          const freshFcmToken = fcmTokenResult?.token || "";

          console.log("FCM TOKEN:", freshFcmToken);

          if (!freshFcmToken) {
            console.log("FCM TOKEN SAVE SKIPPED: No token returned.");
            return;
          }

          await setDoc(
            doc(db, "users", user.uid),
            {
              pushToken: freshFcmToken,
              apnsToken: apnsToken.value,
              pushPlatform: Capacitor.getPlatform(),
              pushTokenUpdatedAt: Date.now(),
              notificationsEnabled: true,
            },
            { merge: true }
          );

          console.log("PUSH TOKEN SAVED:", freshFcmToken);
        } catch (error) {
          console.log("FCM TOKEN REGISTRATION ERROR:", error);
        }
      }
    );

    await PushNotifications.addListener(
  "registrationError",
  (error) => {
    console.log("PUSH REGISTRATION ERROR:", error);
  }
);

await PushNotifications.addListener(
  "pushNotificationReceived",
  async (notification) => {
    console.log(
      "FOREGROUND PUSH RECEIVED:",
      JSON.stringify(notification)
    );

    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() % 2147483647),
          title: notification.title || "Lex Equine",
          body: notification.body || "",
          schedule: { at: new Date(Date.now() + 500) },
          extra: notification.data || {},
        },
      ],
    });
  }
);

await PushNotifications.register();
  } catch (error) {
    console.log("REGISTER PUSH ERROR:", error);
  }
}

function ProtectedRoute({ user, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function ReminderActionModal({
  open,
  onClose,
  onAddCost,
  onAddCare,
  onAddLog,
  horses = [],
}) {
  if (!open) return null;

  const borderColor = "#E5E2DA";
  const navy = "#24324A";
  const primaryText = "#1E1E1E";
  const secondaryText = "#6F6A60";
  const cardBg = "#FFFFFF";
  const softBg = "#FCFBF8";

  const heading =
    horses.length === 1
      ? `Any updates for ${horses[0]?.name || "your horse"}?`
      : "Any updates for your horses?";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 520,
        }}
      >
        <div className="modal-handle" />

        <div
          style={{
            fontSize: 30,
            fontWeight: 600,
            color: navy,
            marginBottom: 8,
            lineHeight: 1.1,
          }}
        >
          {heading}
        </div>

        <div
          style={{
            fontSize: 15,
            color: secondaryText,
            marginBottom: 18,
            lineHeight: 1.5,
          }}
        >
          Add something to Lex now, or close this out for today.
        </div>

        <div
          style={{
            border: `1px solid ${borderColor}`,
            borderRadius: 18,
            background: softBg,
            padding: 14,
            display: "grid",
            gap: 10,
          }}
        >
          <button
            onClick={onAddCost}
            style={{
              width: "100%",
              border: "none",
              borderRadius: 14,
              padding: "15px 16px",
              background: navy,
              color: "#FFFFFF",
              fontWeight: 600,
              fontSize: 16,
              cursor: "pointer",
              boxShadow: "0 6px 14px rgba(0,0,0,0.10)",
            }}
          >
            Add Cost
          </button>

          <button
            onClick={onAddCare}
            style={{
              width: "100%",
              border: `1px solid ${borderColor}`,
              borderRadius: 14,
              padding: "15px 16px",
              background: cardBg,
              color: primaryText,
              fontWeight: 500,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Add Care Appointment
          </button>

          <button
            onClick={onAddLog}
            style={{
              width: "100%",
              border: `1px solid ${borderColor}`,
              borderRadius: 14,
              padding: "15px 16px",
              background: cardBg,
              color: primaryText,
              fontWeight: 500,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Add Log
          </button>

          <button
            onClick={onClose}
            style={{
              width: "100%",
              border: `1px solid ${borderColor}`,
              borderRadius: 14,
              padding: "15px 16px",
              background: "#FBF8F2",
              color: secondaryText,
              fontWeight: 500,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Nothing Today
          </button>
        </div>
      </div>
    </div>
  );
}

function IntroModal({ open, onFinish }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div
        className="modal-sheet"
        style={{
          maxWidth: 520,
          textAlign: "center",
        }}
      >
        <div className="modal-handle" />

        <h2 style={{ color: "#24324A", marginTop: 8 }}>
          Welcome to Lex Equine
        </h2>

        <p style={{ color: "#6F6A60", lineHeight: 1.6 }}>
          Lex keeps your horse’s care, records, reminders, costs, and notes in
          one place.
        </p>

        <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
          <div><strong>Horse Profiles</strong><br />Feed, meds, contacts, photos, and notes.</div>
          <div><strong>Care & Reminders</strong><br />Track appointments and follow-ups.</div>
          <div><strong>Sick Watch</strong><br />Log symptoms and care details when something feels off.</div>
          <div><strong>Costs & Documents</strong><br />Keep spending and important records organized.</div>
        </div>

        <button
          className="primary-button"
          style={{ width: "100%", marginTop: 24 }}
          onClick={onFinish}
        >
          Get Started
        </button>
      </div>
    </div>
  );
}

function AppRoutes(props) {
  const {
    user,
    role,
    isCaretakerOnly,
    horses,
setHorses,
horsesStatus,
careHorses,
careHorsesStatus,
setHorsesStatus,
refreshUserState,
refreshHorseAccessState,
    activeHorseId,
    setActiveHorseId,
    question,
    setQuestion,
    answer,
    onAsk,
    email,
    setEmail,
    password,
    setPassword,
    isAdmin,
    showPending,
    setShowPending,
    resourceType,
    setResourceType,
    resourcesStatus,
    resources,
    approveResource,
    newName,
    setNewName,
    newType,
    setNewType,
    newTown,
    setNewTown,
    addResource,
  } = props;

  const navigate = useNavigate();
  const [showReminderModal, setShowReminderModal] = useState(false);

  useEffect(() => {
    if (!user) return;

    let appStateHandle;
    let notificationHandle;

    const setupReminders = async () => {
      await markAppActiveNow();
      await syncInactivityReminder({ horses });

      try {
        appStateHandle = await CapApp.addListener(
          "appStateChange",
          async ({ isActive }) => {
            if (isActive) {
              await markAppActiveNow();
              await syncInactivityReminder({ horses });
            }
          }
        );
      } catch (e) {
        console.log("APP STATE LISTENER ERROR:", e);
      }

      try {
        notificationHandle = await LocalNotifications.addListener(
          "localNotificationActionPerformed",
          async (notificationAction) => {
            if (isInactivityReminderAction(notificationAction)) {
              await markAppActiveNow();
              await syncInactivityReminder({ horses });
              setShowReminderModal(true);
            }
          }
        );
      } catch (e) {
        console.log("LOCAL NOTIFICATION LISTENER ERROR:", e);
      }
    };

    setupReminders();

    return () => {
      if (appStateHandle?.remove) {
        appStateHandle.remove();
      }

      if (notificationHandle?.remove) {
        notificationHandle.remove();
      }
    };
  }, [user, horses]);

  const handleCloseReminderModal = async () => {
    setShowReminderModal(false);
    await markAppActiveNow();
    await syncInactivityReminder({ horses });
  };

  const handleReminderNavigate = async (path) => {
    setShowReminderModal(false);
    await markAppActiveNow();
    await syncInactivityReminder({ horses });
    navigate(path);
  };

  return (
    <>
      <ReminderActionModal
        open={showReminderModal}
        onClose={handleCloseReminderModal}
        onAddCost={() => handleReminderNavigate("/costs")}
        onAddCare={() => handleReminderNavigate("/care")}
        onAddLog={() => handleReminderNavigate("/horses")}
        horses={horses}
      />

      <Routes>
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/" replace />
            ) : (
              <LoginPage
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                signInWithEmailAndPassword={signInWithEmailAndPassword}
                auth={auth}
              />
            )
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute user={user}>
              <HomePage
                user={user}
                role={role}
                isCaretakerOnly={isCaretakerOnly}
                horses={horses}
                careHorses={careHorses}
careHorsesStatus={careHorsesStatus}
                activeHorseId={activeHorseId}
                question={question}
                setQuestion={setQuestion}
                answer={answer}
                onAsk={onAsk}
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                auth={auth}
                isAdmin={isAdmin}
                showPending={showPending}
                setShowPending={setShowPending}
                resourceType={resourceType}
                setResourceType={setResourceType}
                resourcesStatus={resourcesStatus}
                resources={resources}
                approveResource={approveResource}
                roleForSubmit={role}
                newName={newName}
                setNewName={setNewName}
                newType={newType}
                setNewType={setNewType}
                newTown={newTown}
                setNewTown={setNewTown}
                addResource={addResource}
              />
            </ProtectedRoute>
          }
        />

        <Route
  path="/account"
  element={
    <ProtectedRoute user={user}>
      <AccountPage
        user={user}
        onAsk={onAsk}
        refreshUserState={refreshUserState}
      />
    </ProtectedRoute>
  }
/>

        <Route
  path="/horses"
  element={
    <ProtectedRoute user={user}>
      <HorsesPage
        user={user}
        role={role}
        horses={isCaretakerOnly ? careHorses : horses}
        setHorses={isCaretakerOnly ? () => {} : setHorses}
        horsesStatus={
          isCaretakerOnly ? careHorsesStatus : horsesStatus
        }
        setHorsesStatus={
  isCaretakerOnly
    ? () => {}
    : setHorsesStatus
}
        activeHorseId={activeHorseId}
        setActiveHorseId={setActiveHorseId}
        onAsk={onAsk}
      />
    </ProtectedRoute>
  }
/>

        <Route
  path="/costs"
  element={
    <ProtectedRoute user={user}>
      {isCaretakerOnly ? (
        <Navigate to="/" replace />
      ) : (
        <CostsPage
          user={user}
          horses={horses}
          onAsk={onAsk}
        />
      )}
    </ProtectedRoute>
  }
/>

        <Route
  path="/events"
  element={
    <ProtectedRoute user={user}>
      {isCaretakerOnly ? (
        <Navigate to="/" replace />
      ) : (
        <EventsPage
          user={user}
          horses={horses}
          onAsk={onAsk}
        />
      )}
    </ProtectedRoute>
  }
/>

        <Route
  path="/care"
  element={
    <ProtectedRoute user={user}>
      {isCaretakerOnly ? (
        <Navigate to="/" replace />
      ) : (
        <CarePage
          user={user}
          horses={horses}
          onAsk={onAsk}
        />
      )}
    </ProtectedRoute>
  }
/>

        <Route
  path="/sick-watch"
  element={
    isCaretakerOnly ? (
      <Navigate to="/" replace />
    ) : (
      <ProtectedRoute user={user}>
        <SickWatchPage horses={horses} onAsk={onAsk} />
      </ProtectedRoute>
    )
  }
/>

        <Route
  path="/resources"
  element={
    <ProtectedRoute user={user}>
      {isCaretakerOnly ? (
        <Navigate to="/" replace />
      ) : (
        <ResourcesPage
          horses={horses}
          onAsk={onAsk}
        />
      )}
    </ProtectedRoute>
  }
/>

                <Route
  path="/caretakers"
  element={
    <ProtectedRoute user={user}>
      <CaretakersPage
        user={user}
        horses={horses}
        careHorses={careHorses}
        isCaretakerOnly={isCaretakerOnly}
        onCaretakerAccessChanged={() =>
  refreshHorseAccessState(user?.uid)
}
      />
    </ProtectedRoute>
  }
/>

        <Route
  path="/caretakers/:caretakerId"
  element={
    <ProtectedRoute user={user}>
      <CaretakerDetailPage
        user={user}
        horses={horses}
      />
    </ProtectedRoute>
  }
/>

<Route
  path="/daily-care/:horseId"
  element={
    <ProtectedRoute user={user}>
      <DailyCarePlanPage
  user={user}
  horses={[...horses, ...careHorses]}
/>
    </ProtectedRoute>
  }
/>

<Route
  path="/care-history/:historyId"
  element={
    <ProtectedRoute user={user}>
      <CareHistoryDetailPage user={user} />
    </ProtectedRoute>
  }
/>

        <Route
  path="/documents"
  element={
    <ProtectedRoute user={user}>
      {isCaretakerOnly ? (
        <Navigate to="/" replace />
      ) : (
        <DocumentsPage
          user={user}
          horses={horses}
          onAsk={onAsk}
        />
      )}
    </ProtectedRoute>
  }
/>

        <Route
  path="/documents/:documentId"
  element={
    <ProtectedRoute user={user}>
      {isCaretakerOnly ? (
        <Navigate to="/" replace />
      ) : (
        <DocumentDetailPage user={user} onAsk={onAsk} />
      )}
    </ProtectedRoute>
  }
/>

        <Route
  path="/caretaker-invite/:inviteId"
  element={<CaretakerInvitePage user={user} />}
/>


        <Route
          path="*"
          element={<Navigate to={user ? "/" : "/login"} replace />}
        />
      </Routes>
    </>
  );
}

export default function App() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("farrier");
  const [newTown, setNewTown] = useState("");

  const [horses, setHorses] = useState([]);
  const [activeHorseId, setActiveHorseId] = useState("");
  const [horsesStatus, setHorsesStatus] = useState("");
  const [careHorses, setCareHorses] = useState([]);
const [careHorsesStatus, setCareHorsesStatus] = useState("");
const [hasActiveCaretakerAccess, setHasActiveCaretakerAccess] = useState(false);

  const [resources, setResources] = useState([]);
  const [resourcesStatus, setResourcesStatus] = useState("Loading resources...");
  const [resourceType, setResourceType] = useState("all");
  const [showPending, setShowPending] = useState(false);

  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [userType, setUserType] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userAccess, setUserAccess] = useState(null);
  const [userAccessLoading, setUserAccessLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState("$rc_annual");
  const [monthlyPrice, setMonthlyPrice] = useState("");
const [annualPrice, setAnnualPrice] = useState("");
  const [showIntro, setShowIntro] = useState(false);
  const [showCaretakerEntry, setShowCaretakerEntry] = useState(false);
  const [caretakerInviteCode, setCaretakerInviteCode] = useState("");
const [joiningCaretakerInvite, setJoiningCaretakerInvite] = useState(false);
const [savingUserType, setSavingUserType] = useState(false);

  const { isActive: hasPaidSubscription, loading: subLoading } = useSubscription(userAccess);
  const isOnline = useOnlineStatus();

  const now = Date.now();
const trialEndsAt = userAccess?.trialEndsAt || 0;
const trialDaysLeft = Math.max(
  0,
  Math.ceil((trialEndsAt - now) / (24 * 60 * 60 * 1000))
);

const hasAccessOverride = !!userAccess?.subscriptionOverride;

const hasCaretakerAccess = hasActiveCaretakerAccess;

const isTrialActive =
  !hasPaidSubscription &&
  !hasAccessOverride &&
  trialEndsAt > now;

const accessState =
  userType === "caretaker"
    ? hasCaretakerAccess
      ? "CARETAKER_ACCESS"
      : "CARETAKER_NEEDS_INVITE"
    : hasPaidSubscription || hasAccessOverride
    ? "ACTIVE_SUBSCRIPTION"
    : isTrialActive
    ? "TRIAL_ACTIVE"
    : "NO_ACCESS";

const isCaretakerOnly =
  userType === "caretaker";

  const ADMIN_EMAIL = "tgmarellc@outlook.com";
  const isAdmin = user?.email === ADMIN_EMAIL;

  const loadResources = async () => {
    try {
      const snap = await getDocs(collection(db, "resources"));
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setResources(items);
      setResourcesStatus(items.length ? "" : "No resources found yet.");
    } catch (e) {
      console.log("LOAD RESOURCES ERROR:", e);
      setResources([]);
      setResourcesStatus("Could not load resources (Firestore error).");
    }
  };

  const refreshHorseAccessState = async (uid) => {
  if (!uid) {
    setHorses([]);
    setHorsesStatus("");

    setCareHorses([]);
    setCareHorsesStatus("");

    setHasActiveCaretakerAccess(false);

    return {
      ownerHorses: [],
      careHorses: [],
      hasActiveCaretakerAccess: false,
    };
  }

  try {
    setHorsesStatus("Loading horses...");

    const ownerHorseQuery = query(
      collection(db, "horses"),
      where("ownerUid", "==", uid)
    );

    const caretakerAccessQuery = query(
      collection(db, "caretakerAccess"),
      where("caretakerUid", "==", uid),
      where("status", "==", "active")
    );

    const [ownerHorseSnap, caretakerAccessSnap] = await Promise.all([
      getDocs(ownerHorseQuery),
      getDocs(caretakerAccessQuery),
    ]);

    const ownerHorseItems = ownerHorseSnap.docs.map((horseDoc) => ({
      id: horseDoc.id,
      ...horseDoc.data(),
    }));

    setHorses(ownerHorseItems);
    setHorsesStatus(
      ownerHorseItems.length ? "" : "No horses added yet."
    );

    const accessRecords = caretakerAccessSnap.docs.map((accessDoc) => ({
      id: accessDoc.id,
      ...accessDoc.data(),
    }));

    const hasActiveAccess = accessRecords.length > 0;

    setHasActiveCaretakerAccess(hasActiveAccess);

    const careAccessByHorseId = {};

    accessRecords.forEach((access) => {
      (access.horseIds || []).forEach((horseId) => {
        careAccessByHorseId[horseId] = access;
      });
    });

    const careHorseIds = [
      ...new Set(Object.keys(careAccessByHorseId)),
    ];

    if (careHorseIds.length === 0) {
      setCareHorses([]);
      setCareHorsesStatus("");

      return {
        ownerHorses: ownerHorseItems,
        careHorses: [],
        hasActiveCaretakerAccess: hasActiveAccess,
      };
    }

    setCareHorsesStatus("Loading care horses...");

    const careHorseSnapshots = await Promise.all(
      careHorseIds.map((horseId) =>
        getDoc(doc(db, "horses", horseId))
      )
    );

    const careHorseItems = careHorseSnapshots
      .filter((horseSnap) => horseSnap.exists())
      .map((horseSnap) => {
        const access = careAccessByHorseId[horseSnap.id];

        return {
          id: horseSnap.id,
          ...horseSnap.data(),
          isCareHorse: true,
          caretakerAccessId: access?.id || "",
          caretakerOwnerUid: access?.ownerUid || "",
          caretakerName: access?.caretakerName || "",
        };
      });

    setCareHorses(careHorseItems);

    setCareHorsesStatus(
      careHorseItems.length
        ? ""
        : "Could not load care horses."
    );

    return {
      ownerHorses: ownerHorseItems,
      careHorses: careHorseItems,
      hasActiveCaretakerAccess: hasActiveAccess,
    };
  } catch (error) {
    console.log("REFRESH HORSE ACCESS STATE ERROR:", error);

    setHorses([]);
    setHorsesStatus("Could not load horses.");

    setCareHorses([]);
    setCareHorsesStatus("Could not load care horses.");

    setHasActiveCaretakerAccess(false);

    throw error;
  }
};

  const refreshUserState = async (authUser) => {

  const uid = authUser?.uid;

  if (!uid) {
    setUserAccess(null);
    setUserType(null);
    setRole(null);

    setHorses([]);
    setHorsesStatus("");

    setCareHorses([]);
    setCareHorsesStatus("");

    setHasActiveCaretakerAccess(false);

    return null;
  }

  try {
    // 1. Load the user's account document.
    

const accessData = await ensureUserAccessDoc(authUser);



    const currentUserType = accessData?.userType || null;

    // Account type comes ONLY from users/{uid}.userType.
    setUserAccess(accessData);
    setUserType(currentUserType);
    setRole(
      currentUserType === "caretaker"
        ? "volunteer"
        : currentUserType === "owner"
        ? "owner"
        : null
    );

    refreshHorseAccessState(uid).catch((error) => {
  console.log("BACKGROUND HORSE ACCESS REFRESH ERROR:", error);
});

return {
  accessData,
  userType: currentUserType,
};
  } catch (error) {
    console.log("REFRESH USER STATE ERROR:", error);

    // A data-loading failure must NEVER change account type.
    setHorses([]);
    setHorsesStatus("Could not load horses.");

    setCareHorses([]);
    setCareHorsesStatus("Could not load care horses.");

    setHasActiveCaretakerAccess(false);

    throw error;
  }
};

  useEffect(() => {
    loadResources();
  }, []);

  

  const buildRoleContext = () => {
    if (role === "volunteer") {
      return [
        "User role: volunteer/caretaker.",
        "Use volunteer-appropriate language.",
        "If something seems concerning, tell the user to notify the barn manager, horse owner, or care lead.",
        "Do not speak as if the horse belongs to the user.",
      ].join(" ");
    }

    return [
      "User role: horse owner.",
      "Use owner-appropriate language.",
      "Do not tell the user to notify a barn manager.",
      "If something seems concerning, say things like contact your vet, monitor closely, or continue tracking changes as appropriate.",
    ].join(" ");
  };

   const onAsk = async (incomingQuestion, incomingPhoto = null) => {
  const rawQuestion =
    typeof incomingQuestion === "string"
      ? incomingQuestion.trim()
      : question.trim();

    if (!rawQuestion && !incomingPhoto) {
    if (typeof incomingQuestion !== "string") {
      setAnswer("Please enter a question or choose a photo first.");
    }
    return "Please enter a question or choose a photo first.";
  }

  if (typeof incomingQuestion !== "string") {
    setAnswer("Thinking...");
  }

    const finalQuestion = `${buildRoleContext()}\n\n${
    rawQuestion ||
    "Please review this horse-related photo. Look for visible concerns such as wounds, swelling, hoof cracks, skin irritation, body condition changes, or progression compared with prior observations. Do not diagnose. Give practical observation notes, urgency level, and when to contact a vet."
  }`;

  try {
    const idToken = user ? await user.getIdToken() : null;

        const formData = new FormData();

    formData.append("question", finalQuestion);
    formData.append("rawQuestion", rawQuestion);
    formData.append("userEmail", user?.email || "");
    formData.append("userRole", role || "owner");
    formData.append("idToken", idToken || "");
    formData.append("activeHorseId", activeHorseId || "");

    if (incomingPhoto) {
      formData.append("photo", incomingPhoto);
    }

    const res = await fetch(`${API_BASE_URL}/ask`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMessage = data?.error || "Request failed";
      if (typeof incomingQuestion !== "string") {
        setAnswer(errorMessage);
      }
      return errorMessage;
    }

    let finalAnswer = data.answer || "No answer returned.";

    if (data.source === "faq") {
      finalAnswer = "📘 From our knowledge base:\n\n" + finalAnswer;
    } else if (data.reused) {
      finalAnswer =
        "⚡ You asked this recently — showing your last answer instantly.\n\n" +
        finalAnswer;
    }

    if (typeof incomingQuestion !== "string") {
      setAnswer(finalAnswer);
    }

    return finalAnswer;
  } catch (err) {
    console.log("ASK LEX REQUEST ERROR:", err);
    const errorMessage = "Could not reach the Lex server.";
    if (typeof incomingQuestion !== "string") {
      setAnswer(errorMessage);
    }
    return errorMessage;
  }
};

const handleUserTypeSelection = async (selectedUserType) => {
  if (!user?.uid) return;

    if (savingUserType) return;

    if (selectedUserType === "caretaker") {
  setShowCaretakerEntry(true);
  return;
}

  setSavingUserType(true);

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    const existingData = userSnap.exists()
      ? userSnap.data()
      : {};

    const existingUserType = existingData?.userType || "";

    // Owner status is permanent. Never downgrade an owner to caretaker.
    const finalUserType =
      existingUserType === "owner"
        ? "owner"
        : selectedUserType;

    const updates = {
      userType: finalUserType,
      updatedAt: Date.now(),
    };

    // Start the 14-day owner trial only when this account
    // becomes an owner for the first time.
    if (
      finalUserType === "owner" &&
      existingUserType !== "owner"
    ) {
      const trialStartedAt = Date.now();

      updates.trialStartedAt = trialStartedAt;
      updates.trialEndsAt =
        trialStartedAt + 14 * 24 * 60 * 60 * 1000;
      updates.subscriptionOverride = false;
    }

    await setDoc(
      userRef,
      updates,
      { merge: true }
    );

    setUserAccess((current) => ({
  ...(current || existingData),
  ...updates,
}));

setUserType("owner");
setRole("owner");
setShowCaretakerEntry(false);

refreshHorseAccessState(user.uid).catch((error) => {
  console.log("BACKGROUND HORSE ACCESS REFRESH ERROR:", error);
});
    } catch (error) {
    console.log("SAVE USER TYPE ERROR:", error);
    alert("Could not save your selection. Please try again.");
  } finally {
    setSavingUserType(false);
  }
};

const handleCaretakerEntryJoin = async () => {
  if (!user?.uid) {
    alert("You must be logged in to join as a caretaker.");
    return;
  }

  const code = caretakerInviteCode.trim().toUpperCase();

  if (!code) {
    alert("Please enter your invite code.");
    return;
  }

  try {
    setJoiningCaretakerInvite(true);

    const inviteQuery = query(
      collection(db, "caretakerAccess"),
      where("inviteCode", "==", code),
      where("status", "==", "pending"),
      where("caretakerUid", "==", "")
    );

    const inviteSnap = await getDocs(inviteQuery);

    if (inviteSnap.empty) {
      alert("Invite code not found.");
      return;
    }

    const inviteDoc = inviteSnap.docs[0];
const inviteData = inviteDoc.data();

const activeAccessId = `${inviteData.ownerUid}_${user.uid}`;

await setDoc(doc(db, "caretakerAccess", activeAccessId), {
  ...inviteData,
  sourceInviteId: inviteDoc.id,
  caretakerUid: user.uid,
  status: "active",
  acceptedAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

await deleteDoc(doc(db, "caretakerAccess", inviteDoc.id));

await updateDoc(doc(db, "users", user.uid), {
  userType: "caretaker",
  updatedAt: Date.now(),
});

await refreshHorseAccessState(user.uid);

setCaretakerInviteCode("");
setShowCaretakerEntry(false);

    alert("Caretaker access added.");
  } catch (error) {
    console.log("CARETAKER ENTRY JOIN ERROR:", error);
    alert("Could not join the caretaker invite.");
  } finally {
    setJoiningCaretakerInvite(false);
  }
};

const handleRemainCaretaker = async () => {
  if (!user?.uid || !hasCaretakerAccess) return;

  try {
    await updateDoc(doc(db, "users", user.uid), {
      userType: "caretaker",
      updatedAt: Date.now(),
    });

    await refreshUserState(user);
    setShowCaretakerEntry(false);
  } catch (error) {
    console.log("REMAIN CARETAKER ERROR:", error);
    alert("Could not return to caretaker access.");
  }
};

const startSubscription = async () => {
  try {
    const offerings = await Purchases.getOfferings();

    const current = offerings.current;

    if (!current || !current.availablePackages.length) {
      alert("No subscription options available.");
      return;
    }

    const pkg =
  current.availablePackages.find((p) => p.identifier === selectedPlanId) ||
  current.availablePackages[0];

    const purchase = await Purchases.purchasePackage({
      aPackage: pkg,
    });

    console.log("PURCHASE SUCCESS:", purchase);
    alert("Subscription successful! Refreshing your access...");
    const updatedCustomerInfo = await Purchases.getCustomerInfo();
console.log("UPDATED CUSTOMER INFO:", updatedCustomerInfo);
setTimeout(() => {
  window.location.href = "/";
}, 500);
  } catch (e) {
    console.log("PURCHASE ERROR:", e);

    if (!e.userCancelled) {
      alert("Purchase failed.");
    }
  }
};

const addResource = async () => {
    if (!newName || !newTown) {
      alert("Please fill out name and town.");
      return;
    }

    try {
      const existingSnap = await getDocs(collection(db, "resources"));
      const alreadyExists = existingSnap.docs.some((resourceDoc) => {
        const data = resourceDoc.data();
        return (
          data.name?.toLowerCase() === newName.toLowerCase() &&
          data.town?.toLowerCase() === newTown.toLowerCase()
        );
      });

      if (alreadyExists) {
        alert("This resource already exists.");
        return;
      }

      await addDoc(collection(db, "resources"), {
        name: newName,
        type: newType,
        town: newTown,
        verified: false,
        status: "pending",
        createdAt: Date.now(),
      });

      alert("Resource added!");
      setNewName("");
      setNewTown("");
      await loadResources();
    } catch (err) {
      console.log("ADD RESOURCE ERROR:", err);
      alert("Failed to add resource.");
    }
  };

  const approveResource = async (id) => {
    try {
      await updateDoc(doc(db, "resources", id), {
        status: "approved",
        verified: true,
      });

      await loadResources();
    } catch (err) {
      console.log("APPROVE RESOURCE ERROR:", err);
      alert("Approve failed.");
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      if (u) {
  (async () => {
    try {
      await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });

      if (Capacitor.getPlatform() === "ios") {
        await Purchases.configure({
          apiKey: REVENUECAT_APPLE_API_KEY,
          appUserID: u.uid,
        });

        const offerings = await Purchases.getOfferings();
        const current = offerings.current;

        if (current) {
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
        }
      }
    } catch (e) {
      console.log("REVENUECAT INIT ERROR:", e);
    }
  })();
}
      setActiveHorseId("");

      if (!u) {
  await refreshUserState(null);

  setUserAccessLoading(false);
  setAuthLoading(false);
  return;
}

try {
  const refreshedState = await refreshUserState(u);

  registerForPushNotifications(u).catch((error) => {
  console.log("BACKGROUND PUSH REGISTRATION ERROR:", error);
});

  if (!refreshedState?.accessData?.hasSeenIntro) {
    setShowIntro(true);
  }
} catch (e) {
  console.log("INITIAL USER STATE LOAD ERROR:", e);
}

setUserAccessLoading(false);
setAuthLoading(false);
    });

    const timeout = setTimeout(() => {
      setAuthLoading(false);
    }, 3000);

    return () => {
      clearTimeout(timeout);
      unsub();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
  if (!user?.uid) return;

  const caretakerAccessQuery = query(
    collection(db, "caretakerAccess"),
    where("caretakerUid", "==", user.uid)
  );

  const unsub = onSnapshot(
    caretakerAccessQuery,
    async () => {
      try {
        await refreshHorseAccessState(user.uid);
      } catch (error) {
        console.log("CARETAKER ACCESS LIVE REFRESH ERROR:", error);
      }
    },
    (error) => {
      console.log("CARETAKER ACCESS LISTENER ERROR:", error);
    }
  );

  return () => unsub();
}, [user?.uid]);

  if (authLoading || userAccessLoading || subLoading || (user && !userAccess)) {
    return (
      <div
        style={{
          paddingTop: "max(env(safe-area-inset-top), 16px)",
          paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
          minHeight: "100vh",
          boxSizing: "border-box",
          background: "#F6F4EE",
        }}
      >
        <div style={{ padding: 24 }}>Loading...</div>
      </div>
    );
  }

console.log("USER ACCESS DEBUG", {
  userAccess,
  trialEndsAt,
  subscriptionOverride: userAccess?.subscriptionOverride,
  now,
  trialDaysLeft,
  hasPaidSubscription,
  isTrialActive,
  accessState,
});

if (user && !userType && !showCaretakerEntry) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#F6F4EE",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#FFFFFF",
          border: "1px solid #E5E2DA",
          borderRadius: 22,
          padding: 24,
          boxShadow: "0 10px 22px rgba(24, 34, 51, 0.08)",
        }}
      >
        <div
          style={{
            fontSize: 30,
            fontWeight: 600,
            color: "#24324A",
            marginBottom: 10,
            lineHeight: 1.1,
          }}
        >
          Welcome to Lex Equine
        </div>

        <div
          style={{
            fontSize: 16,
            color: "#6F6A60",
            lineHeight: 1.5,
            marginBottom: 22,
          }}
        >
          How will you use Lex?
        </div>

        <button
  type="button"
  onClick={() => handleUserTypeSelection("owner")}
  disabled={savingUserType}
  style={{
            width: "100%",
            border: "none",
            borderRadius: 14,
            padding: "16px",
            background: "#24324A",
            color: "#FFFFFF",
            fontSize: 16,
            fontWeight: 700,
            cursor: savingUserType ? "not-allowed" : "pointer",
opacity: savingUserType ? 0.7 : 1,
          }}
        >
          {savingUserType ? "Setting up your account..." : "I own horses"}
        </button>

        <button
  type="button"
  onClick={() => handleUserTypeSelection("caretaker")}
  disabled={savingUserType}
  style={{
            width: "100%",
            marginTop: 12,
            border: "1px solid #24324A",
            borderRadius: 14,
            padding: "16px",
            background: "#FFFFFF",
            color: "#24324A",
            fontSize: 16,
            fontWeight: 700,
            cursor: savingUserType ? "not-allowed" : "pointer",
opacity: savingUserType ? 0.7 : 1,
          }}
        >
          {savingUserType
  ? "Setting up your account..."
  : "I'm caring for someone else's horses"}
        </button>
      </div>
    </div>
  );
}

if (
  user &&
  (showCaretakerEntry || accessState === "CARETAKER_NEEDS_INVITE")
) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#F6F4EE",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#FFFFFF",
          border: "1px solid #E5E2DA",
          borderRadius: 22,
          padding: 24,
          boxShadow: "0 10px 22px rgba(24, 34, 51, 0.08)",
        }}
      >
        <div
          style={{
            fontSize: 30,
            fontWeight: 600,
            color: "#24324A",
            marginBottom: 10,
            lineHeight: 1.1,
          }}
        >
          Enter Invite Code
        </div>

        <div
          style={{
            fontSize: 15,
            color: "#6F6A60",
            lineHeight: 1.5,
            marginBottom: 18,
          }}
        >
          Enter the code sent to you by the horse owner.
        </div>

        <input
          type="text"
          placeholder="Invite Code"
          value={caretakerInviteCode}
          onChange={(e) =>
            setCaretakerInviteCode(e.target.value.toUpperCase())
          }
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid #E5E2DA",
            fontSize: 16,
            marginBottom: 14,
          }}
        />

        <button
          type="button"
          onClick={handleCaretakerEntryJoin}
          disabled={joiningCaretakerInvite}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 14,
            padding: "14px",
            background: "#24324A",
            color: "#FFFFFF",
            fontSize: 16,
            fontWeight: 700,
            cursor: joiningCaretakerInvite ? "not-allowed" : "pointer",
            opacity: joiningCaretakerInvite ? 0.7 : 1,
          }}
        >
          {joiningCaretakerInvite ? "Joining..." : "Continue"}
        </button>

        <button
  type="button"
  onClick={async () => {
  setCaretakerInviteCode("");
  setShowCaretakerEntry(false);
  }}
  style={{
    width: "100%",
    marginTop: 12,
    border: "1px solid #E5E2DA",
    borderRadius: 14,
    padding: "13px",
    background: "#FFFFFF",
    color: "#24324A",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  }}
>
  Cancel
</button>
      </div>
    </div>
  );
}

if (user && accessState === "NO_ACCESS") {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#F6F4EE",
        textAlign: "center",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
          background: "#FFFFFF",
          border: "1px solid #E5E2DA",
          borderRadius: 22,
          padding: 24,
          boxShadow: "0 10px 22px rgba(24, 34, 51, 0.08)",
        }}
      >
        <div
          style={{
            fontSize: 30,
            fontWeight: 600,
            color: "#24324A",
            marginBottom: 12,
            lineHeight: 1.1,
          }}
        >
          Subscription Required
        </div>

        <div
  style={{
    fontSize: 16,
    color: "#6F6A60",
    lineHeight: 1.6,
    marginBottom: 20,
  }}
>
  Your free trial has ended. Subscribe to continue using Lex Equine.
  <div
  style={{
    marginTop: 10,
    display: "grid",
    gap: 10,
  }}
>
  <button
    onClick={() => setSelectedPlanId("$rc_monthly")}
    style={{
      width: "100%",
      padding: "14px 16px",
      borderRadius: 14,
      border:
        selectedPlanId === "$rc_monthly"
          ? "2px solid #24324A"
          : "1px solid #E5E2DA",
      background: selectedPlanId === "$rc_monthly" ? "#F5EEDB" : "#FFFFFF",
      color: "#24324A",
      cursor: "pointer",
      textAlign: "left",
    }}
  >
    <div style={{ fontWeight: 700 }}>Monthly</div>
    <div style={{ marginTop: 4, fontSize: 14, color: "#6F6A60" }}>
      {monthlyPrice ? `${monthlyPrice} per month` : "Monthly subscription"}
    </div>
  </button>

  <button
    onClick={() => setSelectedPlanId("$rc_annual")}
    style={{
      width: "100%",
      padding: "14px 16px",
      borderRadius: 14,
      border:
        selectedPlanId === "$rc_annual"
          ? "2px solid #24324A"
          : "1px solid #E5E2DA",
      background: selectedPlanId === "$rc_annual" ? "#F5EEDB" : "#FFFFFF",
      color: "#24324A",
      cursor: "pointer",
      textAlign: "left",
    }}
  >
    <div style={{ fontWeight: 700 }}>Annual</div>
    <div style={{ marginTop: 4, fontSize: 14, color: "#6F6A60" }}>
      {annualPrice ? `${annualPrice} per year` : "Annual subscription"}
    </div>
  </button>
</div>
</div>

        <button
          className="primary-button"
          style={{ width: "100%" }}
          onClick={startSubscription}
        >
          {selectedPlanId === "$rc_monthly"
  ? "Start Monthly Subscription"
  : "Start Annual Subscription"}
        </button>

        <button
  type="button"
  onClick={() => {
  if (hasCaretakerAccess) {
    handleRemainCaretaker();
  } else {
    setShowCaretakerEntry(true);
  }
}}
  style={{
    width: "100%",
    marginTop: 12,
    border: "1px solid #24324A",
    borderRadius: 14,
    padding: "13px 16px",
    background: "#FFFFFF",
    color: "#24324A",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  }}
>
  {hasCaretakerAccess
  ? "Decline Subscription & Remain a Caretaker"
  : "I'm caring for someone else's horses"}
</button>

        <button
  style={{
    width: "100%",
    marginTop: 12,
    background: "transparent",
    border: "none",
    color: "#24324A",
    textDecoration: "underline",
    cursor: "pointer",
    fontSize: 14,
  }}
  onClick={async () => {
    try {
      const restore = await Purchases.restorePurchases();
      console.log("RESTORE RESULT:", restore);
      alert("Purchases restored!");
      setTimeout(() => {
  window.location.href = "/";
}, 500);
    } catch (e) {
      console.log("RESTORE ERROR:", e);
      alert("Restore failed.");
    }
  }}
>
  Restore Purchases
</button>

<div
  style={{
    marginTop: 16,
    fontSize: 13,
    color: "#6F6A60",
    lineHeight: 1.6,
  }}
>
  By subscribing, you agree to our{" "}
  <a
    href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
    target="_blank"
    rel="noreferrer"
    style={{ color: "#24324A" }}
  >
    Terms of Use
  </a>{" "}
  and{" "}
  <a
    href="https://lexequine.com/#privacy"
    target="_blank"
    rel="noreferrer"
    style={{ color: "#24324A" }}
  >
    Privacy Policy
  </a>
  .
</div>

      </div>
    </div>
  );
}

  return (
  <AccessProvider isCaretakerOnly={isCaretakerOnly}>
    <Router>
      <div
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        minHeight: "100vh",
        boxSizing: "border-box",
        background: "#F6F4EE",
      }}
    >
      <OfflineBanner />

      <IntroModal
  open={showIntro}
  onFinish={async () => {
    if (user?.uid) {
      await updateDoc(doc(db, "users", user.uid), {
        hasSeenIntro: true,
        updatedAt: Date.now(),
      });
    }

    setShowIntro(false);
  }}
/>

      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: 16,
          paddingTop: isOnline ? 16 : 76,
          boxSizing: "border-box",
        }}
      >
        {accessState === "TRIAL_ACTIVE" && trialDaysLeft > 0 ? (
  <div
    style={{
      marginBottom: 16,
      padding: "14px 16px",
      borderRadius: 18,
      border: "1px solid #E5E2DA",
      background: "#F5EEDB",
      color: "#24324A",
      boxShadow: "0 6px 14px rgba(24, 34, 51, 0.06)",
    }}
  >
    <div
  style={{
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 10,
  }}
>
  {trialDaysLeft > 3
    ? `${trialDaysLeft} days left in your free trial`
    : trialDaysLeft === 3
    ? "Your free trial ends in 3 days"
    : trialDaysLeft === 2
    ? "Your free trial ends in 2 days"
    : trialDaysLeft === 1
    ? "Your free trial ends tomorrow"
    : "Your free trial ends today"}
</div>

    <button
  className="small-button"
  onClick={startSubscription}
>
  Subscribe Now
</button>
  </div>
) : null}
        <AppRoutes
  user={user}
  role={role}
  isCaretakerOnly={isCaretakerOnly}
  horses={horses}
  setHorses={setHorses}
  horsesStatus={horsesStatus}
  setHorsesStatus={setHorsesStatus}

  careHorses={careHorses}
  setCareHorses={setCareHorses}

  careHorsesStatus={careHorsesStatus}
  setCareHorsesStatus={setCareHorsesStatus}
  refreshUserState={refreshUserState}
  refreshHorseAccessState={refreshHorseAccessState}

  activeHorseId={activeHorseId}
  setActiveHorseId={setActiveHorseId}
  question={question}
  setQuestion={setQuestion}
  answer={answer}
  onAsk={onAsk}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          isAdmin={isAdmin}
          showPending={showPending}
          setShowPending={setShowPending}
          resourceType={resourceType}
          setResourceType={setResourceType}
          resourcesStatus={resourcesStatus}
          resources={resources}
          approveResource={approveResource}
          newName={newName}
          setNewName={setNewName}
          newType={newType}
          setNewType={setNewType}
          newTown={newTown}
          setNewTown={setNewTown}
          addResource={addResource}
        />
      </div>
          </div>
    </Router>
  </AccessProvider>
);
}