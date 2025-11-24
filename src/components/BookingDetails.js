import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { formatDateTime } from "../utils/date.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { format } from "date-fns";
import { db } from "../firebase/firebaseConfig";
import PaymentDetails from "./PaymentDetails.js";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Phone,
  MessageSquare,
  MessageCircle,
  Mail,
  Anchor,
  Users as UsersIcon,
  Briefcase,
  Clock,
  FileText
} from "lucide-react";

/**
 * BookingDetails.jsx — enhanced UI
 * - Tabs: Overview, Payments, Orders, Expenses, Notes
 * - SummaryHeader with payment progress + quick contact actions
 * - Sticky footer with dirty-state Save (Ctrl/Cmd+S) and Esc to close
 * - Notes quick-tags and character count
 * - Notes normalised to BOTH `notes` and `clientNotes` + `notesUpdatedAt`
 */

// -------------------------- Date helpers --------------------------
const formatDateForDisplay = (dateString) => {
  if (!dateString) return "";
  try {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return dateString; // DD/MM/YYYY
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [y, m, d] = dateString.split("-");
      return `${d}/${m}/${y}`;
    }
    const d = new Date(dateString);
    if (!isNaN(d)) return format(d, "dd/MM/yyyy");
    return dateString;
  } catch {
    return dateString;
  }
};

const formatDateForStorage = (dateString) => {
  if (!dateString) return "";
  try {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
      const [d, m, y] = dateString.split("/");
      return `${y}-${m}-${d}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
    const d = new Date(dateString);
    if (!isNaN(d)) return format(d, "yyyy-MM-dd");
    return dateString;
  } catch {
    return dateString;
  }
};

// --------------------- Small UI atoms ---------------------
const Badge = ({ children, tone = "gray" }) => (
  <span
    className={
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium " +
      (tone === "red"
        ? "bg-red-100 text-red-800"
        : tone === "green"
        ? "bg-green-100 text-green-800"
        : tone === "orange"
        ? "bg-orange-100 text-orange-800"
        : "bg-gray-100 text-gray-800")
    }
  >
    {children}
  </span>
);

const PaymentProgress = ({ totalPaid = 0, agreedPrice = 0 }) => {
  const pct = Math.min(
    100,
    Math.round((Number(totalPaid) / Math.max(1, Number(agreedPrice))) * 100)
  );
  const label = agreedPrice <= 0 ? "No price set" : `${pct}% paid`;
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>Payments</span>
        <span>{label}</span>
      </div>
      <div className="w-full h-2 rounded bg-gray-200 overflow-hidden">
        <div
          className={`h-full ${
            pct === 100
              ? "bg-green-500"
              : pct > 0
              ? "bg-blue-500"
              : "bg-gray-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const SummaryChip = ({ icon: Icon, label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
      <Icon size={14} className="text-slate-400" />
      {label}
    </div>
    <p className="mt-1 text-base font-semibold text-slate-900">{value || "—"}</p>
  </div>
);

const QuickActionButton = ({ icon: Icon, label, href, disabled, target }) => {
  const baseClasses =
    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-1";
  const enabledClasses =
    "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900 focus:ring-slate-200";
  const disabledClasses = "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed";

  const inner = (
    <>
      <Icon size={15} />
      {label}
    </>
  );

  if (disabled) {
    return <span className={`${baseClasses} ${disabledClasses}`}>{inner}</span>;
  }

  return (
    <a
      href={href}
      target={target}
      rel={target === "_blank" ? "noreferrer" : undefined}
      className={`${baseClasses} ${enabledClasses}`}
    >
      {inner}
    </a>
  );
};

const QuickActionsBar = ({ booking, showContact = true }) => {
  if (!showContact) return null;

  const phone = booking?.clientPhone
    ? String(booking.clientPhone).replace(/\s+/g, "")
    : "";
  const whatsappLink = phone ? `https://wa.me/${phone.replace(/\D/g, "")}` : "#";

  const actions = [
    {
      label: "Call client",
      icon: Phone,
      href: phone ? `tel:${phone}` : "#",
      disabled: !phone
    },
    {
      label: "Send SMS",
      icon: MessageSquare,
      href: phone ? `sms:${phone}` : "#",
      disabled: !phone
    },
    {
      label: "WhatsApp",
      icon: MessageCircle,
      href: whatsappLink,
      disabled: !phone,
      target: "_blank"
    },
    {
      label: "Email",
      icon: Mail,
      href: booking?.clientEmail ? `mailto:${booking.clientEmail}` : "#",
      disabled: !booking?.clientEmail
    }
  ];

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {actions.map((action) => (
        <QuickActionButton key={action.label} {...action} />
      ))}
    </div>
  );
};

const KeyStatCard = ({ label, value, helper }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
      {label}
    </p>
    <p className="mt-1 text-xl font-semibold text-slate-900">{value || "—"}</p>
    {helper && <p className="text-xs text-slate-500">{helper}</p>}
  </div>
);

const InfoCard = ({ title, subtitle, actions, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        {subtitle && (
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
            {subtitle}
          </p>
        )}
        <h4 className="text-lg font-semibold text-slate-900">{title}</h4>
      </div>
      {actions}
    </div>
    {children}
  </div>
);

const TabBar = ({ tabs, active, onChange }) => (
  <div className="flex flex-wrap gap-2 border-b border-gray-200 mb-4">
    {tabs.map((t) => (
      <button
        key={t}
        onClick={() => onChange(t)}
        className={`px-3 py-1.5 text-sm rounded-t ${
          active === t
            ? "bg-white border border-gray-200 border-b-white -mb-px font-medium"
            : "text-gray-600 hover:text-gray-900"
        }`}
      >
        {t}
      </button>
    ))}
  </div>
);

const NoteQuickTags = ({ onPick }) => {
  const tags = [
    "VIP",
    "Allergies",
    "Birthday",
    "Anniversary",
    "Kids",
    "Wheelchair",
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onPick(t)}
          className="px-2 py-1 rounded-full text-xs bg-gray-100 hover:bg-gray-200"
        >
          {t}
        </button>
      ))}
    </div>
  );
};

// --------------------- FoodOrderIndicator ---------------------
const FoodOrderIndicator = ({ booking }) => {
  const [hasFoodOrder, setHasFoodOrder] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkForFoodOrders = async () => {
      if (!booking?.id) return setIsChecking(false);
      try {
        const bookingRef = doc(db, "bookings", booking.id);
        const bookingDoc = await getDoc(bookingRef);
        if (!bookingDoc.exists()) return setIsChecking(false);
        const bookingData = bookingDoc.data();
        const linkedOrders = bookingData.linkedOrders || [];
        if (!linkedOrders.length) return setIsChecking(false);

        let foundFood = false;
        for (const lo of linkedOrders) {
          if (!lo.orderDocId) continue;
          try {
            const orderDoc = await getDoc(doc(db, "orders", lo.orderDocId));
            if (!orderDoc.exists()) continue;
            const items = orderDoc.data().items || [];
            if (
              items.some(
                (it) =>
                  (it.name || "").toLowerCase().includes("grazing") ||
                  (it.name || "").toLowerCase().includes("platter") ||
                  (it.name || "").toLowerCase().includes("food") ||
                  it.category === "food" ||
                  it.category === "grazing"
              )
            ) {
              foundFood = true;
              break;
            }
          } catch (e) {
            console.error("Error checking order", lo.orderDocId, e);
          }
        }
        setHasFoodOrder(foundFood);
      } catch (e) {
        console.error("Error checking for food orders:", e);
      } finally {
        setIsChecking(false);
      }
    };
    checkForFoodOrders();
  }, [booking?.id]);

  if (isChecking) {
    return (
      <div
        className="inline-flex items-center justify-center w-6 h-6"
        title="Checking for food orders..."
      >
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600" />
      </div>
    );
  }
  if (!hasFoodOrder) return null;
  return (
    <div
      className="inline-flex items-center justify-center w-6 h-6 bg-orange-100 rounded-full ml-2"
      title="This booking has food orders"
    >
      <span className="text-orange-600 text-sm">🍽️</span>
    </div>
  );
};

