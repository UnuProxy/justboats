import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import * as XLSX from 'xlsx';

/**
 * Data Export Utilities
 *
 * Provides one-click export of all data from Firebase
 * Supports JSON, CSV, and Excel formats
 */

/**
 * Fetch all documents from a collection
 * @param {string} collectionName - Name of the Firestore collection
 * @returns {Promise<Array>} Array of documents
 */
const fetchCollection = async (collectionName) => {
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore timestamps to ISO strings for export
      ...(doc.data().createdAt && {
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
      }),
      ...(doc.data().updatedAt && {
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      })
    }));
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    return [];
  }
};

/**
 * Export all data from Firebase
 * @returns {Promise<Object>} Object with all collections
 */
export const exportAllData = async () => {
  const collections = [
    'bookings',
    'clients',
    'boats',
    'expenses',
    'orders',
    'users',
    'hotels',
    'collaborators',
    'notifications',
    'reminders',
    'products',
    'scanLocations',
    'locationScanEvents'
  ];

  const data = {};
  const errors = [];

  for (const collectionName of collections) {
    try {
      data[collectionName] = await fetchCollection(collectionName);
    } catch (error) {
      errors.push({ collection: collectionName, error: error.message });
    }
  }

  return {
    exportDate: new Date().toISOString(),
    collections: data,
    errors: errors.length > 0 ? errors : undefined,
    metadata: {
      totalCollections: collections.length,
      exportedCollections: Object.keys(data).length,
      totalDocuments: Object.values(data).reduce((sum, arr) => sum + arr.length, 0)
    }
  };
};

/**
 * Download data as JSON file
 * @param {Object} data - Data to export
 * @param {string} filename - Filename (without extension)
 */
export const downloadJSON = (data, filename = 'nautiq-backup') => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Flatten nested objects for CSV/Excel export
 * @param {Object} obj - Object to flatten
 * @param {string} prefix - Prefix for nested keys
 * @returns {Object} Flattened object
 */
const flattenObject = (obj, prefix = '') => {
  const flattened = {};

  Object.keys(obj).forEach(key => {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value === null || value === undefined) {
      flattened[newKey] = '';
    } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(flattened, flattenObject(value, newKey));
    } else if (Array.isArray(value)) {
      flattened[newKey] = JSON.stringify(value);
    } else {
      flattened[newKey] = value;
    }
  });

  return flattened;
};

/**
 * Download data as Excel file
 * @param {Object} data - Data object with collections
 * @param {string} filename - Filename (without extension)
 */
export const downloadExcel = (data, filename = 'nautiq-backup') => {
  const workbook = XLSX.utils.book_new();

  Object.keys(data.collections).forEach(collectionName => {
    const collection = data.collections[collectionName];

    if (collection.length === 0) {
      // Create empty sheet
      const worksheet = XLSX.utils.aoa_to_sheet([['No data']]);
      XLSX.utils.book_append_sheet(workbook, worksheet, collectionName);
      return;
    }

    // Flatten objects for better Excel representation
    const flattenedData = collection.map(doc => flattenObject(doc));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(flattenedData);

    // Auto-size columns
    const maxWidth = 50;
    const colWidths = {};

    flattenedData.forEach(row => {
      Object.keys(row).forEach(key => {
        const value = String(row[key] || '');
        const width = Math.min(Math.max(key.length, value.length), maxWidth);
        colWidths[key] = Math.max(colWidths[key] || 0, width);
      });
    });

    worksheet['!cols'] = Object.values(colWidths).map(w => ({ wch: w }));

    // Add sheet to workbook (truncate sheet name if too long)
    const sheetName = collectionName.slice(0, 31); // Excel limit
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });

  // Add metadata sheet
  const metadata = [
    ['Export Information'],
    [''],
    ['Export Date', data.exportDate],
    ['Total Collections', data.metadata.totalCollections],
    ['Exported Collections', data.metadata.exportedCollections],
    ['Total Documents', data.metadata.totalDocuments],
    [''],
    ['Collections']
  ];

  Object.keys(data.collections).forEach(name => {
    metadata.push([name, data.collections[name].length]);
  });

  if (data.errors && data.errors.length > 0) {
    metadata.push([''], ['Errors']);
    data.errors.forEach(err => {
      metadata.push([err.collection, err.error]);
    });
  }

  const metadataSheet = XLSX.utils.aoa_to_sheet(metadata);
  XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');

  // Write file
  XLSX.writeFile(workbook, `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`);
};

