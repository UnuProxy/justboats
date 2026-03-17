import React from 'react';
import PropTypes from 'prop-types';
import { ExternalLink, FileText, Ship, User, Users, CreditCard, CalendarDays, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function formatDateTime(value) {
  if (!value) return 'N/A';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(value) {
  if (!value) return 'N/A';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatCurrency(amount, currency = 'EUR') {
  const numericAmount = Number(amount) || 0;
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: String(currency || 'EUR').toUpperCase(),
    }).format(numericAmount);
  } catch {
    return `${numericAmount.toFixed(2)} ${String(currency || 'EUR').toUpperCase()}`;
  }
}

function DetailCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-900 break-words">{value || 'N/A'}</p>
    </div>
  );
}

DetailCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

function ExternalBookingDetails({ booking, onClose }) {
  const { isAdmin, isEmployee, isDriver, isStaff } = useAuth();
  const hideContactInfo =
    isDriver?.() || (((isEmployee?.() || isStaff?.()) && !isAdmin?.()));
  const lead = booking?.externalData?.lead || {};
  const boat = booking?.externalData?.boat || {};
  const payment = booking?.externalData?.payment || {};
  const extras = Array.isArray(booking?.externalData?.extras) ? booking.externalData.extras : [];
  const documents = Array.isArray(booking?.externalData?.documentsUploaded)
    ? booking.externalData.documentsUploaded
    : [];
  const clientName =
    booking?.clientName ||
    [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() ||
    lead.email ||
    'Unknown client';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 py-6 sm:py-12 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="external-booking-title"
    >
      <div
        className="w-full max-w-5xl rounded-2xl bg-slate-50 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 rounded-t-2xl border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              External Booking
            </p>
            <h2 id="external-booking-title" className="mt-1 text-2xl font-bold text-slate-900">
              {clientName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <div className="flex flex-wrap items-center gap-2">
              <Lock className="h-4 w-4" />
              Read-only booking from `boatox-ibiza`.
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DetailCard icon={CalendarDays} label="Start date" value={formatDateOnly(booking?.externalData?.startDate)} />
            <DetailCard icon={CalendarDays} label="End date" value={formatDateOnly(booking?.externalData?.endDate)} />
            <DetailCard icon={Ship} label="Boat" value={booking?.boatName || boat.name || booking?.externalData?.boatId} />
            <DetailCard icon={Users} label="Guests" value={String(booking?.numberOfPassengers || 0)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">Client</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <DetailCard icon={User} label="Name" value={clientName} />
                <DetailCard icon={FileText} label="Lead status" value={lead.status || 'N/A'} />
                <DetailCard icon={FileText} label="Email" value={hideContactInfo ? 'Not available' : lead.email || booking?.clientEmail} />
                <DetailCard icon={FileText} label="Phone" value={hideContactInfo ? 'Not available' : lead.phone || booking?.clientPhone} />
                <DetailCard icon={FileText} label="WhatsApp" value={hideContactInfo ? 'Not available' : lead.whatsapp} />
                <DetailCard icon={Users} label="Lead guests" value={lead.numberOfGuests ? String(lead.numberOfGuests) : 'N/A'} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">Pricing & Payment</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <DetailCard icon={CreditCard} label="Booking status" value={booking?.externalData?.status || 'N/A'} />
                <DetailCard icon={CreditCard} label="Payment status" value={booking?.paymentStatus || 'No Payment'} />
                <DetailCard icon={CreditCard} label="Base price" value={formatCurrency(booking?.externalData?.basePrice, booking?.externalData?.currency)} />
                <DetailCard icon={CreditCard} label="Total price" value={formatCurrency(booking?.finalPrice, booking?.externalData?.currency)} />
                <DetailCard icon={CreditCard} label="Amount paid" value={formatCurrency(payment.amountPaid, payment.currency || booking?.externalData?.currency)} />
                <DetailCard icon={CreditCard} label="Paid at" value={formatDateTime(payment.paidAt)} />
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">Notes</h3>
              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap">
                {booking?.clientNotes || lead.specialRequirements || 'No notes'}
              </div>
              {extras.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Extras</p>
                  <div className="mt-2 space-y-2">
                    {extras.map((extra, index) => (
                      <div key={`${extra.name || 'extra'}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                        <span>{extra.name || 'Extra'}</span>
                        <span className="font-semibold">{formatCurrency(extra.price, booking?.externalData?.currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">Metadata</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <DetailCard icon={FileText} label="Source app" value="boatox-ibiza" />
                <DetailCard icon={FileText} label="External ID" value={booking?.externalId || booking?.id} />
                <DetailCard icon={FileText} label="Lead ID" value={booking?.externalData?.leadId} />
                <DetailCard icon={FileText} label="Boat ID" value={booking?.externalData?.boatId} />
                <DetailCard icon={FileText} label="Created at" value={formatDateTime(booking?.externalData?.createdAt)} />
                <DetailCard icon={FileText} label="Updated at" value={formatDateTime(booking?.externalData?.updatedAt)} />
              </div>

              {documents.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Documents</p>
                  <div className="mt-2 space-y-2">
                    {documents.map((documentUrl, index) => (
                      <a
                        key={`${documentUrl}-${index}`}
                        href={documentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-blue-700 hover:bg-slate-50"
                      >
                        <span className="truncate pr-4">Document {index + 1}</span>
                        <ExternalLink className="h-4 w-4 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

ExternalBookingDetails.propTypes = {
  booking: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default ExternalBookingDetails;
