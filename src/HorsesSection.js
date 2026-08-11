import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Share } from "@capacitor/share";
import { EmailComposer } from "capacitor-email-composer";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { registerPlugin } from "@capacitor/core";
import imageCompression from "browser-image-compression";
import { db, storage } from "./firebase";


import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import BottomNav from "./components/BottomNav";
import FloatingAskLex from "./components/FloatingAskLex";

const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://lex-equine-api.onrender.com";

const TextMessageComposer = registerPlugin("TextMessageComposerPlugin");

const CARE_TYPES = [
  "Farrier",
  "Vaccines",
  "Dental",
  "Medication",
  "Deworming",
  "Vet Follow-Up",
  "Custom",
];

const REPEAT_OPTIONS = [
  "One Time",
  "Every 4 Weeks",
  "Every 6 Weeks",
  "Every 8 Weeks",
  "Monthly",
  "Every 3 Months",
  "Every 6 Months",
  "Yearly",
];

const ALERT_OPTIONS = [
  "Same Day",
  "1 Day Before",
  "2 Days Before",
  "1 Week Before",
];

const CONTACT_TYPES = [
  { key: "vet", label: "Vet" },
  { key: "farrier", label: "Farrier" },
  { key: "trainer", label: "Trainer" },
  { key: "dentist", label: "Dentist" },
];

const getTodayInputValue = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatArchiveDateRange = (item) => {
  const started = item?.startedAt ? new Date(item.startedAt) : null;
  const ended = item?.endedAt ? new Date(item.endedAt) : null;

  if (started && ended) {
    return `${started.toLocaleDateString()} – ${ended.toLocaleDateString()}`;
  }

  if (ended) return ended.toLocaleDateString();
  if (started) return started.toLocaleDateString();

  return "Unknown date";
};

const getDaysUntil = (value) => {
  if (!value) return null;

  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();

  const due = new Date(value);
  const dueDay = new Date(
    due.getFullYear(),
    due.getMonth(),
    due.getDate()
  ).getTime();

  return Math.round((dueDay - today) / (1000 * 60 * 60 * 24));
};

const formatLogDate = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString();
};

const formatCareDate = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const emptyContact = () => ({
  name: "",
  phone: "",
  email: "",
  businessName: "",
  address: "",
  notes: "",
});

const hasContactData = (contact) => {
  if (!contact) return false;
  return !!(
    contact.name ||
    contact.phone ||
    contact.email ||
    contact.businessName ||
    contact.address ||
    contact.notes
  );
};

const cleanText = (value) => String(value ?? "").trim();

const normalizeContact = (contact = {}) => ({
  name: cleanText(contact.name),
  phone: cleanText(contact.phone),
  email: cleanText(contact.email),
  businessName: cleanText(contact.businessName),
  address: cleanText(contact.address),
  notes: cleanText(contact.notes),
});

const isOffline = () =>
  typeof navigator !== "undefined" && navigator.onLine === false;

const getFeedInventoryStatus = (item) => {
  const quantity = Number(item.currentQuantity || 0);
  const dailyUse = Number(item.dailyUse || 0);
  const lowThresholdDays = Number(item.lowThresholdDays || 3);

  const quantityUpdatedAt = Number(
    item.quantityUpdatedAt || item.updatedAt || item.createdAt || Date.now()
  );

  const daysPassed = Math.max(
    0,
    Math.floor((Date.now() - quantityUpdatedAt) / 86400000)
  );

  const adjustedQuantity =
    dailyUse > 0 ? Math.max(0, quantity - daysPassed * dailyUse) : quantity;

  if (!dailyUse || dailyUse <= 0) {
    return {
      daysRemaining: null,
      displayQuantity: adjustedQuantity,
      isLow: false,
      warningText: "",
    };
  }

  const daysRemaining = Math.floor(adjustedQuantity / dailyUse);

  if (adjustedQuantity <= 0) {
    return {
      daysRemaining: 0,
      displayQuantity: adjustedQuantity,
      isLow: true,
      warningText: `${item.itemName || "This item"} is empty.`,
    };
  }

  if (daysRemaining <= lowThresholdDays) {
    return {
      daysRemaining,
      displayQuantity: adjustedQuantity,
      isLow: true,
      warningText: `${item.itemName || "This item"} may run out in about ${daysRemaining} day(s).`,
    };
  }

  return {
    daysRemaining,
    displayQuantity: adjustedQuantity,
    isLow: false,
    warningText: "",
  };
};

export default function HorsesSection(props) {

  const {
    user,
    horses,
    setHorses,
    horsesStatus,
    setHorsesStatus,
    activeHorseId,
    setActiveHorseId,
    onAsk,
  } = props;

  const navigate = useNavigate();
  const location = useLocation();

  const [horseName, setHorseName] = useState("");
  const [horseAge, setHorseAge] = useState("");
  const [horseSex, setHorseSex] = useState("");
  const [horseFeed, setHorseFeed] = useState("");
  const [horseMeds, setHorseMeds] = useState("");
  const [horseMedical, setHorseMedical] = useState("");
  const [horseNotes, setHorseNotes] = useState("");
  const [blanketingEnabled, setBlanketingEnabled] = useState(false);
const [rainSheetEnabled, setRainSheetEnabled] = useState(false);
const [midweightEnabled, setMidweightEnabled] = useState(false);
const [midweightTemp, setMidweightTemp] = useState("");
const [heavyweightEnabled, setHeavyweightEnabled] = useState(false);
const [heavyweightTemp, setHeavyweightTemp] = useState("");
const [blanketNotes, setBlanketNotes] = useState("");
  const [horsePhotoUrl, setHorsePhotoUrl] = useState("");
  const [horsePhotoBlob, setHorsePhotoBlob] = useState(null);
  const [referencePhotos, setReferencePhotos] = useState([]);
const [referencePhotoUploading, setReferencePhotoUploading] = useState(false);
  const [isSavingHorse, setIsSavingHorse] = useState(false);
  const [failedHorseImages, setFailedHorseImages] = useState({});

  const [horseVet, setHorseVet] = useState(emptyContact());
  const [horseFarrier, setHorseFarrier] = useState(emptyContact());
  const [horseTrainer, setHorseTrainer] = useState(emptyContact());
  const [horseDentist, setHorseDentist] = useState(emptyContact());

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState("add");
  const [editingHorseId, setEditingHorseId] = useState("");

  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewHorse, setViewHorse] = useState(null);

  const [isLogOpen, setIsLogOpen] = useState(false);
  const [logHorse, setLogHorse] = useState(null);
  const [logText, setLogText] = useState("");

  const [isEditLogOpen, setIsEditLogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [editingLogText, setEditingLogText] = useState("");

  const [logHistoryByHorseId, setLogHistoryByHorseId] = useState({});
  const [logHistoryStatusByHorseId, setLogHistoryStatusByHorseId] = useState(
    {}
  );
  const [logHistoryExpandedByHorseId, setLogHistoryExpandedByHorseId] =
    useState({});

  const [careHistoryByHorseId, setCareHistoryByHorseId] = useState({});
  const [careHistoryStatusByHorseId, setCareHistoryStatusByHorseId] =
    useState({});
  const [viewCareHistoryExpanded, setViewCareHistoryExpanded] = useState(false);
  const [caretakerHistoryByHorseId, setCaretakerHistoryByHorseId] = useState({});
const [caretakerHistoryStatusByHorseId, setCaretakerHistoryStatusByHorseId] =
  useState({});
const [viewCaretakerHistoryExpanded, setViewCaretakerHistoryExpanded] =
  useState(false);
  const [selectedCareHistoryItem, setSelectedCareHistoryItem] = useState(null);

  const [isHorseLexOpen, setIsHorseLexOpen] = useState(false);
  const [horseLexHorse, setHorseLexHorse] = useState(null);
  const [horseLexQuestion, setHorseLexQuestion] = useState("");
  const [horseLexAnswer, setHorseLexAnswer] = useState("");
  const [horseLexLoading, setHorseLexLoading] = useState(false);
  const [horseLexLogs, setHorseLexLogs] = useState([]);
  const [horseLexSickWatchEntries, setHorseLexSickWatchEntries] = useState([]);
  const [horseLexSickWatchStatus, setHorseLexSickWatchStatus] = useState("");

  const [archiveByHorseId, setArchiveByHorseId] = useState({});
  const [archiveStatusByHorseId, setArchiveStatusByHorseId] = useState({});
  const [archiveExpandedByHorseId, setArchiveExpandedByHorseId] = useState({});
  const [archiveModalCase, setArchiveModalCase] = useState(null);
  const [shareHorseModalOpen, setShareHorseModalOpen] = useState(false);
const [shareHorseTarget, setShareHorseTarget] = useState(null);
  const [viewLogExpanded, setViewLogExpanded] = useState(false);
  const [viewArchiveExpanded, setViewArchiveExpanded] = useState(false);

  const [careItems, setCareItems] = useState([]);
  const [isCareOpen, setIsCareOpen] = useState(false);
  const [careHorse, setCareHorse] = useState(null);
  const [isDailyCarePlanOpen, setIsDailyCarePlanOpen] = useState(false);
const [dailyCareHorse, setDailyCareHorse] = useState(null);

  const [isAddCareOpen, setIsAddCareOpen] = useState(false);
  const [isFeedInventoryOpen, setIsFeedInventoryOpen] = useState(false);
const [feedInventoryHorse, setFeedInventoryHorse] = useState(null);
const [feedItemType, setFeedItemType] = useState("Hay");
const [feedItemName, setFeedItemName] = useState("");
const [feedQuantity, setFeedQuantity] = useState("");
const [feedUnit, setFeedUnit] = useState("bags");
const [feedDailyUseUnit, setFeedDailyUseUnit] = useState("bags");
const [feedFlakesPerBale, setFeedFlakesPerBale] = useState("");
const [feedDailyUse, setFeedDailyUse] = useState("");
const [feedUsageFrequency, setFeedUsageFrequency] = useState("daily");
const [feedLowThreshold, setFeedLowThreshold] = useState("");
const [feedNotes, setFeedNotes] = useState("");
const [feedInventoryItems, setFeedInventoryItems] = useState([]);
const [feedInventoryStatus, setFeedInventoryStatus] = useState("");
const [editingFeedItemId, setEditingFeedItemId] = useState(null);
const [isFeedFormOpen, setIsFeedFormOpen] = useState(false);
const [refillFeedItem, setRefillFeedItem] = useState(null);
const [hayToAdd, setHayToAdd] = useState("");

  const [careType, setCareType] = useState("Farrier");
  const [careTitle, setCareTitle] = useState("");
  const [careDate, setCareDate] = useState(getTodayInputValue());
  const [careTime, setCareTime] = useState("");
  const [repeatInterval, setRepeatInterval] = useState("One Time");
  const [alertTiming, setAlertTiming] = useState("1 Day Before");
  const [careNotes, setCareNotes] = useState("");

  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactType, setContactType] = useState("vet");
  const [contactForm, setContactForm] = useState(emptyContact());

  const [resourcesById, setResourcesById] = useState({});

  const primaryText = "#1E1E1E";
  const secondaryText = "#6F6A60";
  const borderColor = "#E5E2DA";
  const navy = "#24324A";
  const navyPressed = "#1B2538";
  const navyBorder = "#31425F";
  const burgundy = "#7A2E2E";
  const softBg = "#FBF8F2";
  const cardShadow = "0 10px 22px rgba(24, 34, 51, 0.08)";
  const panelShadow = "0 12px 24px rgba(24, 34, 51, 0.14)";

  const getResolvedContact = (horse, typeKey) => {
    if (!horse) return emptyContact();

    const directContact = horse[typeKey];
    if (hasContactData(directContact)) {
      return directContact;
    }

    const resourceIdField = `${typeKey}Id`;
    const resourceId = horse[resourceIdField];

    if (resourceId && resourcesById[resourceId]) {
      const resource = resourcesById[resourceId];

      return {
        name: resource.name || "",
        phone: resource.phone || "",
        email: resource.email || "",
        businessName: resource.businessName || "",
        address: resource.address || "",
        notes: resource.notes || "",
      };
    }

    return emptyContact();
  };

  const getVetPhone = (horse) => {
    if (!horse) return "";
    const resolvedVet = getResolvedContact(horse, "vet");
    return resolvedVet.phone || "";
  };

  const callVet = (horse) => {
    const phone = getVetPhone(horse);

    if (!phone) {
      alert("No vet phone number available.");
      return;
    }

    window.location.href = `tel:${phone}`;
  };

  const clearForm = () => {
    if (horsePhotoUrl && horsePhotoUrl.startsWith("blob:")) {
      URL.revokeObjectURL(horsePhotoUrl);
    }

    setHorseName("");
    setHorseAge("");
    setHorseSex("");
    setHorseFeed("");
    setHorseMeds("");
    setHorseMedical("");
    setHorseNotes("");
    setBlanketingEnabled(false);
setRainSheetEnabled(false);
setMidweightEnabled(false);
setMidweightTemp("");
setHeavyweightEnabled(false);
setHeavyweightTemp("");
setBlanketNotes("");
    setHorsePhotoUrl("");
setHorsePhotoBlob(null);
setReferencePhotos([]);
    setHorseVet(emptyContact());
    setHorseFarrier(emptyContact());
    setHorseTrainer(emptyContact());
    setHorseDentist(emptyContact());
    setEditingHorseId("");
    setMode("add");
    setIsSavingHorse(false);
  };

  const closeModal = () => {
    setIsOpen(false);
    clearForm();
  };

  const openView = async (horse) => {
    setViewHorse(horse);
    setIsViewOpen(true);

    setViewLogExpanded(false);
    setViewCareHistoryExpanded(false);
    setViewArchiveExpanded(false);

    if (horse?.id) {
      await loadLogHistoryForHorse(horse.id);
await loadCareHistoryForHorse(horse.id);
await loadCaretakerHistoryForHorse(horse.id);
await loadSickWatchArchiveForHorse(horse.id);
    }
  };

  const closeView = () => {
    setViewHorse(null);
    setIsViewOpen(false);
  };

  const clearCareForm = () => {
    setCareType("Farrier");
    setCareTitle("");
    setCareDate(getTodayInputValue());
    setCareTime("");
    setRepeatInterval("One Time");
    setAlertTiming("1 Day Before");
    setCareNotes("");
  };

  const closeCareModal = () => {
    setIsCareOpen(false);
    setCareHorse(null);
    setIsAddCareOpen(false);
    clearCareForm();
  };

  const openFeedInventory = async (horse) => {
  setFeedInventoryHorse(horse);
  setIsFeedInventoryOpen(true);
  setIsFeedFormOpen(false);

  await loadFeedInventory(horse?.id);
};

