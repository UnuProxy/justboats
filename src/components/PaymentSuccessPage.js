import React from 'react';
import { CheckCircle2 } from 'lucide-react';

const PaymentSuccessPage = () => {
  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-10 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-[32px] border border-white/60 bg-white/90 shadow-[0_30px_80px_-40px_rgba(5,34,52,0.45)] backdrop-blur">
          <div className="relative overflow-hidden bg-[linear-gradient(135deg,#041a2d_0%,#0b3e56_45%,#1a9fb3_100%)] px-5 py-8 text-white sm:px-8 sm:py-10 lg:px-12 lg:py-12">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,12,24,0.3)_0%,rgba(2,12,24,0.12)_100%)] lg:bg-[linear-gradient(90deg,rgba(2,12,24,0.7)_0%,rgba(2,12,24,0.36)_48%,rgba(255,255,255,0)_100%)]" />
            <div className="absolute inset-0 opacity-25" style={{ background: 'radial-gradient(circle at top right, rgba(255,255,255,0.32), transparent 32%)' }} />
            <div className="relative flex flex-col items-center gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
              <div className="order-1 flex flex-col items-center text-center lg:order-2">
                <div className="flex h-28 w-28 items-center justify-center self-center rounded-[24px] border border-white/15 bg-white/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] sm:h-32 sm:w-32 sm:p-5 lg:h-40 lg:w-40 lg:rounded-[28px] lg:p-6">
                  <img
                    src="/LogoNoBack.png"
                    alt="Boatox Ibiza"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="mt-3 text-sm font-semibold uppercase tracking-[0.32em] text-white/90">
                  Boatox Ibiza
                </div>
              </div>

              <div className="order-2 w-full max-w-2xl px-1 text-center lg:order-1 lg:px-0 lg:text-left">
                <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-white drop-shadow-[0_10px_28px_rgba(0,0,0,0.32)] sm:text-4xl lg:text-5xl">
                  Payment received
                </h1>
                <p className="mt-3 max-w-xl text-sm text-white/90 sm:mt-4 sm:text-base lg:text-lg">
                  Thank you for completing your payment. Your Boatox Ibiza team will now finalize the next steps for your charter.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-4 py-4 sm:gap-6 sm:px-8 sm:py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-12">
            <div className="rounded-[24px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(31,122,140,0.08),rgba(255,255,255,0.96))] p-5 sm:rounded-[28px] sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-[var(--text-primary)]">What happens next</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    We have securely received your payment. A member of the Boatox Ibiza team will confirm the booking details,
                    boat information, and any final charter logistics with you shortly.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3 sm:gap-4">
                <div className="rounded-2xl border border-[var(--border)] bg-white/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-tertiary)]">Step 1</div>
                  <div className="mt-2 text-sm font-medium text-[var(--text-primary)]">Payment confirmed</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-white/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-tertiary)]">Step 2</div>
                  <div className="mt-2 text-sm font-medium text-[var(--text-primary)]">Booking checked by our team</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-white/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-tertiary)]">Step 3</div>
                  <div className="mt-2 text-sm font-medium text-[var(--text-primary)]">Charter details shared with you</div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-[var(--border)] bg-white p-5 sm:rounded-[28px] sm:p-6">
              <div className="rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(31,122,140,0.08),rgba(255,255,255,0.96))] px-4 py-5">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <CheckCircle2 size={20} />
                  </div>
                  <div className="mt-3 text-sm leading-snug text-[var(--text-secondary)]">
                    Thank you for choosing Boatox Ibiza.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;
