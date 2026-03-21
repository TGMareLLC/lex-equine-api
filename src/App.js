import "./App.css";
import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
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

const API_BASE_URL = "http://10.0.0.160:3001"; // <-- your IP

function ProtectedRoute({ user, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
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

  const [resources, setResources] = useState([]);
  const [resourcesStatus, setResourcesStatus] = useState("Loading resources...");
  const [resourceType, setResourceType] = useState("all");
  const [showPending, setShowPending] = useState(false);

  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

  const loadHorsesForUser = async (uid) => {
    if (!uid) {
      setHorses([]);
      setHorsesStatus("");
      return;
    }

    try {
      setHorsesStatus("Loading horses...");

      const qh = query(collection(db, "horses"), where("ownerUid", "==", uid));
      const hsnap = await getDocs(qh);
      const hitems = hsnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      setHorses(hitems);
      setHorsesStatus(hitems.length ? "" : "No horses added yet.");
    } catch (e) {
      console.log("LOAD HORSES ERROR:", e);
      setHorses([]);
      setHorsesStatus("Could not load horses.");
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

  const onAsk = async (incomingQuestion) => {
    const rawQuestion =
      typeof incomingQuestion === "string" ? incomingQuestion.trim() : question.trim();

    if (!rawQuestion) {
      if (typeof incomingQuestion !== "string") {
        setAnswer("Please enter a question first.");
      }
      return "Please enter a question first.";
    }

    if (typeof incomingQuestion !== "string") {
      setAnswer("Thinking...");
    }

    const finalQuestion = `${buildRoleContext()}\n\n${rawQuestion}`;

    try {
      const idToken = user ? await user.getIdToken() : null;

      const res = await fetch(`${API_BASE_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: finalQuestion,
          rawQuestion,
          userEmail: user?.email || null,
          userRole: role || "owner",
          idToken,
          activeHorseId,
        }),
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
    setActiveHorseId("");

    if (!u) {
      setRole(null);
      setHorses([]);
      setHorsesStatus("");
      setAuthLoading(false);
      return;
    }

    loadHorsesForUser(u.uid).catch(() => {});
setRole("owner");

    setAuthLoading(false);
  });

  const timeout = setTimeout(() => {
    setAuthLoading(false);
  }, 3000);

  return () => {
    clearTimeout(timeout);
    unsub();
  };
}, []);

  if (authLoading) {
  return (
    <div style={{ padding: 40 }}>
      Loading...
    </div>
  );
}

  return (
    <Router>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: 16 }}>
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
                  horses={horses}
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
                <AccountPage user={user} onAsk={onAsk} />
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
                  horses={horses}
                  setHorses={setHorses}
                  horsesStatus={horsesStatus}
                  setHorsesStatus={setHorsesStatus}
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
                <CostsPage user={user} horses={horses} onAsk={onAsk} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/events"
            element={
              <ProtectedRoute user={user}>
                <EventsPage user={user} horses={horses} onAsk={onAsk} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/care"
            element={
              <ProtectedRoute user={user}>
                <CarePage user={user} horses={horses} onAsk={onAsk} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/sick-watch"
            element={
              <ProtectedRoute user={user}>
                <SickWatchPage horses={horses} onAsk={onAsk} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/resources"
            element={
              <ProtectedRoute user={user}>
                <ResourcesPage horses={horses} onAsk={onAsk} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/documents"
            element={
              <ProtectedRoute user={user}>
                <DocumentsPage user={user} horses={horses} onAsk={onAsk} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/documents/:documentId"
            element={
              <ProtectedRoute user={user}>
                <DocumentDetailPage user={user} onAsk={onAsk} />
              </ProtectedRoute>
            }
          />

          <Route
            path="*"
            element={<Navigate to={user ? "/" : "/login"} replace />}
          />
        </Routes>
      </div>
    </Router>
  );
}