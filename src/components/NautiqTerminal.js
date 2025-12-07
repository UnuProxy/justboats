import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  Navigation,
  RefreshCcw,
  Ship,
  TrendingUp,
  UtensilsCrossed,
  Wallet
} from 'lucide-react';
import { db } from '../firebase/firebaseConfig';

const formatMoney = (value) => {
  const amount = Number(value);
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(Number.isFinite(amount) ? amount : 0);
};

const safeDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isPaymentClosed = (status = '') => {
  const normalized = status.toString().toLowerCase();
  return ['paid', 'completed', 'settled', 'success', 'closed'].some((flag) =>
    normalized.includes(flag)
  );
};

const isPaymentOpen = (status = '') => {
  const normalized = status.toString().toLowerCase();
  if (!normalized) return true;
  if (isPaymentClosed(normalized)) return false;
  return ['pending', 'partial', 'deposit', 'no payment', 'outstanding', 'open', 'awaiting', 'due', 'unpaid'].some(
    (flag) => normalized.includes(flag)
  );
};

const NautiqTerminal = () => {
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [partners, setPartners] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bookingSnap, paymentSnap, hotelSnap, collaboratorSnap, orderSnap] = await Promise.all([
        getDocs(collection(db, 'bookings')),
        getDocs(collection(db, 'payments')),
        getDocs(collection(db, 'hotels')),
        getDocs(collection(db, 'collaborators')),
        getDocs(collection(db, 'orders'))
      ]);

      setBookings(bookingSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setPayments(paymentSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setPartners([
        ...hotelSnap.docs.map((doc) => ({ id: doc.id, ...doc.data(), type: 'Hotel' })),
        ...collaboratorSnap.docs.map((doc) => ({ id: doc.id, ...doc.data(), type: 'Collaborator' }))
      ]);
      setOrders(orderSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch terminal data', err);
      setError('Unable to load live data right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const partnerDirectory = useMemo(() => {
    const directory = new Map();
    partners.forEach((partner) => directory.set(partner.id, partner));
    return directory;
  }, [partners]);

  const upcomingBookings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date();
    horizon.setDate(today.getDate() + 14);

    return bookings
      .map((booking) => {
        const date = safeDate(booking.bookingDetails?.date);
        return { ...booking, _date: date };
      })
      .filter((booking) => booking._date && booking._date >= today && booking._date <= horizon)
      .sort((a, b) => a._date - b._date);
  }, [bookings]);

  const bookingsTape = useMemo(() => {
    return upcomingBookings.slice(0, 10).map((booking) => {
      const paymentStatus = booking.pricing?.paymentStatus || 'Pending';
      const outstanding =
        Math.max(
          (Number(booking.pricing?.finalPrice || booking.pricing?.agreedPrice || 0) || 0) -
            (Number(booking.pricing?.paidAmount || 0) || 0) -
            (Array.isArray(booking.pricing?.payments)
              ? booking.pricing.payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
              : 0),
          0
        ) || 0;

      const risk =
        !booking.bookingDetails?.boatName || isPaymentOpen(paymentStatus) || outstanding > 0 ? 'amber' : 'green';

      return {
        id: booking.id,
        client: booking.clientDetails?.name || 'Client',
        boat: booking.bookingDetails?.boatName || 'Unassigned',
        date: booking._date,
        paymentStatus,
        outstanding,
        risk
      };
    });
  }, [upcomingBookings]);

  const paymentQueue = useMemo(() => {
    const queue = [];
    const seen = new Set();

    payments.forEach((payment) => {
      const status = payment.status || payment.paymentStatus || 'Pending';
      if (isPaymentOpen(status)) {
        const key = payment.bookingId || `payment-${payment.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        queue.push({
          id: key,
          label: payment.boatName || payment.bookingReference || 'Booking',
          client: payment.clientName || payment.customerName || 'Client',
          amount: Number(payment.amount || payment.total || 0) || 0,
          status,
          dueDate: safeDate(payment.dueDate || payment.expectedDate || payment.createdAt)
        });
      }
    });

    bookings.forEach((booking) => {
      const status = booking.pricing?.paymentStatus || 'Pending';
      if (!isPaymentOpen(status)) return;
      const key = `booking-${booking.id}`;
      if (seen.has(key)) return;
      seen.add(key);

      const total = Number(booking.pricing?.finalPrice || booking.pricing?.agreedPrice || 0) || 0;
      const paidFromArray = Array.isArray(booking.pricing?.payments)
        ? booking.pricing.payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
        : 0;
      const paid = (Number(booking.pricing?.paidAmount || 0) || 0) + paidFromArray;
      const outstanding = Math.max(total - paid, 0);

      queue.push({
        id: key,
        label: booking.bookingDetails?.boatName || 'Unassigned',
        client: booking.clientDetails?.name || 'Client',
        amount: outstanding || total,
        status,
        dueDate: safeDate(booking.pricing?.dueDate || booking.bookingDetails?.date)
      });
    });

    return queue
      .sort((a, b) => (a.dueDate || Number.MAX_SAFE_INTEGER) - (b.dueDate || Number.MAX_SAFE_INTEGER))
      .slice(0, 10);
  }, [payments, bookings]);

  const partnerStats = useMemo(() => {
    const totals = new Map();

    const ensure = (id, fallbackName = 'Direct / Nautiq') => {
      if (!totals.has(id)) {
        const partner = partnerDirectory.get(id);
        totals.set(id, {
          id,
          name: partner?.name || fallbackName,
          type: partner?.type || 'Direct',
          bookings: 0,
          revenue: 0,
          openPayments: 0
        });
      }
      return totals.get(id);
    };

    bookings.forEach((booking) => {
      const partnerId = booking.selectedPartner || 'direct';
      const bucket = ensure(partnerId);
      const revenue = Number(booking.pricing?.agreedPrice || booking.pricing?.finalPrice || 0) || 0;

      bucket.bookings += 1;
      bucket.revenue += revenue;
      if (isPaymentOpen(booking.pricing?.paymentStatus)) {
        bucket.openPayments += 1;
      }
    });

    const stats = Array.from(totals.values()).sort((a, b) => b.revenue - a.revenue);
    return stats.slice(0, 5);
  }, [bookings, partnerDirectory]);

  const transfersOnDeck = useMemo(() => bookings.filter((booking) => booking.hasTransfer).length, [bookings]);
  const openCateringOrders = useMemo(
    () =>
      orders.filter((order) => {
        const status = (order.status || '').toLowerCase();
        return status && !['delivered', 'completed', 'closed'].includes(status);
      }).length,
    [orders]
  );

  const totalOutstanding = useMemo(
    () => paymentQueue.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [paymentQueue]
  );

  const unassignedBoats = useMemo(
    () => upcomingBookings.filter((booking) => !booking.bookingDetails?.boatName).length,
    [upcomingBookings]
  );

  const sopPlaybooks = useMemo(
    () => [
      {
        key: 'transfers',
        title: 'Transfers',
        icon: Navigation,
        owner: 'Transport lead',
        dataPoint: `${transfersOnDeck} bookings with transfers flagged`,
        steps: [
          'T-24h: confirm pickup window with driver and client.',
          'Verify vehicle, captain contact, and port access notes.',
          'Log ETA and live status updates in reminders board.'
        ]
      },
      {
        key: 'catering',
        title: 'Catering',
        icon: UtensilsCrossed,
        owner: 'Provisioning',
        dataPoint: `${openCateringOrders} catering orders open`,
        steps: [
          'Lock menu and quantities before T-18h and confirm allergens.',
          'Share cost per head and delivery slot with ops desk.',
          'Mark delivery proof (photo/signature) before closing the order.'
        ]
      },
      {
        key: 'charters',
        title: 'Charters',
        icon: Ship,
        owner: 'Charter desk',
        dataPoint: `${upcomingBookings.length} departures in next 14 days`,
        steps: [
          'Check boat readiness, fuel, and skipper assignment daily.',
          'Hold contract + payment proof in booking record before embark.',
          'Send departure brief with timings, pax, and outstanding items.'
        ]
      }
    ],
    [transfersOnDeck, openCateringOrders, upcomingBookings.length]
  );

  const updateScript = useMemo(() => {
    const leader = partnerStats[0];
    return [
      `Bookings: ${upcomingBookings.length} due in next 14 days (${unassignedBoats} unassigned).`,
      `Payments: ${paymentQueue.length} open worth ${formatMoney(totalOutstanding)}.`,
      `Partner: ${leader ? `${leader.name} leading at ${formatMoney(leader.revenue)}` : 'No partner activity yet'}.`,
      `Ops: Transfers ${transfersOnDeck}, Catering ${openCateringOrders} open tasks.`
    ];
  }, [
    upcomingBookings.length,
    unassignedBoats,
    paymentQueue.length,
    totalOutstanding,
    partnerStats,
    transfersOnDeck,
    openCateringOrders
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-tertiary)]">
            Nautiq Terminal
          </div>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Clean, reliable, transparent ops</h1>
          <p className="text-sm text-slate-500">Live bookings, payment exposure, and partner performance.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-GB')}` : 'Waiting for data...'}
          </div>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-[var(--accent-light)]"
          >
            <RefreshCcw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="app-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Live bookings</p>
            <Activity className="h-5 w-5 text-[var(--accent)]" />
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">{upcomingBookings.length}</p>
          <p className="text-xs text-slate-500">Next 14 days</p>
        </div>
        <div className="app-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Pending payments</p>
            <Wallet className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">{paymentQueue.length}</p>
          <p className="text-xs text-slate-500">Exposure {formatMoney(totalOutstanding)}</p>
        </div>
        <div className="app-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Transfers</p>
            <Navigation className="h-5 w-5 text-sky-600" />
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">{transfersOnDeck}</p>
          <p className="text-xs text-slate-500">Bookings with transfer support</p>
        </div>
        <div className="app-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Partner leader</p>
            <TrendingUp className="h-5 w-5 text-orange-500" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">
            {partnerStats[0] ? partnerStats[0].name : 'No partner data'}
          </p>
          <p className="text-xs text-slate-500">
            {partnerStats[0] ? `${partnerStats[0].bookings} bookings • ${formatMoney(partnerStats[0].revenue)}` : 'Awaiting activity'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <div className="app-card p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Bookings tape</p>
                <h3 className="text-xl font-semibold text-slate-900">Upcoming departures</h3>
              </div>
              <span className="rounded-full bg-[var(--background-secondary)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                {unassignedBoats} unassigned boats
              </span>
            </div>
            {loading ? (
              <p className="text-sm text-slate-500">Loading bookings...</p>
            ) : bookingsTape.length === 0 ? (
              <p className="text-sm text-slate-500">No departures in the next 14 days.</p>
            ) : (
              <ul className="space-y-3">
                {bookingsTape.map((booking) => (
                  <li
                    key={booking.id}
                    className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{booking.client}</p>
                        <p className="text-xs text-slate-500">{booking.boat}</p>
                        <div className="mt-2 inline-flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                            <Clock size={12} />
                            {booking.date
                              ? booking.date.toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short'
                                })
                              : 'TBC'}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              booking.risk === 'green'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-amber-200 bg-amber-50 text-amber-700'
                            }`}
                          >
                            {booking.risk === 'green' ? 'Ready' : 'Needs attention'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Payment</p>
                        <p className="text-sm font-semibold text-slate-900">{booking.paymentStatus}</p>
                        {booking.outstanding > 0 && (
                          <p className="text-xs text-amber-600">Due {formatMoney(booking.outstanding)}</p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="app-card p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Payment queue</p>
                <h3 className="text-xl font-semibold text-slate-900">Exposure monitor</h3>
              </div>
              <span className="rounded-full bg-[var(--background-secondary)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                {formatMoney(totalOutstanding)}
              </span>
            </div>
            {loading ? (
              <p className="text-sm text-slate-500">Loading payments...</p>
            ) : paymentQueue.length === 0 ? (
              <p className="text-sm text-slate-500">All payments are settled.</p>
            ) : (
              <ul className="space-y-3">
                {paymentQueue.map((payment) => (
                  <li
                    key={payment.id}
                    className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{payment.client}</p>
                        <p className="text-xs text-slate-500">{payment.label}</p>
                        <div className="mt-2 inline-flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                            <Clock size={12} />
                            {payment.dueDate
                              ? payment.dueDate.toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short'
                                })
                              : 'No due date'}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            {payment.status}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Outstanding</p>
                        <p className="text-sm font-semibold text-slate-900">{formatMoney(payment.amount)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="app-card p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Partners</p>
                <h3 className="text-xl font-semibold text-slate-900">Performance tape</h3>
              </div>
              <ArrowRight className="h-5 w-5 text-[var(--text-tertiary)]" />
            </div>
            {loading ? (
              <p className="text-sm text-slate-500">Loading partner data...</p>
            ) : partnerStats.length === 0 ? (
              <p className="text-sm text-slate-500">No partner performance yet.</p>
            ) : (
              <div className="space-y-3">
                {partnerStats.map((partner) => (
                  <div
                    key={partner.id}
                    className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{partner.name}</p>
                        <p className="text-xs text-slate-500">
                          {partner.type} • {partner.bookings} bookings
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Revenue</p>
                        <p className="text-sm font-semibold text-slate-900">{formatMoney(partner.revenue)}</p>
                        {partner.openPayments > 0 && (
                          <p className="text-[11px] font-semibold text-amber-700">
                            {partner.openPayments} open payments
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="app-card p-6">
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Updates</p>
              <h3 className="text-xl font-semibold text-slate-900">Data-first briefing</h3>
              <p className="text-sm text-slate-500">Read out numbers, not opinions.</p>
            </div>
            <ul className="space-y-2">
              {updateScript.map((line, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-800">
                  <ClipboardList className="mt-0.5 h-4 w-4 text-[var(--accent)]" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {sopPlaybooks.map((sop) => (
          <div key={sop.key} className="app-card p-5">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <sop.icon className="h-5 w-5 text-[var(--accent)]" />
                <h4 className="text-lg font-semibold text-slate-900">{sop.title} SOP</h4>
              </div>
              <span className="rounded-full bg-[var(--background-secondary)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                {sop.owner}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-600 mb-3">{sop.dataPoint}</p>
            <ul className="space-y-2">
              {sop.steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                  {step}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NautiqTerminal;
