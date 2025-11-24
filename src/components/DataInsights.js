import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { db } from '../firebase/firebaseConfig';
import {
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Ship,
  CupSoda,
  MapPin,
  Users,
  ArrowRight,
  Zap,
  Utensils,
  CalendarRange
} from 'lucide-react';

const OUTSTANDING_PAYMENT_STATUSES = ['No Payment', 'Partial', 'Pending', 'Deposit', 'Outstanding'];
const DRINK_KEYWORDS = ['drink', 'wine', 'champagne', 'beer', 'cava', 'beverage', 'spirit', 'vodka', 'gin'];
const SUMMER_MONTHS = [5, 6, 7, 8]; // June through September (0-indexed)

const toDate = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (typeof value === 'string') {
    const parsed = parseISO(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
    const alt = new Date(value);
    return Number.isNaN(alt.getTime()) ? null : alt;
  }
  if (value instanceof Date) {
    return value;
  }
  return null;
};

const normaliseText = (value) => (value || '').toString().trim();

const getClientKey = (booking) => {
  const email = booking?.clientDetails?.email;
  const phone = booking?.clientDetails?.phone;
  const name = booking?.clientDetails?.name;
  return (email || phone || name || '').toString().toLowerCase();
};

const getOrderClientKey = (order) => {
  const email = order?.customerEmail;
  const phone = order?.phoneNumber;
  const name = order?.fullName;
  return (email || phone || name || '').toString().toLowerCase();
};

const isSummer = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return false;
  }
  return SUMMER_MONTHS.includes(date.getMonth());
};

const aggregateRepeatMetrics = (records, { keyExtractor, clientExtractor, dateExtractor, valueExtractor }) => {
  const map = new Map();

  records.forEach((record) => {
    const key = normaliseText(keyExtractor(record));
    if (!key) {
      return;
    }
    const clientKey = clientExtractor(record);
    if (!clientKey) {
      return;
    }

    const bucket = map.get(key) || {
      name: key,
      totalInteractions: 0,
      totalValue: 0,
      clients: new Map(),
      latestInteraction: null
    };

    bucket.totalInteractions += 1;
    bucket.totalValue += valueExtractor ? valueExtractor(record) : 0;

    const clientStats = bucket.clients.get(clientKey) || { count: 0, lastDate: null };
    clientStats.count += 1;

    const interactionDate = dateExtractor ? dateExtractor(record) : null;
    if (interactionDate) {
      clientStats.lastDate = clientStats.lastDate && clientStats.lastDate > interactionDate
        ? clientStats.lastDate
        : interactionDate;
      bucket.latestInteraction = bucket.latestInteraction && bucket.latestInteraction > interactionDate
        ? bucket.latestInteraction
        : interactionDate;
    }

    bucket.clients.set(clientKey, clientStats);
    map.set(key, bucket);
  });

  return Array.from(map.values()).map((bucket) => {
    const repeatClients = Array.from(bucket.clients.values()).filter((stats) => stats.count > 1);
    const repeatInteractions = repeatClients.reduce((sum, stats) => sum + (stats.count - 1), 0);
    const loyaltyRate = bucket.clients.size > 0
      ? (repeatClients.length / bucket.clients.size)
      : 0;

    return {
      name: bucket.name,
      totalInteractions: bucket.totalInteractions,
      totalValue: bucket.totalValue,
      repeatClients: repeatClients.length,
      repeatInteractions,
      loyaltyRate,
      latestInteraction: bucket.latestInteraction,
      uniqueClients: bucket.clients.size
    };
  });
};

const InsightCard = ({ icon: Icon, title, value, subtitle, accent = 'bg-sky-100 text-sky-600' }) => (
  <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-2xl sm:p-5">
    <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
      <Icon size={20} />
    </div>
    <div>
      <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{title}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">{value}</p>
      {subtitle && (
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      )}
    </div>
  </div>
);

