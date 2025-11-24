import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Crown,
  LineChart,
  Download,
  ShieldCheck,
  Users,
  ClipboardCheck,
  ChevronRight
} from 'lucide-react';

const CEO_UID = process.env.REACT_APP_CEO_UID;
const CEO_EMAIL = process.env.REACT_APP_CEO_EMAIL;

const ACTIONS = [
  {
    label: 'Executive dashboard',
    description: 'Open the financial cockpit with live KPIs.',
    icon: LineChart,
    to: '/financial-dashboard'
  },
  {
    label: 'Leadership signals',
    description: 'Review repeat demand, partner health, and automation queue.',
    icon: ClipboardCheck,
    to: '/insights'
  },
  {
    label: 'Approved collaborators',
    description: 'Audit team access and assign elevated permissions.',
    icon: ShieldCheck,
    to: '/user-management'
  },
  {
    label: 'Export revenue snapshot',
    description: 'Download the latest revenue by boat report.',
    icon: Download,
    action: 'export-revenue'
  },
  {
    label: 'Partner roster',
    description: 'Jump to collaborator performance and share links.',
    icon: Users,
    to: '/collaborator-management'
  }
];

const CEOCommandMenu = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const isCeo = Boolean(
    user &&
    (
      (CEO_UID && user.uid === CEO_UID) ||
      (CEO_EMAIL && user.email === CEO_EMAIL)
    )
  );

  if (!isCeo) {
    return null;
  }

  const handleAction = (action) => {
    if (action.to) {
      navigate(action.to);
      setOpen(false);
      return;
    }

    if (action.action === 'export-revenue') {
      setStatusMessage('Preparing revenue export…');
      const event = new CustomEvent('dashboard-export-revenue', { bubbles: true });
      window.dispatchEvent(event);
      setTimeout(() => setStatusMessage('Drop into Finance ▸ Dashboard for detailed exports.'), 2200);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Crown size={16} className="text-amber-500" />
        CEO Suite
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl z-50">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Leadership</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">Executive quick actions</p>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {ACTIONS.map((action) => (
              <li key={action.label}>
                <button
                  onClick={() => handleAction(action)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">
                    <action.icon size={16} />
                  </span>
                  <span className="flex-1">
                    <span className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-900">
                      {action.label}
                      <ChevronRight size={14} className="text-slate-300" />
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">{action.description}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {statusMessage && (
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
              {statusMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CEOCommandMenu;