// --------------------- Summary Header ---------------------
const SummaryHeader = ({ booking }) => {
  const chipData = [
    {
      label: "Boat",
      value: booking.boatName || "Unassigned",
      icon: Anchor
    },
    {
      label: "Schedule",
      value: booking.startTime
        ? `${booking.startTime}${booking.endTime ? ` – ${booking.endTime}` : ""}`
        : booking.bookingDate || "TBD",
      icon: Clock
    },
    {
      label: "Guests",
      value:
        booking.numberOfPassengers !== undefined &&
        booking.numberOfPassengers !== null
          ? `${booking.numberOfPassengers} pax`
          : "No passenger data",
      icon: UsersIcon
    },
    {
      label: "Partner",
      value: booking.partnerName || booking.clientType || "Direct",
      icon: Briefcase
    }
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
            Primary guest
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="text-2xl font-semibold text-slate-900">
              {booking.clientName || "Unknown client"}
            </h3>
            {booking.isCancelled && <Badge tone="red">Cancelled</Badge>}
            <FoodOrderIndicator booking={booking} />
          </div>
          <p className="text-sm text-slate-600">
            {booking.bookingDate || "Date TBC"} ·{" "}
            {booking.boatName || "Boat unassigned"}
          </p>
        </div>
        <div className="w-full lg:max-w-sm">
          <PaymentProgress
            totalPaid={booking?.pricing?.totalPaid}
            agreedPrice={booking?.pricing?.agreedPrice || booking?.finalPrice}
          />
          <div className="mt-1 text-xs text-slate-500">
            Status: {booking?.pricing?.paymentStatus || "No Payment"} · Paid €
            {Number(booking?.pricing?.totalPaid || 0).toFixed(2)} of €
            {Number(booking?.pricing?.agreedPrice || 0).toFixed(2)}
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {chipData.map((chip) => (
          <SummaryChip key={chip.label} {...chip} />
        ))}
      </div>
    </div>
  );
};

