import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Menu, X, Calendar, PlusCircle, Users, BarChart3,
  User, CreditCard, Euro, Ship, MessageSquare, Settings,
  ChevronRight, Utensils, Package, ShoppingCart, FileText, LineChart,
  QrCode, MapPin, DollarSign, Search, Clock, LogOut, TrendingUp,
  CheckSquare, ChevronsLeft, ChevronsRight, Database, LayoutDashboard,
  Smartphone, Activity
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canRoleAccessPath } from '../config/accessControl';
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
const NavItem = React.memo(function NavItem({ item, active, onClick, collapsed }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.name : undefined}
      className={cx(
        'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-[15px] font-medium transition-colors border',
        collapsed
          ? active
            ? 'bg-[var(--accent-light)] text-[var(--text-primary)] border-transparent'
            : 'text-[var(--text-secondary)] hover:bg-white/70 border-transparent'
          : active
            ? 'bg-white/90 text-[var(--text-primary)] border-[var(--border)] shadow-sm'
            : 'text-[var(--text-secondary)] hover:bg-white/70 border-transparent'
      )}
    >
      <span
        className={cx(
          'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
          active
            ? 'text-[var(--accent)] bg-[var(--accent-light)]'
            : 'text-[var(--text-tertiary)]'
        )}
      >
        <item.icon size={20} strokeWidth={2} />
      </span>
      {!collapsed && (
        <>
          <span className="flex-1 truncate text-left">{item.name}</span>
          {item.badge?.text && (
            <span className="rounded-full bg-system-gray-200 px-2 py-0.5 text-[10px] font-semibold text-system-gray-600">
              {item.badge.text}
            </span>
          )}
        </>
      )}
    </button>
  );
});

