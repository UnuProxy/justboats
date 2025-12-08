import React, { useEffect, useState, useCallback } from 'react';
import { auth, db } from '../firebase/firebaseConfig';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import {
  Check,
  Copy,
  CreditCard,
  Link as LinkIcon,
  Loader2,
  RotateCcw,
  Send,
  Shield
} from 'lucide-react';

const initialForm = {
  amount: '',
  currency: 'eur',
  description: '',
  customerName: '',
  customerEmail: '',
  bookingId: '',
  successUrl: 'https://nautiqibiza.com/thanks',
  notes: ''
};

const defaultPaymentLinkEndpoint = process.env.REACT_APP_FIREBASE_PROJECT_ID
  ? `https://us-central1-${process.env.REACT_APP_FIREBASE_PROJECT_ID}.cloudfunctions.net/createStripePaymentLinkHttp`
  : 'https://us-central1-crm-boats.cloudfunctions.net/createStripePaymentLinkHttp';

const paymentLinkEndpoint = process.env.REACT_APP_PAYMENT_LINK_ENDPOINT || defaultPaymentLinkEndpoint;
const defaultRefundLinkEndpoint = process.env.REACT_APP_FIREBASE_PROJECT_ID
  ? `https://us-central1-${process.env.REACT_APP_FIREBASE_PROJECT_ID}.cloudfunctions.net/refundPaymentLinkHttp`
  : 'https://us-central1-crm-boats.cloudfunctions.net/refundPaymentLinkHttp';
const refundPaymentLinkEndpoint = process.env.REACT_APP_REFUND_PAYMENT_LINK_ENDPOINT || defaultRefundLinkEndpoint;

const formatAmount = (value, currency) => {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency?.toUpperCase() || 'EUR'
  }).format(amount);
};