// ------------------------ BookingDetails ------------------------
const BookingDetails = ({ booking, onClose }) => {
  const navigate = useNavigate();
  const { isAdmin, isEmployee, isDriver, isStaff } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [tab, setTab] = useState("Overview");
  const modalRef = useRef(null);
  const [linkedExpenses, setLinkedExpenses] = useState([]);
  const [copySuccess, setCopySuccess] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [invoiceShareOption, setInvoiceShareOption] = useState("outstanding");
  const [customInvoiceAmount, setCustomInvoiceAmount] = useState("");
  const isAdminUser = isAdmin?.();
  const isEmployeeUser = isEmployee?.();
  const isDriverUser = isDriver?.();
  const isStaffUser = isStaff?.();
  const hideContactInfo = isDriverUser || ((isEmployeeUser || isStaffUser) && !isAdminUser);
  const redactedText = "Not available";

  // Dirty state baseline
  const baselineRef = useRef(null);
  const [isDirty, setIsDirty] = useState(false);

  // Normalise notes from either key into a single source of truth
  const initialNotes = useMemo(
    () => booking?.notes ?? booking?.clientNotes ?? "",
    [booking?.notes, booking?.clientNotes]
  );

  const [editedBooking, setEditedBooking] = useState(() => {
    const displayDate = formatDateForDisplay(booking?.bookingDate);
    const payments = Array.isArray(booking?.payments)
      ? booking.payments
      : Array.isArray(booking?.pricing?.payments)
      ? booking.pricing.payments
      : [];

    const firstPayment = payments.find((p) => p.type === "first") || {
      amount: 0,
      method: "cash",
      received: false,
      date: "",
      type: "first",
    };
    const secondPayment = payments.find((p) => p.type === "second") || {
      amount: 0,
      method: "pos",
      received: false,
      date: "",
      type: "second",
    };

    return {
      ...booking,
      bookingDate: displayDate,
      payments,
      firstPayment,
      secondPayment,
      finalPrice: booking?.pricing?.agreedPrice || 0,
      paymentStatus: booking?.pricing?.paymentStatus || "No Payment",
      clientNotes: initialNotes,
      notes: initialNotes,
    };
  });

  // Focus modal when opened
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  // Track dirty state while editing
  useEffect(() => {
    if (isEditing) baselineRef.current = JSON.stringify(editedBooking);
    setIsDirty(false);
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing || !baselineRef.current) return;
    const now = JSON.stringify(editedBooking);
    setIsDirty(now !== baselineRef.current);
  }, [isEditing, editedBooking]);

  // Keyboard shortcuts: Save (Ctrl/Cmd+S) and Esc to close
  useEffect(() => {
    const onKey = (e) => {
      const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
      if (isSave) {
        e.preventDefault();
        if (isEditing && isDirty) handleSaveBooking();
      }
      if (e.key === "Escape") {
        if (isEditing && isDirty) {
          const leave = window.confirm("Discard unsaved changes?");
          if (!leave) return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isEditing, isDirty]);

  // Guard close when clicking backdrop
  const handleBackdropClick = () => {
    if (isEditing && isDirty) {
      const leave = window.confirm("Discard unsaved changes?");
      if (!leave) return;
    }
    onClose();
  };

  // Fetch latest booking and re-normalise notes
  useEffect(() => {
    if (!booking?.id) return;
    const fetchLatest = async () => {
      try {
        const snap = await getDoc(doc(db, "bookings", booking.id));
        if (!snap.exists()) return;
        const data = snap.data();
        const displayDate = formatDateForDisplay(data.bookingDate);
        const payments = Array.isArray(data?.payments)
          ? data.payments
          : Array.isArray(data?.pricing?.payments)
          ? data.pricing.payments
          : [];
        const firstPayment = payments.find((p) => p.type === "first") || {
          amount: 0,
          method: "cash",
          received: false,
          date: "",
          type: "first",
        };
        const secondPayment = payments.find((p) => p.type === "second") || {
          amount: 0,
          method: "pos",
          received: false,
          date: "",
          type: "second",
        };
        const normalisedNotes = data.notes ?? data.clientNotes ?? "";
        setEditedBooking((prev) => ({
          ...prev,
          ...data,
          id: booking.id,
          bookingDate: displayDate,
          firstPayment,
          secondPayment,
          finalPrice: data?.pricing?.agreedPrice || 0,
          paymentStatus: data?.pricing?.paymentStatus || "No Payment",
          clientName: data.clientName || data.clientDetails?.name || "",
          clientPhone: data.clientPhone || data.clientDetails?.phone || "",
          clientEmail: data.clientEmail || data.clientDetails?.email || "",
          clientPassport: data.clientPassport || data.clientDetails?.passportNumber || "",
          clientNotes: normalisedNotes,
          notes: normalisedNotes,
          boatName: data.boatName || data.bookingDetails?.boatName || "",
          boatCompanyName: data.boatCompanyName || data.bookingDetails?.boatCompany || "",
          numberOfPassengers:
            data.numberOfPassengers || data.bookingDetails?.passengers || "",
          restaurantName: data.restaurantName || "",
          startTime: data.startTime || data.bookingDetails?.startTime || "",
          endTime: data.endTime || data.bookingDetails?.endTime || "",
        }));
      } catch (e) {
        console.error("Error fetching latest booking data:", e);
      }
    };
    fetchLatest();
  }, [booking?.id]);

  // Real-time expenses
  useEffect(() => {
    if (!booking?.id) return;
    const qy = query(
      collection(db, "expenses"),
      where("bookingId", "==", booking.id)
    );
    const unsub = onSnapshot(qy, (qs) => {
      const all = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
      const parents = all.filter((e) => !e.parentId);
      const children = all.filter((e) => e.parentId);
      const combined = parents.map((p) => ({
        ...p,
        subExpenses: children.filter((c) => c.parentId === p.id),
      }));
      setLinkedExpenses(combined);
    });
    return () => unsub();
  }, [booking?.id]);

  const handleEditInSanAntonio = () => {
    handleModalClick({ stopPropagation: () => {} });
    onClose();
    navigate("/san-antonio-tours", { state: { editBookingId: booking.id } });
  };
  const isSanAntonioBooking = booking?.location === "San Antonio";

  const handleCancelBooking = async () => {
    if (
      !window.confirm(
        "Are you sure you want to cancel this booking? This action can be reversed later."
      )
    )
      return;
    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        isCancelled: true,
        cancellationDate: new Date().toISOString(),
        cancellationReason: window.prompt(
          "Please provide a reason for cancellation (optional):",
          ""
        ),
        lastUpdated: serverTimestamp(),
      });
      const updatedDoc = await getDoc(doc(db, "bookings", booking.id));
      if (updatedDoc.exists())
        setEditedBooking((p) => ({ ...p, ...updatedDoc.data() }));
      alert("Booking has been cancelled successfully.");
    } catch (e) {
      console.error("Error cancelling booking:", e);
      alert("Failed to cancel booking. Please try again.");
    }
  };

  const handleUndoCancel = async () => {
    if (
      !window.confirm(
        "Are you sure you want to restore this cancelled booking?"
      )
    )
      return;
    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        isCancelled: false,
        cancellationDate: null,
        cancellationReason: null,
        lastUpdated: serverTimestamp(),
      });
      const updatedDoc = await getDoc(doc(db, "bookings", booking.id));
      if (updatedDoc.exists())
        setEditedBooking((p) => ({ ...p, ...updatedDoc.data() }));
      alert("Booking has been restored successfully.");
    } catch (e) {
      console.error("Error restoring booking:", e);
      alert("Failed to restore booking. Please try again.");
    }
  };

  const handleDeleteBooking = useCallback(async () => {
    if (!booking?.id) return;
    if (!isAdmin?.()) {
      alert("Only administrators can delete bookings.");
      return;
    }
    const confirm = window.confirm(
      "Delete this booking permanently? This cannot be undone."
    );
    if (!confirm) return;

    try {
      setIsDeleting(true);
      await deleteDoc(doc(db, "bookings", booking.id));
      alert("Booking deleted.");
      onClose();
    } catch (error) {
      console.error("Failed to delete booking:", error);
      alert("Failed to delete booking. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }, [booking?.id, isAdmin, onClose]);

  const copyToClipboard = (text, field) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopySuccess(`${field} copied!`);
        setTimeout(() => setCopySuccess(""), 2000);
      })
      .catch(() => {
        setCopySuccess("Failed to copy!");
        setTimeout(() => setCopySuccess(""), 2000);
      });
  };

  const copyAllClientInfo = () => {
    const redactedValue = hideContactInfo ? redactedText : null;
    const clientInfo = `Client Name: ${editedBooking.clientName || "N/A"}
Client Type: ${editedBooking.clientType || "N/A"}
Phone: ${redactedValue ?? editedBooking.clientPhone ?? "N/A"}
Email: ${redactedValue ?? editedBooking.clientEmail ?? "N/A"}
Passport: ${redactedValue ?? editedBooking.clientPassport ?? "N/A"}
Address: ${redactedValue ?? editedBooking.clientDetails?.address ?? editedBooking.address ?? "N/A"}`;
    copyToClipboard(clientInfo, "All client info");
  };

  const handleExpensePaymentStatusChange = async (expenseId, newStatus) => {
    try {
      await updateDoc(doc(db, "expenses", expenseId), { paymentStatus: newStatus });
      setLinkedExpenses((prev) =>
        prev.map((p) => ({
          ...p,
          paymentStatus: p.id === expenseId ? newStatus : p.paymentStatus,
          subExpenses: (p.subExpenses || []).map((s) =>
            s.id === expenseId ? { ...s, paymentStatus: newStatus } : s
          ),
        }))
      );
    } catch (e) {
      console.error("Error updating payment status:", e);
      alert("Failed to update payment status. Please try again.");
    }
  };

  // ---------------------- LinkedOrdersSection ----------------------
  const LinkedOrdersSection = () => {
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [forceUpdate, setForceUpdate] = useState(0);

    useEffect(() => {
      if (!booking?.id) return;
      setIsLoading(true);
      const fetchData = async () => {
        try {
          const snap = await getDoc(doc(db, "bookings", booking.id));
          if (!snap.exists()) return setIsLoading(false);
          const linkedOrders = snap.data().linkedOrders || [];
          if (!linkedOrders.length) {
            setOrders([]);
            return setIsLoading(false);
          }
          const details = [];
          for (const lo of linkedOrders) {
            if (!lo.orderDocId) continue;
            try {
              const od = await getDoc(doc(db, "orders", lo.orderDocId));
              if (od.exists()) details.push({ id: od.id, ...od.data() });
            } catch (e) {
              console.error("Error fetching order", lo.orderDocId, e);
            }
          }
          setOrders(details);
        } catch (e) {
          console.error("Error fetching linked orders:", e);
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    }, [booking?.id, forceUpdate]);

    const handleDeleteOrder = async (order) => {
      if (isUpdating) return;
      const orderId = order.id;
      if (!orderId) return alert("Cannot delete this order: Missing ID");
      if (!window.confirm(`Remove order ${order.orderId || orderId} from the booking?`))
        return;
      setIsUpdating(true);
      try {
        const bookingRef = doc(db, "bookings", booking.id);
        const snap = await getDoc(bookingRef);
        if (!snap.exists()) throw new Error("Booking not found");
        const current = snap.data().linkedOrders || [];
        let next = current.filter((lo) => lo.orderDocId !== orderId);
        if (next.length === current.length) {
          next = current.filter((lo) => lo.orderId !== order.orderId);
        }
        if (next.length === current.length)
          throw new Error("Order not linked or ID mismatch");
        await updateDoc(bookingRef, {
          linkedOrders: next,
          lastUpdated: serverTimestamp(),
        });
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        setTimeout(() => {
          setForceUpdate((x) => x + 1);
          setIsUpdating(false);
        }, 200);
      } catch (e) {
        console.error("Error removing order:", e);
        alert(`Error removing order: ${e.message}`);
        setIsUpdating(false);
      }
    };

    const handleOrderStatusUpdate = async (order, field, newValue) => {
      if (isUpdating) return;
      setIsUpdating(true);
      try {
        const updateData = { [field]: newValue, updatedAt: serverTimestamp() };
        if (field === "paymentStatus" && newValue === "paid") {
          const total = order.amount_total || order.amount || 0;
          updateData.payment_details = {
            ...(order.payment_details || {}),
            amountPaid: total,
            paymentDate: new Date().toISOString(),
          };
        }
        await updateDoc(doc(db, "orders", order.id), updateData);

        const bookingRef = doc(db, "bookings", booking.id);
        const snap = await getDoc(bookingRef);
        if (snap.exists()) {
          const linkedOrders = snap.data().linkedOrders || [];
          const updated = linkedOrders.map((lo) => {
            if (lo.orderDocId === order.id) {
              const o = { ...lo, [field]: newValue };
              if (field === "paymentStatus" && newValue === "paid") {
                o.payment_details = {
                  ...(lo.payment_details || {}),
                  amountPaid: order.amount_total || order.amount || 0,
                  paymentDate: new Date().toISOString(),
                };
              }
              return o;
            }
            return lo;
          });
          await updateDoc(bookingRef, {
            linkedOrders: updated,
            lastUpdated: serverTimestamp(),
          });
        }

        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id
              ? {
                  ...o,
                  [field]: newValue,
                  ...(field === "paymentStatus" && newValue === "paid"
                    ? {
                        payment_details: {
                          ...(o.payment_details || {}),
                          amountPaid: o.amount_total || o.amount || 0,
                          paymentDate: new Date().toISOString(),
                        },
                      }
                    : {}),
                }
              : o
          )
        );
      } catch (e) {
        console.error(`Error updating ${field}:`, e);
        alert(`Failed to update ${field}. Please try again.`);
      } finally {
        setIsUpdating(false);
      }
    };

    const getStatusColor = (status) => {
      switch (status) {
        case "paid":
        case "delivered":
        case "completed":
          return "bg-green-100 text-green-800";
        case "pending":
        case "preparing":
          return "bg-yellow-100 text-yellow-800";
        case "cancelled":
          return "bg-red-100 text-red-800";
        default:
          return "bg-gray-100 text-gray-800";
      }
    };

    const renderItems = (items) => {
      if (!items?.length) return "No items";
      const cats = { grazing: [], drinks: [], other: [] };
      items.forEach((it) => {
        const name = it.name || "";
        if (name.includes("Grazing")) cats.grazing.push(it);
        else if (name.includes("Wine") || name.includes("Estrella"))
          cats.drinks.push(it);
        else cats.other.push(it);
      });
      return (
        <div className="space-y-2">
          {cats.grazing.length > 0 && (
            <div>
              <div className="text-xs uppercase text-gray-500 font-medium mb-1">
                Grazing Platters
              </div>
              {cats.grazing.map((it, i) => (
                <div key={i} className="text-sm py-0.5">
                  <strong>{it.quantity}x</strong>{" "}
                  {String(it.name)
                    .replace("pax x", "")
                    .replace("Grazing Platter", "")
                    .replace("Grazing Plater", "")
                    .trim()}
                </div>
              ))}
            </div>
          )}
          {cats.drinks.length > 0 && (
            <div>
              <div className="text-xs uppercase text-gray-500 font-medium mb-1">
                Drinks
              </div>
              {cats.drinks.map((it, i) => (
                <div key={i} className="text-sm py-0.5">
                  <strong>{it.quantity}x</strong> {it.name}
                </div>
              ))}
            </div>
          )}
          {cats.other.length > 0 && (
            <div>
              <div className="text-xs uppercase text-gray-500 font-medium mb-1">
                Other Items
              </div>
              {cats.other.map((it, i) => (
                <div key={i} className="text-sm py-0.5">
                  <strong>{it.quantity}x</strong> {it.name}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <h4 className="text-lg font-bold text-gray-800">Linked Orders</h4>
          {isUpdating && (
            <span className="text-sm text-blue-600 animate-pulse">Updating...</span>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600 mb-2" />
            <p>Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No orders linked to this booking</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 table-fixed">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                    Order ID
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider flex-1">
                    Items
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Total
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                    Paid/Due
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Payment
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Delivery
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => {
                  const total = order.amount_total || order.amount || 0;
                  const paid =
                    order.paymentStatus === "paid"
                      ? total
                      : order.payment_details?.amountPaid || 0;
                  const due =
                    order.paymentStatus === "paid"
                      ? 0
                      : Math.max(0, total - paid);
                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {order.orderId || "N/A"}
                      </td>
                      <td className="px-4 py-3">{renderItems(order.items)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium text-right">
                        €{total.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm text-green-600 font-medium">
                          €{paid.toFixed(2)} paid
                        </div>
                        {due > 0 && (
                          <div className="text-sm text-red-600 font-medium">
                            €{due.toFixed(2)} due
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() =>
                            handleOrderStatusUpdate(
                              order,
                              "paymentStatus",
                              order.paymentStatus === "paid" ? "unpaid" : "paid"
                            )
                          }
                          disabled={isUpdating}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${getStatusColor(
                            order.paymentStatus
                          )} ${
                            isUpdating
                              ? "opacity-50 cursor-not-allowed"
                              : "hover:bg-opacity-80"
                          }`}
                        >
                          {order.paymentStatus || "unpaid"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() =>
                            handleOrderStatusUpdate(
                              order,
                              "deliveryStatus",
                              order.deliveryStatus === "delivered"
                                ? "pending"
                                : "delivered"
                            )
                          }
                          disabled={isUpdating}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${getStatusColor(
                            order.deliveryStatus || order.status
                          )} ${
                            isUpdating
                              ? "opacity-50 cursor-not-allowed"
                              : "hover:bg-opacity-80"
                          }`}
                        >
                          {order.deliveryStatus || order.status || "pending"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center space-x-2">
                          <button
                            className="text-blue-600 hover:text-blue-800 px-2 py-1 bg-blue-50 hover:bg-blue-100 rounded text-sm"
                            onClick={() =>
                              alert(
                                `Order Details:\nID: ${order.orderId || "N/A"}\nStatus: ${
                                  order.status || "N/A"
                                }\nTotal: €${total.toFixed(2)}\nItems: ${
                                  order.items ? order.items.length : 0
                                }`
                              )
                            }
                          >
                            View
                          </button>
                          <button
                            className="text-red-600 hover:text-red-800 px-2 py-1 bg-red-50 hover:bg-red-100 rounded text-sm"
                            onClick={() => handleDeleteOrder(order)}
                            disabled={isUpdating}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const handlePaymentChange = (paymentIndex, updates) => {
    setEditedBooking((prev) => {
      const updatedPayments = [...(prev.pricing?.payments || [])];
      if (!updatedPayments[paymentIndex]) {
        updatedPayments[paymentIndex] = {
          type: paymentIndex === 0 ? "first" : "second",
          amount: 0,
          method: paymentIndex === 0 ? "cash" : "pos",
          received: false,
          date: "",
          excludeVAT: false,
          percentage: paymentIndex === 0 ? 30 : 70,
          recordedAt: new Date().toISOString(),
        };
      }
      if (updates.percentage !== undefined) {
        const finalPrice = Number(prev.finalPrice) || 0;
        const pct = Number(updates.percentage) || 0;
        updatedPayments[paymentIndex] = {
          ...updatedPayments[paymentIndex],
          ...updates,
          percentage: pct,
          amount: ((finalPrice * pct) / 100).toFixed(2),
        };
      } else {
        updatedPayments[paymentIndex] = {
          ...updatedPayments[paymentIndex],
          ...updates,
        };
      }
      const totalPaid = updatedPayments.reduce(
        (sum, p) => sum + (p.received ? Number(p.amount) || 0 : 0),
        0
      );
      const paymentStatus =
        totalPaid === 0
          ? "No Payment"
          : totalPaid >= (prev.pricing?.agreedPrice || 0)
          ? "Completed"
          : "Partial";
      return {
        ...prev,
        pricing: {
          ...prev.pricing,
          payments: updatedPayments,
          totalPaid,
          paymentStatus,
        },
      };
    });
  };

  const ExpensesSection = () => {
    const calculateTotal = () =>
      linkedExpenses.reduce((sum, e) => {
        const main = Number(e.amount) || 0;
        const subs = (e.subExpenses || []).reduce(
          (s, se) => s + (Number(se.amount) || 0),
          0
        );
        return sum + main + subs;
      }, 0);

    const safeFormatDate = (v) => {
      if (!v) return "N/A";
      try {
        const d = new Date(v);
        if (isNaN(d.getTime())) return "Invalid date";
        return format(d, "dd/MM/yyyy");
      } catch {
        return "Invalid date";
      }
    };

    return (
      <div className="p-4 border rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-lg font-bold">Linked Expenses</h4>
          <div className="text-sm text-gray-600">
            Total Expenses: €{calculateTotal().toFixed(2)}
          </div>
        </div>

        {linkedExpenses.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Category
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Description
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {linkedExpenses.map((e) => (
                  <React.Fragment key={e.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap">
                        {safeFormatDate(e.date)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">{e.category}</td>
                      <td className="px-4 py-2">{e.description}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        €{Number(e.amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <button
                          onClick={() =>
                            handleExpensePaymentStatusChange(
                              e.id,
                              e.paymentStatus === "paid" ? "pending" : "paid"
                            )
                          }
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            e.paymentStatus === "paid"
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {e.paymentStatus || "pending"}
                        </button>
                      </td>
                    </tr>

                    {(e.subExpenses || []).map((se) => (
                      <tr key={se.id} className="bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap pl-8">
                          {safeFormatDate(se.date)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {se.category}
                        </td>
                        <td className="px-4 py-2">{se.description}</td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          €{Number(se.amount).toFixed(2)}
                        </td>
                        <td>
                          <span
                            onClick={() =>
                              handleExpensePaymentStatusChange(
                                se.id,
                                se.paymentStatus === "paid" ? "pending" : "paid"
                              )
                            }
                            className={`cursor-pointer px-2 py-1 rounded-full text-xs font-medium ${
                              se.paymentStatus === "paid"
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {se.paymentStatus || "pending"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">
            No expenses linked to this booking
          </p>
        )}
      </div>
    );
  };

  const handleInputChange = (field, value) => {
    setEditedBooking((prev) => {
      if (field === "firstPayment" || field === "secondPayment") {
        const updatedPayment = { ...prev[field], ...value };
        if (value.received !== undefined) {
          updatedPayment.date = value.received
            ? new Date().toISOString().split("T")[0]
            : "";
        }
        const next = { ...prev, [field]: updatedPayment };
        const firstReceived = next.firstPayment?.received || false;
        const secondReceived = next.secondPayment?.received || false;
        next.paymentStatus = firstReceived && secondReceived
          ? "Completed"
          : firstReceived || secondReceived
          ? "Partial"
          : "No Payment";
        return next;
      }
      if (field === "clientNotes" || field === "notes") {
        return { ...prev, clientNotes: value, notes: value };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleFinalPriceChange = (newPrice) => {
    setEditedBooking((prev) => ({ ...prev, finalPrice: Number(newPrice) || 0 }));
  };

  // ---------------------------- Save ----------------------------
  const handleSaveBooking = async () => {
    if (!editedBooking.clientName?.trim()) return alert("Client name is required.");
    if (!editedBooking.bookingDate?.trim()) return alert("Booking date is required.");

    try {
      const formattedDate = formatDateForStorage(editedBooking.bookingDate);
      const bookingRef = doc(db, "bookings", booking.id);
      const currentSnap = await getDoc(bookingRef);
      const currentData = currentSnap.exists() ? currentSnap.data() : {};

      const updatedBookingDetails = {
        ...(currentData.bookingDetails || {}),
        date: formattedDate,
        boatName: editedBooking.boatName || currentData.bookingDetails?.boatName || "",
        boatCompany:
          editedBooking.boatCompanyName || currentData.bookingDetails?.boatCompany || "",
        passengers: Number(editedBooking.numberOfPassengers) || 0,
        startTime: editedBooking.startTime || currentData.bookingDetails?.startTime || "",
        endTime: editedBooking.endTime || currentData.bookingDetails?.endTime || "",
      };

      const payments = editedBooking.pricing?.payments || [];
      const totalPaid = payments.reduce(
        (sum, p) => sum + (p.received ? Number(p.amount) || 0 : 0),
        0
      );
      const paymentStatus =
        totalPaid === 0
          ? "No Payment"
          : totalPaid >= Number(editedBooking.finalPrice || 0)
          ? "Completed"
          : "Partial";

      const normalisedNotes = editedBooking.notes ?? editedBooking.clientNotes ?? "";

      const bookingToSave = {
        bookingDate: formattedDate,
        ...(editedBooking.clientName ? { clientName: editedBooking.clientName } : {}),
        ...(editedBooking.clientPhone ? { clientPhone: editedBooking.clientPhone } : {}),
        ...(editedBooking.clientEmail ? { clientEmail: editedBooking.clientEmail } : {}),
        ...(editedBooking.clientPassport ? { clientPassport: editedBooking.clientPassport } : {}),
        bookingDetails: updatedBookingDetails,
        clientDetails: {
          ...(currentData.clientDetails || {}),
          name: editedBooking.clientName || currentData.clientDetails?.name || "",
          phone: editedBooking.clientPhone || currentData.clientDetails?.phone || "",
          email: editedBooking.clientEmail || currentData.clientDetails?.email || "",
          passportNumber:
            editedBooking.clientPassport || currentData.clientDetails?.passportNumber || "",
          address: editedBooking.clientDetails?.address || editedBooking.address || "",
        },
        pricing: {
          ...(currentData.pricing || {}),
          agreedPrice: Number(editedBooking.finalPrice) || 0,
          lastUpdated: new Date().toISOString(),
          payments,
          totalPaid,
          paymentStatus,
        },
        restaurantName: editedBooking.restaurantName || currentData.restaurantName || "",
        // IMPORTANT: write BOTH keys and bump a timestamp
        notes: normalisedNotes,
        clientNotes: normalisedNotes,
        notesUpdatedAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
      };

      await updateDoc(bookingRef, bookingToSave);
      setIsEditing(false);
      alert("Booking updated successfully!");
      onClose();
    } catch (e) {
      console.error("Error saving booking:", e);
      alert("Failed to save booking. Please try again. Error: " + e.message);
    }
  };

  const handleModalClick = (e) => e.stopPropagation();

  const CopyButton = ({ text, field }) => (
    <button
      onClick={() => copyToClipboard(text, field)}
      className="ml-2 text-gray-400 hover:text-blue-500 focus:outline-none"
      aria-label={`Copy ${field}`}
      title={`Copy ${field}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
    </button>
  );

  const renderField = (field) => {
    const {
      label,
      key,
      value,
      display,
      copyValue,
      editable = true,
      type = "text",
      placeholder,
      inputProps = {}
    } = field;

    const resolvedValue = value ?? "";
    const displayValue = display ?? (typeof resolvedValue === "number" ? resolvedValue : resolvedValue || "");
    const canEdit = isEditing && editable !== false && Boolean(key);
    const effectiveKey = field.id || key || label;
    const copyText = copyValue ?? displayValue ?? "";
    const onChange = field.onChange
      ? field.onChange
      : (val) => key && handleInputChange(key, val);

    const baseInputClasses =
      "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

    let control = null;
    if (canEdit) {
      if (type === "textarea") {
        control = (
          <textarea
            className={`${baseInputClasses} resize-none`}
            rows={3}
            value={resolvedValue || ""}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      } else {
        control = (
          <input
            type={type}
            className={baseInputClasses}
            value={resolvedValue || ""}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            {...inputProps}
          />
        );
      }
    } else {
      control = (
        <p className="text-sm text-slate-900">
          {displayValue || "—"}
        </p>
      );
    }

    return (
      <div key={effectiveKey} className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          {label}
          {!canEdit && copyText && (
            <CopyButton text={copyText} field={label} />
          )}
        </div>
        {control}
      </div>
    );
  };

  const totalPaidValue = Number(editedBooking?.pricing?.totalPaid || 0);
  const agreedPriceValue = Number(
    editedBooking?.pricing?.agreedPrice || editedBooking?.finalPrice || 0
  );
  const paymentStatusLabel =
    editedBooking?.pricing?.paymentStatus ||
    editedBooking.paymentStatus ||
    "No Payment";
  const bookingReference =
    editedBooking.bookingReference ||
    editedBooking.reference ||
    editedBooking.id ||
    booking?.id ||
    "";
  const transferSummary = editedBooking.privateTransfer
    ? `${editedBooking.pickupLocation || "Pickup TBD"} → ${
        editedBooking.dropoffLocation || "Drop-off TBD"
      }`
    : "Tap edit to add transfer details";
  const bookingDateDisplay =
    formatDateForDisplay(editedBooking.bookingDate) ||
    editedBooking.bookingDate ||
    "";
  const bookingDateInputValue =
    formatDateForStorage(editedBooking.bookingDate) || "";
  const passengerDisplay =
    editedBooking.numberOfPassengers || editedBooking.numberOfPassengers === 0
      ? `${editedBooking.numberOfPassengers} guests`
      : "";
  const notePreview =
    editedBooking.clientNotes?.trim() ||
    editedBooking.notes?.trim() ||
    "";
  const paymentBreakdown = useMemo(() => {
    const payments = Array.isArray(editedBooking?.pricing?.payments)
      ? editedBooking.pricing.payments
      : [];
    const firstPayment = payments.find((p) => p.type === "first");
    const secondPayment = payments.find((p) => p.type === "second");
    const firstAmount = Number(firstPayment?.amount) || 0;
    const secondAmount = Number(secondPayment?.amount) || 0;
    const totalPaid =
      payments.reduce((sum, payment) => sum + (Number(payment?.amount) || 0), 0) || 0;
    const outstanding = Math.max(agreedPriceValue - totalPaid, 0);

    return {
      firstAmount,
      secondAmount,
      firstPercentage: Number(firstPayment?.percentage) || null,
      totalPaid,
      outstanding: Number.isFinite(outstanding) ? outstanding : 0
    };
  }, [editedBooking?.pricing?.payments, agreedPriceValue]);

  const clientFieldsConfig = [
    {
      label: "Client name",
      key: "clientName",
      value: editedBooking.clientName || "",
      copyValue: editedBooking.clientName || ""
    },
    {
      label: "Client type",
      value: editedBooking.clientType || "",
      copyValue: editedBooking.clientType || "",
      editable: false
    },
    {
      label: "Phone",
      key: "clientPhone",
      value: hideContactInfo ? redactedText : (editedBooking.clientPhone || ""),
      copyValue: hideContactInfo ? "" : (editedBooking.clientPhone || ""),
      editable: !hideContactInfo
    },
    {
      label: "Email",
      key: "clientEmail",
      value: hideContactInfo ? redactedText : (editedBooking.clientEmail || ""),
      copyValue: hideContactInfo ? "" : (editedBooking.clientEmail || ""),
      editable: !hideContactInfo
    },
    {
      label: "Passport",
      key: "clientPassport",
      value: hideContactInfo ? redactedText : (editedBooking.clientPassport || ""),
      copyValue: hideContactInfo ? "" : (editedBooking.clientPassport || ""),
      editable: !hideContactInfo
    },
    {
      label: "Address",
      key: "address",
      value: hideContactInfo
        ? redactedText
        : editedBooking.clientDetails?.address ||
          editedBooking.address ||
          "",
      display: hideContactInfo
        ? redactedText
        : editedBooking.clientDetails?.address ||
          editedBooking.address ||
          "",
      copyValue: hideContactInfo
        ? ""
        : editedBooking.clientDetails?.address ||
          editedBooking.address ||
          "",
      type: "textarea",
      placeholder: "Street, city, country"
    }
  ];

  const tripFieldsConfig = [
    {
      label: "Booking date",
      key: "bookingDate",
      value: bookingDateInputValue,
      display: bookingDateDisplay,
      type: "date"
    },
    {
      label: "Start time",
      key: "startTime",
      value: editedBooking.startTime || "",
      type: "time"
    },
    {
      label: "End time",
      key: "endTime",
      value: editedBooking.endTime || "",
      type: "time"
    },
    {
      label: "Boat name",
      key: "boatName",
      value: editedBooking.boatName || "",
      copyValue: editedBooking.boatName || ""
    },
    {
      label: "Company / Supplier",
      key: "boatCompanyName",
      value: editedBooking.boatCompanyName || "",
      copyValue: editedBooking.boatCompanyName || ""
    },
    {
      label: "Passengers",
      key: "numberOfPassengers",
      value:
        editedBooking.numberOfPassengers ||
        editedBooking.numberOfPassengers === 0
          ? String(editedBooking.numberOfPassengers)
          : "",
      display: passengerDisplay,
      type: "number",
      inputProps: { min: 0 }
    },
    {
      label: "Restaurant / experience",
      key: "restaurantName",
      value: editedBooking.restaurantName || "",
      copyValue: editedBooking.restaurantName || ""
    }
  ];

  const logisticsFieldsConfig = [
    {
      label: "Transfer booked",
      display: editedBooking.privateTransfer ? "Yes" : "No",
      editable: false
    },
    {
      label: "Pickup location",
      key: "pickupLocation",
      value: editedBooking.pickupLocation || "",
      copyValue: editedBooking.pickupLocation || ""
    },
    {
      label: "Pickup address",
      key: "pickupAddress",
      value: editedBooking.pickupAddress || "",
      copyValue: editedBooking.pickupAddress || "",
      type: "textarea",
      placeholder: "Dock / Hotel / Street"
    },
    {
      label: "Drop-off location",
      key: "dropoffLocation",
      value: editedBooking.dropoffLocation || "",
      copyValue: editedBooking.dropoffLocation || ""
    },
    {
      label: "Drop-off address",
      key: "dropoffAddress",
      value: editedBooking.dropoffAddress || "",
      copyValue: editedBooking.dropoffAddress || "",
      type: "textarea",
      placeholder: "Dock / Hotel / Street"
    }
  ];

  const systemFieldsConfig = [
    {
      label: "Booking ID",
      display: bookingReference,
      copyValue: bookingReference,
      editable: false
    },
    {
      label: "Created at",
      display: editedBooking.createdAt
        ? formatDateTime(editedBooking.createdAt)
        : "",
      editable: false
    },
    {
      label: "Last updated",
      display: editedBooking.lastUpdated
        ? formatDateTime(editedBooking.lastUpdated)
        : "",
      editable: false
    },
    {
      label: "Created by",
      display:
        editedBooking.createdBy?.displayName ||
        editedBooking.createdBy?.email ||
        "—",
      editable: false
    }
  ];

  const highlightCards = [
    {
      label: "Booking ref",
      value: bookingReference || "Not set",
      helper: "Share this ID with partners"
    },
    {
      label: "Payment status",
      value: paymentStatusLabel,
      helper: `Paid €${totalPaidValue.toFixed(2)} of €${agreedPriceValue.toFixed(2)}`
    },
    {
      label: "Transfer",
      value: editedBooking.privateTransfer ? "Transfer arranged" : "No transfer planned",
      helper: transferSummary
    }
  ];

  const invoiceOptions = useMemo(() => {
    const options = [
      {
        id: "full",
        label: "Full balance",
        helper: `€${agreedPriceValue.toFixed(2)} total`,
        amount: agreedPriceValue
      }
    ];

    if (paymentBreakdown.outstanding > 0 && paymentBreakdown.outstanding !== agreedPriceValue) {
      options.push({
        id: "outstanding",
        label: "Outstanding balance",
        helper: `€${paymentBreakdown.outstanding.toFixed(2)} remaining`,
        amount: paymentBreakdown.outstanding
      });
    }

    if (paymentBreakdown.firstAmount > 0) {
      options.push({
        id: "first",
        label: "Deposit (first payment)",
        helper: `€${paymentBreakdown.firstAmount.toFixed(2)}`,
        amount: paymentBreakdown.firstAmount
      });
    }

    if (paymentBreakdown.secondAmount > 0) {
      options.push({
        id: "second",
        label: "Final installment",
        helper: `€${paymentBreakdown.secondAmount.toFixed(2)}`,
        amount: paymentBreakdown.secondAmount
      });
    }

    options.push({
      id: "custom",
      label: "Custom amount",
      helper: customInvoiceAmount
        ? `€${Number(customInvoiceAmount || 0).toFixed(2)}`
        : "Enter any figure",
      amount: Number(customInvoiceAmount) || 0
    });

    return options;
  }, [agreedPriceValue, paymentBreakdown, customInvoiceAmount]);

  const selectedInvoiceOption =
    invoiceOptions.find((opt) => opt.id === invoiceShareOption) || invoiceOptions[0];

  useEffect(() => {
    if (!invoiceOptions.find((opt) => opt.id === invoiceShareOption) && invoiceOptions[0]) {
      setInvoiceShareOption(invoiceOptions[0].id);
    }
  }, [invoiceOptions, invoiceShareOption]);

  const invoicePrefill = useMemo(() => {
    if (!editedBooking?.id) return null;
    const bookingDate =
      editedBooking.bookingDetails?.date ||
      editedBooking.bookingDate ||
      new Date().toISOString().split("T")[0];
    if (!selectedInvoiceOption) return null;
    const amount = Number(selectedInvoiceOption?.amount) || 0;
    const isDepositInvoice = selectedInvoiceOption?.id === "first";
    const depositPercentage = paymentBreakdown.firstPercentage || 50;
    const baseNotes =
      editedBooking.notes || "Courtesy drinks, towels and skipper included.";
    const depositNote = isDepositInvoice
      ? `Deposit invoice (${depositPercentage}% down payment). `
      : "";

    return {
      bookingId: editedBooking.id,
      invoice: {
        invoiceNumber: `INV-${new Date().getFullYear()}-${editedBooking.id.slice(-5).toUpperCase()}`,
        invoiceDate: bookingDate,
        notes: `${depositNote}${baseNotes}`.trim(),
        terms:
          "Payment terms: Net 30 days from invoice date. Please include the invoice number as the payment reference.",
      },
      client: {
        name: editedBooking.clientDetails?.name || editedBooking.clientName || "",
        companyName: hideContactInfo ? "" : (editedBooking.clientDetails?.companyName || ""),
        address: hideContactInfo ? redactedText : (editedBooking.clientDetails?.address || editedBooking.address || ""),
        city: hideContactInfo ? "" : (editedBooking.clientDetails?.city || ""),
        postalCode: hideContactInfo ? "" : (editedBooking.clientDetails?.postalCode || ""),
        country: hideContactInfo ? "" : (editedBooking.clientDetails?.country || ""),
        email: hideContactInfo ? "" : (editedBooking.clientDetails?.email || editedBooking.clientEmail || ""),
        phone: hideContactInfo ? "" : (editedBooking.clientDetails?.phone || editedBooking.clientPhone || ""),
        taxId: hideContactInfo ? "" : (editedBooking.clientDetails?.taxId || ""),
      },
      items: [
        {
          id: editedBooking.id,
          description: `${editedBooking.bookingDetails?.boatName || editedBooking.boatName || "Charter"} · ${bookingDate}${
            isDepositInvoice ? ` • ${depositPercentage}% Down Payment` : ""
          }`,
          unitPrice: amount,
          discount: 0,
        },
      ],
    };
  }, [editedBooking, selectedInvoiceOption]);

  const isInvoiceReady = Boolean(
    invoicePrefill && invoicePrefill.items?.[0]?.unitPrice > 0
  );

  const handleGenerateInvoice = useCallback(() => {
    if (!invoicePrefill) return;
    navigate("/invoice-generator", { state: { prefillInvoice: invoicePrefill } });
  }, [invoicePrefill, navigate]);

  if (!booking) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 py-6 sm:py-12 bg-black bg-opacity-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-details-title"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-5xl w-full"
        onClick={handleModalClick}
        ref={modalRef}
      >
        {/* Header */}
        <div
          className={`p-4 flex justify-between items-center rounded-t-lg ${
            editedBooking.isCancelled ? "bg-red-100" : "bg-gray-100"
          }`}
        >
          <div className="flex items-center gap-3">
            <h3 id="booking-details-title" className="text-xl font-bold text-gray-800">
              Booking Details
            </h3>
            {isAdmin?.() && (
              <button
                onClick={handleDeleteBooking}
                disabled={isDeleting}
                className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                title="Delete booking"
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            )}
          </div>
          <button
            onClick={handleBackdropClick}
            className="text-gray-600 hover:text-gray-800 focus:outline-none"
            aria-label="Close Modal"
            title="Close (Esc)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary header */}
        <div className="p-6 pt-4 pb-2 space-y-4">
          <SummaryHeader booking={editedBooking} />
          <QuickActionsBar booking={editedBooking} showContact={!hideContactInfo} />
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Invoice amount</p>
                <p className="text-sm text-slate-600">
                  Choose which portion of the booking to invoice.
                </p>
              </div>
              <select
                value={invoiceShareOption}
                onChange={(e) => setInvoiceShareOption(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                {invoiceOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} — {option.helper}
                  </option>
                ))}
              </select>
            </div>

            {invoiceShareOption === "custom" && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Custom value (€)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={customInvoiceAmount}
                  onChange={(e) => setCustomInvoiceAmount(e.target.value)}
                  className="w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="0.00"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleGenerateInvoice}
                disabled={!invoicePrefill || !isInvoiceReady}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow ${
                  invoicePrefill && isInvoiceReady
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-slate-200 text-slate-500 cursor-not-allowed"
                }`}
              >
                <FileText size={16} />
                Generate invoice
              </button>
              <span className="text-xs text-slate-500">
                {isInvoiceReady
                  ? `Invoice for €${Number(selectedInvoiceOption?.amount || 0).toFixed(2)}`
                  : "Choose a non-zero amount to enable invoice generation."}
              </span>
            </div>
          </div>
        </div>

        {/* Cancellation banner */}
        {editedBooking.isCancelled && (
          <div className="bg-red-50 p-4 border-t border-b border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-red-800">Cancellation Details</h4>
                <p className="text-sm text-red-700 mt-1">
                  {editedBooking.cancellationDate ? (
                    <span>
                      Cancelled on: {formatDateTime(editedBooking.cancellationDate)}
                    </span>
                  ) : (
                    <span>Cancellation date not recorded</span>
                  )}
                </p>
                {editedBooking.cancellationReason && (
                  <p className="text-sm text-red-700 mt-1">
                    Reason: {editedBooking.cancellationReason}
                  </p>
                )}
              </div>
              <button
                onClick={handleUndoCancel}
                className="px-3 py-1 bg-white text-red-700 rounded border border-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 text-sm"
              >
                Restore Booking
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="px-6">
          <TabBar
            tabs={["Overview", "Payments", "Orders", "Expenses", "Notes"]}
            active={tab}
            onChange={setTab}
          />
        </div>

        {/* Body */}
        <div className="px-6 pb-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 18rem)" }}>
          {tab === "Overview" && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                {highlightCards.map((card) => (
                  <KeyStatCard
                    key={card.label}
                    label={card.label}
                    value={card.value}
                    helper={card.helper}
                  />
                ))}
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <InfoCard
                  title="Client profile"
                  subtitle="Guest contact"
                  actions={
                    <button
                      onClick={copyAllClientInfo}
                      className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                    >
                      Copy profile
                    </button>
                  }
                >
                  {copySuccess && (
                    <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      {copySuccess}
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {clientFieldsConfig.map(renderField)}
                  </div>
                </InfoCard>

                <InfoCard title="Trip plan" subtitle="Schedule & boat">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {tripFieldsConfig.map(renderField)}
                  </div>
                </InfoCard>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <InfoCard title="Logistics" subtitle="Transfers & locations">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {logisticsFieldsConfig.map(renderField)}
                  </div>
                </InfoCard>
                <InfoCard title="Internal timeline" subtitle="Audit trail">
                  <div className="grid gap-4">
                    {systemFieldsConfig.map(renderField)}
                  </div>
                </InfoCard>
              </div>

              <InfoCard
                title="Notes snapshot"
                subtitle="Crew briefing"
                actions={
                  <button
                    onClick={() => setTab("Notes")}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                  >
                    Open notes
                  </button>
                }
              >
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {notePreview || "No notes added yet."}
                </div>
              </InfoCard>
            </div>
          )}
          {tab === "Payments" && (
            <div className="grid grid-cols-1 gap-6">
              {/* Price Information */}
              <div className="p-4 border rounded-lg">
                <h4 className="text-lg font-bold mb-3">Price Information</h4>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Agreed Price:
                  </label>
                  {isEditing ? (
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">€</span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md"
                        placeholder="0.00"
                        value={editedBooking.finalPrice || ""}
                        onChange={(e) => handleFinalPriceChange(e.target.value)}
                      />
                    </div>
                  ) : (
                    <p className="mt-1">€{Number(editedBooking.finalPrice).toFixed(2)}</p>
                  )}
                </div>
              </div>

              {/* Payments table */}
              <PaymentDetails
                payments={editedBooking?.pricing?.payments || []}
                pricingType={editedBooking?.pricing?.pricingType}
                agreedPrice={editedBooking?.pricing?.agreedPrice}
                totalPaid={editedBooking?.pricing?.totalPaid}
                paymentStatus={editedBooking?.pricing?.paymentStatus}
                isEditing={isEditing}
                onPaymentChange={handlePaymentChange}
              />

              {isEditing && (
                <div className="mt-2 p-4 border rounded-lg border-blue-200 bg-blue-50">
                  <h4 className="text-lg font-medium text-blue-800 mb-3">
                    Set Payment Split
                  </h4>
                  <div className="flex flex-wrap gap-3">
                    {[
                      [25, 75],
                      [30, 70],
                      [50, 50],
                      [70, 30],
                      [100, 0],
                    ].map(([a, b]) => (
                      <button
                        key={`${a}-${b}`}
                        type="button"
                        onClick={() => {
                          handlePaymentChange(0, { percentage: a });
                          handlePaymentChange(1, { percentage: b });
                        }}
                        className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        {a}% / {b}%
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-blue-600">
                    Note: Setting the percentages will automatically calculate the
                    payment amounts.
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === "Orders" && (
            <div className="col-span-full mt-2">
              <LinkedOrdersSection />
            </div>
          )}

          {tab === "Expenses" && (
            <div className="col-span-full mt-2">
              <ExpensesSection />
            </div>
          )}

          {tab === "Notes" && (
            <div className="col-span-full">
              <div className="p-4 border rounded-lg">
                <h4 className="text-lg font-bold mb-3">Additional Information</h4>
                {isEditing && (
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                    <span>{(editedBooking.clientNotes || "").length} characters</span>
                    <NoteQuickTags
                      onPick={(t) =>
                        handleInputChange(
                          "clientNotes",
                          `${editedBooking.clientNotes ? editedBooking.clientNotes + " • " : ""}${t}`
                        )
                      }
                    />
                  </div>
                )}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Notes:
                  </label>
                  {isEditing ? (
                    <textarea
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32 resize-y"
                      value={editedBooking.clientNotes || ""}
                      onChange={(e) => handleInputChange("clientNotes", e.target.value)}
                    />
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap">
                      {editedBooking.clientNotes || "N/A"}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Created:
                    </label>
                    <p className="mt-1">
                      {editedBooking.createdAt
                        ? formatDateTime(editedBooking.createdAt)
                        : "N/A"}
                    </p>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Last Updated:
                    </label>
                    <p className="mt-1">
                      {editedBooking.lastUpdated
                        ? formatDateTime(editedBooking.lastUpdated)
                        : "N/A"}
                    </p>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Added by:
                    </label>
                    <p className="mt-1">
                      {editedBooking.createdBy?.displayName ||
                        editedBooking.createdBy?.email ||
                        "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-100 p-4 flex justify-between space-x-2 rounded-b-lg sticky bottom-0">
          <div className="flex space-x-2">
            {isSanAntonioBooking && (
              <button
                onClick={handleEditInSanAntonio}
                className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                aria-label="Edit in San Antonio Tours"
              >
                Edit in San Antonio Tours
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleSaveBooking}
                  disabled={!isDirty}
                  className={`px-4 py-2 rounded-md text-white ${
                    isDirty
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-blue-300 cursor-not-allowed"
                  } focus:outline-none focus:ring-2 focus:ring-blue-300`}
                  aria-label="Save Changes"
                  title="Save (Ctrl/Cmd+S)"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  aria-label="Cancel Editing"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                aria-label="Edit Booking"
              >
                Edit
              </button>
            )}

            {!editedBooking.isCancelled && (
              <button
                type="button"
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
                onClick={handleCancelBooking}
                aria-label="Cancel Booking"
              >
                Cancel Booking
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

BookingDetails.propTypes = {
  booking: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default BookingDetails;