/**
 * Download individual collection as CSV
 * @param {Array} data - Array of documents
 * @param {string} collectionName - Name of collection
 */
export const downloadCollectionCSV = (data, collectionName) => {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  const flattenedData = data.map(doc => flattenObject(doc));
  const worksheet = XLSX.utils.json_to_sheet(flattenedData);
  const csv = XLSX.utils.sheet_to_csv(worksheet);

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${collectionName}-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export bookings with profit calculations
 * @param {Array} bookings - Array of bookings
 * @param {Array} expenses - Array of expenses
 * @returns {Array} Bookings with profit data
 */
export const exportBookingsWithProfit = async (bookings, expenses) => {
  const { calculateBookingProfit, findMatchingExpense } = await import('./profitCalculations');

  return bookings.map(booking => {
    const expense = findMatchingExpense(booking, expenses);
    const profit = calculateBookingProfit(booking, expense);

    return {
      // Booking info
      id: booking.id,
      clientName: booking.clientDetails?.name,
      clientEmail: booking.clientDetails?.email,
      clientPhone: booking.clientDetails?.phone,
      boatName: booking.bookingDetails?.boatName,
      boatCompany: booking.bookingDetails?.boatCompany,
      date: booking.bookingDetails?.date,
      startTime: booking.bookingDetails?.startTime,
      endTime: booking.bookingDetails?.endTime,
      passengers: booking.bookingDetails?.passengers,

      // Pricing
      basePrice: booking.pricing?.basePrice,
      agreedPrice: booking.pricing?.agreedPrice,
      discount: booking.pricing?.discount,
      finalPrice: booking.pricing?.finalPrice,
      paymentStatus: booking.pricing?.paymentStatus,
      totalPaid: booking.pricing?.totalPaid,

      // Profit
      revenue: profit.revenue,
      totalExpenses: profit.expenses,
      ownerPayments: profit.ownerPayments,
      operationalExpenses: profit.operationalExpenses,
      grossProfit: profit.grossProfit,
      netProfit: profit.netProfit,
      profitMargin: profit.profitMargin,
      hasExpenseData: profit.hasExpenseData,

      // Expense breakdown (if available)
      ...(profit.hasExpenseData && profit.breakdown),

      // Other
      clientType: booking.clientType,
      status: booking.status,
      createdAt: booking.createdAt?.toDate?.()?.toISOString() || booking.createdAt
    };
  });
};

/**
 * Calculate file size estimate
 * @param {Object} data - Data to estimate
 * @returns {string} Formatted size
 */
export const estimateFileSize = (data) => {
  const json = JSON.stringify(data);
  const bytes = new Blob([json]).size;

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

/**
 * Validate export data before download
 * @param {Object} data - Data to validate
 * @returns {Object} Validation result
 */
export const validateExportData = (data) => {
  const warnings = [];

  if (!data.collections) {
    return { valid: false, error: 'No collections found in export data' };
  }

  // Check for empty collections
  Object.keys(data.collections).forEach(name => {
    if (data.collections[name].length === 0) {
      warnings.push(`Collection '${name}' is empty`);
    }
  });

  // Check for errors
  if (data.errors && data.errors.length > 0) {
    warnings.push(`${data.errors.length} collections failed to export`);
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
    size: estimateFileSize(data)
  };
};
