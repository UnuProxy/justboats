const STAFF_ALLOWED_PATTERNS = [
  '/bookings',                // Bookings overview
  '/bookings/:id',            // Specific booking detail
  '/add-booking',             // Capture new booking
  '/san-antonio-tours',       // Daily tour operations
  '/boatox-payments',         // Real-time Boatox payment link monitor
  '/boats',                   // Fleet overview
  '/add-boat',                // Add new boat
  '/edit-boat/:id',           // Edit boat details
  '/available-boats',         // Availability lookup
  '/boat-brochure-builder',   // Fleet PDF brochure generator
  '/reminders',               // Task board
  '/collaborator-management', // Collaborator coordination
  '/catering-orders',         // Catering orders board
  '/catering-expenses',       // Provisioning costs
  '/products',                // Catering products catalog
  '/add-product',             // Add product workflow
  '/edit-product/:id',        // Edit product workflow
  '/pricing-manager',         // Catering pricing controls
  '/payment-links',           // Generate Stripe payment links
  '/invoice-generator'        // Invoice PDF generator
];

const EMPLOYEE_ALLOWED_PATTERNS = [
  '/payment-tracking',        // Payment visibility (no contact details)
  '/bookings',
  '/bookings/:id',
  '/boats',
  '/boat-brochure-builder',
  '/add-boat',
  '/edit-boat/:id'
];

const DRIVER_ALLOWED_PATTERNS = [
  '/bookings',
  '/bookings/:id',
  '/crew-app'
];

const BROCHURE_ALLOWED_PATTERNS = [
  '/boats',
  '/boat-brochure-builder'
];

const normalizeRole = (role = '') => String(role || '').trim().toLowerCase();

const normalizePath = (pathname = '/') => {
  if (!pathname) return '/';
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
};

const toRegex = (pattern) => {
  const normalized = normalizePath(pattern);
  const regexBody = normalized
    .replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
    .replace(/\\:[^/]+/g, '[^/]+');
  return new RegExp(`^${regexBody}$`);
};

const STAFF_ROUTE_REGEXPS = STAFF_ALLOWED_PATTERNS.map((pattern) => ({
  pattern,
  regex: toRegex(pattern)
}));

export const canStaffAccessPath = (pathname = '/') => {
  const normalized = normalizePath(pathname);
  return STAFF_ROUTE_REGEXPS.some(({ regex }) => regex.test(normalized));
};

const employeeRouteRegexps = EMPLOYEE_ALLOWED_PATTERNS.map((pattern) => ({
  pattern,
  regex: toRegex(pattern)
}));

const driverRouteRegexps = DRIVER_ALLOWED_PATTERNS.map((pattern) => ({
  pattern,
  regex: toRegex(pattern)
}));

const brochureRouteRegexps = BROCHURE_ALLOWED_PATTERNS.map((pattern) => ({
  pattern,
  regex: toRegex(pattern)
}));

export const canRoleAccessPath = (role = '', pathname = '/') => {
  const normalizedRole = normalizeRole(role);
  const normalized = normalizePath(pathname);

  switch (normalizedRole) {
    case 'admin':
      return true;
    case 'staff':
      return STAFF_ROUTE_REGEXPS.some(({ regex }) => regex.test(normalized));
    case 'employee':
      return employeeRouteRegexps.some(({ regex }) => regex.test(normalized));
    case 'driver':
      return driverRouteRegexps.some(({ regex }) => regex.test(normalized));
    case 'brochure':
      return brochureRouteRegexps.some(({ regex }) => regex.test(normalized));
    default:
      return false;
  }
};

export const getDefaultRouteForRole = (role = '') => {
  switch (normalizeRole(role)) {
    case 'admin':
      return '/user-management';
    case 'brochure':
      return '/boats';
    default:
      return '/bookings';
  }
};

export const staffAllowedPatterns = [...STAFF_ALLOWED_PATTERNS];
export const employeeAllowedPatterns = [...EMPLOYEE_ALLOWED_PATTERNS];
export const driverAllowedPatterns = [...DRIVER_ALLOWED_PATTERNS];
export const brochureAllowedPatterns = [...BROCHURE_ALLOWED_PATTERNS];
