import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import BottomNav from "../components/BottomNav";
import FloatingAskLex from "../components/FloatingAskLex";
import { useLocation, useNavigate } from "react-router-dom";

const isOffline = () =>
  typeof navigator !== "undefined" && navigator.onLine === false;

const COST_CATEGORIES = [
  "hay",
  "feed",
  "vet",
  "farrier",
  "meds",
  "tack",
  "supplies",
  "emergency",
  "other",
];

const TIME_VIEWS = ["month", "quarter", "season", "year"];
const EXPORT_RANGE_OPTIONS = ["all", "year", "season", "custom"];

const getTodayInputValue = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getSeasonLabel = (monthIndex) => {
  if ([11, 0, 1].includes(monthIndex)) return "Winter";
  if ([2, 3, 4].includes(monthIndex)) return "Spring";
  if ([5, 6, 7].includes(monthIndex)) return "Summer";
  return "Fall";
};

const formatCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;

const capitalize = (value) => {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const groupMonthLabel = (year, monthIndex) =>
  new Date(year, monthIndex, 1).toLocaleString([], {
    month: "long",
    year: "numeric",
  });

const csvEscape = (value) => {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
};

export default function CostsPage({ user, horses = [], onAsk }) {
  const location = useLocation();
const navigate = useNavigate();
  const [costs, setCosts] = useState([]);

  const [horseFilter, setHorseFilter] = useState("all");
  const selectedHorseId = new URLSearchParams(location.search).get("horseId");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [timeView, setTimeView] = useState("month");
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState("add");
  const [editingCostId, setEditingCostId] = useState("");

    const [costAmount, setCostAmount] = useState("");
  const [costCategory, setCostCategory] = useState("hay");
  const [costItem, setCostItem] = useState("");
  const [costHorseId, setCostHorseId] = useState("shared");
  const [costVendor, setCostVendor] = useState("");
  const [costDate, setCostDate] = useState(getTodayInputValue());
  const [costNotes, setCostNotes] = useState("");

  const [receiptPhoto, setReceiptPhoto] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState("");
  const [receiptScanning, setReceiptScanning] = useState(false);

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportRangeType, setExportRangeType] = useState("year");
  const [exportYear, setExportYear] = useState(String(new Date().getFullYear()));
  const [exportSeason, setExportSeason] = useState("Winter");
  const [exportHorseFilter, setExportHorseFilter] = useState("all");
  const [exportCategoryFilter, setExportCategoryFilter] = useState("all");
  const [exportItemSearch, setExportItemSearch] = useState("");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");

  const primaryText = "#1E1E1E";
const borderColor = "#E5E2DA";
  const secondaryText = "#6F6A60";
  const navy = "#24324A";
  const navyBorder = "#31425F";
  const homeBg = "#F6F4EE";
  const burgundy = "#7A2E2E";
  const softBg = "#FBF8F2";
  const goldText = "#6E5A36";
  const cardShadow = "0 10px 22px rgba(24, 34, 51, 0.08)";
  const panelShadow = "0 12px 24px rgba(24, 34, 51, 0.14)";

  const horseNameById = useMemo(() => {
    const map = {};
    horses.forEach((horse) => {
      map[horse.id] = horse.name || "Unnamed";
    });
    return map;
  }, [horses]);

  const sharedHorseOptions = useMemo(() => {
    return [
      { id: "shared", name: "Shared" },
      ...horses.map((horse) => ({
        id: horse.id,
        name: horse.name || "Unnamed",
      })),
    ];
  }, [horses]);

    const clearCostForm = () => {
    setCostAmount("");
    setCostCategory("hay");
    setCostItem("");
    setCostHorseId("shared");
    setCostVendor("");
    setCostDate(getTodayInputValue());
    setCostNotes("");
    setReceiptPhoto(null);
    setReceiptPreview("");
    setReceiptScanning(false);
    setEditingCostId("");
    setMode("add");
  };

  const clearExportForm = () => {
    const currentYear = String(new Date().getFullYear());
    setExportRangeType("year");
    setExportYear(currentYear);
    setExportSeason("Winter");
    setExportHorseFilter("all");
    setExportCategoryFilter("all");
    setExportItemSearch("");
    setExportStartDate("");
    setExportEndDate("");
  };

  const closeModal = () => {
    setIsOpen(false);
    clearCostForm();
  };

  const closeExportModal = () => {
    setIsExportOpen(false);
    clearExportForm();
  };

  const openAdd = () => {
    clearCostForm();
    setMode("add");
    setIsOpen(true);
  };

  const openExportModal = () => {
    clearExportForm();
    setIsExportOpen(true);
  };

  const openEdit = (cost) => {
    setMode("edit");
    setEditingCostId(cost.id || "");
    setCostAmount(String(cost.amount ?? ""));
    setCostCategory(cost.category || "hay");
    setCostItem(cost.item || "");
    setCostHorseId(cost.horseId || "shared");
    setCostVendor(cost.vendor || "");
    setCostDate(
      cost.createdAt ? new Date(cost.createdAt).toISOString().slice(0, 10) : getTodayInputValue()
    );
    setCostNotes(cost.notes || "");
    setIsOpen(true);
  };

  const loadCosts = async () => {
    if (!user?.uid) {
      setCosts([]);
      return;
    }

    try {
      const qc = query(collection(db, "costs"), where("ownerUid", "==", user.uid));
      const snap = await getDocs(qc);

      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      setCosts(items);
    } catch (e) {
      console.log("LOAD COSTS ERROR:", e);
      setCosts([]);
    }
  };

  useEffect(() => {
    loadCosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  useEffect(() => {
  if (selectedHorseId) {
    setHorseFilter(selectedHorseId);
  }
}, [selectedHorseId]);

  const handleReceiptPhotoSelect = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      return;
    }

    setReceiptPhoto(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

    const scanReceipt = async () => {
    if (!receiptPhoto) {
      alert("Choose a receipt photo first.");
      return;
    }

    if (typeof onAsk !== "function") {
      alert("Lex scanner is not connected.");
      return;
    }

    setReceiptScanning(true);

    try {
      const prompt = `
Receipt scanner task.

Read this receipt image and return ONLY valid JSON. No markdown. No explanation.

Use this exact shape:
{
  "store": "",
  "date": "YYYY-MM-DD",
  "amount": "",
  "item": "",
  "category": "other",
  "notes": ""
}

Rules:
- amount should be the final total paid, numbers only, no dollar sign.
- date must be YYYY-MM-DD if visible. If not visible, use an empty string.
- store should be the merchant/store/vendor name.
- item should be the main equine-related item if clear, otherwise a short receipt summary.
- category must be one of: hay, feed, vet, farrier, meds, tack, supplies, emergency, other.
- notes should include anything useful that does not fit elsewhere.
`;

      const result = await onAsk(prompt, receiptPhoto);
      const rawText = typeof result === "string" ? result : result?.answer || "";

      const cleaned = rawText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const parsed = JSON.parse(cleaned);

      if (parsed.amount) {
        setCostAmount(String(parsed.amount));
      }

      if (parsed.category && COST_CATEGORIES.includes(parsed.category)) {
        setCostCategory(parsed.category);
      } else {
        setCostCategory("other");
      }

      if (parsed.item) {
        setCostItem(String(parsed.item));
      }

      if (parsed.store) {
        setCostVendor(String(parsed.store));
      }

      if (parsed.date) {
        setCostDate(String(parsed.date));
      }

      const notesParts = [];

      if (parsed.notes) {
        notesParts.push(String(parsed.notes));
      }

      notesParts.push("Scanned from receipt photo.");

      setCostNotes(notesParts.join("\n"));
    } catch (e) {
      console.log("SCAN RECEIPT ERROR:", e);
      alert("Lex could not read this receipt clearly. You can still enter it manually.");
    } finally {
      setReceiptScanning(false);
    }
  };

  const saveCost = async () => {
    if (!user?.uid) {
      alert("Please log in first.");
      return;
    }

    if (isOffline()) {
  alert("You're offline. New cost changes can't be saved right now.");
  return;
}

    if (!costAmount || Number(costAmount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    if (!costCategory) {
      alert("Please choose a category.");
      return;
    }

    if (costCategory === "other" && !costItem.trim()) {
      alert('Please enter what this cost was for when using "Other."');
      return;
    }

    try {
      const selectedHorse =
        costHorseId !== "shared"
          ? horses.find((horse) => horse.id === costHorseId) || null
          : null;

      const createdAtMs = new Date(`${costDate}T12:00:00`).getTime();

      const payload = {
        ownerUid: user.uid,
        horseId: costHorseId === "shared" ? null : costHorseId,
        horseName: costHorseId === "shared" ? "Shared" : selectedHorse?.name || "Unnamed",
        amount: Number(costAmount),
        category: costCategory,
        item: costCategory === "other" ? costItem.trim() : "",
        vendor: costVendor.trim(),
        notes: costNotes.trim(),
        createdAt: Number.isNaN(createdAtMs) ? Date.now() : createdAtMs,
      };

      if (mode === "add") {
        await addDoc(collection(db, "costs"), payload);
      } else {
        if (!editingCostId) {
          alert("No cost selected to edit.");
          return;
        }

        await updateDoc(doc(db, "costs", editingCostId), payload);
      }

      await loadCosts();
      closeModal();
    } catch (e) {
      console.log("SAVE COST ERROR:", e);
      alert(mode === "add" ? "Failed to save cost." : "Failed to update cost.");
    }
  };

  const deleteCost = async (costId) => {
    if (!costId) return;

    const confirmed = window.confirm("Delete this cost entry?");
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "costs", costId));
      await loadCosts();
    } catch (e) {
      console.log("DELETE COST ERROR:", e);
      alert("Failed to delete cost.");
    }
  };

  const filteredCosts = useMemo(() => {
    return costs.filter((cost) => {
      if (horseFilter === "shared" && cost.horseId !== null) return false;
      if (horseFilter !== "all" && horseFilter !== "shared" && cost.horseId !== horseFilter) {
        return false;
      }
      if (categoryFilter !== "all" && cost.category !== categoryFilter) return false;
      return true;
    });
  }, [costs, horseFilter, categoryFilter]);

  const totalSpent = useMemo(() => {
    return filteredCosts.reduce((sum, cost) => sum + Number(cost.amount || 0), 0);
  }, [filteredCosts]);

  const thisMonthSpent = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return filteredCosts
      .filter((cost) => {
        const d = new Date(cost.createdAt || 0);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, cost) => sum + Number(cost.amount || 0), 0);
  }, [filteredCosts]);

  const topCategory = useMemo(() => {
    const totals = COST_CATEGORIES.map((category) => {
      const total = filteredCosts
        .filter((cost) => cost.category === category)
        .reduce((sum, cost) => sum + Number(cost.amount || 0), 0);

      return { category, total };
    }).filter((row) => row.total > 0);

    if (!totals.length) return null;

    return totals.sort((a, b) => b.total - a.total)[0];
  }, [filteredCosts]);

  const availableYears = useMemo(() => {
    const yearSet = new Set(
      costs.map((cost) => new Date(cost.createdAt || 0).getFullYear()).filter(Boolean)
    );
    yearSet.add(new Date().getFullYear());

    return Array.from(yearSet).sort((a, b) => b - a);
  }, [costs]);

  const chartData = useMemo(() => {
    const selectedYear = Number(yearFilter);
    const yearCosts = filteredCosts.filter(
      (cost) => new Date(cost.createdAt || 0).getFullYear() === selectedYear
    );

    if (timeView === "year") {
      const totalsByYear = new Map();

      filteredCosts.forEach((cost) => {
        const year = new Date(cost.createdAt || 0).getFullYear();
        totalsByYear.set(year, (totalsByYear.get(year) || 0) + Number(cost.amount || 0));
      });

      return Array.from(totalsByYear.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([label, total]) => ({
          label: String(label),
          total,
        }));
    }

    if (timeView === "quarter") {
      const buckets = [
        { label: "Q1", total: 0 },
        { label: "Q2", total: 0 },
        { label: "Q3", total: 0 },
        { label: "Q4", total: 0 },
      ];

      yearCosts.forEach((cost) => {
        const month = new Date(cost.createdAt || 0).getMonth();
        const quarterIndex = Math.floor(month / 3);
        buckets[quarterIndex].total += Number(cost.amount || 0);
      });

      return buckets;
    }

    if (timeView === "season") {
      const buckets = [
        { label: "Winter", total: 0 },
        { label: "Spring", total: 0 },
        { label: "Summer", total: 0 },
        { label: "Fall", total: 0 },
      ];

      yearCosts.forEach((cost) => {
        const month = new Date(cost.createdAt || 0).getMonth();
        const season = getSeasonLabel(month);
        const bucket = buckets.find((b) => b.label === season);
        if (bucket) bucket.total += Number(cost.amount || 0);
      });

      return buckets;
    }

    const monthlyBuckets = Array.from({ length: 12 }, (_, monthIndex) => ({
      label: new Date(selectedYear, monthIndex, 1).toLocaleString([], { month: "short" }),
      total: 0,
    }));

    yearCosts.forEach((cost) => {
      const month = new Date(cost.createdAt || 0).getMonth();
      monthlyBuckets[month].total += Number(cost.amount || 0);
    });

    return monthlyBuckets;
  }, [filteredCosts, timeView, yearFilter]);

  const maxChartValue = useMemo(() => {
    return Math.max(...chartData.map((item) => item.total), 0);
  }, [chartData]);

  const monthlyHistory = useMemo(() => {
    const map = new Map();

    filteredCosts.forEach((cost) => {
      const d = new Date(cost.createdAt || 0);
      const key = `${d.getFullYear()}-${d.getMonth()}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          year: d.getFullYear(),
          monthIndex: d.getMonth(),
          label: groupMonthLabel(d.getFullYear(), d.getMonth()),
          items: [],
          total: 0,
        });
      }

      map.get(key).items.push(cost);
      map.get(key).total += Number(cost.amount || 0);
    });

    return Array.from(map.values())
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.monthIndex - a.monthIndex;
      })
      .map((group) => ({
        ...group,
        items: [...group.items].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
      }));
  }, [filteredCosts]);

  const exportPreviewCosts = useMemo(() => {
    return costs.filter((cost) => {
      const costDateObj = new Date(cost.createdAt || 0);
      const costYear = costDateObj.getFullYear();
      const costMonth = costDateObj.getMonth();
      const costSeason = getSeasonLabel(costMonth);

      if (exportRangeType === "year" && costYear !== Number(exportYear)) return false;

      if (exportRangeType === "season") {
        if (costYear !== Number(exportYear)) return false;
        if (costSeason !== exportSeason) return false;
      }

      if (exportRangeType === "custom") {
        const startMs = exportStartDate
          ? new Date(`${exportStartDate}T00:00:00`).getTime()
          : null;
        const endMs = exportEndDate
          ? new Date(`${exportEndDate}T23:59:59`).getTime()
          : null;

        if (startMs && cost.createdAt < startMs) return false;
        if (endMs && cost.createdAt > endMs) return false;
      }

      if (exportHorseFilter === "shared" && cost.horseId !== null) return false;
      if (
        exportHorseFilter !== "all" &&
        exportHorseFilter !== "shared" &&
        cost.horseId !== exportHorseFilter
      ) {
        return false;
      }

      if (exportCategoryFilter !== "all" && cost.category !== exportCategoryFilter) return false;

      if (exportItemSearch.trim()) {
        const search = exportItemSearch.trim().toLowerCase();
        const itemText = String(cost.item || "").toLowerCase();
        const notesText = String(cost.notes || "").toLowerCase();
        const vendorText = String(cost.vendor || "").toLowerCase();

        if (
          !itemText.includes(search) &&
          !notesText.includes(search) &&
          !vendorText.includes(search)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    costs,
    exportRangeType,
    exportYear,
    exportSeason,
    exportHorseFilter,
    exportCategoryFilter,
    exportItemSearch,
    exportStartDate,
    exportEndDate,
  ]);

  const exportPreviewTotal = useMemo(() => {
    return exportPreviewCosts.reduce((sum, cost) => sum + Number(cost.amount || 0), 0);
  }, [exportPreviewCosts]);

  const buildExportFileName = () => {
    const parts = ["lex-costs"];

    if (exportRangeType === "year") {
      parts.push(exportYear);
    } else if (exportRangeType === "season") {
      parts.push(exportSeason.toLowerCase());
      parts.push(exportYear);
    } else if (exportRangeType === "custom") {
      parts.push(exportStartDate || "start");
      parts.push(exportEndDate || "end");
    } else {
      parts.push("all");
    }

    if (exportHorseFilter === "shared") {
      parts.push("shared");
    } else if (exportHorseFilter !== "all") {
      parts.push((horseNameById[exportHorseFilter] || "horse").toLowerCase().replace(/\s+/g, "-"));
    }

    if (exportCategoryFilter !== "all") {
      parts.push(exportCategoryFilter);
    }

    if (exportItemSearch.trim()) {
      parts.push(exportItemSearch.trim().toLowerCase().replace(/\s+/g, "-"));
    }

    return `${parts.join("-")}.csv`;
  };

  const exportCostsToCsv = () => {
    if (!exportPreviewCosts.length) {
      alert("No matching costs to export.");
      return;
    }

    const rows = [
      ["Date", "Horse", "Category", "Item", "Vendor", "Amount", "Notes"],
      ...exportPreviewCosts
        .slice()
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
        .map((cost) => {
          const horseLabel =
            cost.horseId === null
              ? "Shared"
              : horseNameById[cost.horseId] || cost.horseName || "Unnamed";

          return [
            cost.createdAt ? new Date(cost.createdAt).toLocaleDateString() : "",
            horseLabel,
            capitalize(cost.category || "other"),
            cost.item || "",
            cost.vendor || "",
            Number(cost.amount || 0).toFixed(2),
            cost.notes || "",
          ];
        }),
    ];

    const csvText = rows
      .map((row) => row.map((cell) => csvEscape(cell)).join(","))
      .join("\n");

    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildExportFileName();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    closeExportModal();
  };

  if (!user) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: homeBg,
        paddingBottom: 100,
      }}
    >
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
          Costs
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 20,
            color: secondaryText,
            fontWeight: 400,
          }}
        >
          {selectedHorseId
  ? `Showing costs for ${horseNameById[selectedHorseId] || "this horse"}`
  : "Spending and cost tracking"}
        </div>
      </div>

      {selectedHorseId ? (
  <button
    className="small-button"
    onClick={() => navigate("/costs")}
    style={{ marginTop: 12 }}
  >
    View All Costs
  </button>
) : null}

      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div
          className="card"
          style={{
            padding: 18,
            borderRadius: 22,
            border: `1px solid ${borderColor}`,
            background: "#FFFFFF",
            boxShadow: cardShadow,
          }}
        >
          <div style={{ fontSize: 13, color: secondaryText }}>Total Spent</div>
          <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700, color: primaryText }}>
            {formatCurrency(totalSpent)}
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: 18,
            borderRadius: 22,
            border: `1px solid ${borderColor}`,
            background: "#FFFFFF",
            boxShadow: cardShadow,
          }}
        >
          <div style={{ fontSize: 13, color: secondaryText }}>This Month</div>
          <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700, color: primaryText }}>
            {formatCurrency(thisMonthSpent)}
          </div>
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
          + Add Cost
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <button
          onClick={openExportModal}
          style={{
            width: "100%",
            border: `1px solid ${borderColor}`,
            borderRadius: 16,
            padding: "14px 16px",
            background: softBg,
            color: goldText,
            fontWeight: 600,
            fontSize: 16,
            cursor: "pointer",
            boxShadow: "0 8px 18px rgba(0,0,0,0.05)",
          }}
        >
          Export Costs
        </button>
      </div>

      <div
        className="card"
        style={{
          marginTop: 18,
          padding: 18,
          borderRadius: 22,
          border: `1px solid ${borderColor}`,
          background: "#FFFFFF",
          boxShadow: cardShadow,
        }}
      >
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <select className="field-select" value={timeView} onChange={(e) => setTimeView(e.target.value)}>
            {TIME_VIEWS.map((view) => (
              <option key={view} value={view}>
                {capitalize(view)}
              </option>
            ))}
          </select>

          <select className="field-select" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            {availableYears.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </select>

          <select className="field-select" value={horseFilter} onChange={(e) => setHorseFilter(e.target.value)}>
            <option value="all">All Horses</option>
            <option value="shared">Shared</option>
            {horses.map((horse) => (
              <option key={horse.id} value={horse.id}>
                {horse.name || "Unnamed"}
              </option>
            ))}
          </select>

          <select className="field-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All Categories</option>
            {COST_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {capitalize(category)}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 20 }}>
          {chartData.length === 0 || maxChartValue === 0 ? (
            <div style={{ fontSize: 14, color: secondaryText }}>No graph data yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {chartData.map((item) => {
                const widthPercent = maxChartValue ? (item.total / maxChartValue) * 100 : 0;

                return (
                  <div key={item.label}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 6,
                        fontSize: 14,
                        color: primaryText,
                      }}
                    >
                      <span>{item.label}</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(item.total)}</span>
                    </div>

                    <div
                      style={{
                        width: "100%",
                        height: 18,
                        background: "#EFEAE0",
                        borderRadius: 999,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${widthPercent}%`,
                          minWidth: item.total > 0 ? 8 : 0,
                          height: "100%",
                          background: "linear-gradient(90deg, #31425F 0%, #24324A 100%)",
                          borderRadius: 999,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div
        className="card"
        style={{
          marginTop: 18,
          padding: 18,
          borderRadius: 22,
          border: `1px solid ${borderColor}`,
          background: "#FFFFFF",
          boxShadow: cardShadow,
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
            <div style={{ fontSize: 26, fontWeight: 600, color: primaryText }}>Snapshot</div>
            <div style={{ marginTop: 8, fontSize: 14, color: secondaryText }}>
              {topCategory
                ? `Top category: ${capitalize(topCategory.category)} • ${formatCurrency(topCategory.total)}`
                : "No category data yet."}
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: borderColor, marginTop: 14, marginBottom: 14 }} />

        {monthlyHistory.length === 0 ? (
          <div style={{ fontSize: 14, color: secondaryText }}>No matching costs found.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {monthlyHistory.map((group) => (
              <details
                key={group.key}
                style={{
                  border: `1px solid ${borderColor}`,
                  borderRadius: 18,
                  background: "#FCFBF8",
                  padding: 14,
                }}
              >
                <summary style={{ cursor: "pointer", listStyle: "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div style={{ fontWeight: 600, color: primaryText }}>{group.label}</div>
                    <div style={{ fontSize: 14, color: secondaryText, fontWeight: 600 }}>
                      {formatCurrency(group.total)}
                    </div>
                  </div>
                </summary>

                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {group.items.map((cost) => {
                    const horseLabel =
                      cost.horseId === null
                        ? "Shared"
                        : horseNameById[cost.horseId] || cost.horseName || "Unnamed";

                    return (
                      <div key={cost.id} style={{ borderTop: "1px solid #eee", paddingTop: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: primaryText }}>
                              {formatCurrency(cost.amount)} — {cost.item || capitalize(cost.category || "other")}
                            </div>

                            <div style={{ fontSize: 14, color: secondaryText, marginTop: 4 }}>
                              {capitalize(cost.category || "other")} · {horseLabel}
                              {cost.vendor ? ` · ${cost.vendor}` : ""}
                            </div>

                            {cost.notes ? (
                              <div
                                style={{
                                  fontSize: 14,
                                  color: primaryText,
                                  marginTop: 6,
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                {cost.notes}
                              </div>
                            ) : null}

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                              <button className="small-button" onClick={() => openEdit(cost)}>
                                Edit
                              </button>

                              <button
                                className="small-button"
                                onClick={() => deleteCost(cost.id)}
                                style={{ borderColor: burgundy, color: burgundy }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          <div style={{ fontSize: 12, color: secondaryText, whiteSpace: "nowrap" }}>
                            {cost.createdAt ? new Date(cost.createdAt).toLocaleDateString() : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      {isOpen ? (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 30, fontWeight: 600, color: navy }}>
                {mode === "add" ? "Add Cost" : "Edit Cost"}
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

                        {mode === "add" ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 14,
                  border: `1px solid ${borderColor}`,
                  borderRadius: 16,
                  background: "#FCFBF8",
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: primaryText,
                  }}
                >
                  Receipt Scanner
                </div>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    color: secondaryText,
                    lineHeight: 1.4,
                  }}
                >
                  Upload a receipt photo and Lex will try to fill in the cost details.
                </div>

                <input
                  className="field-input"
                  type="file"
                  accept="image/*"
                  onChange={handleReceiptPhotoSelect}
                  style={{ marginTop: 10 }}
                />

                {receiptPreview ? (
                  <div style={{ marginTop: 10 }}>
                    <img
                      src={receiptPreview}
                      alt="Receipt preview"
                      style={{
                        width: "100%",
                        maxHeight: 240,
                        objectFit: "cover",
                        borderRadius: 14,
                        border: `1px solid ${borderColor}`,
                      }}
                    />

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginTop: 10,
                      }}
                    >
                      <button
                        className="small-button"
                        onClick={scanReceipt}
                        disabled={receiptScanning}
                      >
                        {receiptScanning ? "Scanning..." : "Scan Receipt"}
                      </button>

                      <button
                        className="small-button"
                        onClick={() => {
                          setReceiptPhoto(null);
                          setReceiptPreview("");
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <input
              className="field-input"
              type="number"
              step="0.01"
              placeholder="Amount"
              value={costAmount}
              onChange={(e) => setCostAmount(e.target.value)}
              style={{ marginTop: 12 }}
            />

            <select
              className="field-select"
              value={costCategory}
              onChange={(e) => {
                const value = e.target.value;
                setCostCategory(value);
                if (value !== "other") {
                  setCostItem("");
                }
              }}
              style={{ marginTop: 10 }}
            >
              {COST_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {capitalize(category)}
                </option>
              ))}
            </select>

            {costCategory === "other" ? (
              <input
                className="field-input"
                placeholder="What was it for?"
                value={costItem}
                onChange={(e) => setCostItem(e.target.value)}
                style={{ marginTop: 10 }}
              />
            ) : null}

            <select
              className="field-select"
              value={costHorseId}
              onChange={(e) => setCostHorseId(e.target.value)}
              style={{ marginTop: 10 }}
            >
              {sharedHorseOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>

            <input
              className="field-input"
              placeholder="Where / who from?"
              value={costVendor}
              onChange={(e) => setCostVendor(e.target.value)}
              style={{ marginTop: 10 }}
            />

            <input
              className="field-input"
              type="date"
              value={costDate}
              onChange={(e) => setCostDate(e.target.value)}
              style={{ marginTop: 10 }}
            />

            <textarea
              className="field-textarea"
              placeholder="Notes"
              value={costNotes}
              onChange={(e) => setCostNotes(e.target.value)}
              rows={3}
              style={{ marginTop: 10 }}
            />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="secondary-button" onClick={closeModal}>
                Cancel
              </button>
              <button className="primary-button" onClick={saveCost}>
                {mode === "add" ? "Save Cost" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isExportOpen ? (
        <div className="modal-backdrop" onClick={closeExportModal}>
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
              <h3 style={{ margin: 0, fontSize: 30, fontWeight: 600, color: navy }}>
                Export Costs
              </h3>

              <button
                onClick={closeExportModal}
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

            <select
              className="field-select"
              value={exportRangeType}
              onChange={(e) => setExportRangeType(e.target.value)}
              style={{ marginTop: 12 }}
            >
              {EXPORT_RANGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {capitalize(option)}
                </option>
              ))}
            </select>

            {exportRangeType === "year" || exportRangeType === "season" ? (
              <select
                className="field-select"
                value={exportYear}
                onChange={(e) => setExportYear(e.target.value)}
                style={{ marginTop: 10 }}
              >
                {availableYears.map((year) => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                ))}
              </select>
            ) : null}

            {exportRangeType === "season" ? (
              <select
                className="field-select"
                value={exportSeason}
                onChange={(e) => setExportSeason(e.target.value)}
                style={{ marginTop: 10 }}
              >
                <option value="Winter">Winter</option>
                <option value="Spring">Spring</option>
                <option value="Summer">Summer</option>
                <option value="Fall">Fall</option>
              </select>
            ) : null}

            {exportRangeType === "custom" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                <input
                  className="field-input"
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                />
                <input
                  className="field-input"
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                />
              </div>
            ) : null}

            <select
              className="field-select"
              value={exportHorseFilter}
              onChange={(e) => setExportHorseFilter(e.target.value)}
              style={{ marginTop: 10 }}
            >
              <option value="all">All Horses</option>
              <option value="shared">Shared</option>
              {horses.map((horse) => (
                <option key={horse.id} value={horse.id}>
                  {horse.name || "Unnamed"}
                </option>
              ))}
            </select>

            <select
              className="field-select"
              value={exportCategoryFilter}
              onChange={(e) => setExportCategoryFilter(e.target.value)}
              style={{ marginTop: 10 }}
            >
              <option value="all">All Categories</option>
              {COST_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {capitalize(category)}
                </option>
              ))}
            </select>

            <input
              className="field-input"
              placeholder="Item search (example: hay)"
              value={exportItemSearch}
              onChange={(e) => setExportItemSearch(e.target.value)}
              style={{ marginTop: 10 }}
            />

            <div
              style={{
                marginTop: 16,
                padding: 16,
                border: `1px solid ${borderColor}`,
                borderRadius: 16,
                background: "#FCFBF8",
              }}
            >
              <div style={{ fontSize: 14, color: secondaryText }}>Export Preview</div>
              <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700, color: primaryText }}>
                {exportPreviewCosts.length} cost{exportPreviewCosts.length === 1 ? "" : "s"} ·{" "}
                {formatCurrency(exportPreviewTotal)}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="secondary-button" onClick={closeExportModal}>
                Cancel
              </button>
              <button className="primary-button" onClick={exportCostsToCsv}>
                Export CSV
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