const closeFeedInventory = () => {
  setFeedInventoryHorse(null);
  setIsFeedInventoryOpen(false);
  setEditingFeedItemId(null);
setFeedItemType("Hay");
setFeedItemName("");
setFeedQuantity("");
setFeedUnit("bales");
setFeedDailyUse("");
setFeedDailyUseUnit("bales");
setFeedUsageFrequency("daily");
setFeedFlakesPerBale("");
setFeedLowThreshold("");
setFeedNotes("");
};

  const closeEditLogModal = () => {
    setIsEditLogOpen(false);
    setEditingLog(null);
    setEditingLogText("");
  };

  const getContactStateByType = (typeKey) => {
    if (typeKey === "vet") return horseVet;
    if (typeKey === "farrier") return horseFarrier;
    if (typeKey === "trainer") return horseTrainer;
    if (typeKey === "dentist") return horseDentist;
    return emptyContact();
  };

  const setContactStateByType = (typeKey, value) => {
    if (typeKey === "vet") setHorseVet(value);
    if (typeKey === "farrier") setHorseFarrier(value);
    if (typeKey === "trainer") setHorseTrainer(value);
    if (typeKey === "dentist") setHorseDentist(value);
  };

  const openContactModal = (typeKey) => {
    setContactType(typeKey);

    const draftContact = getContactStateByType(typeKey);

    const editingHorse =
      mode === "edit" ? horses.find((h) => h.id === editingHorseId) : null;

    let resolvedContact = emptyContact();

    if (editingHorse) {
      const resourceId = editingHorse[`${typeKey}Id`];

      if (resourceId && resourcesById[resourceId]) {
        const resource = resourcesById[resourceId];

        resolvedContact = {
          name: resource.name || "",
          phone: resource.phone || "",
          email: resource.email || "",
          businessName: resource.businessName || "",
          address: resource.address || "",
          notes: resource.notes || "",
        };
      } else if (editingHorse[typeKey]) {
        resolvedContact = editingHorse[typeKey];
      }
    }

    setContactForm(
      hasContactData(draftContact)
        ? { ...draftContact }
        : { ...resolvedContact }
    );

    setIsContactModalOpen(true);
  };

  const closeContactModal = () => {
    setIsContactModalOpen(false);
    setContactType("vet");
    setContactForm(emptyContact());
  };

const handleSelectPhoto = async () => {
  try {
    const image = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
    });

    if (!image?.webPath) return;

    const response = await fetch(image.webPath);
    const originalBlob = await response.blob();

    const originalFile = new File(
      [originalBlob],
      `horse-photo-${Date.now()}.jpg`,
      {
        type: originalBlob.type || "image/jpeg",
      }
    );

    const compressedFile = await imageCompression(originalFile, {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1400,
      useWebWorker: true,
      initialQuality: 0.8,
    });

    const compressedBlob = new Blob([compressedFile], {
      type: compressedFile.type || "image/jpeg",
    });

    if (horsePhotoUrl && horsePhotoUrl.startsWith("blob:")) {
      URL.revokeObjectURL(horsePhotoUrl);
    }

    const previewUrl = URL.createObjectURL(compressedBlob);

    console.log("PHOTO READY:", {
      type: compressedBlob.type,
      size: compressedBlob.size,
    });

    setHorsePhotoBlob(compressedBlob);
    setHorsePhotoUrl(previewUrl);
  } catch (e) {
    console.log("PHOTO PICK ERROR:", e);
    alert("Could not select photo.");
  }
};

const handleAddReferencePhoto = async () => {
  try {
    setReferencePhotoUploading(true);

    const image = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
    });

    if (!image?.webPath) {
      setReferencePhotoUploading(false);
      return;
    }

    const response = await fetch(image.webPath);
    const originalBlob = await response.blob();

    const originalFile = new File(
      [originalBlob],
      `horse-reference-${Date.now()}.jpg`,
      {
        type: originalBlob.type || "image/jpeg",
      }
    );

    const compressedFile = await imageCompression(originalFile, {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1400,
      useWebWorker: true,
      initialQuality: 0.8,
    });

    const compressedBlob = new Blob([compressedFile], {
      type: compressedFile.type || "image/jpeg",
    });

    if (!user?.uid) {
      alert("Please log in first.");
      setReferencePhotoUploading(false);
      return;
    }

    const fileExtension =
      cleanText(compressedBlob?.type).includes("png") ? "png" : "jpg";

    const storagePath = `horse_reference_photos/${user.uid}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${fileExtension}`;

    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, compressedBlob, {
      contentType: compressedBlob.type || "image/jpeg",
    });

    const downloadUrl = await getDownloadURL(storageRef);

    setReferencePhotos((prev) => [
  ...prev,
  {
    url: downloadUrl,
    path: storagePath,
    label: "",
    note: "",
  },
]);
  } catch (e) {
    console.log("REFERENCE PHOTO ERROR:", e);
    alert("Could not add reference photo.");
  } finally {
    setReferencePhotoUploading(false);
  }
};

const handleRemoveReferencePhoto = async (photoToRemove) => {
  const confirmed = window.confirm("Remove this reference photo?");
  if (!confirmed) return;

  try {
    if (photoToRemove?.path) {
      try {
        await deleteObject(ref(storage, photoToRemove.path));
      } catch (e) {
        console.log("DELETE REFERENCE PHOTO ERROR:", e);
      }
    }

    setReferencePhotos((prev) =>
      prev.filter((photo) => photo.url !== photoToRemove.url)
    );
  } catch (e) {
    console.log("REMOVE REFERENCE PHOTO ERROR:", e);
    alert("Could not remove reference photo.");
  }
};

  const saveContactModal = () => {
    if (!contactForm.name.trim() && !contactForm.phone.trim()) {
      alert("Please add at least a name or phone number.");
      return;
    }

    setContactStateByType(contactType, {
      name: contactForm.name.trim(),
      phone: contactForm.phone.trim(),
      email: contactForm.email.trim(),
      businessName: contactForm.businessName.trim(),
      address: contactForm.address.trim(),
      notes: contactForm.notes.trim(),
    });

    closeContactModal();
  };

  const reloadHorses = async () => {
    if (!user?.uid) return;

    try {
      setHorsesStatus("Loading horses...");
      const qh = query(
        collection(db, "horses"),
        where("ownerUid", "==", user.uid)
      );
      const hsnap = await getDocs(qh);
      const hitems = hsnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setHorses(hitems);
      setHorsesStatus(hitems.length ? "" : "No horses added yet.");
    } catch (e) {
      console.log("LOAD HORSES ERROR:", e);
      setHorsesStatus("Could not load horses.");
    }
  };

  const loadResources = async () => {
    if (!user?.uid) return;

    try {
      const qr = query(
        collection(db, "saved_resources"),
        where("ownerUid", "==", user.uid)
      );

      const snap = await getDocs(qr);

      const map = {};
      snap.docs.forEach((d) => {
        map[d.id] = d.data();
      });

      setResourcesById(map);
    } catch (e) {
      console.log("LOAD RESOURCES ERROR:", e);
    }
  };

  const loadCareItems = async () => {
    if (!user?.uid) {
      setCareItems([]);
      return;
    }

    try {
      const qr = query(
        collection(db, "reminders"),
        where("ownerUid", "==", user.uid),
        where("completed", "==", false)
      );

      const snap = await getDocs(qr);
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0));

      setCareItems(items);
    } catch (e) {
      console.log("LOAD CARE ITEMS ERROR:", e);
      setCareItems([]);
    }
  };

  useEffect(() => {
    reloadHorses();
    loadCareItems();
    loadResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  useEffect(() => {
  const params = new URLSearchParams(location.search);

  const horseId = params.get("horseId");
  const shouldOpenFeedInventory =
    params.get("openFeedInventory") === "true";
    const shouldOpenLog = params.get("openLog") === "true";

  if (!horses || horses.length === 0) return;

  const selectedHorse = horses.find((h) => h.id === horseId);

  if (shouldOpenFeedInventory && selectedHorse) {
    openFeedInventory(selectedHorse);
    navigate("/horses", { replace: true });
  }
  if (shouldOpenLog && selectedHorse) {
  openLog(selectedHorse);
  navigate("/horses", { replace: true });
}

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [location.search, horses]);
useEffect(() => {
  const reopenHorseId = location.state?.reopenHorse;
  const reopenSection = location.state?.reopenSection;

  if (!reopenHorseId || !horses?.length) return;

  const horseToReopen = horses.find(
    (horse) => horse.id === reopenHorseId
  );

  if (!horseToReopen) return;

  const reopenPreviousView = async () => {
    await openView(horseToReopen);

    if (reopenSection === "caretakerHistory") {
      setViewCaretakerHistoryExpanded(true);
    }

    navigate("/horses", {
      replace: true,
      state: null,
    });
  };

  reopenPreviousView();

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [location.state, horses]);

  const openAdd = () => {
    setMode("add");
    clearForm();
    setIsOpen(true);
  };

  const openEdit = (horse) => {
    if (horsePhotoUrl && horsePhotoUrl.startsWith("blob:")) {
      URL.revokeObjectURL(horsePhotoUrl);
    }

    setMode("edit");
    setEditingHorseId(horse.id);
    setHorseName(horse.name || "");
    setHorseAge(horse.age || "");
    setHorseSex(horse.sex || "");
    setHorseFeed(horse.feed || "");
    setHorseMeds(horse.meds || "");
    setHorseMedical(horse.medicalIssues || "");
    setHorseNotes(horse.notes || "");
    setBlanketingEnabled(horse.blanketingEnabled || false);
setRainSheetEnabled(horse.rainSheetEnabled || false);
setMidweightEnabled(horse.midweightEnabled || false);
setMidweightTemp(horse.midweightTemp || "");
setHeavyweightEnabled(horse.heavyweightEnabled || false);
setHeavyweightTemp(horse.heavyweightTemp || "");
setBlanketNotes(horse.blanketNotes || "");
    setHorsePhotoUrl(horse.photoUrl || "");
setHorsePhotoBlob(null);
setReferencePhotos(Array.isArray(horse.referencePhotos) ? horse.referencePhotos : []);
setHorseVet({ ...emptyContact(), ...(horse.vet || {}) });
    setHorseFarrier({ ...emptyContact(), ...(horse.farrier || {}) });
    setHorseTrainer({ ...emptyContact(), ...(horse.trainer || {}) });
    setHorseDentist({ ...emptyContact(), ...(horse.dentist || {}) });
    setIsSavingHorse(false);
    setIsOpen(true);
  };

  const openCareModal = (horse) => {
    setCareHorse(horse);
    clearCareForm();
    setIsAddCareOpen(false);
    setIsCareOpen(true);
  };

  const loadLogsForHorse = async (horseId, itemLimit = 10) => {
    if (!user?.uid || !horseId) return [];

    try {
      const ql = query(
        collection(db, "logs"),
        where("ownerUid", "==", user.uid),
        where("horseId", "==", horseId),
        where("type", "==", "note"),
        orderBy("createdAt", "desc"),
        limit(itemLimit)
      );

      const snap = await getDocs(ql);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.log("LOAD LOGS ERROR:", e);
      return [];
    }
  };

  const loadLogHistoryForHorse = async (horseId) => {
    if (!horseId) return [];

    try {
      setLogHistoryStatusByHorseId((prev) => ({
        ...prev,
        [horseId]: "Loading logs...",
      }));

      const items = await loadLogsForHorse(horseId, 20);

      setLogHistoryByHorseId((prev) => ({
        ...prev,
        [horseId]: items,
      }));

      setLogHistoryStatusByHorseId((prev) => ({
        ...prev,
        [horseId]: items.length ? "" : "No logs yet.",
      }));

      return items;
    } catch (e) {
      console.log("LOAD LOG HISTORY ERROR:", e);
      setLogHistoryByHorseId((prev) => ({
        ...prev,
        [horseId]: [],
      }));
      setLogHistoryStatusByHorseId((prev) => ({
        ...prev,
        [horseId]: "Could not load logs.",
      }));
      return [];
    }
  };

  const loadCareHistoryForHorse = async (horseId) => {
    if (!horseId) return [];

    try {
      setCareHistoryStatusByHorseId((prev) => ({
        ...prev,
        [horseId]: "Loading care history...",
      }));

      const qc = query(
  collection(db, "care_history"),
  where("ownerUid", "==", user.uid),
  where("horseId", "==", horseId)
);

      const snap = await getDocs(qc);
      const items = snap.docs
  .map((d) => ({ id: d.id, ...d.data() }))
  .filter((item) => item.source !== "caretaker_daily_care")
  .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

      setCareHistoryByHorseId((prev) => ({
        ...prev,
        [horseId]: items,
      }));

      setCareHistoryStatusByHorseId((prev) => ({
        ...prev,
        [horseId]: items.length ? "" : "No care history yet.",
      }));

      return items;
    } catch (e) {
      console.log("LOAD CARE HISTORY ERROR:", e);
      setCareHistoryByHorseId((prev) => ({
        ...prev,
        [horseId]: [],
      }));
      setCareHistoryStatusByHorseId((prev) => ({
        ...prev,
        [horseId]: "Could not load care history.",
      }));
      return [];
    }
  };

  const loadCaretakerHistoryForHorse = async (horseId) => {
  if (!horseId) return [];

  try {
    setCaretakerHistoryStatusByHorseId((prev) => ({
      ...prev,
      [horseId]: "Loading caretaker history...",
    }));

    const qc = query(
      collection(db, "care_history"),
      where("ownerUid", "==", user.uid),
      where("horseId", "==", horseId)
    );

    const snap = await getDocs(qc);

    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((item) => item.source === "caretaker_daily_care")
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

    setCaretakerHistoryByHorseId((prev) => ({
      ...prev,
      [horseId]: items,
    }));

    setCaretakerHistoryStatusByHorseId((prev) => ({
      ...prev,
      [horseId]: items.length ? "" : "No caretaker history yet.",
    }));

    return items;
  } catch (e) {
    console.log("LOAD CARETAKER HISTORY ERROR:", e);

    setCaretakerHistoryByHorseId((prev) => ({
      ...prev,
      [horseId]: [],
    }));

    setCaretakerHistoryStatusByHorseId((prev) => ({
      ...prev,
      [horseId]: "Could not load caretaker history.",
    }));

    return [];
  }
};

  const openEditLog = (log) => {
    setEditingLog(log);
    setEditingLogText(log.text || "");
    setIsEditLogOpen(true);
  };

  const saveEditedLog = async () => {
    if (!editingLog?.id) {
      alert("No log selected.");
      return;
    }

    if (!editingLogText.trim()) {
      alert("Please enter a log note.");
      return;
    }

    try {
      await updateDoc(doc(db, "logs", editingLog.id), {
        text: editingLogText.trim(),
        updatedAt: Date.now(),
      });

      await loadLogHistoryForHorse(editingLog.horseId);
      closeEditLogModal();
    } catch (e) {
      console.log("UPDATE LOG ERROR:", e);
      alert("Failed to update log.");
    }
  };

  const deleteLog = async (log) => {
    if (!log?.id) return;

    const confirmed = window.confirm("Delete this log?");
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "logs", log.id));
      await loadLogHistoryForHorse(log.horseId);
    } catch (e) {
      console.log("DELETE LOG ERROR:", e);
      alert("Failed to delete log.");
    }
  };

  const deleteCareHistoryEntry = async (item) => {
  if (!item?.id) return;

  const confirmed = window.confirm("Delete this history entry?");
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "care_history", item.id));

    if (item.horseId) {
      await loadCareHistoryForHorse(item.horseId);
      await loadCaretakerHistoryForHorse(item.horseId);
    }
  } catch (e) {
    console.log("DELETE CARE HISTORY ENTRY ERROR:", e);
    alert("Failed to delete history entry.");
  }
};

  const loadSickWatchEntriesForHorse = async (horseId) => {
    if (!horseId) {
      setHorseLexSickWatchEntries([]);
      setHorseLexSickWatchStatus("");
      return [];
    }

    try {
      setHorseLexSickWatchStatus("Loading Sick Watch history...");

      const qs = query(
        collection(db, "sickwatch"),
        where("horseId", "==", horseId),
        orderBy("createdAt", "desc"),
        limit(12)
      );

      const snap = await getDocs(qs);
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      setHorseLexSickWatchEntries(items);
      setHorseLexSickWatchStatus(items.length ? "" : "No Sick Watch entries.");
      return items;
    } catch (e) {
      console.log("LOAD SICK WATCH FOR LEX ERROR:", e);
      setHorseLexSickWatchEntries([]);
      setHorseLexSickWatchStatus("Could not load Sick Watch history.");
      return [];
    }
  };

  const loadSickWatchArchiveForHorse = async (horseId) => {
    if (!horseId) return [];

    try {
      setArchiveStatusByHorseId((prev) => ({
        ...prev,
        [horseId]: "Loading Sick Watch history...",
      }));

      const qs = query(
        collection(db, "sickwatch_archive"),
        where("horseId", "==", horseId),
        orderBy("endedAt", "desc")
      );

      const snap = await getDocs(qs);
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      setArchiveByHorseId((prev) => ({
        ...prev,
        [horseId]: items,
      }));

      setArchiveStatusByHorseId((prev) => ({
        ...prev,
        [horseId]: items.length ? "" : "No Sick Watch history yet.",
      }));

      return items;
    } catch (e) {
      console.log("LOAD SICK WATCH ARCHIVE ERROR:", e);
      setArchiveByHorseId((prev) => ({
        ...prev,
        [horseId]: [],
      }));
      setArchiveStatusByHorseId((prev) => ({
        ...prev,
        [horseId]: "Could not load Sick Watch history.",
      }));
      return [];
    }
  };

  const openLog = (horse) => {
    setLogHorse(horse);
    setLogText("");
    setIsLogOpen(true);
  };

  const closeLog = () => {
    setIsLogOpen(false);
    setLogHorse(null);
    setLogText("");
  };

  const saveLog = async () => {
    if (!user?.uid) {
      alert("Please log in first.");
      return;
    }

    if (!logHorse?.id) {
      alert("No horse selected to log.");
      return;
    }

    if (!logText.trim()) {
      alert("Please type a log note.");
      return;
    }

    try {
      await addDoc(collection(db, "logs"), {
        ownerUid: user.uid,
        horseId: logHorse.id,
        text: logText.trim(),
        type: "note",
        tags: [],
        amount: null,
        createdAt: Date.now(),
      });

      await updateDoc(doc(db, "horses", logHorse.id), {
        updatedAt: Date.now(),
      });

      await reloadHorses();
      await loadLogHistoryForHorse(logHorse.id);
      setLogHistoryExpandedByHorseId((prev) => ({
        ...prev,
        [logHorse.id]: true,
      }));
      setActiveHorseId(logHorse.id);
      closeLog();
    } catch (e) {
      console.log("SAVE LOG ERROR:", e);
      alert("Failed to save log.");
    }
  };

  const loadFeedInventory = async (horseId) => {
  if (!horseId) return;

  try {
    setFeedInventoryStatus("Loading feed inventory...");

    const qFeed = query(
  collection(db, "feed_inventory"),
  where("horseId", "==", horseId)
);


const snap = await getDocs(qFeed);

    const items = snap.docs
  .map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }))
  .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    setFeedInventoryItems(items);

    if (items.length === 0) {
      setFeedInventoryStatus("No feed inventory yet.");
    } else {
      setFeedInventoryStatus("");
    }
  } catch (e) {
    console.log("LOAD FEED INVENTORY ERROR:", e);
    setFeedInventoryStatus("Could not load feed inventory.");
  }
};