/* ---------- NavGroup ---------- */
const NavGroup = React.memo(function NavGroup({ group, expanded, onToggle, pathname, onNavigate, collapsed }) {
  const allowed = (group.items || []).filter(i => i && i.allowed);
  if (!allowed.length) return null;

  const hasActive = allowed.some(i => i && pathname === i.path);
  if (collapsed) {
    return (
      <div className="mb-3 flex flex-col gap-1">
        {allowed.map(item => {
          if (!item?.path) return null;
          const active = pathname === item.path;
          return (
            <NavItem
              key={item.path}
              item={item}
              active={active}
              onClick={() => onNavigate(item.path)}
              collapsed
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="mb-3">
      <button
        onClick={() => onToggle(group.id)}
        className={cx(
          'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors border',
          hasActive ? 'bg-white/90 text-[var(--text-primary)] border-[var(--border)] shadow-sm' : 'text-[var(--text-tertiary)] hover:bg-white/70 border-transparent'
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cx(
              'flex h-6 w-6 items-center justify-center rounded-lg transition-colors',
              hasActive ? 'text-[var(--accent)] bg-[var(--accent-light)]' : 'text-[var(--text-tertiary)]'
            )}
          >
            <group.icon size={16} />
          </span>
          <span>
            {group.title}
          </span>
        </div>
        <ChevronRight
          size={14}
          className={cx(
            'text-system-gray-400 transition-transform duration-200',
            expanded ? 'rotate-90 text-system-gray-600' : ''
          )}
        />
      </button>

      <div className={cx('overflow-hidden transition-all duration-200', expanded ? 'max-h-80 opacity-100 mt-2' : 'max-h-0 opacity-0')}>
        <div className="space-y-1 pl-2">
          {allowed.map(item => {
            if (!item?.path) return null;
            const active = pathname === item.path;
            return (
              <NavItem
                key={item.path}
                item={item}
                active={active}
                onClick={() => onNavigate(item.path)}
                collapsed={false}
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
      <div className="mt-2 rounded-lg border bg-white px-3 py-2 shadow-sm" style={{ borderColor: 'var(--border)' }}>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>No results</div>
      </div>
    );
  }
  return (
    <div className="mt-2 overflow-hidden rounded-xl border bg-white shadow-md" style={{ borderColor: 'var(--border)' }}>
      <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {results.map((r) => (
          <li key={r.path}>
            <button
              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--accent-light)]"
              onClick={() => onSelect(r.path)}
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[var(--text-tertiary)]">
                <r.icon size={18} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium text-[var(--text-primary)]">{r.name}</div>
                <div className="text-xs text-[var(--text-tertiary)]">{r.groupTitle}</div>
              </div>
              <ChevronRight size={16} className="text-[var(--text-tertiary)]" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
});

/* ---------- Sidebar ---------- */
const Sidebar = () => {
  const isBrowser = typeof window !== 'undefined';
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userRole, logout } = useAuth();
  const isAdminUser = userRole === 'admin';
  const isEmployeeUser = userRole === 'employee';

  const initialIsMobile = isBrowser ? window.innerWidth <= 1024 : false;
  const initialCollapsed = isBrowser ? window.innerWidth >= 1440 : false;
  const [isOpen, setIsOpen] = useState(!initialIsMobile);
  const [isMobile, setIsMobile] = useState(initialIsMobile);
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 120);
  const searchRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const updateSidebarOffset = useCallback((mobileState) => {
    if (!isBrowser) return;
    const mobile = mobileState ?? (window.innerWidth <= 1024);
    const offset = mobile ? '0px' : (isCollapsed ? '5.25rem' : '16rem');
    document.documentElement.style.setProperty('--sidebar-offset', offset);
  }, [isBrowser, isCollapsed]);

  /* layout offset + responsive */
  useEffect(() => {
    if (!isBrowser) return;

    const syncLayout = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      if (mobile) {
        setIsOpen(false);
        setIsCollapsed(false);
      } else {
        setIsOpen(true);
      }

      updateSidebarOffset(mobile);
    };

    syncLayout();
    window.addEventListener('resize', syncLayout);
    return () => window.removeEventListener('resize', syncLayout);
  }, [isBrowser, updateSidebarOffset]);

  // live clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    updateSidebarOffset(isMobile);
  }, [isCollapsed, isMobile, updateSidebarOffset]);

  /* config */
  const roleCanSee = useCallback((path, defaultValue = false) => {
    if (isAdminUser) return true;
    if (!path) return defaultValue;
    return canRoleAccessPath(userRole, path);
  }, [isAdminUser, userRole]);

  const baseGroups = useMemo(() => {
    const admin = isAdminUser;

    return [
      {
        id: 'bookings',
        title: 'Bookings',
        icon: Calendar,
        items: [
          { name: 'All bookings', icon: Calendar, path: '/bookings', allowed: roleCanSee('/bookings', true), badge: { text: 'LIVE' } },
          { name: 'New booking', icon: PlusCircle, path: '/add-booking', allowed: roleCanSee('/add-booking', true) },
          { name: 'San Antonio tours', icon: Ship, path: '/san-antonio-tours', allowed: roleCanSee('/san-antonio-tours', true) },
        ]
      },
      {
        id: 'ops-command',
        title: 'Ops Command',
        icon: Activity,
        items: [
          { name: 'Command center', icon: LayoutDashboard, path: '/ops-command', allowed: roleCanSee('/ops-command', true) },
          { name: 'Crew field app', icon: Smartphone, path: '/crew-app', allowed: roleCanSee('/crew-app', true) },
        ]
      },
      {
        id: 'financial',
        title: 'Finance',
      icon: Euro,
      items: [
        { name: 'Payments', icon: CreditCard, path: '/payment-tracking', allowed: admin || isEmployeeUser },
        { name: 'Invoices', icon: FileText, path: '/invoice-generator', allowed: admin },
        { name: 'Expenses', icon: Euro, path: '/expenses', allowed: admin },
        { name: 'Expense tracker', icon: LineChart, path: '/expense-tracker', allowed: admin },
        { name: 'Analytics', icon: BarChart3, path: '/financial-dashboard', allowed: admin },
      ]
    },
      {
        id: 'intelligence',
        title: 'Intelligence',
        icon: TrendingUp,
        items: [
          { name: 'Command signals', icon: TrendingUp, path: '/insights', allowed: admin },
          { name: 'Boat performance', icon: Ship, path: '/boat-performance', allowed: admin },
          { name: 'Partner performance', icon: Users, path: '/partner-performance', allowed: admin }
        ]
      },
      {
        id: 'catering-ops',
        title: 'Catering Ops',
        icon: Utensils,
        items: [
          { name: 'Products', icon: Package, path: '/products', allowed: roleCanSee('/products') },
          { name: 'Add product', icon: PlusCircle, path: '/add-product', allowed: roleCanSee('/add-product') },
          { name: 'Orders', icon: ShoppingCart, path: '/catering-orders', allowed: roleCanSee('/catering-orders') },
          { name: 'Provisioning', icon: DollarSign, path: '/catering-expenses', allowed: roleCanSee('/catering-expenses') },
          { name: 'Pricing', icon: Euro, path: '/pricing-manager', allowed: roleCanSee('/pricing-manager') },
        ]
      },
      {
        id: 'fleet',
      title: 'Fleet',
      icon: Ship,
      items: [
        { name: 'All boats', icon: Ship, path: '/boats', allowed: roleCanSee('/boats', true) },
        { name: 'Availability', icon: Clock, path: '/available-boats', allowed: roleCanSee('/available-boats', true) },
        { name: 'PDF brochure', icon: FileText, path: '/boat-brochure-builder', allowed: roleCanSee('/boat-brochure-builder', true) },
      ]
    },
      {
        id: 'customers',
        title: 'Customers',
        icon: Users,
        items: [
          { name: 'Directory', icon: Users, path: '/clients', allowed: admin },
          { name: 'Leads', icon: MessageSquare, path: '/inquiries', allowed: admin },
        ]
      },
      {
        id: 'workspace',
        title: 'Workspace',
        icon: CheckSquare,
        items: [
          { name: 'Reminders', icon: CheckSquare, path: '/reminders', allowed: roleCanSee('/reminders', true) },
          { name: 'Collaborators', icon: Users2, path: '/collaborator-management', allowed: roleCanSee('/collaborator-management') },
        ],
      },
      {
        id: 'locations',
        title: 'Locations',
        icon: MapPin,
        items: [{ name: 'QR codes', icon: QrCode, path: '/places', allowed: admin }]
      },
      {
        id: 'admin',
        title: 'Settings',
        icon: Settings,
        items: [
          { name: 'Users', icon: User, path: '/user-management', allowed: admin },
          { name: 'Data backup', icon: Database, path: '/data-backup', allowed: admin },
          { name: 'System', icon: Settings, path: '/settings', allowed: admin },
        ]
      }
    ];
  }, [roleCanSee, isAdminUser, isEmployeeUser]);

  // expand group for current route
  useEffect(() => {
    let next = null;
    for (const g of baseGroups) {
      if (g.items?.some(i => i.path === location.pathname)) { next = g.id; break; }
    }
    setExpandedGroup(next || 'bookings');
  }, [location.pathname, baseGroups]);

  // ensure sidebar open state reflects current breakpoint when auth changes
  useEffect(() => {
    if (!isBrowser) return;
    const mobile = window.innerWidth <= 1024;
    setIsMobile(mobile);
    setIsOpen(!mobile);
    if (mobile) {
      setIsCollapsed(false);
    }
  }, [isBrowser, userRole]);

  // cmd/ctrl+k focus
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isCollapsed) {
          setIsCollapsed(false);
          setTimeout(() => searchRef.current?.focus(), 0);
        } else {
          searchRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isCollapsed]);

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

  const sidebarWidth = isCollapsed ? 'w-20' : 'w-64';

  return (
    <>
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-40 inline-flex items-center justify-center rounded-lg border p-2.5 shadow-sm transition-colors lg:hidden"
        style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', backgroundColor: 'var(--surface)' }}
        aria-label="Toggle menu"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside
        className={cx(
          'fixed top-0 left-0 z-40 h-full border-r bg-[var(--sidebar-bg)] shadow-[0_20px_40px_-30px_rgba(31,33,37,0.55)] transition-transform duration-300',
          sidebarWidth,
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0'
        )}
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="relative flex h-full flex-col">
          <div className={cx('border-b px-4 pb-4 pt-5', isCollapsed ? 'items-center justify-center' : '')} style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-[var(--accent)]" style={{ borderColor: 'var(--border)' }}>
                  <Ship size={20} strokeWidth={2} />
                </div>
                {!isCollapsed && (
                  <div className="leading-tight">
                    <h1 className="text-base font-semibold text-[var(--text-primary)]">Nautiq</h1>
                    <p className="text-xs text-[var(--text-tertiary)]">Operations Command</p>
                  </div>
                )}
              </div>
              {!isMobile && (
                <button
                  onClick={() => setIsCollapsed((v) => !v)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  {isCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
                </button>
              )}
              {isMobile && (
                <button
                  onClick={() => setIsOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors lg:hidden"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {!isCollapsed && (
              <>
                <div className="mt-4 flex items-center justify-between rounded-xl border bg-white/95 px-3 py-2.5" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-light)] text-[var(--accent-hover)] text-sm font-semibold">
                      {(user?.email?.[0] || 'N').toUpperCase()}
                    </div>
                    <div>
                      <p className="truncate text-[15px] font-medium text-[var(--text-primary)]">
                        {user?.email?.split('@')[0] || 'Team member'}
                      </p>
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {isAdminUser ? 'Administrator' : (userRole || 'Staff')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="relative">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-system-gray-400" />
                    <input
                      ref={searchRef}
                      type="text"
                      placeholder="Quick search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="app-input pl-10 pr-3"
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
              </>
            )}
          </div>

          <nav className={cx('flex-1 overflow-y-auto py-5', isCollapsed ? 'px-2' : 'px-4')}>
            {baseGroups.map(g => (
              <NavGroup
                key={g.id}
                group={g}
                expanded={!isCollapsed && expandedGroup === g.id}
                onToggle={toggleGroup}
                pathname={location.pathname}
                onNavigate={handleNavClick}
                collapsed={isCollapsed}
              />
            ))}
          </nav>

          <div className="border-t px-4 py-4" style={{ borderColor: 'var(--border)' }}>
            {!isCollapsed && (
              <div className="mb-3 flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                <span>{currentTime.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-[var(--border)]">•</span>
                <span>Ibiza crew</span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className={cx(
                'items-center justify-center gap-2 rounded-lg border text-[15px] font-medium transition-colors bg-white hover:bg-system-gray-50',
                isCollapsed ? 'flex h-10 w-10 mx-auto' : 'flex w-full px-3 py-2.5'
              )}
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              <LogOut size={18} />
              {!isCollapsed && <span>Sign out</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
