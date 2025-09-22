import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Menu, X, Calendar, PlusCircle, Users,  BarChart3,
  User, CreditCard, Euro, Ship, MessageSquare, Settings, Building,
  ChevronRight, Utensils, Package, ShoppingCart, FileText, LineChart,
  QrCode, MapPin, DollarSign, Search, Clock, UserCheck
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Users2 } from 'lucide-react';

/* ---------- utils ---------- */
const cx = (...xs) => xs.filter(Boolean).join(' ');
const useDebouncedValue = (value, delay = 120) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
};

/* ---------- NavItem ---------- */
const NavItem = React.memo(function NavItem({ item, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors',
        active ? 'bg-white/10 text-white' : 'text-neutral-300 hover:text-white hover:bg-white/5'
      )}
    >
      <item.icon size={16} className="text-neutral-400" />
      <span className="flex-1 text-left">{item.name}</span>
      {item.badge?.text && (
        <span className="px-1.5 py-0.5 text-[10px] rounded bg-white/8 text-neutral-300 border border-white/10">
          {item.badge.text}
        </span>
      )}
    </button>
  );
});

/* ---------- NavGroup ---------- */
const NavGroup = React.memo(function NavGroup({ group, expanded, onToggle, pathname, onNavigate }) {
  const allowed = (group.items || []).filter(i => i && i.allowed);
  if (!allowed.length) return null;

  const hasActive = allowed.some(i => i && pathname === i.path);

  return (
    <div className="mb-3">
      <button
        onClick={() => onToggle(group.id)}
        className={cx(
          'w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors',
          'hover:bg-white/5',
          hasActive && 'bg-white/5'
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cx('w-8 h-8 rounded-md flex items-center justify-center bg-white/[0.04] border border-white/10')}>
            <group.icon size={16} className="text-neutral-300" />
          </div>
          <span className={cx('font-semibold text-[12px] uppercase tracking-wide', hasActive ? 'text-white' : 'text-neutral-200')}>
            {group.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 text-[10px] rounded bg-white/5 text-neutral-400">{allowed.length}</span>
          <ChevronRight size={14} className={cx('text-neutral-500 transition-transform', expanded && 'rotate-90')} />
        </div>
      </button>

      <div className={cx('overflow-hidden transition-all', expanded ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0')}>
        <div className="pl-2 space-y-1">
          {allowed.map(item => {
            if (!item?.path) return null;
            const active = pathname === item.path;
            return (
              <NavItem
                key={item.path}
                item={item}
                active={active}
                onClick={() => onNavigate(item.path)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
});

/* ---------- SearchResults ---------- */
const SearchResults = React.memo(function SearchResults({ results, onSelect }) {
  if (!results?.length) {
    return (
      <div className="mt-2 rounded-md border border-white/10 bg-black/70 p-3">
        <div className="text-xs text-neutral-500">No matches found</div>
      </div>
    );
  }
  return (
    <div className="mt-2 rounded-md border border-white/10 bg-neutral-950 overflow-hidden">
      <ul className="divide-y divide-white/10">
        {results.map((r) => (
          <li key={r.path}>
            <button
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5"
              onClick={() => onSelect(r.path)}
            >
              <div className="w-7 h-7 rounded bg-white/5 border border-white/10 flex items-center justify-center">
                <r.icon size={14} className="text-neutral-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white truncate">{r.name}</div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">{r.groupTitle}</div>
              </div>
              <ChevronRight size={14} className="text-neutral-600" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
});

/* ---------- Sidebar ---------- */
const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userRole, isAdmin, logout } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 1024);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 120);
  const searchRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  /* layout offset (keeps content clear of the sidebar on desktop) */
  useEffect(() => {
    const updateOffset = () => {
      const isLg = window.innerWidth >= 1024;
      document.documentElement.style.setProperty('--sidebar-offset', isLg ? '16rem' : '0px'); // w-64
    };
    updateOffset();
    window.addEventListener('resize', updateOffset);
    return () => window.removeEventListener('resize', updateOffset);
  }, []);

  // live clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* config */
  const baseGroups = useMemo(() => ([
    {
      id: 'bookings',
      title: 'Bookings',
      icon: Calendar,
      items: [
        { name: 'All bookings', icon: Calendar, path: '/bookings', allowed: true, badge: { text: 'LIVE' } },
        { name: 'New booking', icon: PlusCircle, path: '/add-booking', allowed: true },
        { name: 'San Antonio tours', icon: Ship, path: '/san-antonio-tours', allowed: true },
        { name: 'Charter management', icon: Users2, path: '/charter-management', allowed: isAdmin() },
        { name: 'Contracts', icon: FileText, path: '/contract-generator', allowed: isAdmin() },
        { name: 'Client collection', icon: Users, path: '/client-data-collection', allowed: isAdmin() },
      ]
    },
    {
      id: 'financial',
      title: 'Finance',
      icon: Euro,
      items: [
        { name: 'Payments', icon: CreditCard, path: '/payment-tracking', allowed: true },
        { name: 'Invoices', icon: FileText, path: '/invoice-generator', allowed: true },
        { name: 'Expenses', icon: Euro, path: '/expenses', allowed: true },
        { name: 'Expense tracker', icon: LineChart, path: '/expense-tracker', allowed: true },
        { name: 'Analytics', icon: BarChart3, path: '/financial-dashboard', allowed: true },
      ]
    },
    {
      id: 'catering',
      title: 'Catering',
      icon: Utensils,
      items: [
        { name: 'Products', icon: Package, path: '/products', allowed: true },
        { name: 'Add product', icon: PlusCircle, path: '/add-product', allowed: true },
        { name: 'Orders', icon: ShoppingCart, path: '/catering-orders', allowed: true },
        { name: 'Provisioning', icon: DollarSign, path: '/catering-expenses', allowed: true },
        { name: 'Pricing', icon: Euro, path: '/pricing-manager', allowed: true },
      ]
    },
    {
      id: 'fleet',
      title: 'Fleet',
      icon: Ship,
      items: [
        { name: 'All boats', icon: Ship, path: '/boats', allowed: true },
        { name: 'Availability', icon: Clock, path: '/available-boats', allowed: true },
      ]
    },
    {
      id: 'customers',
      title: 'Customers',
      icon: Users,
      items: [
        { name: 'Client directory', icon: UserCheck, path: '/clients', allowed: true },
        { name: 'Partners', icon: Building, path: '/manage-partners', allowed: true },
        { name: 'Enquiries', icon: MessageSquare, path: '/inquiries', allowed: true },
      ]
    },
    {
      id: 'places',
      title: 'Places',
      icon: MapPin,
      items: [{ name: 'QR codes', icon: QrCode, path: '/places', allowed: true }]
    },
    {
      id: 'admin',
      title: 'Settings',
      icon: Settings,
      items: [
        { name: 'Users', icon: User, path: '/user-management', allowed: isAdmin() },
        { name: 'System', icon: Settings, path: '/settings', allowed: isAdmin() },
      ]
    }
  ]), [isAdmin]);

  // expand group for current route
  useEffect(() => {
    let next = null;
    for (const g of baseGroups) {
      if (g.items?.some(i => i.path === location.pathname)) { next = g.id; break; }
    }
    setExpandedGroup(next || 'bookings');
  }, [location.pathname, baseGroups]);

  // responsive open/close & ensure close on desktop
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      if (!mobile) setIsOpen(true);
    };
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // cmd/ctrl+k focus
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // flat items for search
  const flatItems = useMemo(() => {
    const r = [];
    baseGroups.forEach(g => g.items?.forEach(i => { if (i?.allowed) r.push({ ...i, groupTitle: g.title }); }));
    return r;
  }, [baseGroups]);

 

  // handlers
  const toggleSidebar = useCallback(() => setIsOpen(v => !v), []);
  const toggleGroup = useCallback((id) => setExpandedGroup(g => (g === id ? null : id)), []);
  const handleNavClick = useCallback((path) => { navigate(path); if (isMobile) setIsOpen(false); }, [navigate, isMobile]);
  const handleLogout = useCallback(async () => {
    try { await logout(); navigate('/login'); }
    catch (e) { console.error('Logout failed:', e); }
  }, [logout, navigate]);

  return (
    <>
      {/* overlay */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-[2px] z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* mobile toggle */}
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-40 p-2 rounded-md bg-neutral-900/90 border border-white/10 text-white lg:hidden"
        aria-label="Toggle menu"
      >
        {isOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* sidebar */}
      <aside
        className={cx(
          'fixed top-0 left-0 h-full w-64 z-40 transition-transform duration-300',
          'bg-neutral-950 border-r border-white/10',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0'
        )}
      >
        {/* persistent Close on mobile (top-right of panel) */}
        {isMobile && (
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
            className="absolute top-3 right-3 z-50 p-2 rounded-md hover:bg-white/5"
          >
            <X size={16} className="text-neutral-300" />
          </button>
        )}

        <div className="relative flex flex-col h-full">
          {/* header */}
          <div className="px-4 pt-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-white/[0.04] border border-white/10 flex items-center justify-center">
                <Ship size={18} className="text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-semibold text-white">Just Enjoy</h1>
                <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                  <MapPin size={10} />
                  <span>IBIZA</span>
                  <span>•</span>
                  <span className="font-mono">
                    {currentTime.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            {/* profile */}
            <div className="mt-3 rounded-md bg-white/[0.03] border border-white/10 p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-white/[0.06] flex items-center justify-center">
                  <User size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user?.email?.split('@')[0]}
                  </p>
                  <span className="mt-0.5 inline-block px-2 py-0.5 text-[10px] rounded bg-white/10 text-neutral-300">
                    {isAdmin() ? 'Admin' : userRole}
                  </span>
                </div>
              </div>
            </div>

            {/* quick actions */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => handleNavClick('/add-booking')}
                className="rounded-md bg-white/[0.03] border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-white/10"
              >
                Add booking
              </button>
              <button
                onClick={() => handleNavClick('/payment-tracking')}
                className="rounded-md bg-white/[0.03] border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:bg-white/10"
              >
                Payments
              </button>
            </div>

            {/* search */}
            <div className="mt-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-md bg-black/60 border border-white/10 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white/30"
                />
              </div>
              {debouncedSearch && (
                <SearchResults
                  results={flatItems.filter(i =>
                    i.name.toLowerCase().includes(debouncedSearch.trim().toLowerCase()) ||
                    i.groupTitle.toLowerCase().includes(debouncedSearch.trim().toLowerCase())
                  ).slice(0, 8)}
                  onSelect={(path) => { handleNavClick(path); setSearchTerm(''); }}
                />
              )}
            </div>
          </div>

          {/* nav */}
          <nav className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}>
            {baseGroups.map(g => (
              <NavGroup
                key={g.id}
                group={g}
                expanded={expandedGroup === g.id}
                onToggle={toggleGroup}
                pathname={location.pathname}
                onNavigate={handleNavClick}
              />
            ))}
          </nav>

          {/* footer */}
          <div className="p-4 border-t border-white/10">
            <button
              onClick={handleLogout}
              className="w-full rounded-md bg-red-600/15 border border-red-600/30 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-600/25"
            >
              Disconnect
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;