const editFeedInventoryItem = (item) => {
  if (!item) return;
  setIsFeedFormOpen(true);

  setEditingFeedItemId(item.id);
  setFeedItemType(item.itemType || "Hay");
  setFeedItemName(item.itemName || "");

  setFeedQuantity(
    item.currentQuantity != null ? String(item.currentQuantity) : ""
  );

  setFeedUnit(item.unit || "bales");

  setFeedDailyUse(
    item.dailyUse != null ? String(item.dailyUse) : ""
  );

  setFeedDailyUseUnit(item.dailyUseUnit || item.unit || "bales");
  setFeedUsageFrequency(item.usageFrequency || "daily");

  setFeedFlakesPerBale(
    item.flakesPerBale != null ? String(item.flakesPerBale) : ""
  );

  setFeedLowThreshold(
    item.lowThresholdDays != null ? String(item.lowThresholdDays) : ""
  );

  setFeedNotes(item.notes || "");

  setTimeout(() => {
    const input = document.querySelector('[placeholder="Feed Item Name"]');
    if (input) {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      input.focus();
    }
  }, 100);
};

  
const deleteFeedInventoryItem = async (itemId) => {
  if (!itemId) return;

  const confirmed = window.confirm("Delete this feed item?");
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "feed_inventory", itemId));

    if (feedInventoryHorse?.id) {
      await loadFeedInventory(feedInventoryHorse.id);
      setIsFeedFormOpen(false);
setEditingFeedItemId(null);
    }
  } catch (e) {
    console.log("DELETE FEED INVENTORY ERROR:", e);
    alert("Failed to delete feed item.");
  }
};

  const saveFeedInventoryItem = async () => {
  if (!user?.uid) {
    alert("Please log in first.");
    return;
  }

  if (!feedInventoryHorse?.id) {
    alert("No horse selected.");
    return;
  }

  if (!feedItemName.trim()) {
    alert("Please enter a feed item name.");
    return;
  }

  const quantityNumber = Number(feedQuantity);
  const dailyUseNumber = Number(feedDailyUse);
  const lowThresholdNumber = Number(feedLowThreshold);

  if (Number.isNaN(quantityNumber) || quantityNumber < 0) {
    alert("Please enter a valid current quantity.");
    return;
  }

  if (Number.isNaN(dailyUseNumber) || dailyUseNumber <= 0) {
    alert("Please enter a valid daily use amount.");
    return;
  }

  const estimatedDaysRemaining =
  dailyUseNumber > 0
    ? Math.floor(quantityNumber / dailyUseNumber)
    : null;

const estimatedDepletionDate =
  estimatedDaysRemaining != null
    ? Date.now() + estimatedDaysRemaining * 86400000
    : null;

  try {
    if (editingFeedItemId) {
  await updateDoc(doc(db, "feed_inventory", editingFeedItemId), {
  itemType: feedItemType,
  itemName: feedItemName.trim(),
  currentQuantity: quantityNumber,
  unit: feedUnit,
  dailyUse: dailyUseNumber,
  dailyUseUnit: feedDailyUseUnit,
  usageFrequency: feedUsageFrequency,
  flakesPerBale: feedFlakesPerBale || null,
  lowThresholdDays: Number.isNaN(lowThresholdNumber)
    ? null
    : lowThresholdNumber,
  estimatedDaysRemaining,
estimatedDepletionDate,
quantityUpdatedAt: Date.now(),

  // reset warning if user refilled inventory
  lowFeedPushSent:
    estimatedDaysRemaining >
    (Number.isNaN(lowThresholdNumber)
      ? 3
      : lowThresholdNumber)
      ? false
      : true,

  notes: feedNotes.trim(),
  updatedAt: Date.now(),
});
} else {
  await addDoc(collection(db, "feed_inventory"), {
      ownerUid: user.uid,
      horseId: feedInventoryHorse.id,
      horseName: feedInventoryHorse.name || "Unnamed",
      itemType: feedItemType,
      itemName: feedItemName.trim(),
      currentQuantity: quantityNumber,
      unit: feedUnit,
      dailyUse: dailyUseNumber,
dailyUseUnit: feedDailyUseUnit,
usageFrequency: feedUsageFrequency,
flakesPerBale: feedFlakesPerBale || null,
lowThresholdDays: Number.isNaN(lowThresholdNumber)
  ? 3
  : lowThresholdNumber,
estimatedDaysRemaining,
estimatedDepletionDate,
quantityUpdatedAt: Date.now(),
lowFeedPushSent: false,
refillQuantity: feedItemType === "Hay" ? null : quantityNumber,
notes: feedNotes.trim(),
createdAt: Date.now(),
updatedAt: Date.now(),
    });
  }

  

    alert("Feed item saved.");
    await loadFeedInventory(feedInventoryHorse.id);

    setFeedItemType("Hay");
    setFeedItemName("");
    setFeedQuantity("");
    setFeedUnit("bags");
setFeedDailyUse("");
setFeedDailyUseUnit("bags");
setFeedUsageFrequency("daily");
setFeedFlakesPerBale("");
setFeedLowThreshold("");
setFeedNotes("");
setEditingFeedItemId(null);
setIsFeedFormOpen(false);
  } catch (e) {
    console.log("SAVE FEED INVENTORY ERROR:", e);
    alert("Failed to save feed item.");
  }
};

  const saveCareItem = async () => {
    if (!user?.uid) {
      alert("Please log in first.");
      return false;
    }

    if (!careHorse?.id) {
      alert("No horse selected.");
      return false;
    }

    if (!careDate) {
      alert("Please choose a due date.");
      return false;
    }

    const dueDateMs = new Date(`${careDate}T12:00:00`).getTime();

    if (Number.isNaN(dueDateMs)) {
      alert("Please enter a valid date.");
      return false;
    }

   try {
  const savedCareRef = await addDoc(collection(db, "reminders"), {
    ownerUid: user.uid,
    horseId: careHorse.id,
    horseName: careHorse.name || "Unnamed",
    type: careType,
    title: careTitle.trim() || careType,
    dueDate: dueDateMs,
    time: careTime || "",
    repeatInterval,
    alertTiming,
    notes: careNotes.trim(),
    completed: false,
    createdAt: Date.now(),
  });

try {
  console.log("CARE PUSH BLOCK STARTED");
  const userSnap = await getDoc(doc(db, "users", user.uid));
  const userData = userSnap.exists() ? userSnap.data() : null;

  console.log("CARE PUSH DEBUG:", {
  hasUserData: !!userData,
  hasPushToken: !!userData?.pushToken,
  apiBaseUrl: API_BASE_URL,
});

  if (userData?.pushToken) {
    await fetch(`${API_BASE_URL}/send-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: userData.pushToken,
        title: "Care Reminder Added",
        body: `${careTitle.trim() || careType} is scheduled for ${careHorse.name || "your horse"}.`,
        data: {
          type: "care_added",
          horseId: careHorse.id,
          reminderId: savedCareRef.id,
        },
      }),
    });
  }
} catch (pushErr) {
  console.log("CARE PUSH ERROR:", pushErr);
}

      await loadCareItems();
      clearCareForm();
      return true;
    } catch (e) {
      console.log("SAVE CARE ITEM ERROR:", e);
      alert("Failed to save care item.");
      return false;
    }
  };

  const deleteCareItem = async (careId) => {
    if (!careId) return;

    const confirmed = window.confirm("Delete this care item?");
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "reminders", careId));
      await loadCareItems();
    } catch (e) {
      console.log("DELETE CARE ITEM ERROR:", e);
      alert("Failed to delete care item.");
    }
  };

  const startSickWatch = async (horseId) => {
    if (!user?.uid || !horseId) return;

    try {
      await updateDoc(doc(db, "horses", horseId), {
        sickWatchOn: true,
        sickWatchStartedAt: Date.now(),
        updatedAt: Date.now(),
      });

      await reloadHorses();
      setActiveHorseId(horseId);
    } catch (e) {
      console.log("START SICK WATCH ERROR:", e);
      alert("Failed to start Sick Watch.");
    }
  };

  const handleDeleteHorse = async () => {
    if (!editingHorseId) {
      alert("No horse selected to delete.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this horse profile?"
    );
    if (!confirmed) return;

    try {
      const existingHorse = horses.find((h) => h.id === editingHorseId);

      if (existingHorse?.photoPath) {
        try {
          await deleteObject(ref(storage, existingHorse.photoPath));
        } catch (storageErr) {
          console.log("DELETE HORSE PHOTO ERROR:", storageErr);
        }
      }

      await deleteDoc(doc(db, "horses", editingHorseId));

      if (activeHorseId === editingHorseId) {
        setActiveHorseId("");
      }

      await reloadHorses();
      closeModal();
    } catch (e) {
      console.log("DELETE HORSE ERROR:", e);
      alert("Failed to delete horse.");
    }
  };

  const saveHorse = async () => {
  if (!user?.uid) {
    alert("Please log in first.");
    return;
  }

  if (isOffline()) {
  alert("You're offline. New horse changes can't be saved right now.");
  return;
}

  if (!horseName.trim()) {
    alert("Please enter a horse name.");
    return;
  }

  if (!horseSex) {
    alert("Please select sex.");
    return;
  }

  const existingHorse =
    mode === "edit" ? horses.find((h) => h.id === editingHorseId) : null;

  setIsSavingHorse(true);

  try {
    let finalPhotoUrl = cleanText(existingHorse?.photoUrl);
    let finalPhotoPath = cleanText(existingHorse?.photoPath);

    if (horsePhotoBlob) {
      try {
        const fileExtension =
          cleanText(horsePhotoBlob?.type).includes("png") ? "png" : "jpg";

        const storagePath = `horse_photos/${user.uid}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${fileExtension}`;

        const storageRef = ref(storage, storagePath);

        const uploadBlob =
          horsePhotoBlob instanceof Blob
            ? horsePhotoBlob
            : new Blob([horsePhotoBlob], { type: "image/jpeg" });

        await uploadBytes(storageRef, uploadBlob, {
          contentType: uploadBlob.type || "image/jpeg",
        });

        finalPhotoUrl = await getDownloadURL(storageRef);
        finalPhotoPath = storagePath;

        console.log("HORSE PHOTO UPLOAD SUCCESS", {
          finalPhotoUrl,
          finalPhotoPath,
        });
      } catch (uploadErr) {
        console.log("HORSE PHOTO UPLOAD ERROR:", uploadErr);
        alert("Photo upload failed.");
        setIsSavingHorse(false);
        return;
      }
    }

    const horsePayload = {
      name: cleanText(horseName),
      sex: cleanText(horseSex),
      age: cleanText(horseAge),
      feed: cleanText(horseFeed),
      meds: cleanText(horseMeds),
      medicalIssues: cleanText(horseMedical),
      notes: cleanText(horseNotes),
      blanketingEnabled,
rainSheetEnabled,
midweightEnabled,
midweightTemp: cleanText(midweightTemp),
heavyweightEnabled,
heavyweightTemp: cleanText(heavyweightTemp),
blanketNotes: cleanText(blanketNotes),
      photoUrl: cleanText(finalPhotoUrl),
      photoPath: cleanText(finalPhotoPath),
      referencePhotos,
      vet: normalizeContact(horseVet),
      farrier: normalizeContact(horseFarrier),
      trainer: normalizeContact(horseTrainer),
      dentist: normalizeContact(horseDentist),
      vetId: existingHorse?.vetId ?? null,
      farrierId: existingHorse?.farrierId ?? null,
      trainerId: existingHorse?.trainerId ?? null,
      dentistId: existingHorse?.dentistId ?? null,
      updatedAt: Date.now(),
    };

    console.log("HORSE PAYLOAD READY:", horsePayload);

    if (mode === "add") {
      await addDoc(collection(db, "horses"), {
  ownerUid: user.uid,
  caretakerUids: [],
  ...horsePayload,
  sickWatchOn: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
    } else {
      if (!editingHorseId) {
        alert("No horse selected to edit.");
        setIsSavingHorse(false);
        return;
      }

      await updateDoc(doc(db, "horses", editingHorseId), horsePayload);

      if (
        horsePhotoBlob &&
        existingHorse?.photoPath &&
        existingHorse.photoPath !== finalPhotoPath
      ) {
        try {
          await deleteObject(ref(storage, existingHorse.photoPath));
        } catch (deleteErr) {
          console.log("OLD HORSE PHOTO DELETE ERROR:", deleteErr);
        }
      }
    }

    await reloadHorses();
    closeModal();
  } catch (e) {
    console.log("SAVE HORSE ERROR:", e);
    alert(mode === "add" ? "Failed to add horse." : "Failed to update horse.");
  } finally {
    setIsSavingHorse(false);
  }
};

  const openHorseLex = async (horse) => {
    setHorseLexHorse(horse);
    setHorseLexQuestion("");
    setHorseLexAnswer("");
    setHorseLexLoading(false);
    setHorseLexSickWatchEntries([]);
    setHorseLexSickWatchStatus("");
    setHorseLexLogs([]);
    setIsHorseLexOpen(true);

    if (horse?.id) {
      setActiveHorseId(horse.id);
      const loadedLogs = await loadLogsForHorse(horse.id);
      setHorseLexLogs(loadedLogs);
      await loadSickWatchEntriesForHorse(horse.id);
    }
  };

  const closeHorseLex = () => {
    setIsHorseLexOpen(false);
    setHorseLexHorse(null);
    setHorseLexQuestion("");
    setHorseLexAnswer("");
    setHorseLexLoading(false);
    setHorseLexLogs([]);
    setHorseLexSickWatchEntries([]);
    setHorseLexSickWatchStatus("");
  };

  const buildHorseLexPrompt = () => {
    if (!horseLexHorse) return "";

    const recentLogsText = horseLexLogs.length
      ? horseLexLogs
          .map((l) => {
            return `${
              l.createdAt ? new Date(l.createdAt).toLocaleString() : "Unknown time"
            } | Note | ${l.text || ""}`;
          })
          .join("\n")
      : "No recent logs.";

    const sickWatchText = horseLexSickWatchEntries.length
      ? horseLexSickWatchEntries
          .map((entry) => {
            const parts = [];
            if (entry.createdAt)
              parts.push(new Date(entry.createdAt).toLocaleString());
            if (entry.temperature) parts.push(`Temp: ${entry.temperature}`);
            if (entry.manure) parts.push(`Manure: ${entry.manure}`);
            if (entry.urine) parts.push(`Urine: ${entry.urine}`);
            if (entry.water) parts.push(`Water: ${entry.water}`);
            if (entry.appetite) parts.push(`Appetite: ${entry.appetite}`);
            if (entry.symptoms) parts.push(`Symptoms: ${entry.symptoms}`);
            if (entry.medication) parts.push(`Medication: ${entry.medication}`);
            if (entry.notes) parts.push(`Notes: ${entry.notes}`);
            return parts.join(" | ");
          })
          .join("\n")
      : horseLexSickWatchStatus || "No Sick Watch entries.";

    return [
      "You are Lex, an equine care assistant.",
      "Answer using the horse data below plus your general horse knowledge.",
      "Be practical, clear, and grounded.",
      "Do not claim certainty if you are not certain.",
      "If the situation sounds urgent, say so clearly.",
      "Reference the horse context naturally in your answer when relevant.",
      "",
      `Horse Name: ${horseLexHorse.name || "Unnamed"}`,
      `Age: ${horseLexHorse.age || "Unknown"}`,
      `Sex: ${horseLexHorse.sex || "Unknown"}`,
      `Feed: ${horseLexHorse.feed || "None listed"}`,
      `Meds: ${horseLexHorse.meds || "None listed"}`,
      `Medical Issues: ${horseLexHorse.medicalIssues || "None listed"}`,
      `Notes: ${horseLexHorse.notes || "None listed"}`,
      `Sick Watch Active: ${horseLexHorse.sickWatchOn ? "Yes" : "No"}`,
      "",
      "Recent Logs:",
      recentLogsText,
      "",
      "Sick Watch Entries:",
      sickWatchText,
      "",
      `User Question: ${horseLexQuestion.trim()}`,
    ].join("\n");
  };

  const handleAskHorseLex = async () => {
    if (!horseLexQuestion.trim()) {
      alert("Type a question first.");
      return;
    }

    if (!horseLexHorse) {
      alert("No horse selected.");
      return;
    }

    setHorseLexLoading(true);
    setHorseLexAnswer("");

    try {
      if (typeof onAsk === "function") {
        const result = await onAsk(buildHorseLexPrompt());

        if (typeof result === "string") {
          setHorseLexAnswer(result);
        } else if (result?.answer) {
          setHorseLexAnswer(result.answer);
        } else {
          setHorseLexAnswer("Lex did not return an answer.");
        }
      } else {
        setHorseLexAnswer("Ask Lex is not connected yet.");
      }
    } catch (e) {
      console.log("HORSE ASK LEX ERROR:", e);
      setHorseLexAnswer("Something went wrong while asking Lex.");
    } finally {
      setHorseLexLoading(false);
    }
  };

  const copyHorseLexAnswer = async () => {
    if (!horseLexAnswer) return;

    try {
      await navigator.clipboard.writeText(horseLexAnswer);
      alert("Answer copied.");
    } catch (e) {
      console.log("COPY HORSE LEX ANSWER ERROR:", e);
      alert("Could not copy answer.");
    }
  };

  const closeArchiveModal = () => {
    setArchiveModalCase(null);
  };

  const copyArchiveSummary = async () => {
    if (!archiveModalCase?.summaryText) return;

    try {
      await navigator.clipboard.writeText(archiveModalCase.summaryText);
      alert("Summary copied.");
    } catch (e) {
      console.log("COPY ARCHIVE SUMMARY ERROR:", e);
      alert("Could not copy summary.");
    }
  };

  const sendArchiveSummary = async () => {
    if (!archiveModalCase?.summaryText) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${archiveModalCase.horseName || "Horse"} Sick Watch Summary`,
          text: archiveModalCase.summaryText,
        });
        return;
      }

      await navigator.clipboard.writeText(archiveModalCase.summaryText);
      alert("Summary copied. You can paste it into text or email.");
    } catch (e) {
      console.log("SEND ARCHIVE SUMMARY ERROR:", e);
      alert("Could not send summary.");
    }
  };

  const deleteArchiveItem = async (archiveId, horseId) => {
    if (!archiveId) return;

    const confirmed = window.confirm("Delete this Sick Watch summary?");
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "sickwatch_archive", archiveId));
      await loadSickWatchArchiveForHorse(horseId);
    } catch (e) {
      console.log("DELETE ARCHIVE ERROR:", e);
      alert("Failed to delete summary.");
    }
  };

  const buildHorseCareShareText = (horse) => {
  if (!horse) return "";

  const sections = [];

  sections.push(`Horse Care Instructions`);
  sections.push(``);

  sections.push(`Name: ${horse.name || "—"}`);
  sections.push(`Age: ${horse.age || "—"}`);
  sections.push(`Sex: ${horse.sex || "—"}`);
  sections.push(``);

  sections.push(`Feed Instructions:`);
  sections.push(horse.feed || "—");
  sections.push(``);

  sections.push(`Medications:`);
  sections.push(horse.meds || "—");
  sections.push(``);

  sections.push(`Medical Issues:`);
  sections.push(horse.medicalIssues || "—");
  sections.push(``);

  sections.push(`Notes:`);
  sections.push(horse.notes || "—");
  sections.push(``);

  CONTACT_TYPES.forEach((contactItem) => {
    const contact = getResolvedContact(horse, contactItem.key);

    if (!hasContactData(contact)) return;

    sections.push(`${contactItem.label}:`);
    sections.push(`Name: ${contact.name || "—"}`);
    sections.push(`Phone: ${contact.phone || "—"}`);
    sections.push(`Email: ${contact.email || "—"}`);
    sections.push(`Business: ${contact.businessName || "—"}`);
    sections.push(`Address: ${contact.address || "—"}`);
    sections.push(`Notes: ${contact.notes || "—"}`);
    sections.push(``);
  });

  if (Array.isArray(horse.referencePhotos) && horse.referencePhotos.length > 0) {
  sections.push(`Reference Photos:`);
  sections.push(`${horse.referencePhotos.length} photo(s) attached.`);

  horse.referencePhotos.forEach((photo, index) => {
    const hasLabel = !!String(photo.label || "").trim();
    const hasNote = !!String(photo.note || "").trim();

    if (hasLabel || hasNote) {
      sections.push(`Photo ${index + 1}:`);

      if (hasLabel) {
        sections.push(`Label: ${photo.label}`);
      }

      if (hasNote) {
        sections.push(`Note: ${photo.note}`);
      }
    }
  });

  sections.push(``);
}

  return sections.join("\n");
};

