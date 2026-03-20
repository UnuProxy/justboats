import React, { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { ExternalLink, Loader2, RotateCcw, Search } from 'lucide-react';
import { auth, db } from '../firebase/firebaseConfig';

const BOATOX_STATUS_CALLBACK_URL = 'https://boatox.vercel.app/api/payment-links/provider-status';
const BOATOX_DESCRIPTION_PREFIX = 'boatox payment';
const defaultRefundLinkEndpoint = process.env.REACT_APP_FIREBASE_PROJECT_ID
  ? `https://us-central1-${process.env.REACT_APP_FIREBASE_PROJECT_ID}.cloudfunctions.net/refundPaymentLinkHttp`
  : 'https://us-central1-crm-boats.cloudfunctions.net/refundPaymentLinkHttp';
const refundPaymentLinkEndpoint = process.env.REACT_APP_REFUND_PAYMENT_LINK_ENDPOINT || defaultRefundLinkEndpoint;

const formatAmount = (amount, currency = 'eur') => {
  const numericAmount = Number(amount) || 0;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: String(currency || 'eur').toUpperCase(),
  }).format(numericAmount);
};

const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString();
};

const isBoatoxPaymentRecord = (item = {}) => {
  const sourceApp = String(item.sourceApp || '').trim().toLowerCase();
  const description = String(item.description || '').trim().toLowerCase();

  return (
    sourceApp === 'boatox-ibiza' ||
    (sourceApp === 'external-app' &&
      item.statusCallbackUrl === BOATOX_STATUS_CALLBACK_URL &&
      description.startsWith(BOATOX_DESCRIPTION_PREFIX))
  );
};

const statusBadge = (label, tone = 'default') => {
  const tones = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border-amber-100',
    danger: 'bg-red-50 text-red-700 border-red-100',
    info: 'bg-sky-50 text-sky-700 border-sky-100',
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${tones[tone] || tones.default}`}>
      {label}
    </span>
  );
};

const getBookingReference = (item = {}) =>
  item.bookingReference ||
  item.bookingRef ||
  item.reference ||
  item.bookingId ||
  null;

const BoatoxPayments = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refundLoadingId, setRefundLoadingId] = useState(null);
  const [refundError, setRefundError] = useState(null);

  useEffect(() => {
    const paymentsQuery = query(
      collection(db, 'paymentLinks'),
      orderBy('createdAt', 'desc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(
      paymentsQuery,
      (snapshot) => {
        const allItems = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
            paidAt: data.paidAt?.toDate ? data.paidAt.toDate() : null,
            refundedAt: data.refundedAt?.toDate ? data.refundedAt.toDate() : null,
          };
        });

        const boatoxItems = allItems.filter(isBoatoxPaymentRecord);

        setHistory(boatoxItems);
        setLoading(false);
      },
      (error) => {
        console.error('Failed to load Boatox payments', error);
        setHistory([]);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const filteredHistory = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return history;

    return history.filter((item) => {
      const haystack = [
        item.id,
        item.customerName,
        item.customerEmail,
        item.description,
        item.bookingReference,
        item.bookingRef,
        item.reference,
        item.bookingId,
        item.paymentStatus,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [history, searchTerm]);

  const handleRefund = async (item) => {
    if (!item?.id) return;
    setRefundError(null);
    setRefundLoadingId(item.id);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Please sign in again to refund.');
      }

      const response = await fetch(refundPaymentLinkEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ paymentLinkId: item.id }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'Refund failed. Please try again.');
      }
    } catch (err) {
      setRefundError(err?.message || 'Refund failed. Please try again.');
    } finally {
      setRefundLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="app-card overflow-hidden p-0">
        <div className="flex flex-col gap-4 border-b px-6 py-5 md:flex-row md:items-end md:justify-between" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Boatox payments</h1>
            <p className="text-sm text-[var(--text-secondary)]">Separate Boatox activity from Nautiq internal links and keep the status feed clean.</p>
          </div>
          <div className="w-full md:w-80">
            <label className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-[0.2em]">Search</label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Client, description, booking, status"
                className="app-input pl-10"
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 text-xs text-[var(--text-tertiary)]">
          Showing links whose origin is explicitly identifiable as Boatox.
        </div>

        {refundError ? (
          <div className="px-6 pb-2 text-sm text-red-600">
            {refundError}
          </div>
        ) : null}

        <div className="overflow-x-auto px-6 pb-6">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--text-tertiary)]">
                <th className="py-2 pr-3 font-medium">Created</th>
                <th className="py-2 pr-3 font-medium">Client</th>
                <th className="py-2 pr-3 font-medium">Description</th>
                <th className="py-2 pr-3 font-medium">Amount</th>
                <th className="py-2 pr-3 font-medium">Payment</th>
                <th className="py-2 pr-3 font-medium">Paid at</th>
                <th className="py-2 pr-3 font-medium">Link</th>
                <th className="py-2 pr-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {loading ? (
                <tr>
                  <td className="py-4 text-[var(--text-secondary)]" colSpan={8}>
                    Loading Boatox payments…
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td className="py-4 text-[var(--text-secondary)]" colSpan={8}>
                    No Boatox payment links found.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => {
                  const bookingReference = getBookingReference(item);
                  const paymentTone = item.paymentStatus === 'paid'
                    ? 'success'
                    : item.paymentStatus === 'failed'
                      ? 'danger'
                      : item.paymentStatus === 'refunded'
                        ? 'info'
                        : 'warning';

                  return (
                    <tr key={item.id} className="align-top">
                      <td className="py-3 pr-3 whitespace-nowrap text-[var(--text-secondary)]">
                        {formatDateTime(item.createdAt)}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="font-medium text-[var(--text-primary)]">{item.customerName || '—'}</div>
                        <div className="text-xs text-[var(--text-tertiary)]">{item.customerEmail || item.id}</div>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="text-[var(--text-primary)]">{item.description || '—'}</div>
                        <div className="text-xs text-[var(--text-tertiary)]">{bookingReference || 'No booking reference'}</div>
                      </td>
                      <td className="py-3 pr-3 font-medium text-[var(--text-primary)]">
                        {formatAmount(item.amount, item.currency)}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-col gap-1">
                          {statusBadge(item.paymentStatus || 'pending', paymentTone)}
                          <span className="text-xs text-[var(--text-tertiary)]">
                            Link {item.status || 'active'}
                          </span>
                          {item.refundStatus ? (
                            <span className="text-xs text-[var(--text-tertiary)]">
                              Refund {item.refundStatus}{item.refundedAt ? ` · ${formatDateTime(item.refundedAt)}` : ''}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-[var(--text-secondary)]">
                        {formatDateTime(item.paidAt)}
                      </td>
                      <td className="py-3 pr-3">
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[var(--accent)] underline"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Open
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <button
                          type="button"
                          onClick={() => handleRefund(item)}
                          disabled={item.paymentStatus !== 'paid' || refundLoadingId === item.id}
                          className="app-button--secondary w-full justify-center disabled:opacity-50"
                        >
                          {refundLoadingId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                          Refund
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BoatoxPayments;