const TableCard = ({ icon: Icon, title, description, columns, rows, emptyLabel }) => (
  <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm shadow-slate-200/60 backdrop-blur sm:p-6">
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-sky-500" />
          <h3 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h3>
        </div>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>
    </div>
    <div className="mt-6 flex-1 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-slate-400">
                  {emptyLabel || 'No data yet'}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3 text-slate-700">
                      {row[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

const DataInsights = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [partnerLookup, setPartnerLookup] = useState({});
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bookingsSnap, ordersSnap, hotelsSnap, collaboratorsSnap] = await Promise.all([
        getDocs(collection(db, 'bookings')),
        getDocs(collection(db, 'orders')),
        getDocs(collection(db, 'hotels')),
        getDocs(collection(db, 'collaborators'))
      ]);

      setBookings(bookingsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setOrders(ordersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      const partnerMap = {};

      const registerPartner = (id, data) => {
        if (!id || !data) return;
        const contactPerson = data.contactPerson;
        const contactName = typeof contactPerson === 'string'
          ? contactPerson
          : contactPerson?.name;
        const name =
          data.name ||
          data.company ||
          data.hotelName ||
          data.title ||
          contactName ||
          data.contactName;
        if (name && typeof name === 'string') {
          partnerMap[id] = name;
        }
      };

      hotelsSnap.docs.forEach((doc) => registerPartner(doc.id, doc.data()));
      collaboratorsSnap.docs.forEach((doc) => registerPartner(doc.id, doc.data()));
      setPartnerLookup(partnerMap);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error loading insight data:', err);
      setError(err.message || 'Failed to load insight data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const partnerAliasMap = useMemo(() => {
    const map = { ...partnerLookup };

    bookings.forEach((booking) => {
      const partnerId = booking?.selectedPartner;
      const alias =
        booking?.selectedPartnerName ||
        booking?.partnerName ||
        booking?.selectedPartnerDetails?.name ||
        booking?.partner?.name;
      if (partnerId && alias) {
        map[partnerId] = alias;
      }
    });

    return map;
  }, [partnerLookup, bookings]);

  const boatInsights = useMemo(() => {
    if (!bookings.length) {
      return [];
    }

    const metrics = aggregateRepeatMetrics(bookings, {
      keyExtractor: (booking) => booking?.bookingDetails?.boatName || booking?.boatName,
      clientExtractor: (booking) => getClientKey(booking),
      dateExtractor: (booking) => toDate(booking?.bookingDetails?.date) || toDate(booking?.bookingDate) || toDate(booking?.createdAt),
      valueExtractor: (booking) => Number(booking?.pricing?.agreedPrice || booking?.pricing?.finalPrice || 0)
    });

    return metrics
      .sort((a, b) => {
        if (b.repeatInteractions !== a.repeatInteractions) {
          return b.repeatInteractions - a.repeatInteractions;
        }
        if (b.totalInteractions !== a.totalInteractions) {
          return b.totalInteractions - a.totalInteractions;
        }
        return (b.totalValue || 0) - (a.totalValue || 0);
      })
      .slice(0, 5)
      .map((metric, index) => ({
        id: `${metric.name}-${index}`,
        name: metric.name,
        total: metric.totalInteractions,
        repeat: metric.repeatInteractions,
        loyalClients: metric.repeatClients,
        loyaltyRate: `${Math.round(metric.loyaltyRate * 100)}%`,
        value: metric.totalValue ? `€${Math.round(metric.totalValue).toLocaleString()}` : '—',
      }));
  }, [bookings]);

  const routeInsights = useMemo(() => {
    if (!bookings.length) {
      return [];
    }

    const determineRouteLabel = (booking) => {
      const transfer = booking?.transfer || {};
      const pickup = transfer.pickup || {};
      const dropoff = transfer.dropoff || {};

      const pickupLabel = pickup.locationDetail || pickup.location || booking?.pickupLocation || 'TBC';
      const dropoffLabel = dropoff.locationDetail || dropoff.location || booking?.dropoffLocation || booking?.bookingDetails?.locationDetail || booking?.bookingDetails?.location || 'Return';

      return `${pickupLabel} → ${dropoffLabel}`;
    };

    const metrics = aggregateRepeatMetrics(bookings, {
      keyExtractor: (booking) => determineRouteLabel(booking),
      clientExtractor: (booking) => getClientKey(booking),
      dateExtractor: (booking) => toDate(booking?.bookingDetails?.date) || toDate(booking?.bookingDate) || toDate(booking?.createdAt),
      valueExtractor: (booking) => Number(booking?.pricing?.agreedPrice || booking?.pricing?.finalPrice || 0)
    });

    return metrics
      .filter((metric) => metric.totalInteractions > 1)
      .sort((a, b) => {
        if (b.repeatInteractions !== a.repeatInteractions) {
          return b.repeatInteractions - a.repeatInteractions;
        }
        return b.totalInteractions - a.totalInteractions;
      })
      .slice(0, 5)
      .map((metric, index) => ({
        id: `${metric.name}-${index}`,
        route: metric.name,
        total: metric.totalInteractions,
        repeat: metric.repeatInteractions,
        loyalClients: metric.repeatClients,
        value: metric.totalValue ? `€${Math.round(metric.totalValue).toLocaleString()}` : '—'
      }));
  }, [bookings]);

  const {
    drinkInsights,
    foodTotals,
    foodByBoat,
    topFoodItems
  } = useMemo(() => {
    if (!orders.length) {
      return {
        drinkInsights: [],
        foodTotals: { quantity: 0, revenue: 0 },
        foodByBoat: [],
        topFoodItems: []
      };
    }

    const beverageRecords = [];
    const foodLineItems = [];

    orders.forEach((order) => {
      const clientKey = getOrderClientKey(order);
      const orderDate = toDate(order?.orderDate) || toDate(order?.createdAt);
      const boatName =
        order?.boatName ||
        order?.booking_info?.bookingDetails?.boatName ||
        order?.bookingDetails?.boatName ||
        order?.booking?.boatName ||
        '';

      if (Array.isArray(order?.items)) {
        order.items.forEach((item) => {
          const label = normaliseText(item?.name);
          if (!label) {
            return;
          }

          const category = normaliseText(item?.category).toLowerCase();
          const tags = Array.isArray(item?.tags) ? item.tags.join(' ').toLowerCase() : '';
          const isDrink = DRINK_KEYWORDS.some((keyword) => category.includes(keyword) || label.toLowerCase().includes(keyword) || tags.includes(keyword));
          const quantity = Number(item?.quantity || 1);
          const price = Number(item?.price || 0);
          const lineTotal = quantity * price;

          if (isDrink) {
            beverageRecords.push({
              name: label,
              quantity,
              clientKey,
              orderDate
            });
          } else {
            foodLineItems.push({
              name: label,
              quantity,
              total: lineTotal,
              clientKey,
              orderDate,
              boat: boatName || 'Unassigned',
              orderId: order?.id || ''
            });
          }
        });
      }
    });

    const drinkMetrics = aggregateRepeatMetrics(beverageRecords, {
      keyExtractor: (record) => record.name,
      clientExtractor: (record) => record.clientKey,
      dateExtractor: (record) => record.orderDate,
      valueExtractor: (record) => record.quantity
    })
      .filter((metric) => metric.repeatInteractions > 0)
      .sort((a, b) => {
        if (b.repeatInteractions !== a.repeatInteractions) {
          return b.repeatInteractions - a.repeatInteractions;
        }
        return b.totalInteractions - a.totalInteractions;
      })
      .slice(0, 5)
      .map((metric, index) => ({
        id: `${metric.name}-${index}`,
        drink: metric.name,
        orders: metric.totalInteractions,
        repeatOrders: metric.repeatInteractions,
        loyalClients: metric.repeatClients,
        volume: `${Math.round(metric.totalValue)} units`,
      }));

    const foodTotals = foodLineItems.reduce(
      (acc, item) => {
        return {
          quantity: acc.quantity + item.quantity,
          revenue: acc.revenue + item.total
        };
      },
      { quantity: 0, revenue: 0 }
    );

    const foodByBoatMap = new Map();
    foodLineItems.forEach((item) => {
      const key = item.boat || 'Unassigned';
      const entry = foodByBoatMap.get(key) || {
        boat: key,
        revenue: 0,
        quantity: 0,
        orders: new Set()
      };
      entry.revenue += item.total;
      entry.quantity += item.quantity;
      if (item.orderId) {
        entry.orders.add(item.orderId);
      }
      foodByBoatMap.set(key, entry);
    });

    const foodByBoat = Array.from(foodByBoatMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)
      .map((entry) => ({
        id: entry.boat,
        boat: entry.boat,
        orders: entry.orders.size,
        items: entry.quantity,
        revenueValue: entry.revenue,
        revenue: `€${Math.round(entry.revenue).toLocaleString()}`
      }));

    const foodItemMap = new Map();
    foodLineItems.forEach((item) => {
      const key = item.name;
      const entry = foodItemMap.get(key) || {
        item: key,
        quantity: 0,
        revenue: 0,
        boats: new Set()
      };
      entry.quantity += item.quantity;
      entry.revenue += item.total;
      if (item.boat) {
        entry.boats.add(item.boat);
      }
      foodItemMap.set(key, entry);
    });

    const topFoodItems = Array.from(foodItemMap.values())
      .sort((a, b) => {
        if (b.quantity !== a.quantity) {
          return b.quantity - a.quantity;
        }
        return b.revenue - a.revenue;
      })
      .slice(0, 6)
      .map((entry) => ({
        id: entry.item,
        item: entry.item,
        boats: entry.boats.size,
        quantity: entry.quantity,
        revenueValue: entry.revenue,
        revenue: `€${Math.round(entry.revenue).toLocaleString()}`
      }));

    return {
      drinkInsights: drinkMetrics,
      foodTotals,
      foodByBoat,
      topFoodItems
    };
  }, [orders]);

  const partnerInsights = useMemo(() => {
    if (!bookings.length) {
      return [];
    }

    const partnerRecords = aggregateRepeatMetrics(bookings, {
      keyExtractor: (booking) => {
        const partnerId = booking?.selectedPartner;
        if (partnerId) {
          return partnerId;
        }
        return booking?.selectedPartnerName || booking?.partnerName || '';
      },
      clientExtractor: (booking) => getClientKey(booking),
      dateExtractor: (booking) => toDate(booking?.bookingDetails?.date) || toDate(booking?.createdAt),
      valueExtractor: (booking) => Number(booking?.pricing?.agreedPrice || booking?.pricing?.finalPrice || 0)
    });

    return partnerRecords
      .filter((partner) => partner.name)
      .sort((a, b) => {
        if (b.totalValue !== a.totalValue) {
          return b.totalValue - a.totalValue;
        }
        return b.repeatClients - a.repeatClients;
      })
      .slice(0, 5)
      .map((partner, index) => {
        const key = partner.name;
        const label = partnerAliasMap[key] || key;
        return {
          id: `${key}-${index}`,
          partner: label,
          bookings: partner.totalInteractions,
          revenue: `€${Math.round(partner.totalValue).toLocaleString()}`,
          loyalClients: partner.repeatClients,
          loyaltyRate: `${Math.round(partner.loyaltyRate * 100)}%`
        };
      });
  }, [bookings, partnerAliasMap]);

  const summerBusyDays = useMemo(() => {
    if (!bookings.length) {
      return { past: [], upcoming: [] };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const byDate = new Map();

    bookings.forEach((booking) => {
      const bookingDate =
        toDate(booking?.bookingDetails?.date) ||
        toDate(booking?.bookingDate) ||
        toDate(booking?.createdAt);
      if (!bookingDate || !isSummer(bookingDate)) {
        return;
      }

      const key = format(bookingDate, 'yyyy-MM-dd');
      const entry = byDate.get(key) || {
        date: bookingDate,
        bookings: 0,
        revenue: 0,
        boats: new Set(),
        passengers: 0
      };

      entry.bookings += 1;
      entry.revenue += Number(booking?.pricing?.agreedPrice || booking?.pricing?.finalPrice || 0);
      if (booking?.bookingDetails?.boatName) {
        entry.boats.add(booking.bookingDetails.boatName);
      }
      entry.passengers += Number(booking?.bookingDetails?.passengers || booking?.passengers || 0);

      byDate.set(key, entry);
    });

    const entries = Array.from(byDate.values()).map((entry) => ({
      ...entry,
      boats: Array.from(entry.boats)
    }));

    const sorter = (a, b) => {
      if (b.bookings !== a.bookings) {
        return b.bookings - a.bookings;
      }
      return b.revenue - a.revenue;
    };

    const past = entries
      .filter((entry) => entry.date < today)
      .sort(sorter)
      .slice(0, 5);

    const upcoming = entries
      .filter((entry) => entry.date >= today)
      .sort(sorter)
      .slice(0, 5);

    return { past, upcoming };
  }, [bookings]);

  const outstandingPayments = useMemo(() => {
    const today = new Date();
    return bookings
      .filter((booking) => {
        const status = booking?.pricing?.paymentStatus;
        if (!OUTSTANDING_PAYMENT_STATUSES.includes(status)) {
          return false;
        }
        const bookingDate = toDate(booking?.bookingDetails?.date) || toDate(booking?.bookingDate);
        if (!bookingDate) {
          return true;
        }
        const daysUntil = differenceInCalendarDays(bookingDate, today);
        return daysUntil >= -1 && daysUntil <= 14;
      })
      .map((booking) => {
        const bookingDate = toDate(booking?.bookingDetails?.date) || toDate(booking?.bookingDate);
        const amountDue = Number(booking?.pricing?.agreedPrice || 0) - Number(booking?.pricing?.totalPaid || 0);
        return {
          id: booking.id,
          client: booking?.clientDetails?.name || 'Unknown client',
          boat: booking?.bookingDetails?.boatName || 'Unassigned',
          status: booking?.pricing?.paymentStatus || 'Pending',
          amountDue: amountDue > 0 ? `€${Math.round(amountDue).toLocaleString()}` : 'TBC',
          bookingDate: bookingDate ? format(bookingDate, 'dd MMM yyyy') : 'TBC',
        };
      });
  }, [bookings]);

  const automationQueue = useMemo(() => {
    const today = new Date();
    const soonThreshold = 5;

    const queue = bookings
      .filter((booking) => OUTSTANDING_PAYMENT_STATUSES.includes(booking?.pricing?.paymentStatus || ''))
      .map((booking) => {
        const bookingDate = toDate(booking?.bookingDetails?.date) || toDate(booking?.bookingDate);
        const daysToGo = bookingDate ? differenceInCalendarDays(bookingDate, today) : null;
        const lastReminder = toDate(booking?.automation?.lastReminderSentAt);

        return {
          id: booking.id,
          client: booking?.clientDetails?.name || 'Unknown client',
          boat: booking?.bookingDetails?.boatName || 'Unassigned',
          daysRemaining: daysToGo,
          lastReminder: lastReminder ? format(lastReminder, 'dd MMM') : 'Never',
          priority: daysToGo !== null && daysToGo <= soonThreshold ? 'High' : 'Standard'
        };
      })
      .filter((entry) => entry.daysRemaining === null || entry.daysRemaining >= -1)
      .sort((a, b) => {
        if (a.priority === 'High' && b.priority !== 'High') return -1;
        if (b.priority === 'High' && a.priority !== 'High') return 1;
        if (a.daysRemaining === null) return 1;
        if (b.daysRemaining === null) return -1;
        return a.daysRemaining - b.daysRemaining;
      });

    return queue.slice(0, 6);
  }, [bookings]);

  const summary = useMemo(() => {
    if (!bookings.length) {
      return {
        totalBookings: 0,
        repeatBookings: 0,
        outstanding: 0,
        topBoat: '—',
        topDrink: '—',
        topPartner: '—',
        foodRevenue: 0,
        topFoodBoat: '—',
        topFoodItem: '—'
      };
    }

    const repeatBookingsCount = boatInsights.reduce((sum, boat) => sum + boat.repeat, 0);
    return {
      totalBookings: bookings.length,
      repeatBookings: repeatBookingsCount,
      outstanding: outstandingPayments.length,
      topBoat: boatInsights[0]?.name || '—',
      topDrink: drinkInsights[0]?.drink || '—',
      topPartner: partnerInsights[0]?.partner || '—',
      foodRevenue: foodTotals.revenue || 0,
      topFoodBoat: foodByBoat[0]?.boat || '—',
      topFoodItem: topFoodItems[0]?.item || '—'
    };
  }, [bookings, boatInsights, drinkInsights, partnerInsights, outstandingPayments, foodTotals, foodByBoat, topFoodItems]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500" />
          <p className="text-sm">Crunching booking intelligence…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        <h2 className="text-lg font-semibold">Unable to load intelligence data</h2>
        <p className="mt-2 text-sm">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
        >
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Nautiq Intelligence</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">Operational Signal Board</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Track repeat demand, beverage traction, route performance, and partner strength. Designed to surface the moves you need to
            make before anyone else spots them.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
        >
          <RefreshCw size={16} />
          Refresh
          <span className="text-xs text-slate-400">
            {lastRefresh ? format(lastRefresh, 'dd MMM • HH:mm') : ''}
          </span>
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <InsightCard
          icon={TrendingUp}
          title="Repeat Bookings"
          value={summary.repeatBookings}
          subtitle="Bookings created by returning guests this season"
        />
        <InsightCard
          icon={AlertTriangle}
          title="Outstanding Payments"
          value={summary.outstanding}
          subtitle="Bookings with balances inside a 14-day window"
          accent="bg-amber-100 text-amber-600"
        />
        <InsightCard
          icon={Ship}
          title="Most Loyal Boat"
          value={summary.topBoat}
          subtitle="Highest repeat volume"
          accent="bg-slate-900 text-sky-300"
        />
        <InsightCard
          icon={CupSoda}
          title="Hot Beverage"
          value={summary.topDrink}
          subtitle="Drink with the most repeat demand"
          accent="bg-emerald-100 text-emerald-600"
        />
        <InsightCard
          icon={Utensils}
          title="Catering Momentum"
          value={`€${Math.round(summary.foodRevenue || 0).toLocaleString()}`}
          subtitle={`Top boat: ${summary.topFoodBoat} • Star dish: ${summary.topFoodItem}`}
          accent="bg-rose-100 text-rose-600"
        />
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <TableCard
          icon={Ship}
          title="Boats With Repeat Pull"
          description="Analyze which yachts pull guests back for second and third voyages."
          columns={[
            { key: 'name', label: 'Boat' },
            { key: 'total', label: 'Bookings' },
            { key: 'repeat', label: 'Repeat' },
            { key: 'loyalClients', label: 'Loyal Clients' },
            { key: 'loyaltyRate', label: 'Loyalty' },
            { key: 'value', label: 'Revenue' }
          ]}
          rows={boatInsights}
          emptyLabel="No repeat bookings detected yet."
        />
        <TableCard
          icon={MapPin}
          title="Routes Guests Repeat"
          description="Locate the transfer paths and itineraries that keep guests coming back."
          columns={[
            { key: 'route', label: 'Route' },
            { key: 'total', label: 'Bookings' },
            { key: 'repeat', label: 'Repeat' },
            { key: 'loyalClients', label: 'Loyal Clients' },
            { key: 'value', label: 'Revenue' }
          ]}
          rows={routeInsights}
          emptyLabel="No repeat routes identified."
        />
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <TableCard
          icon={CupSoda}
          title="Drinks With Repeat Demand"
          description="Spot the beverage SKUs that deserve prime placement and proactive procurement."
          columns={[
            { key: 'drink', label: 'Drink' },
            { key: 'orders', label: 'Orders' },
            { key: 'repeatOrders', label: 'Repeat' },
            { key: 'loyalClients', label: 'Loyal Clients' },
            { key: 'volume', label: 'Volume' }
          ]}
          rows={drinkInsights}
          emptyLabel="No repeat beverage patterns yet."
        />
        <TableCard
          icon={Users}
          title="Partner Performance Pulse"
          description="Measure partner-driven revenue and the loyalty they help cultivate."
          columns={[
            { key: 'partner', label: 'Partner' },
            { key: 'bookings', label: 'Bookings' },
            { key: 'revenue', label: 'Revenue' },
            { key: 'loyalClients', label: 'Loyal Clients' },
            { key: 'loyaltyRate', label: 'Loyalty' }
          ]}
          rows={partnerInsights}
          emptyLabel="No partner bookings recorded yet."
        />
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <TableCard
          icon={Utensils}
          title="Catering Volume by Boat"
          description="Understand which yachts consume the highest provisioning volume."
          columns={[
            { key: 'boat', label: 'Boat' },
            { key: 'orders', label: 'Orders' },
            { key: 'items', label: 'Items' },
            { key: 'revenue', label: 'Value' }
          ]}
          rows={foodByBoat.map((entry) => ({
            ...entry,
            revenue: `€${Math.round(entry.revenueValue || 0).toLocaleString()}`,
          }))}
          emptyLabel="No food orders recorded yet."
        />
        <TableCard
          icon={Utensils}
          title="Most Requested Dishes"
          description="Menu items driving the strongest repeat demand across the fleet."
          columns={[
            { key: 'item', label: 'Item' },
            { key: 'boats', label: 'Boats' },
            { key: 'quantity', label: 'Units' },
            { key: 'revenue', label: 'Value' }
          ]}
          rows={topFoodItems.map((entry) => ({
            ...entry,
            revenue: `€${Math.round(entry.revenueValue || 0).toLocaleString()}`,
          }))}
          emptyLabel="No catering items have been ordered yet."
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CalendarRange size={18} className="text-sky-500" />
                <h3 className="text-lg font-semibold text-slate-900">Summer Pressure Days</h3>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Peak charter density across June–September. Past highs show where operations stretched; upcoming spikes flag where to stage crew and supplies.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {new Date().getFullYear()} season
            </span>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Recent peaks</p>
              <ul className="mt-3 space-y-3">
                {summerBusyDays.past.length === 0 && (
                  <li className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    No historical summer peaks recorded yet.
                  </li>
                )}
                {summerBusyDays.past.map((entry) => (
                  <li
                    key={`past-${entry.date.toISOString()}`}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {format(entry.date, 'EEE • dd MMM')}
                        </p>
                        <p className="text-xs text-slate-500">
                          {entry.boats.length > 0 ? entry.boats.slice(0, 3).join(', ') : 'Fleet TBC'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">{entry.bookings} departures</p>
                        <p className="text-xs text-slate-500">
                          €{Math.round(entry.revenue).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Forecasted surges</p>
              <ul className="mt-3 space-y-3">
                {summerBusyDays.upcoming.length === 0 && (
                  <li className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    No upcoming summer spikes yet — keep an eye on new bookings.
                  </li>
                )}
                {summerBusyDays.upcoming.map((entry) => (
                  <li
                    key={`future-${entry.date.toISOString()}`}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {format(entry.date, 'EEE • dd MMM')}
                        </p>
                        <p className="text-xs text-slate-500">
                          {entry.boats.length > 0 ? entry.boats.slice(0, 3).join(', ') : 'Fleet TBC'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">{entry.bookings} departures</p>
                        <p className="text-xs text-slate-500">
                          €{Math.round(entry.revenue).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="flex h-full flex-col gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-5 shadow-inner shadow-slate-200/70">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-amber-500" />
                <h3 className="text-lg font-semibold text-slate-900">Automation Queue</h3>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Preview the bookings your Firebase Function will nudge next. Configure cadence by tuning the reminder window.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100">
              {automationQueue.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-slate-400">
                  No reminders queued. All balances are clear or outside the window.
                </li>
              )}
              {automationQueue.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{entry.client}</p>
                    <p className="text-xs text-slate-500">{entry.boat}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span
                      className={
                        entry.priority === 'High'
                          ? 'rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-600'
                          : 'rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600'
                      }
                    >
                      {entry.priority}
                    </span>
                    <div className="flex items-center gap-1">
                      <ArrowRight size={14} />
                      <span>{entry.daysRemaining === null ? 'Date TBC' : `${entry.daysRemaining} days`}</span>
                    </div>
                    <span>Last ping: {entry.lastReminder}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-slate-900">SOP Reminder</h4>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              1. Verify outstanding balance in the CRM dashboard.<br />
              2. Ensure reminder template aligns with payment terms.<br />
              3. Log concierge follow-up notes in the booking timeline for team visibility.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5">
        <TableCard
          icon={AlertTriangle}
          title="Outstanding Balances Watchlist"
          description="Payment statuses to reconcile. Trigger reminders or call-outs directly from here."
          columns={[
            { key: 'client', label: 'Client' },
            { key: 'boat', label: 'Boat' },
            { key: 'bookingDate', label: 'Sail Date' },
            { key: 'status', label: 'Status' },
            { key: 'amountDue', label: 'Balance' }
          ]}
          rows={outstandingPayments.map((entry, index) => ({
            id: `${entry.id}-${index}`,
            ...entry
          }))}
          emptyLabel="No outstanding balances in the next 14 days."
        />
      </section>
    </div>
  );
};

export default DataInsights;