const prepareReferencePhotosForShare = async (horse) => {
  if (!Array.isArray(horse?.referencePhotos) || horse.referencePhotos.length === 0) {
    console.log("HORSE SHARE: no reference photos");
    return [];
  }

  const fileUris = [];

  for (let i = 0; i < horse.referencePhotos.length; i += 1) {
    const photo = horse.referencePhotos[i];
    if (!photo?.url) continue;

    try {
      const safeHorseName = String(horse.name || "horse")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-");

      const fileName = `${safeHorseName}-reference-${i + 1}.jpg`;

      const downloadResult = await Filesystem.downloadFile({
        url: photo.url,
        path: fileName,
        directory: Directory.Cache,
      });

      console.log("HORSE SHARE: downloaded file", downloadResult.path);

      const uriResult = await Filesystem.getUri({
        path: fileName,
        directory: Directory.Cache,
      });

      console.log("HORSE SHARE: uri", uriResult.uri);
      fileUris.push(uriResult.uri);
    } catch (err) {
      console.log("HORSE SHARE: photo prep failed", err);
      throw err;
    }
  }

  console.log("HORSE SHARE FILE URIS:", fileUris);
  return fileUris;
};

const prepareHorseCareTextFileForShare = async (horse) => {
  const shareText = buildHorseCareShareText(horse);

  if (!shareText) return null;

  const safeHorseName = String(horse.name || "horse")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-");

  const fileName = `${safeHorseName}-care-instructions.txt`;

  await Filesystem.writeFile({
    path: fileName,
    data: shareText,
    directory: Directory.Cache,
    encoding: "utf8",
    recursive: true,
  });

  const uriResult = await Filesystem.getUri({
    path: fileName,
    directory: Directory.Cache,
  });

  return uriResult.uri;
};

