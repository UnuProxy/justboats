const STAFF_ALLOWED_PATTERNS = [
  '/bookings',                // Bookings overview
  '/bookings/:id',            // Specific booking detail
  '/add-booking',             // Capture new booking
  '/san-antonio-tours',       // Daily tour operations
  '/boats',                   // Fleet overview
  '/add-boat',                // Add new boat
  '/edit-boat/:id',           // Edit boat details
  '/available-boats',         // Availability lookup
  '/reminders',               // Task board
  '/collaborator-management', // Collaborator coordination
  '/catering-orders',         // Catering orders board
  '/catering-expenses',       // Provisioning costs
  '/products',                // Catering products catalog
  '/add-product',             // Add product workflow
  '/edit-product/:id',        // Edit product workflow
  '/pricing-manager',         // Catering pricing controls
  '/ops-command',             // Staff ops command center
  '/crew-app'                 // Crew mobile field app
];

const EMPLOYEE_ALLOWED_PATTERNS = [
  '/payment-tracking',        // Payment visibility (no contact details)
  '/bookings',
  '/bookings/:id',
  '/boats',
  '/add-boat',
  '/edit-boat/:id'
];

const DRIVER_ALLOWED_PATTERNS = [
  '/bookings',
  '/bookings/:id',
  '/crew-app'
];

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

export const canRoleAccessPath = (role = '', pathname = '/') => {
  const normalized = normalizePath(pathname);

  switch (role) {
    case 'admin':
      return true;
    case 'staff':
      return STAFF_ROUTE_REGEXPS.some(({ regex }) => regex.test(normalized));
    case 'employee':
      return employeeRouteRegexps.some(({ regex }) => regex.test(normalized));
    case 'driver':
      return driverRouteRegexps.some(({ regex }) => regex.test(normalized));
    default:
      return false;
  }
};

export const staffAllowedPatterns = [...STAFF_ALLOWED_PATTERNS];
export const employeeAllowedPatterns = [...EMPLOYEE_ALLOWED_PATTERNS];
export const driverAllowedPatterns = [...DRIVER_ALLOWED_PATTERNS];