const PaymentLinkGenerator = () => {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [filters, setFilters] = useState({ term: '', from: '', to: '' });
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [refundLoadingId, setRefundLoadingId] = useState(null);
  const [refundError, setRefundError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setCopied(false);
    setResult(null);

    const parsedAmount = Number(form.amount);
    if (!parsedAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Please sign in again to create payment links.');
      }

      const response = await fetch(paymentLinkEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: parsedAmount,
          currency: form.currency,
          description: form.description,
          customerName: form.customerName,
          customerEmail: form.customerEmail,
          bookingId: form.bookingId,
          successUrl: form.successUrl,
          notes: form.notes
        })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.error || `Request failed (${response.status})`;
        throw new Error(message);
      }

      if (!data?.url) {
        throw new Error('Stripe did not return a payment link. Please verify the Stripe key in Firebase.');
      }
      setResult(data);
    } catch (err) {
      const message = err?.message || 'Unable to create a payment link right now.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!result?.url || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      setError('Could not copy the link. Please copy it manually.');
    }
  };

  const shareMessage = result
    ? `Hi ${form.customerName || 'there'}, here is your secure Nautiq payment link for ${formatAmount(form.amount, form.currency)}: ${result.url}`
    : '';

  const quickDescriptions = ['Deposit', 'Remaining balance', 'Fuel surcharge', 'Extra hours'];

  useEffect(() => {
    const linksQuery = query(
      collection(db, 'paymentLinks'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      linksQuery,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
            paidAt: data.paidAt?.toDate ? data.paidAt.toDate() : null
          };
        });
        setHistory(items);
        setHistoryLoading(false);
      },
      (err) => {
        console.error('Failed to load payment links', err);
        setHistory([]);
        setHistoryLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const applyFilters = useCallback(() => {
    const { term, from, to } = filters;
    const normalizedTerm = term.trim().toLowerCase();

    const startDate = from ? new Date(from) : null;
    if (startDate) startDate.setHours(0, 0, 0, 0);
    const endDate = to ? new Date(to) : null;
    if (endDate) endDate.setHours(23, 59, 59, 999);

    const next = history.filter((item) => {
      const created = item.createdAt ? new Date(item.createdAt) : null;

      if (startDate && (!created || created < startDate)) return false;
      if (endDate && (!created || created > endDate)) return false;

      if (normalizedTerm) {
        const haystack = [
          item.customerName,
          item.customerEmail,
          item.bookingId,
          item.description
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(normalizedTerm)) {
          return false;
        }
      }
      return true;
    });

    setFilteredHistory(next);
  }, [filters, history]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const clearFilters = () => {
    setFilters({ term: '', from: '', to: '' });
    setFilteredHistory(history);
  };

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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ paymentLinkId: item.id })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'Refund failed. Please try again.');
      }
      // Snapshot listener will refresh status; nothing else required here
    } catch (err) {
      const message = err?.message || 'Refund failed. Please try again.';
      setRefundError(message);
    } finally {
      setRefundLoadingId(null);
    }
  };

  const statusBadge = (label, tone = 'default') => {
    const tones = {
      default: 'bg-slate-100 text-slate-700 border-slate-200',
      success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      warning: 'bg-amber-50 text-amber-700 border-amber-100',
      danger: 'bg-red-50 text-red-700 border-red-100',
      info: 'bg-sky-50 text-sky-700 border-sky-100'
    };
    return (
      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${tones[tone] || tones.default}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--text-primary)]">Payment link</h1>
          <p className="text-[var(--text-secondary)]">
            Create a one-off Stripe link to share with a client.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 shadow-sm ring-1" style={{ borderColor: 'var(--border)' }}>
          <Shield className="h-4 w-4 text-[var(--text-tertiary)]" />
          <span className="text-sm text-[var(--text-tertiary)]">Secure via Firebase</span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 app-card p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-light)] text-[var(--accent)]">
              <CreditCard size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Link details</h2>
              <p className="text-sm text-[var(--text-secondary)]">Amount and optional client info.</p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="amount"
                  value={form.amount}
                  onChange={handleChange}
                  className="app-input"
                  placeholder="250.00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Currency</label>
                <select
                  name="currency"
                  value={form.currency}
                  className="app-input bg-gray-50 text-[var(--text-secondary)]"
                  disabled
                >
                  <option value="eur">EUR (€)</option>
                </select>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">Payments are processed in euros.</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Description</label>
              <input
                type="text"
                name="description"
                value={form.description}
                onChange={handleChange}
                className="app-input"
                placeholder="Deposit for Luna charter"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {quickDescriptions.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, description: label }))}
                    className="rounded-full border px-3 py-1 text-xs text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Client name (optional)</label>
                <input
                  type="text"
                  name="customerName"
                  value={form.customerName}
                  onChange={handleChange}
                  className="app-input"
                  placeholder="Alex Johnson"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Client email (optional)</label>
                <input
                  type="email"
                  name="customerEmail"
                  value={form.customerEmail}
                  onChange={handleChange}
                  className="app-input"
                  placeholder="client@email.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Booking ID (optional)</label>
                <input
                  type="text"
                  name="bookingId"
                  value={form.bookingId}
                  onChange={handleChange}
                  className="app-input"
                  placeholder="Booking ref to track in Stripe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Success redirect (optional)</label>
                <input
                  type="url"
                  name="successUrl"
                  value={form.successUrl}
                  onChange={handleChange}
                  className="app-input"
                  placeholder="https://nautiqibiza.com/thanks"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Internal notes (metadata)</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
                className="app-input"
                placeholder="Add context for finance or ops..."
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button type="submit" className="app-button" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {loading ? 'Creating link…' : 'Generate payment link'}
              </button>
              <div className="text-sm text-[var(--text-secondary)]">
                {form.amount ? formatAmount(form.amount, form.currency) : 'Enter an amount'}
              </div>
            </div>
          </form>
        </div>

        <div className="app-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <LinkIcon size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Payment link</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Copy and share after generation.
              </p>
            </div>
          </div>

          {result ? (
            <div className="space-y-3 rounded-xl border px-3 py-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <Check className="h-4 w-4" />
                Link created successfully
              </div>
              <div className="rounded-lg bg-white px-3 py-2 text-sm shadow-inner border" style={{ borderColor: 'var(--border)' }}>
                <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">URL</div>
                <div className="break-all text-[var(--text-primary)]">{result.url}</div>
              </div>
              <button
                type="button"
                onClick={copyLink}
                className="app-button--secondary w-full justify-center"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)] mb-1">
                  Message template
                </div>
                <div className="rounded-lg border bg-white px-3 py-2 text-sm text-[var(--text-secondary)]" style={{ borderColor: 'var(--border)' }}>
                  {shareMessage}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed px-4 py-6 text-center text-[var(--text-secondary)]" style={{ borderColor: 'var(--border)' }}>
              Fill in the form to generate a Stripe link.
            </div>
          )}

          <div className="rounded-xl border bg-white px-3 py-3 text-sm space-y-2" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
              <Shield size={14} />
              Quick notes
            </div>
            <ul className="list-disc space-y-1 pl-4 text-[var(--text-secondary)]">
              <li>Each link is one-off and carries your metadata.</li>
              <li>Redirect URL is optional.</li>
              <li>Use a test key in the emulator.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="app-card p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-light)] text-[var(--accent)]">
              <LinkIcon size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recent payment links</h2>
              <p className="text-sm text-[var(--text-secondary)]">Last 50 generated links with payment status.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3 text-xs text-[var(--text-tertiary)]">
            <span>Auto-refreshes as new links are created.</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border bg-white px-3 py-3 text-sm" style={{ borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end">
            <div className="md:col-span-2">
              <label className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-[0.2em]">Search</label>
              <input
                type="text"
                name="term"
                value={filters.term}
                onChange={(e) => setFilters((prev) => ({ ...prev, term: e.target.value }))}
                placeholder="Client name, email, booking, description"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-[var(--text-primary)]"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              />
            </div>
            <div>
              <label className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-[0.2em]">From</label>
              <input
                type="date"
                name="from"
                value={filters.from}
                onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-[var(--text-primary)]"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              />
            </div>
            <div>
              <label className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-[0.2em]">To</label>
              <input
                type="date"
                name="to"
                value={filters.to}
                onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-[var(--text-primary)]"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={applyFilters} className="app-button app-button--primary">
              Search
            </button>
            <button type="button" onClick={clearFilters} className="app-button--secondary">
              Clear
            </button>
            {refundError && (
              <span className="text-xs text-red-600">
                {refundError}
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--text-tertiary)]">
                <th className="py-2 pr-3 font-medium">Created</th>
                <th className="py-2 pr-3 font-medium">Amount</th>
                <th className="py-2 pr-3 font-medium">Client</th>
                <th className="py-2 pr-3 font-medium">Booking</th>
                <th className="py-2 pr-3 font-medium">Link status</th>
                <th className="py-2 pr-3 font-medium">Payment</th>
                <th className="py-2 pr-3 font-medium">Link</th>
                <th className="py-2 pr-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {historyLoading ? (
                <tr>
                  <td className="py-4 text-[var(--text-secondary)]" colSpan={8}>
                    Loading payment links…
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td className="py-4 text-[var(--text-secondary)]" colSpan={8}>
                    No payment links match these filters.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => {
                  const paymentTone = item.paymentStatus === 'paid'
                    ? 'success'
                    : item.paymentStatus === 'failed'
                      ? 'danger'
                      : item.paymentStatus === 'refunded'
                        ? 'info'
                        : 'warning';

                  return (
                    <tr key={item.id} className="align-top">
                      <td className="py-3 pr-3 text-[var(--text-secondary)] whitespace-nowrap">
                        {item.createdAt ? item.createdAt.toLocaleString() : '—'}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="text-[var(--text-primary)] font-semibold">
                          {formatAmount(item.amount || 0, item.currency || 'eur')}
                        </div>
                        <div className="text-[var(--text-tertiary)] text-xs">{item.description || '—'}</div>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="text-[var(--text-primary)]">{item.customerName || '—'}</div>
                        <div className="text-[var(--text-tertiary)] text-xs">{item.customerEmail || ''}</div>
                      </td>
                      <td className="py-3 pr-3 text-[var(--text-secondary)]">
                        {item.bookingId || '—'}
                      </td>
                      <td className="py-3 pr-3">
                        {statusBadge(item.status || 'active')}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-col gap-1">
                          {statusBadge(item.paymentStatus || 'pending', paymentTone)}
                          {item.paidAt && (
                            <span className="text-xs text-[var(--text-tertiary)]">
                              Paid {item.paidAt.toLocaleString()}
                            </span>
                          )}
                          {item.refundStatus && (
                            <span className="text-xs text-[var(--text-tertiary)]">
                              Refund {item.refundStatus}{item.refundedAt ? ` · ${item.refundedAt.toLocaleString()}` : ''}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--accent)] underline"
                          >
                            Open
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-col gap-2">
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
                        </div>
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

export default PaymentLinkGenerator;