const shareHorseCareInstructions = async (horse) => {
  const shareText = buildHorseCareShareText(horse);

  if (!shareText) {
    alert("No horse information available to share.");
    return;
  }

  try {
    const textFileUri = await prepareHorseCareTextFileForShare(horse);
    const photoFileUris = await prepareReferencePhotosForShare(horse);

    const filesToShare = [
      ...(textFileUri ? [textFileUri] : []),
      ...photoFileUris,
    ];

    console.log("HORSE SHARE FILES:", filesToShare);

    const canShare = await Share.canShare();
    console.log("HORSE SHARE CAN SHARE:", canShare);

    if (filesToShare.length > 0) {
      await Share.share({
        title: `${horse?.name || "Horse"} Care Instructions`,
        files: filesToShare,
        dialogTitle: "Share Horse Care Instructions",
      });
      return;
    }

    await Share.share({
      title: `${horse?.name || "Horse"} Care Instructions`,
      text: shareText,
      dialogTitle: "Share Horse Care Instructions",
    });
  } catch (e) {
    console.log("SHARE HORSE CARE ERROR:", e);

    try {
      await navigator.clipboard.writeText(shareText);
      alert("Could not attach files. Care instructions copied instead.");
    } catch {
      alert("Could not share care instructions.");
    }
  }
};

const emailHorseCareInstructions = async (horse) => {
  try {
    const shareText = buildHorseCareShareText(horse);

    if (!shareText) {
      alert("No horse information available to email.");
      return;
    }

    const attachmentUris = await prepareReferencePhotosForShare(horse);

    const attachments = attachmentUris.map((uri) => ({
  type: "absolute",
  path: String(uri).replace("file://", ""),
}));

    const hasAccount = await EmailComposer.hasAccount();

    if (!hasAccount?.hasAccount) {
      alert("No mail account is set up on this device.");
      return;
    }

    await EmailComposer.open({
      subject: `${horse?.name || "Horse"} Care Instructions`,
      body: shareText,
      isHtml: false,
      attachments,
    });
  } catch (e) {
    console.log("EMAIL SHARE ERROR:", e);
    alert("Could not open email.");
  }
};

