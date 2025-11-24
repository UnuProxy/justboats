import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { RefreshCcw, ClipboardList, Truck, Wallet, AlertCircle } from 'lucide-react';
import { db } from '../firebase/firebaseConfig';
import { formatCurrency } from '../utils/profitCalculations';

const DATE_FORMAT_OPTIONS = { weekday: 'short', month: 'short', day: 'numeric' };

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
};

const parseTimeToMinutes = (timeString) => {
  if (!timeString) return Number.MAX_SAFE_INTEGER;
  const [hours = 0, minutes = 0] = timeString.split(':').map((n) => parseInt(n, 10));
  return Number.isNaN(hours) ? Number.MAX_SAFE_INTEGER : hours * 60 + (Number.isNaN(minutes) ? 0 : minutes);
};

const OpsCommandWorkspace = () => {
  const [loading, setLoading] = useState(true);
  const [todayTrips, setTodayTrips] = useState([]);
  const [provisioningAlerts, setProvisioningAlerts] = useState([]);
  const [openPayments, setOpenPayments] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  const todayKey = useMemo(() => new Date().toISOString().split('T')[0], []);

  const fetchOpsData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [bookingsSnap, ordersSnap, paymentsSnap] = await Promise.all([
        getDocs(collection(db, 'bookings')),
        getDocs(collection(db, 'orders')),
        getDocs(collection(db, 'payments'))
      ]);

      const bookings = bookingsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) || [];
      const orders = ordersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) || [];
      const payments = paymentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) || [];

      const todaysTrips = bookings
        .filter((booking) => {
          const tripDate = normalizeDate(booking.bookingDetails?.date);
          return tripDate === todayKey && booking.status !== 'cancelled';
        })
        .map((booking) => ({
          id: booking.id,
          boatName: booking.bookingDetails?.boatName || 'Unknown boat',
          captain: booking.captain?.name || booking.bookingDetails?.boatCompany || 'Crew TBD',
          client: booking.clientDetails?.name || 'Guest',
          startTime: booking.bookingDetails?.startTime || '??:??',
          endTime: booking.bookingDetails?.endTime || '',
          embarkLocation: booking.bookingDetails?.port || booking.bookingDetails?.startPort || '',
          notes: booking.notes || ''
        }))
        .sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));

      const provisioningReminders = orders
        .filter((order) => {
          const status = (order.status || '').toLowerCase();
          return !['delivered', 'completed'].includes(status);
        })
        .map((order) => {
          const etaSource = order.deliveryDate || order.eventDate || order.scheduledDate || order.createdAt;
          const etaKey = normalizeDate(etaSource);
          const etaDate = etaKey ? new Date(etaKey) : null;
          const daysUntil = etaDate
            ? Math.ceil((etaDate.getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24))
            : null;
          return {
            id: order.id,
            boatName: order.boatName || order.boat || 'Unknown boat',
            supplier: order.supplier || order.vendor || 'Supplier',
            status: order.status || 'pending',
            items: Array.isArray(order.items) ? order.items.length : 0,
            etaLabel: etaDate ? etaDate.toLocaleDateString('en-GB', DATE_FORMAT_OPTIONS) : 'TBD',
            daysUntil,
            priority: daysUntil !== null && daysUntil <= 1 ? 'urgent' : 'normal'
          };
        })
        .sort((a, b) => (a.daysUntil ?? 99) - (b.daysUntil ?? 99))
        .slice(0, 6);

      const unresolvedPayments = payments
        .filter((payment) => {
          const status = (payment.status || payment.paymentStatus || '').toLowerCase();
          return status && !['paid', 'completed', 'settled', 'success'].includes(status);
        })
        .map((payment) => ({
          id: payment.id,
          client: payment.clientName || payment.customerName || 'Client',
          boatName: payment.boatName || payment.bookingReference || 'Booking',
          amount: Number(payment.amount ?? payment.total ?? 0) || 0,
          status: payment.status || payment.paymentStatus || 'pending',
          dueDate: payment.dueDate || payment.createdAt || null
        }))
        .sort((a, b) => (new Date(a.dueDate || 0)) - (new Date(b.dueDate || 0)))
        .slice(0, 6);

      setTodayTrips(todaysTrips);
      setProvisioningAlerts(provisioningReminders);
      setOpenPayments(unresolvedPayments);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load ops workspace data:', err);
      setError('Unable to fetch the latest operations data.');
    } finally {
      setLoading(false);
    }
  }, [todayKey]);

  useEffect(() => {
    fetchOpsData();
  }, [fetchOpsData]);

  const stats = [
    {
      title: 'Today’s Trips',
      value: todayTrips.length,
      subtitle: 'Scheduled departures',
      icon: ClipboardList,
      accent: 'text-blue-600'
    },
    {
      title: 'Provisioning',
      value: provisioningAlerts.length,
      subtitle: 'Orders need action',
      icon: Truck,
      accent: 'text-amber-600'
    },
    {
      title: 'Open Payments',
      value: openPayments.length,
      subtitle: 'Awaiting confirmation',
      icon: Wallet,
      accent: 'text-emerald-600'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Ops Command</h1>
          <p className="text-sm text-slate-500">Live overview for the on-duty operations lead</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-GB')}` : 'Waiting for data...'}
          </div>
          <button
            onClick={fetchOpsData}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
          >
            <RefreshCcw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.title} className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">{stat.subtitle}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{stat.value}</p>
                <p className="text-sm text-slate-500">{stat.title}</p>
              </div>
              <stat.icon className={`h-10 w-10 ${stat.accent}`} />
            </div>
          </div>
        ))}
      </div>

  {loading ? (
        <div className="rounded-xl border border-slate-100 bg-white p-6 text-center text-slate-500 shadow-sm">
          Loading latest ops data...
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Trips</p>
                <h2 className="text-xl font-semibold text-slate-900">Today&apos;s departures</h2>
              </div>
              <span className="text-xs text-slate-500">{todayKey}</span>
            </div>
            {todayTrips.length === 0 ? (
              <p className="text-sm text-slate-500">No trips scheduled for today.</p>
            ) : (
              <ul className="space-y-3">
                {todayTrips.map((trip) => (
                  <li
                    key={trip.id}
                    className="rounded-lg border border-slate-100 px-4 py-3 hover:border-slate-200"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{trip.boatName}</p>
                        <p className="text-sm text-slate-500">
                          {trip.startTime} - {trip.endTime || 'TBD'} · {trip.embarkLocation || 'Port TBD'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-700">{trip.client}</p>
                        <p className="text-xs text-slate-400">Crew: {trip.captain}</p>
                      </div>
                    </div>
                    {trip.notes && (
                      <p className="mt-2 rounded-md bg-slate-50 px-3 py-1 text-xs text-slate-500">
                        {trip.notes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Provisioning</p>
                  <h3 className="text-lg font-semibold text-slate-900">Reminders</h3>
                </div>
                <Truck className="h-5 w-5 text-amber-600" />
              </div>
              {provisioningAlerts.length === 0 ? (
                <p className="text-sm text-slate-500">No pending orders 🎉</p>
              ) : (
                <ul className="space-y-3">
                  {provisioningAlerts.map((order) => (
                    <li key={order.id} className="rounded-lg border border-slate-100 px-3 py-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-800">{order.boatName}</span>
                        <span
                          className={`text-xs font-medium ${
                            order.priority === 'urgent' ? 'text-red-600' : 'text-slate-500'
                          }`}
                        >
                          {order.etaLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {order.supplier} • {order.items} items • {order.status}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Payments</p>
                  <h3 className="text-lg font-semibold text-slate-900">Awaiting clearance</h3>
                </div>
                <Wallet className="h-5 w-5 text-emerald-600" />
              </div>
              {openPayments.length === 0 ? (
                <p className="text-sm text-slate-500">All payments are settled.</p>
              ) : (
                <ul className="space-y-3">
                  {openPayments.map((payment) => (
                    <li key={payment.id} className="rounded-lg border border-slate-100 px-3 py-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-800">{payment.client}</span>
                        <span className="text-xs text-slate-500">
                          {payment.dueDate
                            ? new Date(payment.dueDate).toLocaleDateString('en-GB', DATE_FORMAT_OPTIONS)
                            : 'No due date'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {payment.boatName} • {formatCurrency(payment.amount)} • {payment.status}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick actions</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {[
          { label: 'Add booking', href: '/add-booking' },
          { label: 'Log provisioning', href: '/catering-orders' },
          { label: 'Reminders board', href: '/reminders' }
          ].map((action) => (
            <a
              key={action.href}
              href={action.href}
              className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-slate-300"
            >
              {action.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OpsCommandWorkspace;