const textHorseCareInstructions = async (horse) => {
  try {
    const shareText = buildHorseCareShareText(horse);

    if (!shareText) {
      alert("No horse information available to text.");
      return;
    }

    const photoUris = await prepareReferencePhotosForShare(horse);

    await TextMessageComposer.compose({
      body: shareText,
      recipients: [],
      attachments: photoUris || [],
    });
  } catch (e) {
  console.log("TEXT SHARE ERROR:", e);
  alert(`Could not open text message: ${JSON.stringify(e)}`);
}
};

  const careSummaryByHorseId = useMemo(() => {
    const map = {};

    horses.forEach((horse) => {
      const horseCareItems = careItems.filter(
        (item) => item.horseId === horse.id && !item.completed
      );

      const overdue = horseCareItems.filter((item) => {
        const daysUntil = getDaysUntil(item.dueDate);
        return daysUntil != null && daysUntil < 0;
      });

      const upcoming = horseCareItems.filter((item) => {
        const daysUntil = getDaysUntil(item.dueDate);
        return daysUntil != null && daysUntil >= 0 && daysUntil <= 7;
      });

      map[horse.id] = {
        overdueCount: overdue.length,
        upcomingCount: upcoming.length,
      };
    });

    return map;
  }, [horses, careItems]);

  const getHorseStatusPills = (horse) => {
    const pills = [];

    if (horse?.sickWatchOn) {
      pills.push({
        key: "sickwatch",
        text: "Sick Watch Active",
        background: "#F2E8E7",
        color: burgundy,
        onClick: () => navigate(`/sick-watch?horseId=${horse.id}`),
      });
    }

    const summary = careSummaryByHorseId[horse?.id];

    if (summary?.overdueCount > 0) {
      pills.push({
        key: "care-overdue",
        text:
          summary.overdueCount === 1
            ? "Care Overdue"
            : `${summary.overdueCount} Care Items Overdue`,
        background: "#F2E8E7",
        color: burgundy,
        onClick: () => navigate(`/care?horseId=${horse.id}`),
      });
    } else if (summary?.upcomingCount > 0) {
      pills.push({
        key: "care-upcoming",
        text:
          summary.upcomingCount === 1
            ? "Upcoming Care"
            : `${summary.upcomingCount} Upcoming Care Items`,
        background: "#F5EEDB",
        color: "#6E5A36",
        onClick: () => navigate(`/care?horseId=${horse.id}`),
      });
    }

    return pills;
  };

  const careItemsForActiveHorse = useMemo(() => {
    if (!careHorse?.id) return [];
    return careItems.filter((item) => item.horseId === careHorse.id);
  }, [careItems, careHorse]);

  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 100 }}>
      <div style={{ paddingTop: 8 }}>
        <div
          style={{
            fontSize: 44,
            lineHeight: 1,
            fontWeight: 600,
            letterSpacing: "-0.03em",
            color: navy,
          }}
        >
          Horses
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <button
          onClick={openAdd}
          style={{
            width: "100%",
            border: `1px solid ${navyBorder}`,
            borderRadius: 20,
            padding: "18px 20px",
            background: "linear-gradient(180deg, #2E3F5D 0%, #24324A 100%)",
            color: "#FFFFFF",
            fontWeight: 600,
            fontSize: 18,
            cursor: "pointer",
            boxShadow: panelShadow,
            letterSpacing: "-0.01em",
          }}
        >
          + Add Horse
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        {horsesStatus ? (
          <div
            className="card"
            style={{
              padding: 18,
              color: secondaryText,
              borderRadius: 22,
              border: `1px solid ${borderColor}`,
              background: "#FFFFFF",
              boxShadow: cardShadow,
            }}
          >
            {horsesStatus}
          </div>
        ) : horses.length === 0 ? (
          <div
            className="card"
            style={{
              padding: 18,
              color: secondaryText,
              borderRadius: 22,
              border: `1px solid ${borderColor}`,
              background: "#FFFFFF",
              boxShadow: cardShadow,
            }}
          >
            No horses added yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {[...horses]
              .sort((a, b) =>
                (a.name || "").localeCompare(b.name || "", undefined, {
                  sensitivity: "base",
                })
              )
              .map((h) => {
                const statusPills = getHorseStatusPills(h);

                return (
                  <div
                    key={h.id}
                    className="card"
                    style={{
                      padding: 0,
                      overflow: "hidden",
                      borderRadius: 22,
                      border: `1px solid ${borderColor}`,
                      background: "#FFFFFF",
                      boxShadow: cardShadow,
                    }}
                  >
                    <div
                      style={{
                        padding: 20,
                        position: "relative",
                        background: "#FFFFFF",
                      }}
                    >
                      {statusPills.length > 0 ? (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                            marginBottom: 14,
                          }}
                        >
                          {statusPills.map((pill) => (
                            <div
                              key={pill.key}
                              onClick={pill.onClick}
                              style={{
                                background: pill.background,
                                color: pill.color,
                                fontSize: 13,
                                fontWeight: 600,
                                padding: "8px 12px",
                                borderRadius: 999,
                                cursor: "pointer",
                              }}
                            >
                              {pill.text}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 14,
                          marginTop: 0,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 28,
                              lineHeight: 1.08,
                              fontWeight: 600,
                              color: primaryText,
                              wordBreak: "break-word",
                              letterSpacing: "-0.02em",
                            }}
                          >
                            {h.name || "Unnamed"}
                          </div>

                          <div
                            style={{
                              marginTop: 8,
                              fontSize: 16,
                              color: secondaryText,
                            }}
                          >
                            {h.age ? `${h.age} years old` : "Age —"} ·{" "}
                            {h.sex ? h.sex : "Sex —"}
                          </div>
                        </div>

                        <div
                          style={{
                            width: 110,
height: 110,
borderRadius: "50%",
                            overflow: "hidden",
                            background: "#EAE7DF",
                            flexShrink: 0,
                            border: `1px solid ${borderColor}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
                          }}
                        >
                          {h.photoUrl && !failedHorseImages[h.id] ? (
                            <img
                              src={h.photoUrl}
                              alt={h.name || "Horse"}
                              onError={() =>
                                setFailedHorseImages((prev) => ({
                                  ...prev,
                                  [h.id]: true,
                                }))
                              }
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                fontSize: 11,
                                color: secondaryText,
                                textAlign: "center",
                                padding: 6,
                                lineHeight: 1.2,
                              }}
                            >
                              No Photo
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                          marginTop: 14,
marginBottom: 14,
                        }}
                      >
                        <button
                          className="small-button"
                          onClick={() => {
                            setActiveHorseId(h.id);
                            openView(h);
                          }}
                        >
                          View
                        </button>

                        <button
  className="small-button"
  onClick={() => navigate(`/daily-care/${h.id}`)}
>
  Daily Care Plan
</button>

                        <button
                          className="small-button"
                          onClick={() => {
                            setActiveHorseId(h.id);
                            openEdit(h);
                          }}
                        >
                          Edit
                        </button>
                      </div>

                      

                      <div
  style={{
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 0,
}}
>
  <button
    onClick={() => openLog(h)}
    style={{
      border: `1px solid ${borderColor}`,
      borderRadius: 15,
      padding: "14px 16px",
      background: softBg,
      color: "#6C6254",
      fontWeight: 500,
      fontSize: 16,
      cursor: "pointer",
    }}
  >
    Log
  </button>

  <button
    onClick={() => navigate(`/care?horseId=${h.id}`)}
    style={{
      border: `1px solid ${borderColor}`,
      borderRadius: 15,
      padding: "14px 16px",
      background: softBg,
      color: "#6C6254",
      fontWeight: 500,
      fontSize: 16,
      cursor: "pointer",
    }}
  >
    Care
  </button>

  <button
    onClick={() => navigate(`/costs?horseId=${h.id}`)}
    style={{
      border: `1px solid ${borderColor}`,
      borderRadius: 15,
      padding: "14px 16px",
      background: softBg,
      color: "#6C6254",
      fontWeight: 500,
      fontSize: 16,
      cursor: "pointer",
    }}
  >
    Costs
  </button>

  <button
    onClick={() => openFeedInventory(h)}
    style={{
      border: `1px solid ${borderColor}`,
      borderRadius: 15,
      padding: "14px 16px",
      background: softBg,
      color: "#6C6254",
      fontWeight: 500,
      fontSize: 16,
      cursor: "pointer",
    }}
  >
    Feed
  </button>

  <button
    onClick={() => navigate(`/documents?horseId=${h.id}`)}
    style={{
      border: `1px solid ${borderColor}`,
      borderRadius: 15,
      padding: "14px 16px",
      background: softBg,
      color: "#6C6254",
      fontWeight: 500,
      fontSize: 16,
      cursor: "pointer",
    }}
  >
    Docs
  </button>

  {!h.sickWatchOn ? (
    <button
      onClick={() => startSickWatch(h.id)}
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: 15,
        padding: "14px 16px",
        background: softBg,
        color: burgundy,
        fontWeight: 600,
        fontSize: 16,
        cursor: "pointer",
      }}
    >
      Sick Watch
    </button>
  ) : (
    <button
      onClick={() => navigate(`/sick-watch?horseId=${h.id}`)}
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: 15,
        padding: "14px 16px",
        background: softBg,
        color: "#6C6254",
        fontWeight: 500,
        fontSize: 16,
        cursor: "pointer",
      }}
    >
      View Sick Watch
    </button>
  )}
</div>

                        
                      </div>
                    </div>
                
                );
              })}
          </div>
        )}
      </div>

      {isViewOpen && viewHorse ? (
        <div className="modal-backdrop" onClick={closeView}>
          <div
            className="modal-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxHeight: "88vh",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
            }}
          >
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
                Horse Details
              </h3>

              <button
                onClick={closeView}
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

            <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
              <div>
                <div style={{ fontSize: 13, color: secondaryText }}>Name</div>
                <div
                  style={{ fontSize: 18, color: primaryText, fontWeight: 600 }}
                >
                  {viewHorse.name || "—"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, color: secondaryText }}>Age</div>
                <div style={{ fontSize: 16, color: primaryText }}>
                  {viewHorse.age || "—"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, color: secondaryText }}>Sex</div>
                <div style={{ fontSize: 16, color: primaryText }}>
                  {viewHorse.sex || "—"}
                </div>
              </div>

              <div>
  <div style={{ fontSize: 13, color: secondaryText }}>Feed</div>
  <div
    style={{
      fontSize: 16,
      color: primaryText,
      whiteSpace: "pre-wrap",
      overflow: "visible",
      maxHeight: "none",
      height: "auto",
      lineHeight: 1.55,
      wordBreak: "break-word",
    }}
  >
    {viewHorse.feed || "—"}
  </div>
</div>
<div style={{ marginTop: 14 }}>
  <button
    onClick={() => openFeedInventory(viewHorse)}
    style={{
      width: "100%",
      border: `1px solid ${borderColor}`,
      borderRadius: 14,
      padding: "14px 16px",
      background: softBg,
      color: primaryText,
      fontWeight: 600,
      fontSize: 16,
      cursor: "pointer",
    }}
  >
    Feed Inventory
  </button>
</div>

{viewHorse.blanketingEnabled ? (
  <div
    style={{
      marginTop: 14,
      padding: 14,
      border: `1px solid ${borderColor}`,
      borderRadius: 14,
      background: softBg,
    }}
  >
    <div
      style={{
        fontSize: 13,
        color: secondaryText,
        marginBottom: 8,
      }}
    >
      Blanketing
    </div>

    <div style={{ display: "grid", gap: 6 }}>
      {viewHorse.rainSheetEnabled ? (
        <div style={{ fontSize: 16, color: primaryText }}>
          Rain sheet: Yes
        </div>
      ) : null}

      {viewHorse.midweightEnabled ? (
        <div style={{ fontSize: 16, color: primaryText }}>
          Midweight: {viewHorse.midweightTemp || "—"}°
        </div>
      ) : null}

      {viewHorse.heavyweightEnabled ? (
        <div style={{ fontSize: 16, color: primaryText }}>
          Heavyweight: {viewHorse.heavyweightTemp || "—"}°
        </div>
      ) : null}

      {viewHorse.blanketNotes ? (
        <div
          style={{
            fontSize: 15,
            color: secondaryText,
            whiteSpace: "pre-wrap",
            marginTop: 4,
          }}
        >
          {viewHorse.blanketNotes}
        </div>
      ) : null}
    </div>
  </div>
) : null}
              <div>
                <div style={{ fontSize: 13, color: secondaryText }}>Meds</div>
                <div
                  style={{
                    fontSize: 16,
                    color: primaryText,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {viewHorse.meds || "—"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, color: secondaryText }}>
                  Medical Issues
                </div>
                <div
                  style={{
                    fontSize: 16,
                    color: primaryText,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {viewHorse.medicalIssues || "—"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, color: secondaryText }}>Notes</div>
                <div
                  style={{
                    fontSize: 16,
                    color: primaryText,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {viewHorse.notes || "—"}
                </div>
              </div>

              {Array.isArray(viewHorse.referencePhotos) &&
viewHorse.referencePhotos.length > 0 ? (
  <div>
    <div style={{ fontSize: 13, color: secondaryText }}>Reference Photos</div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        marginTop: 10,
      }}
    >
      {viewHorse.referencePhotos.map((photo, index) => (
  <div key={photo.url || index}>
    <img
      src={photo.url}
      alt={`Reference ${index + 1}`}
      style={{
        width: "100%",
        height: 140,
        objectFit: "cover",
        borderRadius: 12,
        display: "block",
        border: `1px solid ${borderColor}`,
      }}
    />

    {photo.label ? (
      <div style={{ marginTop: 6, fontSize: 14, fontWeight: 600, color: primaryText }}>
        {photo.label}
      </div>
    ) : null}

    {photo.note ? (
      <div style={{ marginTop: 2, fontSize: 13, color: secondaryText }}>
        {photo.note}
      </div>
    ) : null}
  </div>
))}
    </div>
  </div>
) : null}

              {CONTACT_TYPES.map((contactItem) => {
                const contact = getResolvedContact(viewHorse, contactItem.key);

                const isLoadingResources =
                  viewHorse?.[`${contactItem.key}Id`] &&
                  !resourcesById[viewHorse[`${contactItem.key}Id`]];

                if (isLoadingResources) {
                  return (
                    <div key={contactItem.key} style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 14, color: "#6F6A60" }}>
                        Loading {contactItem.label}...
                      </div>
                    </div>
                  );
                }

                if (!hasContactData(contact)) return null;

                return (
                  <div
                    key={contactItem.key}
                    style={{
                      marginTop: 6,
                      paddingTop: 14,
                      borderTop: `1px solid ${borderColor}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: primaryText,
                        marginBottom: 8,
                      }}
                    >
                      {contactItem.label}
                    </div>

                    <div style={{ display: "grid", gap: 8 }}>
                      {contact.name ? (
                        <div>
                          <div style={{ fontSize: 13, color: secondaryText }}>
                            Name
                          </div>
                          <div style={{ fontSize: 16, color: primaryText }}>
                            {contact.name}
                          </div>
                        </div>
                      ) : null}

                      {contact.phone ? (
                        <div>
                          <div style={{ fontSize: 13, color: secondaryText }}>
                            Phone
                          </div>
                          <div style={{ fontSize: 16, color: primaryText }}>
                            {contact.phone}
                          </div>
                        </div>
                      ) : null}

                      {contact.email ? (
                        <div>
                          <div style={{ fontSize: 13, color: secondaryText }}>
                            Email
                          </div>
                          <div style={{ fontSize: 16, color: primaryText }}>
                            {contact.email}
                          </div>
                        </div>
                      ) : null}

                      {contact.businessName ? (
                        <div>
                          <div style={{ fontSize: 13, color: secondaryText }}>
                            Business Name
                          </div>
                          <div style={{ fontSize: 16, color: primaryText }}>
                            {contact.businessName}
                          </div>
                        </div>
                      ) : null}

                      {contact.address ? (
                        <div>
                          <div style={{ fontSize: 13, color: secondaryText }}>
                            Address
                          </div>
                          <div style={{ fontSize: 16, color: primaryText }}>
                            {contact.address}
                          </div>
                        </div>
                      ) : null}

                      {contact.notes ? (
                        <div>
                          <div style={{ fontSize: 13, color: secondaryText }}>
                            Notes
                          </div>
                          <div style={{ fontSize: 16, color: primaryText }}>
                            {contact.notes}
                          </div>
                        </div>
                      ) : null}

                      {contact.phone ? (
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <a href={`tel:${contact.phone}`} className="small-button">
                            Call
                          </a>
                          <a href={`sms:${contact.phone}`} className="small-button">
                            Text
                          </a>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 20,
                paddingTop: 14,
                borderTop: `1px solid ${borderColor}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 600, color: primaryText }}>
                  Log History
                </div>

                <button
                  className="small-button"
                  onClick={() => setViewLogExpanded((prev) => !prev)}
                >
                  {viewLogExpanded ? "Hide Logs" : "View Logs"}
                </button>
              </div>

              {viewLogExpanded ? (
                <div style={{ marginTop: 12 }}>
                  {(logHistoryByHorseId[viewHorse.id] || []).length === 0 ? (
                    <div style={{ fontSize: 14, color: secondaryText }}>
                      No logs yet.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {(logHistoryByHorseId[viewHorse.id] || []).map((item) => (
                        <div
                          key={item.id}
                          style={{
                            padding: 14,
                            border: `1px solid ${borderColor}`,
                            borderRadius: 14,
                            background: "#FCFBF8",
                          }}
                        >
                          <div style={{ fontSize: 14, color: secondaryText }}>
                            {formatLogDate(item.createdAt)}
                          </div>

                          <div
                            style={{
                              marginTop: 6,
                              fontSize: 15,
                              color: primaryText,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {item.text}
                          </div>

                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              marginTop: 10,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              className="small-button"
                              onClick={() => openEditLog(item)}
                            >
                              Edit
                            </button>

                            <button
                              className="small-button"
                              onClick={() => deleteLog(item)}
                              style={{ borderColor: burgundy, color: burgundy }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div
              style={{
                marginTop: 20,
                paddingTop: 14,
                borderTop: `1px solid ${borderColor}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 600, color: primaryText }}>
                  Care History
                </div>

                <button
                  className="small-button"
                  onClick={() => setViewCareHistoryExpanded((prev) => !prev)}
                >
                  {viewCareHistoryExpanded ? "Hide History" : "View History"}
                </button>
              </div>

              {viewCareHistoryExpanded ? (
                <div style={{ marginTop: 12 }}>
                  {(careHistoryByHorseId[viewHorse.id] || []).length === 0 ? (
                    <div style={{ fontSize: 14, color: secondaryText }}>
                      {careHistoryStatusByHorseId[viewHorse.id] ||
                        "No care history yet."}
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {(careHistoryByHorseId[viewHorse.id] || []).map((item) => (
                        <div
  key={item.id}
  onClick={() => navigate(`/care-history/${item.id}`)}
  style={{
    padding: 14,
    border: `1px solid ${borderColor}`,
    borderRadius: 14,
    background: "#FCFBF8",
    cursor: "pointer",
  }}
>
                          <div style={{ fontSize: 14, color: secondaryText }}>
                            {item.completedAt
                              ? formatCareDate(item.completedAt)
                              : "Unknown date"}
                          </div>

                          <div
                            style={{
                              marginTop: 6,
                              fontSize: 15,
                              color: primaryText,
                              fontWeight: 600,
                            }}
                          >
                            {item.title || "Care Item"}
                          </div>

                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 14,
                              color: secondaryText,
                            }}
                          >
                            {item.type || "Custom"}
                            {item.dueDate
                              ? ` · Scheduled ${formatCareDate(item.dueDate)}`
                              : ""}
                          </div>

                          {item.notes ? (
                            <div
                              style={{
                                marginTop: 8,
                                fontSize: 14,
                                color: primaryText,
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {item.notes}
                            </div>
                          ) : null}
<div
  style={{
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 10,
  }}
>
  <button
    className="small-button"
    onClick={(e) => {
      e.stopPropagation();
      deleteCareHistoryEntry(item);
    }}
    style={{
      borderColor: burgundy,
      color: burgundy,
    }}
  >
    Delete
  </button>
</div>

                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div
  style={{
    marginTop: 20,
    paddingTop: 14,
    borderTop: `1px solid ${borderColor}`,
  }}
>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    }}
  >
    <div style={{ fontSize: 20, fontWeight: 600, color: primaryText }}>
      Caretaker History
    </div>

    <button
      className="small-button"
      onClick={() =>
        setViewCaretakerHistoryExpanded((prev) => !prev)
      }
    >
      {viewCaretakerHistoryExpanded ? "Hide History" : "View History"}
    </button>
  </div>

  {viewCaretakerHistoryExpanded ? (
    <div style={{ marginTop: 12 }}>
      {(caretakerHistoryByHorseId[viewHorse.id] || []).length === 0 ? (
        <div style={{ fontSize: 14, color: secondaryText }}>
          {caretakerHistoryStatusByHorseId[viewHorse.id] ||
            "No caretaker history yet."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {(caretakerHistoryByHorseId[viewHorse.id] || []).map((item) => (
            <div
              key={item.id}
              onClick={() => navigate(`/care-history/${item.id}`)}
              style={{
                padding: 14,
                border: `1px solid ${borderColor}`,
                borderRadius: 14,
                background: "#FCFBF8",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 14, color: secondaryText }}>
                {item.completedAt
                  ? formatCareDate(item.completedAt)
                  : "Unknown date"}
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontSize: 15,
                  color: primaryText,
                  fontWeight: 600,
                }}
              >
                Daily Care Completed
              </div>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 14,
                  color: secondaryText,
                }}
              >
                {item.caretakerName || "Caretaker"}
                {(item.completedItems || []).length
                  ? ` · ${(item.completedItems || []).length} task(s) completed`
                  : ""}
              </div>

              {item.notes ? (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 14,
                    color: primaryText,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {item.notes}
                </div>
              ) : null}
<div
  style={{
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 10,
  }}
>
  <button
    className="small-button"
    onClick={(e) => {
      e.stopPropagation();
      deleteCareHistoryEntry(item);
    }}
    style={{
      borderColor: burgundy,
      color: burgundy,
    }}
  >
    Delete
  </button>
</div>

            </div>
          ))}
        </div>
      )}
    </div>
  ) : null}
</div>

            <div
              style={{
                marginTop: 20,
                paddingTop: 14,
                borderTop: `1px solid ${borderColor}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 600, color: primaryText }}>
                  Sick Watch History
                </div>

                <button
                  className="small-button"
                  onClick={() => setViewArchiveExpanded((prev) => !prev)}
                >
                  {viewArchiveExpanded ? "Hide History" : "View History"}
                </button>
              </div>

              {viewArchiveExpanded ? (
                <div style={{ marginTop: 12 }}>
                  {(archiveByHorseId[viewHorse.id] || []).length === 0 ? (
                    <div style={{ fontSize: 14, color: secondaryText }}>
                      No Sick Watch history yet.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {(archiveByHorseId[viewHorse.id] || []).map((item) => (
                        <div
                          key={item.id}
                          style={{
                            padding: 14,
                            border: `1px solid ${borderColor}`,
                            borderRadius: 14,
                            background: "#FCFBF8",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 15,
                              color: primaryText,
                              fontWeight: 500,
                            }}
                          >
                            {formatArchiveDateRange(item)}
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              className="small-button"
                              onClick={() => setArchiveModalCase(item)}
                            >
                              View Summary
                            </button>

                            <button
                              className="small-button"
                              onClick={() => deleteArchiveItem(item.id, viewHorse.id)}
                              style={{ borderColor: burgundy, color: burgundy }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
    flexWrap: "wrap",
  }}
>
  <button
  className="primary-button"
  onClick={() => {
    setShareHorseTarget(viewHorse);
    setShareHorseModalOpen(true);
  }}
>
  Share Care Instructions
</button>

  <button className="secondary-button" onClick={closeView}>
    Close
  </button>
</div>
          </div>
        </div>
      ) : null}

      {isOpen ? (
        <div className="modal-backdrop" onClick={closeModal}>
          <div
            className="modal-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxHeight: "88vh",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
            }}
          >
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
                {mode === "add" ? "Add Horse" : "Edit Horse"}
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

            <input
              className="field-input"
              placeholder="Horse Name *"
              value={horseName}
              onChange={(e) => setHorseName(e.target.value)}
              style={{ marginTop: 12 }}
            />

            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                className="secondary-button"
                onClick={handleSelectPhoto}
                style={{ width: "100%" }}
              >
                {horsePhotoUrl ? "Change Photo" : "Add Photo"}
              </button>

              {horsePhotoUrl ? (
                <div style={{ marginTop: 10 }}>
                  <img
                    src={horsePhotoUrl}
                    alt="Horse Preview"
                    style={{
                      width: "100%",
                      maxHeight: 180,
                      objectFit: "cover",
                      borderRadius: 12,
                      display: "block",
                    }}
                  />
                </div>
              ) : null}
            </div>

            <input
              className="field-input"
              placeholder="Age"
              value={horseAge}
              onChange={(e) => setHorseAge(e.target.value)}
              style={{ marginTop: 10 }}
            />

            <select
              className="field-select"
              value={horseSex}
              onChange={(e) => setHorseSex(e.target.value)}
              style={{ marginTop: 10 }}
            >
              <option value="">Sex *</option>
              <option value="Gelding">Gelding</option>
              <option value="Mare">Mare</option>
              <option value="Stallion">Stallion</option>
            </select>

            <textarea
              className="field-textarea"
              placeholder="Feed"
              value={horseFeed}
              onChange={(e) => setHorseFeed(e.target.value)}
              rows={2}
              style={{ marginTop: 10 }}
            />

            <div
  style={{
    marginTop: 14,
    padding: 14,
    border: `1px solid ${borderColor}`,
    borderRadius: 16,
    background: "#FBF8F2",
  }}
>
  <label
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      fontSize: 15,
      fontWeight: 600,
      color: primaryText,
    }}
  >
    <input
      type="checkbox"
      checked={blanketingEnabled}
      onChange={(e) => setBlanketingEnabled(e.target.checked)}
    />
    Use blanketing preferences
  </label>

  {blanketingEnabled ? (
    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
      <label
  style={{
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 15,
    fontWeight: 600,
    color: primaryText,
  }}
>
  <input
    type="checkbox"
    checked={rainSheetEnabled}
    onChange={(e) => setRainSheetEnabled(e.target.checked)}
  />
  Rain sheet
</label>

      <label
  style={{
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 15,
    fontWeight: 600,
    color: primaryText,
  }}
>
  <input
    type="checkbox"
    checked={midweightEnabled}
    onChange={(e) => setMidweightEnabled(e.target.checked)}
  />
  Midweight blanket
</label>

{midweightEnabled ? (
  <input
    className="field-input"
    placeholder="Midweight temperature, ex: 30"
    value={midweightTemp}
    onChange={(e) => setMidweightTemp(e.target.value)}
  />
) : null}

      <label
  style={{
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 15,
    fontWeight: 600,
    color: primaryText,
  }}
>
  <input
    type="checkbox"
    checked={heavyweightEnabled}
    onChange={(e) => setHeavyweightEnabled(e.target.checked)}
  />
  Heavyweight blanket
</label>

{heavyweightEnabled ? (
  <input
    className="field-input"
    placeholder="Heavyweight temperature, ex: 20"
    value={heavyweightTemp}
    onChange={(e) => setHeavyweightTemp(e.target.value)}
  />
) : null}

      <textarea
        className="field-textarea"
        placeholder="Blanketing notes"
        value={blanketNotes}
        onChange={(e) => setBlanketNotes(e.target.value)}
        rows={2}
      />
    </div>
  ) : null}
</div>

            <textarea
              className="field-textarea"
              placeholder="Meds"
              value={horseMeds}
              onChange={(e) => setHorseMeds(e.target.value)}
              rows={2}
              style={{ marginTop: 10 }}
            />

            <textarea
              className="field-textarea"
              placeholder="Known Medical Issues"
              value={horseMedical}
              onChange={(e) => setHorseMedical(e.target.value)}
              rows={2}
              style={{ marginTop: 10 }}
            />

            <textarea
              className="field-textarea"
              placeholder="Notes"
              value={horseNotes}
              onChange={(e) => setHorseNotes(e.target.value)}
              rows={3}
              style={{ marginTop: 10 }}
            />

            <div style={{ marginTop: 16 }}>
  <div
    style={{
      fontSize: 18,
      fontWeight: 600,
      color: primaryText,
      marginBottom: 10,
    }}
  >
    Reference Photos
  </div>

  <button
    type="button"
    className="secondary-button"
    onClick={handleAddReferencePhoto}
    disabled={referencePhotoUploading}
    style={{ width: "100%" }}
  >
    {referencePhotoUploading ? "Adding Photo..." : "Add Reference Photo"}
  </button>

  {referencePhotos.length > 0 ? (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        marginTop: 12,
      }}
    >
      {referencePhotos.map((photo, index) => (
        <div
  key={photo.url || index}
  style={{
    border: `1px solid ${borderColor}`,
    borderRadius: 14,
    overflow: "hidden",
    background: "#FCFBF8",
  }}
>
  <img
    src={photo.url}
    alt={`Reference ${index + 1}`}
    style={{
      width: "100%",
      height: 140,
      objectFit: "cover",
      display: "block",
    }}
  />

  <div style={{ padding: 8 }}>
    <input
      className="field-input"
      placeholder="Label (optional)"
      value={photo.label || ""}
      onChange={(e) => {
        const value = e.target.value;
        setReferencePhotos((prev) =>
          prev.map((item, itemIndex) =>
            itemIndex === index ? { ...item, label: value } : item
          )
        );
      }}
      style={{ marginBottom: 8 }}
    />

    <textarea
      className="field-textarea"
      placeholder="Note (optional)"
      value={photo.note || ""}
      onChange={(e) => {
        const value = e.target.value;
        setReferencePhotos((prev) =>
          prev.map((item, itemIndex) =>
            itemIndex === index ? { ...item, note: value } : item
          )
        );
      }}
      rows={2}
      style={{ marginBottom: 8 }}
    />

    <button
      type="button"
      className="small-button"
      onClick={() => handleRemoveReferencePhoto(photo)}
      style={{ width: "100%", borderColor: burgundy, color: burgundy }}
    >
      Remove
    </button>
  </div>
</div>
      ))}
    </div>
  ) : (
    <div
      style={{
        marginTop: 10,
        fontSize: 14,
        color: secondaryText,
      }}
    >
      No reference photos added yet.
    </div>
  )}
</div>

            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: primaryText,
                  marginBottom: 10,
                }}
              >
                Horse Contacts
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {CONTACT_TYPES.map((item) => {
                  const draftContact = getContactStateByType(item.key);

                  const editingHorse =
                    mode === "edit"
                      ? horses.find((h) => h.id === editingHorseId)
                      : null;

                  const resolvedContact =
                    mode === "edit" && editingHorse
                      ? getResolvedContact(editingHorse, item.key)
                      : emptyContact();

                  const hasData =
                    hasContactData(draftContact) || hasContactData(resolvedContact);

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => openContactModal(item.key)}
                      style={{
                        border: `1px solid ${borderColor}`,
                        borderRadius: 14,
                        padding: "14px 16px",
                        background: softBg,
                        color: hasData ? navy : "#6C6254",
                        fontWeight: 500,
                        fontSize: 16,
                        cursor: "pointer",
                      }}
                    >
                      {hasData ? `Edit ${item.label}` : `Add ${item.label}`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 20,
                gap: 10,
              }}
            >
              {mode === "edit" ? (
                <button
                  onClick={handleDeleteHorse}
                  style={{
                    border: "none",
                    borderRadius: 14,
                    padding: "12px 16px",
                    background: burgundy,
                    color: "#FFFFFF",
                    fontWeight: 600,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  Delete Horse
                </button>
              ) : (
                <div />
              )}

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <button className="secondary-button" onClick={closeModal}>
                  Cancel
                </button>
                <button
                  className="primary-button"
                  onClick={saveHorse}
                  disabled={isSavingHorse}
                >
                  {isSavingHorse
                    ? "Saving..."
                    : mode === "add"
                    ? "Add Horse"
                    : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isContactModalOpen ? (
        <div className="modal-backdrop" onClick={closeContactModal}>
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
                  fontSize: 28,
                  fontWeight: 600,
                  color: navy,
                }}
              >
                {CONTACT_TYPES.find((item) => item.key === contactType)?.label}
              </h3>

              <button
                onClick={closeContactModal}
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

            <input
              className="field-input"
              placeholder="Name"
              value={contactForm.name}
              onChange={(e) =>
                setContactForm((prev) => ({ ...prev, name: e.target.value }))
              }
              style={{ marginTop: 12 }}
            />

            <input
              className="field-input"
              placeholder="Phone"
              value={contactForm.phone}
              onChange={(e) =>
                setContactForm((prev) => ({ ...prev, phone: e.target.value }))
              }
              style={{ marginTop: 10 }}
            />

            <input
              className="field-input"
              placeholder="Email (optional)"
              value={contactForm.email}
              onChange={(e) =>
                setContactForm((prev) => ({ ...prev, email: e.target.value }))
              }
              style={{ marginTop: 10 }}
            />

            <input
              className="field-input"
              placeholder="Business Name (optional)"
              value={contactForm.businessName}
              onChange={(e) =>
                setContactForm((prev) => ({
                  ...prev,
                  businessName: e.target.value,
                }))
              }
              style={{ marginTop: 10 }}
            />

            <textarea
              className="field-textarea"
              placeholder="Address (optional)"
              value={contactForm.address}
              onChange={(e) =>
                setContactForm((prev) => ({ ...prev, address: e.target.value }))
              }
              rows={2}
              style={{ marginTop: 10 }}
            />

            <textarea
              className="field-textarea"
              placeholder="Notes (optional)"
              value={contactForm.notes}
              onChange={(e) =>
                setContactForm((prev) => ({ ...prev, notes: e.target.value }))
              }
              rows={3}
              style={{ marginTop: 10 }}
            />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="secondary-button" onClick={closeContactModal}>
                Cancel
              </button>
              <button className="primary-button" onClick={saveContactModal}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isLogOpen ? (
        <div className="modal-backdrop" onClick={closeLog}>
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
                Log — {logHorse?.name || "Unnamed"}
              </h3>

              <button
                onClick={closeLog}
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
              placeholder="What would you like to note about this horse?"
              value={logText}
              onChange={(e) => setLogText(e.target.value)}
              rows={5}
              style={{ marginTop: 12 }}
            />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="secondary-button" onClick={closeLog}>
                Cancel
              </button>
              <button className="primary-button" onClick={saveLog}>
                Save Log
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditLogOpen && editingLog ? (
        <div className="modal-backdrop" onClick={closeEditLogModal}>
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
                Edit Log
              </h3>

              <button
                onClick={closeEditLogModal}
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
              placeholder="Edit note..."
              value={editingLogText}
              onChange={(e) => setEditingLogText(e.target.value)}
              rows={5}
              style={{ marginTop: 12 }}
            />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="secondary-button" onClick={closeEditLogModal}>
                Cancel
              </button>
              <button className="primary-button" onClick={saveEditedLog}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isCareOpen && careHorse ? (
        <div className="modal-backdrop" onClick={closeCareModal}>
          <div
            className="modal-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              paddingBottom: 0,
            }}
          >
            <div className="modal-handle" />

            <div
              style={{
                paddingBottom: 12,
                borderBottom: `1px solid ${borderColor}`,
              }}
            >
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
                  Care — {careHorse.name || "Unnamed"}
                </h3>

                <button
                  onClick={closeCareModal}
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
            </div>

            <div
              style={{
                overflowY: "auto",
                paddingTop: 16,
                paddingBottom: 16,
                flex: 1,
              }}
            >
              <button
                className="primary-button"
                onClick={() => setIsAddCareOpen(true)}
                style={{ width: "100%" }}
              >
                + Add Care Appointment
              </button>

              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: primaryText }}>
                  Current Care Items
                </div>

                {careItemsForActiveHorse.length === 0 ? (
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 14,
                      color: secondaryText,
                    }}
                  >
                    No care items yet for this horse.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                    {careItemsForActiveHorse.map((item) => {
                      const days = getDaysUntil(item.dueDate);

                      let badgeText = "";
                      let badgeBg = "#F5F2EB";
                      let badgeColor = secondaryText;

                      if (days != null && days < 0) {
                        badgeText = "Overdue";
                        badgeBg = "#F2E8E7";
                        badgeColor = burgundy;
                      } else if (days === 0) {
                        badgeText = "Due Today";
                        badgeBg = "#F5EEDB";
                        badgeColor = "#6E5A36";
                      } else if (days != null && days > 0 && days <= 7) {
                        badgeText = `${days} day${days === 1 ? "" : "s"} away`;
                        badgeBg = "#F5EEDB";
                        badgeColor = "#6E5A36";
                      }

                      return (
                        <div
                          key={item.id}
                          style={{
                            padding: 14,
                            border: `1px solid ${borderColor}`,
                            borderRadius: 14,
                            background: "#FCFBF8",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 12,
                              alignItems: "flex-start",
                              flexWrap: "wrap",
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: 16,
                                  fontWeight: 600,
                                  color: primaryText,
                                }}
                              >
                                {item.title || "Care Item"}
                              </div>

                              <div
                                style={{
                                  fontSize: 14,
                                  color: secondaryText,
                                  marginTop: 4,
                                }}
                              >
                                {(item.type || "Custom")} ·{" "}
                                {formatCareDate(item.dueDate)}
                                {item.time ? ` · ${item.time}` : ""}
                              </div>

                              {item.notes ? (
                                <div
                                  style={{
                                    fontSize: 14,
                                    color: primaryText,
                                    marginTop: 8,
                                    whiteSpace: "pre-wrap",
                                  }}
                                >
                                  {item.notes}
                                </div>
                              ) : null}
                            </div>

                            {badgeText ? (
                              <div
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 999,
                                  background: badgeBg,
                                  color: badgeColor,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {badgeText}
                              </div>
                            ) : null}
                          </div>

                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                              marginTop: 12,
                            }}
                          >
                            <button
                              className="small-button"
                              onClick={() => deleteCareItem(item.id)}
                              style={{ borderColor: burgundy, color: burgundy }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                position: "sticky",
                bottom: 0,
                background: "#FFFFFF",
                borderTop: `1px solid ${borderColor}`,
                paddingTop: 12,
                paddingBottom: 14,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button className="secondary-button" onClick={closeCareModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isHorseLexOpen && horseLexHorse ? (
        <div className="modal-backdrop" onClick={closeHorseLex}>
          <div
            className="modal-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxHeight: "88vh",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
            }}
          >
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
                Lex This Horse
              </h3>

              <button
                onClick={closeHorseLex}
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

            <div style={{ fontSize: 14, color: secondaryText, marginTop: 4 }}>
              Asking about: {horseLexHorse.name || "Unnamed"}
            </div>

            <textarea
              className="field-textarea"
              placeholder="Ask Lex anything about this horse..."
              value={horseLexQuestion}
              onChange={(e) => setHorseLexQuestion(e.target.value)}
              rows={5}
              style={{ marginTop: 12 }}
            />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="secondary-button" onClick={closeHorseLex}>
                Cancel
              </button>
              <button className="primary-button" onClick={handleAskHorseLex}>
                {horseLexLoading ? "Asking..." : "Ask Lex"}
              </button>
            </div>

            {horseLexLoading || horseLexAnswer ? (
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
                  {horseLexLoading ? "Thinking..." : horseLexAnswer}
                </div>

                {!horseLexLoading && horseLexAnswer ? (
                  <button
                    className="small-button"
                    style={{ marginTop: 14 }}
                    onClick={copyHorseLexAnswer}
                  >
                    Copy Answer
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {archiveModalCase ? (
        <div className="modal-backdrop" onClick={closeArchiveModal}>
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
                Sick Watch Summary
              </h3>

              <button
                onClick={closeArchiveModal}
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

            <div style={{ fontSize: 14, color: secondaryText, marginTop: 4 }}>
              {archiveModalCase.horseName || "Unnamed"} ·{" "}
              {formatArchiveDateRange(archiveModalCase)}
            </div>

            <textarea
              className="field-textarea"
              value={archiveModalCase.summaryText || ""}
              readOnly
              rows={12}
              style={{ marginTop: 12 }}
            />

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                marginTop: 16,
                flexWrap: "wrap",
              }}
            >
              <button className="secondary-button" onClick={copyArchiveSummary}>
                Copy Summary
              </button>
              <button className="primary-button" onClick={sendArchiveSummary}>
                Send Summary
              </button>
              <button
                className="secondary-button"
                onClick={async () => {
                  await deleteArchiveItem(
                    archiveModalCase.id,
                    archiveModalCase.horseId
                  );
                  closeArchiveModal();
                }}
                style={{ borderColor: burgundy, color: burgundy }}
              >
                Delete
              </button>
              <button className="secondary-button" onClick={closeArchiveModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shareHorseModalOpen && shareHorseTarget ? (
        <div
          className="modal-backdrop"
          onClick={() => {
            setShareHorseModalOpen(false);
            setShareHorseTarget(null);
          }}
        >
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
                  fontSize: 28,
                  fontWeight: 600,
                  color: navy,
                }}
              >
                Share Care Instructions
              </h3>

              <button
                onClick={() => {
                  setShareHorseModalOpen(false);
                  setShareHorseTarget(null);
                }}
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

            <div
              style={{
                fontSize: 15,
                color: secondaryText,
                marginTop: 6,
                marginBottom: 16,
                lineHeight: 1.5,
              }}
            >
              Choose how you want to send {shareHorseTarget.name || "this horse"}'s care instructions.
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <button
  className="primary-button"
  onClick={() => {
    textHorseCareInstructions(shareHorseTarget);
    setShareHorseModalOpen(false);
    setShareHorseTarget(null);
  }}
>
  Text Care Instructions
</button>
              <button
  className="secondary-button"
  onClick={() => {
    emailHorseCareInstructions(shareHorseTarget);
    setShareHorseModalOpen(false);
    setShareHorseTarget(null);
  }}
>
  Email Care Instructions
</button>

              <button
                className="secondary-button"
                onClick={() => {
                  setShareHorseModalOpen(false);
                  setShareHorseTarget(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAddCareOpen ? (
        <div className="modal-backdrop" onClick={() => setIsAddCareOpen(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />

            <h3 style={{ fontSize: 28, marginBottom: 12, color: navy }}>
              Add Care Appointment
            </h3>

            <select
              className="field-select"
              value={careType}
              onChange={(e) => setCareType(e.target.value)}
            >
              {CARE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <input
              className="field-input"
              placeholder="Title"
              value={careTitle}
              onChange={(e) => setCareTitle(e.target.value)}
              style={{ marginTop: 10 }}
            />

            <input
              className="field-input"
              type="date"
              value={careDate}
              onChange={(e) => setCareDate(e.target.value)}
              style={{ marginTop: 10 }}
            />

            <input
              className="field-input"
              type="time"
              value={careTime}
              onChange={(e) => setCareTime(e.target.value)}
              style={{ marginTop: 10 }}
            />

            <select
              className="field-select"
              value={repeatInterval}
              onChange={(e) => setRepeatInterval(e.target.value)}
              style={{ marginTop: 10 }}
            >
              {REPEAT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <select
              className="field-select"
              value={alertTiming}
              onChange={(e) => setAlertTiming(e.target.value)}
              style={{ marginTop: 10 }}
            >
              {ALERT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <textarea
              className="field-textarea"
              placeholder="Notes"
              value={careNotes}
              onChange={(e) => setCareNotes(e.target.value)}
              rows={3}
              style={{ marginTop: 10 }}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="secondary-button" onClick={() => setIsAddCareOpen(false)}>
                Cancel
              </button>

              <button
                className="primary-button"
                onClick={async () => {
                  const saved = await saveCareItem();
                  if (saved) setIsAddCareOpen(false);
                }}
              >
                Save Care Appointment
              </button>
            </div>
          </div>
        </div>
      ) : null}

{isFeedInventoryOpen && feedInventoryHorse ? (
  <div className="modal-backdrop" onClick={closeFeedInventory}>
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
        <h3 style={{ margin: 0, fontSize: 28, fontWeight: 600, color: navy }}>
          Feed Inventory
        </h3>

        <button
          onClick={closeFeedInventory}
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

      <div style={{ fontSize: 15, color: secondaryText, marginTop: 6 }}>
        Tracking Feed Inventory for {feedInventoryHorse.name || "this horse"}.
      </div>

      {!isFeedFormOpen ? (
        <>
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: primaryText,
                marginBottom: 10,
              }}
            >
              Current Feed Inventory
            </div>

            {feedInventoryItems.length === 0 ? (
              <div
                style={{
                  fontSize: 14,
                  color: secondaryText,
                  padding: 14,
                  border: `1px solid ${borderColor}`,
                  borderRadius: 14,
                  background: "#FCFBF8",
                }}
              >
                {feedInventoryStatus || "No feed inventory yet."}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {feedInventoryItems.map((item) => {
  const inventoryStatus = getFeedInventoryStatus(item);

  return (
                  <div
                    key={item.id}
                    style={{
                      padding: 14,
                      border: `1px solid ${borderColor}`,
                      borderRadius: 14,
                      background: "#FCFBF8",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: primaryText,
                      }}
                    >
                      {item.itemName || "Unnamed Feed"}
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        color: secondaryText,
                        marginTop: 4,
                      }}
                    >
                      Estimated on hand: {inventoryStatus.displayQuantity ?? 0} {item.unit || ""}
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        color: secondaryText,
                        marginTop: 4,
                      }}
                    >
                      Uses {item.dailyUse || 0}{" "}
                      {item.dailyUseUnit || item.unit || ""}{" "}
                      {item.usageFrequency || "daily"}
                    </div>

                    {(() => {
  const inventoryStatus = getFeedInventoryStatus(item);

  return (
    <>
      <div
        style={{
          fontSize: 14,
          color: primaryText,
          marginTop: 6,
          fontWeight: 500,
        }}
      >
        Estimated{" "}
        {inventoryStatus.daysRemaining != null
          ? inventoryStatus.daysRemaining
          : item.estimatedDaysRemaining || 0}{" "}
        ≈ day(s) remaining
      </div>

      {inventoryStatus.isLow ? (
        <div
          style={{
            marginTop: 8,
            padding: "10px 12px",
            borderRadius: 12,
            background: "#F2E8E7",
            color: burgundy,
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.35,
          }}
        >
          {inventoryStatus.warningText}
        </div>
      ) : null}
    </>
  );
})()}

                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
  <button
    className="small-button"
    onClick={() => setRefillFeedItem(item)}
  >
    {item.itemType === "Hay" ? "+ Hay" : "Refill"}
  </button>

  <button
    className="small-button"
    onClick={() => editFeedInventoryItem(item)}
  >
    Edit
  </button>

                      <button
                        className="small-button"
                        onClick={() => deleteFeedInventoryItem(item.id)}
                        style={{ borderColor: burgundy, color: burgundy }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            className="primary-button"
            onClick={() => {
              setEditingFeedItemId(null);
              setFeedItemType("Hay");
              setFeedItemName("");
              setFeedQuantity("");
              setFeedUnit("bales");
              setFeedDailyUse("");
              setFeedDailyUseUnit("bales");
              setFeedUsageFrequency("daily");
              setFeedFlakesPerBale("");
              setFeedLowThreshold("");
              setFeedNotes("");
              setIsFeedFormOpen(true);
            }}
            style={{ width: "100%", marginTop: 16 }}
          >
            + Add Feed Supply
          </button>
        </>
      ) : (
        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
          {editingFeedItemId ? (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: "#F5EEDB",
                color: "#6E5A36",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Editing feed item — update the fields, then tap Save Changes.
            </div>
          ) : null}

          <select
            className="field-select"
            value={feedItemType}
            onChange={(e) => {
  const nextType = e.target.value;
  setFeedItemType(nextType);

  if (nextType === "Hay") {
    setFeedUnit("bales");
    setFeedDailyUseUnit("bales");
  } else if (nextType === "Grain") {
    setFeedUnit("bags");
    setFeedDailyUseUnit("pounds");
  } else if (nextType === "Supplement") {
    setFeedUnit("mL");
    setFeedDailyUseUnit("mL");
  }
}}
          >
            <option value="Hay">Hay</option>
            <option value="Grain">Grain</option>
            <option value="Supplement">Supplement</option>
          </select>

          <input
            className="field-input"
            placeholder="Feed Item Name"
            value={feedItemName}
            onChange={(e) => setFeedItemName(e.target.value)}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 140px",
              gap: 10,
            }}
          >
            <input
              className="field-input"
              type="number"
              placeholder="Qty On Hand"
              value={feedQuantity}
              onChange={(e) => setFeedQuantity(e.target.value)}
            />

            <select
              className="field-select"
              value={feedUnit}
              onChange={(e) => setFeedUnit(e.target.value)}
            >
              {feedItemType === "Hay" ? (
                <>
                  <option value="bales">bales</option>
                  <option value="flakes">flakes</option>
                </>
              ) : feedItemType === "Grain" ? (
                <>
                  <option value="bags">bags</option>
                  <option value="pounds">pounds</option>
                  <option value="scoops">scoops</option>
                  <option value="quarts">quarts</option>
                </>
              ) : (
                <>
                  <option value="mL">mL</option>
                  <option value="ounces">ounces</option>
                  <option value="scoops">scoops</option>
                  <option value="grams">grams</option>
                  <option value="pounds">pounds</option>
                </>
              )}
            </select>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 140px",
              gap: 10,
            }}
          >
            <input
              className="field-input"
              type="number"
              placeholder="Amount Used"
              value={feedDailyUse}
              onChange={(e) => setFeedDailyUse(e.target.value)}
            />

            <select
              className="field-select"
              value={feedDailyUseUnit}
              onChange={(e) => setFeedDailyUseUnit(e.target.value)}
            >
              {feedItemType === "Hay" ? (
                <>
                  <option value="bales">bales</option>
                  <option value="flakes">flakes</option>
                </>
              ) : feedItemType === "Grain" ? (
                <>
                  <option value="bags">bags</option>
                  <option value="pounds">pounds</option>
                  <option value="scoops">scoops</option>
                  <option value="quarts">quarts</option>
                </>
              ) : (
                <>
                  <option value="mL">mL</option>
                  <option value="ounces">ounces</option>
                  <option value="scoops">scoops</option>
                  <option value="grams">grams</option>
                  <option value="pounds">pounds</option>
                </>
              )}
            </select>
          </div>

          <select
            className="field-select"
            value={feedUsageFrequency}
            onChange={(e) => setFeedUsageFrequency(e.target.value)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-Weekly</option>
            <option value="monthly">Monthly</option>
          </select>

          {feedItemType === "Hay" ? (
            <input
              className="field-input"
              type="number"
              placeholder="How many flakes are in one bale?"
              value={feedFlakesPerBale}
              onChange={(e) => setFeedFlakesPerBale(e.target.value)}
            />
          ) : null}

          <input
            className="field-input"
            type="number"
            placeholder="Remind me when I have this many days left"
            value={feedLowThreshold}
            onChange={(e) => setFeedLowThreshold(e.target.value)}
          />

          <textarea
            className="field-textarea"
            placeholder="Notes"
            value={feedNotes}
            onChange={(e) => setFeedNotes(e.target.value)}
            rows={3}
          />

          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button className="secondary-button" onClick={() => setIsFeedFormOpen(false)}>
              Cancel
            </button>

            <button className="primary-button" onClick={saveFeedInventoryItem}>
              {editingFeedItemId ? "Save Changes" : "Save Feed Item"}
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
) : null}

{refillFeedItem ? (
  <div className="modal-backdrop" onClick={() => setRefillFeedItem(null)}>
    <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
      <div className="modal-handle" />

      <h3 style={{ marginTop: 0 }}>
        {refillFeedItem.itemType === "Hay" ? "+ Hay" : "Refill"}
      </h3>

      <p style={{ color: secondaryText }}>
        {refillFeedItem.itemType === "Hay"
          ? "How many bales did you add?"
          : `Refill ${refillFeedItem.itemName || "this item"}?`}
      </p>
      {refillFeedItem.itemType === "Hay" && (
  <input
    type="number"
    min="1"
    value={hayToAdd}
    onChange={(e) => setHayToAdd(e.target.value)}
    placeholder="Number of bales"
    style={{
      width: "100%",
      marginTop: 12,
      padding: 10,
      borderRadius: 10,
      border: `1px solid ${borderColor}`,
      fontSize: 16,
      boxSizing: "border-box",
    }}
  />
)}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button className="secondary-button" onClick={() => setRefillFeedItem(null)}>
          Cancel
        </button>

        <button
  className="primary-button"
  onClick={async () => {
    if (refillFeedItem.itemType === "Hay") {
  const addedHay = Number(hayToAdd);

  if (Number.isNaN(addedHay) || addedHay <= 0) {
    alert("Enter the number of bales you added.");
    return;
  }

  await updateDoc(
    doc(db, "feed_inventory", refillFeedItem.id),
    {
      currentQuantity: (refillFeedItem.currentQuantity ?? 0) + addedHay,
      quantityUpdatedAt: Date.now(),
      updatedAt: Date.now(),
      lowFeedPushSent: false,
    }
  );

  await loadFeedInventory(feedInventoryHorse.id);

  setHayToAdd("");
  setRefillFeedItem(null);
  return;
}
console.log("REFILL ITEM:", refillFeedItem);

    await updateDoc(
  doc(db, "feed_inventory", refillFeedItem.id),
  {
    currentQuantity:
  (refillFeedItem.currentQuantity ?? 0) +
  (refillFeedItem.refillQuantity ?? 0),
    quantityUpdatedAt: Date.now(),
    updatedAt: Date.now(),
    lowFeedPushSent: false,
  }
);

await loadFeedInventory(feedInventoryHorse.id);

    setRefillFeedItem(null);
  }}
>
  {refillFeedItem.itemType === "Hay" ? "Add" : "Refill"}
</button>
      </div>
    </div>
  </div>
) : null}

      <FloatingAskLex onAsk={onAsk} />
      <BottomNav />
    </div>
  );
}