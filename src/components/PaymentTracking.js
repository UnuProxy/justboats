import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { storage } from '../firebase/firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../firebase/firebaseConfig';
import { format, addDays, isPast, differenceInDays, isBefore } from 'date-fns';
import SignaturePad from './SignaturePad';
import { 
    Edit, 
    X, 
    FileText, 
    Save, 
    Search, 
    Filter, 
    Calendar, 
    ChevronLeft, 
    ChevronRight,
    AlertTriangle,
    Clock,
    CheckCircle,
    Info,
    Euro,
    Layers,
    ArrowUp,
    ArrowDown,
    Printer,
    ChevronDown,
    ChevronUp,
    Lock
} from 'lucide-react';
import * as XLSX from 'xlsx';

// Helper functions for formatting
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2
    }).format(amount);
};

const formatDate = (date) => {
    if (!date) return '';
    return format(new Date(date), 'dd/MM/yyyy');
};

// Calculate completion percentage
/* eslint-disable no-unused-vars */
const calculateCompletionPercentage = (booking) => {
    if (!booking) return 0;
    
    let totalRequiredPayments = 2; // First and second payments
    let completedPayments = 0;
    
    // Check if transfer payment is required
    if (booking.hasTransfer) {
        totalRequiredPayments++;
    }
    
    // Count completed payments
    if (booking.ownerPayments?.firstPayment?.signature) completedPayments++;
    if (booking.ownerPayments?.secondPayment?.signature) completedPayments++;
    if (booking.hasTransfer && booking.ownerPayments?.transferPayment?.signature) completedPayments++;
    
    return Math.round((completedPayments / totalRequiredPayments) * 100);
};
/* eslint-enable no-unused-vars */

const decodeHtmlEntities = (text) => {
    if (!text) return '';
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
};
// Custom Components
const CustomTooltip = ({ children, content }) => (
    <div className="relative group">
        {children}
        <div className="invisible group-hover:visible absolute z-50 px-2 py-1 text-sm text-white bg-gray-900 rounded-lg 
            bottom-full left-1/2 transform -translate-x-1/2 mb-2 whitespace-nowrap">
            {content}
        </div>
    </div>
);

const CustomAlert = ({ children, type = 'success', onClose }) => (
    <div className={`p-4 rounded-lg mb-4 ${
        type === 'error' 
            ? 'bg-red-50 border border-red-200 text-red-700' 
            : type === 'warning' 
            ? 'bg-yellow-50 border border-yellow-200 text-yellow-700'
            : 'bg-green-50 border border-green-200 text-green-700'
    }`}>
        <div className="flex justify-between">
            <div className="flex items-start">
                <div className="ml-3">
                    <p className={`text-sm ${
                        type === 'error' 
                            ? 'text-red-800' 
                            : type === 'warning'
                            ? 'text-yellow-800'
                            : 'text-green-800'
                    }`}>
                        {children}
                    </p>
                </div>
            </div>
            {onClose && (
                <button 
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    </div>
);

// New Component: Enhanced Payment Cell
const OwnerPaymentCell = ({ payment, onEditClick, onSignatureClick, onViewSignature }) => {
    const isCompleted = payment?.signature;
    
    return (
      <div className={`p-2 rounded ${isCompleted ? 'bg-green-100 border border-green-300' : 'bg-white border border-gray-200'}`}>
        <div className="flex justify-between items-center mb-1">
          <span className="font-medium text-sm">{formatCurrency(payment?.amount || 0)}</span>
          {isCompleted && <CheckCircle className="w-4 h-4 text-green-600" />}
        </div>
        
        <div className="flex flex-wrap gap-1 mt-2">
          {isCompleted ? (
            // Signed payment - show view option only
            <button
              onClick={() => onViewSignature(payment)}
              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
            >
              <Info className="w-3 h-3 mr-1" />
              View
            </button>
          ) : (
            // Unsigned payment - show edit and sign options
            <>
              <button
                onClick={onEditClick}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
              >
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </button>
              <button
                onClick={onSignatureClick}
                className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center"
              >
                <Save className="w-3 h-3 mr-1" />
                Sign
              </button>
            </>
          )}
        </div>
        
        {payment?.date && (
          <div className="text-xs text-gray-500 mt-1">
            Updated: {formatDate(payment.date)}
          </div>
        )}
      </div>
    );
};

// New Component: Enhanced Expanded Row for Payment Details
const ExpandedPaymentRow = ({ booking, onClose, onSignatureClick, onEditPayment, onViewSignature }) => {
    if (!booking) return null;
    
    const { ownerPayments, hasTransfer } = booking;
    const firstPayment = ownerPayments?.firstPayment || {};
    const secondPayment = ownerPayments?.secondPayment || {};
    const transferPayment = ownerPayments?.transferPayment || {};
    
    return (
      <tr className="bg-gray-50 border-b">
        <td colSpan="8" className="p-4">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-lg">Owner Payment Details</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* First Payment */}
            <div className={`rounded-lg border ${firstPayment.signature ? 'border-green-300' : 'border-gray-300'}`}>
              <div className={`p-3 ${firstPayment.signature ? 'bg-green-50 text-green-800' : 'bg-white'} border-b font-medium flex justify-between items-center`}>
                First Payment
                {firstPayment.signature && <CheckCircle className="w-4 h-4 text-green-600" />}
              </div>
              <div className="p-3">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Amount:</span>
                  <span className="font-medium">{formatCurrency(firstPayment.amount || 0)}</span>
                </div>
                {firstPayment.date && (
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">Date:</span>
                    <span>{formatDate(firstPayment.date)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className={firstPayment.signature ? 'text-green-600 font-medium' : 'text-blue-600'}>
                    {firstPayment.signature ? 'Signed' : 'Pending'}
                  </span>
                </div>
              </div>
              <div className={`p-3 border-t ${firstPayment.signature ? 'bg-green-50' : 'bg-gray-50'} flex justify-end gap-2`}>
                {firstPayment.signature ? (
                  <button
                    onClick={() => onViewSignature(firstPayment)}
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
                  >
                    <Info className="w-3 h-3 mr-1" />
                    View
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => onEditPayment(booking.id, 'first')}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => onSignatureClick(booking.id, 'first')}
                      className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center"
                    >
                      <Save className="w-3 h-3 mr-1" />
                      Sign
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {/* Second Payment */}
            <div className={`rounded-lg border ${secondPayment.signature ? 'border-green-300' : 'border-gray-300'}`}>
              <div className={`p-3 ${secondPayment.signature ? 'bg-green-50 text-green-800' : 'bg-white'} border-b font-medium flex justify-between items-center`}>
                Second Payment
                {secondPayment.signature && <CheckCircle className="w-4 h-4 text-green-600" />}
              </div>
              <div className="p-3">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Amount:</span>
                  <span className="font-medium">{formatCurrency(secondPayment.amount || 0)}</span>
                </div>
                {secondPayment.date && (
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">Date:</span>
                    <span>{formatDate(secondPayment.date)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className={secondPayment.signature ? 'text-green-600 font-medium' : 'text-blue-600'}>
                    {secondPayment.signature ? 'Signed' : 'Pending'}
                  </span>
                </div>
              </div>
              <div className={`p-3 border-t ${secondPayment.signature ? 'bg-green-50' : 'bg-gray-50'} flex justify-end gap-2`}>
                {secondPayment.signature ? (
                  <button
                    onClick={() => onViewSignature(secondPayment)}
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
                  >
                    <Info className="w-3 h-3 mr-1" />
                    View
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => onEditPayment(booking.id, 'second')}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => onSignatureClick(booking.id, 'second')}
                      className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center"
                    >
                      <Save className="w-3 h-3 mr-1" />
                      Sign
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {/* Transfer Payment - Only show if applicable */}
            {hasTransfer && (
              <div className={`rounded-lg border ${transferPayment.signature ? 'border-green-300' : 'border-gray-300'}`}>
                <div className={`p-3 ${transferPayment.signature ? 'bg-green-50 text-green-800' : 'bg-white'} border-b font-medium flex justify-between items-center`}>
                  Transfer Payment
                  {transferPayment.signature && <CheckCircle className="w-4 h-4 text-green-600" />}
                </div>
                <div className="p-3">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">Amount:</span>
                    <span className="font-medium">{formatCurrency(transferPayment.amount || 0)}</span>
                  </div>
                  {transferPayment.date && (
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-600">Date:</span>
                      <span>{formatDate(transferPayment.date)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Status:</span>
                    <span className={transferPayment.signature ? 'text-green-600 font-medium' : 'text-blue-600'}>
                      {transferPayment.signature ? 'Signed' : 'Pending'}
                    </span>
                  </div>
                </div>
                <div className={`p-3 border-t ${transferPayment.signature ? 'bg-green-50' : 'bg-gray-50'} flex justify-end gap-2`}>
                  {transferPayment.signature ? (
                    <button
                      onClick={() => onViewSignature(transferPayment)}
                      className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
                    >
                      <Info className="w-3 h-3 mr-1" />
                      View
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => onEditPayment(booking.id, 'transfer')}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </button>
                      <button
                        onClick={() => onSignatureClick(booking.id, 'transfer')}
                        className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center"
                      >
                        <Save className="w-3 h-3 mr-1" />
                        Sign
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </td>
      </tr>
    );
};

// Enhanced Signature Modal
const EnhancedSignatureModal = ({ isOpen, onClose, onSave, paymentInfo }) => {
    const [signatureData, setSignatureData] = useState(null);
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    
    const handleSave = async () => {
      if (!signatureData || !name) {
        alert('Please provide both signature and name');
        return;
      }
      
      setSaving(true);
      try {
        await onSave(signatureData, name, paymentInfo);
        // Show success animation before closing
        setTimeout(() => {
          onClose();
        }, 1000);
      } catch (error) {
        console.error('Error saving signature:', error);
      } finally {
        setSaving(false);
      }
    };
    
    if (!isOpen) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              Sign Off Payment
            </h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
              disabled={saving}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <AlertTriangle className="inline-block w-4 h-4 mr-1" />
            <strong>Important:</strong> Signing a payment will lock it permanently. This action cannot be undone.
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name
            </label>
            <input
              type="text"
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              disabled={saving}
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Signature
            </label>
            <div className="border border-gray-300 rounded p-2 h-32 bg-gray-50 flex items-center justify-center">
              {signatureData ? (
                <div className="relative w-full h-full">
                  <img 
                    src={signatureData} 
                    alt="Signature" 
                    className="object-contain w-full h-full"
                  />
                  <button
                    onClick={() => setSignatureData(null)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                    disabled={saving}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <SignaturePad 
                onSave={(data) => setSignatureData(data)}
                onClear={() => setSignatureData(null)}
              />
              )}
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
              disabled={!signatureData || !name || saving}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Finalize Payment
                </>
              )}
            </button>
          </div>
          
          {/* Success animation overlay when saving is successful */}
          {saving && (
            <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center">
              <div className="bg-green-100 p-4 rounded-lg flex items-center">
                <CheckCircle className="w-8 h-8 text-green-600 mr-3" />
                <span className="text-green-800 font-medium">Payment signed successfully!</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
};

const PaymentSummaryCard = ({ title, value, icon: Icon, color, trend, percent }) => (
    <div className={`rounded-lg p-4 border-l-4 ${color}`}>
        <div className="flex justify-between items-start">
            <div>
                <div className="text-sm text-gray-600">{title}</div>
                <div className="text-2xl font-bold mt-1">{value}</div>
                {trend && (
                    <div className={`flex items-center mt-1 text-xs ${
                        trend === 'up' ? 'text-green-600' : 'text-red-600'
                    }`}>
                        {trend === 'up' ? <ArrowUp className="w-3 h-3 mr-1" /> : <ArrowDown className="w-3 h-3 mr-1" />}
                        {percent}%
                    </div>
                )}
            </div>
            <div className={`p-2 rounded-full ${color.replace('border-', 'bg-').replace('-600', '-100')}`}>
                <Icon className={`w-5 h-5 ${color.replace('border-', 'text-')}`} />
            </div>
        </div>
    </div>
);

const TabButton = ({ active, onClick, children, icon: Icon }) => (
    <button
        onClick={onClick}
        className={`flex items-center px-4 py-2 rounded-lg ${
            active 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-600 hover:bg-gray-100'
        }`}
    >
        <Icon className="w-4 h-4 mr-2" />
        {children}
    </button>
);

const priorityLevels = {
    CRITICAL: { label: 'Critical', class: 'bg-red-100 text-red-800 border-red-300' },
    HIGH: { label: 'High', class: 'bg-orange-100 text-orange-800 border-orange-300' },
    MEDIUM: { label: 'Medium', class: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    LOW: { label: 'Low', class: 'bg-blue-100 text-blue-800 border-blue-300' },
    COMPLETE: { label: 'Complete', class: 'bg-green-100 text-green-800 border-green-300' }
};

const PaymentTracking = () => {
    // Main State
    const [bookings, setBookings] = useState([]);
    const [filteredBookings, setFilteredBookings] = useState([]);
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(null);
    const [editingPayment, setEditingPayment] = useState(null);
    const [editingAmount, setEditingAmount] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [activeTab, setActiveTab] = useState('all');
    const [notification, setNotification] = useState(null);
    const [showFiltersPanel, setShowFiltersPanel] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'embarkedDate', direction: 'asc' });
    const [savedFilters, setSavedFilters] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [showHelp, setShowHelp] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [showFilters, setShowFilters] = useState(true);
    const [taskInProgress, setTaskInProgress] = useState(false);
    const [expandedRows, setExpandedRows] = useState([]);
    const [filters, setFilters] = useState({
        search: '',
        dateFrom: '',
        dateTo: '',
        paymentStatus: 'all',
        boatCompany: 'all',
        transferOnly: false,
        completionStatus: 'all',
        includeSanAntonioTours: false,
        paymentDueWithin: 'all', // 'all', '7', '14', '30'
        paymentPriority: 'all', // 'all', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'
    });

    // Helper function to toggle row expansion
    const toggleRowExpansion = (bookingId) => {
        setExpandedRows(prev => 
            prev.includes(bookingId) 
            ? prev.filter(id => id !== bookingId) 
            : [...prev, bookingId]
        );
    };

    // Fetch Data
    useEffect(() => {
        const bookingsRef = collection(db, "bookings");
        const q = query(bookingsRef, orderBy("bookingDate", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const bookingsData = snapshot.docs.map(doc => {
                const data = doc.data();
                
                // Handle San Antonio tours detection
                const isSanAntonioTour = 
                    data.bookingType === 'sanAntonioTour' || 
                    data.tourType === 'sanAntonio' ||
                    (data.bookingDetails?.location && 
                     data.bookingDetails?.location.toLowerCase().includes('san antonio')) ||
                    (data.bookingDetails?.tourType && 
                     data.bookingDetails?.tourType.toLowerCase().includes('san antonio')) ||
                    (data.bookingDetails?.boatName && 
                     data.bookingDetails?.boatName.toLowerCase().includes('san antonio'));
                
                const payments = data.pricing?.payments || [];
                const firstPayment = payments.find(p => p.type === 'first') || {};
                const secondPayment = payments.find(p => p.type === 'second') || {};
                
                const ownerPayments = data.ownerPayments || {};
                const ownerFirstPayment = ownerPayments.firstPayment || {};
                const ownerSecondPayment = ownerPayments.secondPayment || {};
                const transferPayment = ownerPayments.transferPayment || {};

                const passengerCount = data.numberOfPassengers || 
                    parseInt(data.bookingDetails?.passengers) || 0;

                const hasTransfer = (data.privateTransfer === true || 
                    (data.transfer?.pickup?.location && data.transfer?.dropoff?.location) ||
                    data.bookingDetails?.transfer === true ||
                    data.transfer?.required === true) &&
                    passengerCount > 4;

                const transferDetails = {
                    pickup: data.transfer?.pickup || {},
                    dropoff: data.transfer?.dropoff || {},
                    privateTransfer: data.privateTransfer || false
                };

                // Calculate payment due date (7 days before embarkation)
                const embarkedDate = data.bookingDetails?.date ? new Date(data.bookingDetails.date) : null;
                const paymentDueDate = embarkedDate ? addDays(embarkedDate, -7) : null;
                
                // Calculate priority based on payment status and due date
                let priority = 'LOW';
                
                if (embarkedDate) {
                    const today = new Date();
                    const hasClientFullPayment = firstPayment.received && secondPayment.received;
                    const hasOwnerFullPayment = 
                        ownerFirstPayment.signature && 
                        ownerSecondPayment.signature && 
                        (!hasTransfer || transferPayment.signature);
                    
                    if (hasClientFullPayment && hasOwnerFullPayment) {
                        priority = 'COMPLETE';
                    } else if (hasClientFullPayment && !hasOwnerFullPayment) {
                        if (isBefore(embarkedDate, today)) {
                            priority = 'CRITICAL'; // Trip already happened, owner not paid
                        } else if (paymentDueDate && isBefore(paymentDueDate, today)) {
                            priority = 'HIGH'; // Payment due date passed
                        } else if (paymentDueDate && differenceInDays(paymentDueDate, today) <= 7) {
                            priority = 'MEDIUM'; // Payment due within 7 days
                        }
                    }
                }

                return {
                    id: doc.id,
                    boatName: data.bookingDetails?.boatName || '',
                    boatCompany: data.bookingDetails?.boatCompany || '',
                    clientName: data.clientName || '',
                    bookingDate: data.bookingDate || null,
                    embarkedDate: data.bookingDetails?.date || null,
                    paymentDueDate,
                    priority,
                    hasTransfer,
                    transferDetails,
                    totalAmount: data.pricing?.agreedPrice || 0,
                    isSanAntonioTour,
                    firstPayment: {
                        amount: firstPayment.amount || 0,
                        method: firstPayment.method || '',
                        date: firstPayment.date || null,
                        received: firstPayment.received || false
                    },
                    secondPayment: {
                        amount: secondPayment.amount || 0,
                        method: secondPayment.method || '',
                        date: secondPayment.date || null,
                        received: secondPayment.received || false
                    },
                    ownerPayments: {
                        firstPayment: {
                            amount: ownerFirstPayment.amount || 0,
                            date: ownerFirstPayment.date || null,
                            paid: ownerFirstPayment.paid || false,
                            invoice: ownerFirstPayment.invoice || '',
                            signature: ownerFirstPayment.signature || '',
                            paidBy: ownerFirstPayment.paidBy || ''
                        },
                        secondPayment: {
                            amount: ownerSecondPayment.amount || 0,
                            date: ownerSecondPayment.date || null,
                            paid: ownerSecondPayment.paid || false,
                            invoice: ownerSecondPayment.invoice || '',
                            signature: ownerSecondPayment.signature || '',
                            paidBy: ownerSecondPayment.paidBy || ''
                        },
                        transferPayment: {
                            amount: transferPayment.amount || 0,
                            date: transferPayment.date || null,
                            paid: transferPayment.paid || false,
                            invoice: transferPayment.invoice || '',
                            signature: transferPayment.signature || '',
                            paidBy: transferPayment.paidBy || ''
                        }
                    },
                    status: data.pricing?.paymentStatus || 'Pending'
                };
            });
            
            setBookings(bookingsData);
            generateAlerts(bookingsData);
        });

        return () => unsubscribe();
    }, []);

    // Apply filters and sorting
    useEffect(() => {
        let filtered = [...bookings];

        // Filter out San Antonio tours if needed
        if (!filters.includeSanAntonioTours) {
            filtered = filtered.filter(booking => !booking.isSanAntonioTour);
        }

        // Apply active tab filtering
        if (activeTab === 'urgent') {
            filtered = filtered.filter(booking => 
                booking.priority === 'CRITICAL' || booking.priority === 'HIGH'
            );
        } else if (activeTab === 'upcoming') {
            filtered = filtered.filter(booking => 
                booking.embarkedDate && new Date(booking.embarkedDate) >= new Date() &&
                (booking.priority !== 'COMPLETE')
            );
        } else if (activeTab === 'completed') {
            filtered = filtered.filter(booking => booking.priority === 'COMPLETE');
        } else if (activeTab === 'overdue') {
            const today = new Date();
            filtered = filtered.filter(booking => 
                booking.embarkedDate && 
                new Date(booking.embarkedDate) < today && 
                booking.priority !== 'COMPLETE'
            );
        }

        // Apply text search
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            filtered = filtered.filter(booking => 
                (booking.boatName && booking.boatName.toLowerCase().includes(searchTerm)) ||
                (booking.boatCompany && booking.boatCompany.toLowerCase().includes(searchTerm)) ||
                (booking.clientName && booking.clientName.toLowerCase().includes(searchTerm))
            );
        }

        // Apply date filters
        if (filters.dateFrom) {
            filtered = filtered.filter(booking => 
                booking.embarkedDate && new Date(booking.embarkedDate) >= new Date(filters.dateFrom)
            );
        }

        if (filters.dateTo) {
            filtered = filtered.filter(booking => 
                booking.embarkedDate && new Date(booking.embarkedDate) <= new Date(filters.dateTo)
            );
        }

        // Apply payment status filter
        if (filters.paymentStatus !== 'all') {
            filtered = filtered.filter(booking => {
                if (filters.paymentStatus === 'pending') {
                    return !booking.firstPayment.received || !booking.secondPayment.received;
                }
                return booking.firstPayment.received && booking.secondPayment.received;
            });
        }

        // Apply company filter
        if (filters.boatCompany !== 'all') {
            filtered = filtered.filter(booking => 
                booking.boatCompany === filters.boatCompany
            );
        }

        // Apply transfer filter
        if (filters.transferOnly) {
            filtered = filtered.filter(booking => booking.hasTransfer);
        }
        
        // Apply completion status filter
        if (filters.completionStatus !== 'all') {
            filtered = filtered.filter(booking => {
                const complete = isBookingComplete(booking);
                return filters.completionStatus === 'complete' ? complete : !complete;
            });
        }

        // Apply payment due within filter
        if (filters.paymentDueWithin !== 'all') {
            const today = new Date();
            const daysAhead = parseInt(filters.paymentDueWithin);
            filtered = filtered.filter(booking => {
                if (!booking.paymentDueDate) return false;
                
                const daysDiff = differenceInDays(new Date(booking.paymentDueDate), today);
                return daysDiff >= 0 && daysDiff <= daysAhead;
            });
        }

        // Apply priority filter
        if (filters.paymentPriority !== 'all') {
            filtered = filtered.filter(booking => booking.priority === filters.paymentPriority);
        }

        // Apply sorting
        if (sortConfig.key) {
            filtered.sort((a, b) => {
                // Handle date comparison
                if (['embarkedDate', 'bookingDate', 'paymentDueDate'].includes(sortConfig.key)) {
                    const dateA = a[sortConfig.key] ? new Date(a[sortConfig.key]) : new Date(0);
                    const dateB = b[sortConfig.key] ? new Date(b[sortConfig.key]) : new Date(0);
                    
                    if (sortConfig.direction === 'asc') {
                        return dateA - dateB;
                    } else {
                        return dateB - dateA;
                    }
                }
                
                // Handle string comparison
                if (['boatName', 'boatCompany', 'clientName', 'priority'].includes(sortConfig.key)) {
                    const valueA = a[sortConfig.key] || '';
                    const valueB = b[sortConfig.key] || '';
                    
                    if (sortConfig.direction === 'asc') {
                        return valueA.localeCompare(valueB);
                    } else {
                        return valueB.localeCompare(valueA);
                    }
                }
                
                // Handle number comparison
                if (sortConfig.key === 'totalAmount') {
                    const numA = parseFloat(a[sortConfig.key]) || 0;
                    const numB = parseFloat(b[sortConfig.key]) || 0;
                    
                    if (sortConfig.direction === 'asc') {
                        return numA - numB;
                    } else {
                        return numB - numA;
                    }
                }
                
                return 0;
            });
        }

        setFilteredBookings(filtered);
        setCurrentPage(1);
    }, [filters, bookings, activeTab, sortConfig]);

    // Generate alerts for important payment actions
    const generateAlerts = (data) => {
        const newAlerts = [];
        const today = new Date();
        
        // Check for urgent payments
        data.forEach(booking => {
            if (booking.priority === 'CRITICAL') {
                newAlerts.push({
                    id: `critical-${booking.id}`,
                    type: 'error',
                    message: `Critical: Owner payment overdue for ${booking.boatName} (${format(new Date(booking.embarkedDate), 'dd/MM/yyyy')})`,
                    booking: booking.id
                });
            } else if (booking.priority === 'HIGH') {
                newAlerts.push({
                    id: `high-${booking.id}`,
                    type: 'warning',
                    message: `High Priority: Owner payment due for ${booking.boatName} (Trip date: ${format(new Date(booking.embarkedDate), 'dd/MM/yyyy')})`,
                    booking: booking.id
                });
            }
            
            // Check for upcoming trips without full client payment
            if (booking.embarkedDate && 
                differenceInDays(new Date(booking.embarkedDate), today) <= 7 && 
                differenceInDays(new Date(booking.embarkedDate), today) > 0 &&
                (!booking.firstPayment.received || !booking.secondPayment.received)) {
                newAlerts.push({
                    id: `client-payment-${booking.id}`,
                    type: 'warning',
                    message: `Client hasn&apos;t completed payment for ${booking.boatName} (Trip in ${differenceInDays(new Date(booking.embarkedDate), today)} days)`,
                    booking: booking.id
                });
            }
        });
        
        setAlerts(newAlerts);
    };

    // Resize handler for mobile detection
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.metaKey || e.ctrlKey) {
                switch (e.key.toLowerCase()) {
                    case 'f':
                        e.preventDefault();
                        document.querySelector('input[type="text"]')?.focus();
                        break;
                    case 'e':
                        e.preventDefault();
                        handleExport();
                        break;
                    case 's':
                        e.preventDefault();
                        handleSaveFilter();
                        break;
                    default:
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, []);

    // Helper for date preset selection
    const handleDatePresetChange = (preset) => {
        const today = new Date();
        let dateFrom = new Date();
        let dateTo = new Date();

        switch (preset) {
            case 'today':
                break;
            case 'yesterday':
                dateFrom.setDate(dateFrom.getDate() - 1);
                dateTo = new Date(dateFrom);
                break;
            case 'last7days':
                dateFrom.setDate(dateFrom.getDate() - 7);
                break;
            case 'last30days':
                dateFrom.setDate(dateFrom.getDate() - 30);
                break;
            case 'thisMonth':
                dateFrom = new Date(today.getFullYear(), today.getMonth(), 1);
                dateTo = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
            case 'lastMonth':
                dateFrom = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                dateTo = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
            case 'next7days':
                dateFrom = today;
                dateTo = addDays(today, 7);
                break;
            case 'next30days':
                dateFrom = today;
                dateTo = addDays(today, 30);
                break;
            default:
                return;
        }

        setFilters(prev => ({
            ...prev,
            dateFrom: dateFrom.toISOString().split('T')[0],
            dateTo: dateTo.toISOString().split('T')[0]
        }));
    };

    // Check if a booking has all payments completed
    const isBookingComplete = (booking) => {
        const clientPaymentsComplete = 
            booking.firstPayment?.received && 
            booking.secondPayment?.received;
    
        const ownerFirstPaymentComplete = 
            booking.ownerPayments?.firstPayment?.signature && 
            booking.ownerPayments?.firstPayment?.amount > 0;
    
        const ownerSecondPaymentComplete = 
            booking.ownerPayments?.secondPayment?.signature && 
            booking.ownerPayments?.secondPayment?.amount > 0;
    
        // For transfer, only check if booking has transfer
        const transferComplete = !booking.hasTransfer || 
            (booking.hasTransfer && 
             booking.ownerPayments?.transferPayment?.signature && 
             booking.ownerPayments?.transferPayment?.amount > 0);
    
        return clientPaymentsComplete && 
               ownerFirstPaymentComplete && 
               ownerSecondPaymentComplete && 
               transferComplete;
    };

    // File upload handler - kept for future file upload functionality
    /* eslint-disable no-unused-vars */
    const handleFileUpload = async (bookingId, paymentType, file) => {
        setTaskInProgress(true);
        try {
            const storageRef = ref(storage, `invoices/${bookingId}/${paymentType}_${file.name}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            const bookingRef = doc(db, "bookings", bookingId);
            const updateData = {
                [`ownerPayments.${paymentType}Payment.invoice`]: downloadURL
            };
            await updateDoc(bookingRef, updateData);
            showNotification('Invoice uploaded successfully!');
        } catch (error) {
            console.error('Error uploading file:', error);
            showNotification('Failed to upload invoice. Please try again.', 'error');
        } finally {
            setTaskInProgress(false);
        }
    };
    /* eslint-enable no-unused-vars */
    
    // Notification helper
    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };
    
    // Save filter combination
    const handleSaveFilter = () => {
        const filterName = prompt('Enter a name for this filter combination:');
        if (filterName) {
            setSavedFilters([...savedFilters, { name: filterName, filters: { ...filters } }]);
            showNotification('Filter combination saved!');
        }
    };

    // Enhanced Payment amount update handler with signature check
    const handlePaymentAmountChange = async (bookingId, paymentType, amount) => {
        // Get the current booking and payment data
        const booking = bookings.find(b => b.id === bookingId);
        const payment = booking?.ownerPayments?.[paymentType + 'Payment'];
        
        // Check if payment is already signed - prevent editing
        if (payment?.signature) {
            showNotification('This payment has been signed and locked. It cannot be edited.', 'error');
            return;
        }
        
        setTaskInProgress(true);
        try {
            const bookingRef = doc(db, "bookings", bookingId);
            const updateData = {
                [`ownerPayments.${paymentType}Payment.amount`]: parseFloat(amount),
                [`ownerPayments.${paymentType}Payment.date`]: new Date().toISOString()
            };
            await updateDoc(bookingRef, updateData);
            setEditingPayment(null);
            setEditingAmount('');
            showNotification(`Payment amount updated to ${formatCurrency(parseFloat(amount))}`);
        } catch (error) {
            console.error('Error updating payment amount:', error);
            showNotification('Failed to update payment amount. Please try again.', 'error');
        } finally {
            setTaskInProgress(false);
        }
    };

    // Signature request handler
    const handleSignatureClick = (bookingId, paymentType) => {
        // Get the booking details
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking) return;
        
        // Show confirmation dialog
        if (window.confirm(
            `You are about to sign off on this payment for ${booking.boatName}.\n\n` +
            `This action will LOCK this payment and it can&apos;t be edited afterward.\n\n` +
            `Do you want to proceed?`
        )) {
            setSelectedPayment({ bookingId, paymentType });
            setIsSignatureModalOpen(true);
        }
    };

    // Enhanced Signature save handler with success notification
    const handleSignatureSave = async (signatureData, name, paymentInfo) => {
        if (!paymentInfo || !paymentInfo.bookingId) {
            console.error('Invalid payment info');
            return;
        }
    
        setTaskInProgress(true);
        try {
            const bookingRef = doc(db, "bookings", paymentInfo.bookingId);
            const ownerPaymentField = `ownerPayments.${paymentInfo.paymentType}Payment`;
            
            // Create the update object with all necessary fields
            const updateData = {
                [`${ownerPaymentField}.signature`]: signatureData,
                [`${ownerPaymentField}.paidBy`]: name,
                [`${ownerPaymentField}.date`]: new Date().toISOString(),
                [`${ownerPaymentField}.paid`]: true
            };
    
            // If it's a transfer payment, we need to preserve the existing amount
            if (paymentInfo.paymentType === 'transfer') {
                // First get the current document
                const bookingDoc = await getDoc(bookingRef);
                const currentData = bookingDoc.data();
                const currentAmount = currentData?.ownerPayments?.transferPayment?.amount || 0;
                
                // Add the amount to the update if it exists
                updateData[`${ownerPaymentField}.amount`] = currentAmount;
            }
    
            await updateDoc(bookingRef, updateData);
            setIsSignatureModalOpen(false);
            showNotification('Payment has been signed and locked successfully!', 'success');
        } catch (error) {
            console.error('Error saving signature:', error);
            showNotification('Failed to save signature. Please try again.', 'error');
        } finally {
            setTaskInProgress(false);
        }
    };

    // Handle editing payment
    const handleEditPayment = (bookingId, paymentType) => {
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking) return;
        
        // Check if payment is already signed
        const payment = booking.ownerPayments[paymentType + 'Payment'];
        if (payment?.signature) {
            showNotification('This payment has been signed and locked. It cannot be edited.', 'error');
            return;
        }
        
        setEditingPayment({ id: bookingId, type: paymentType });
        setEditingAmount(booking.ownerPayments[paymentType + 'Payment']?.amount || '');
    };

    // Excel export handler
    const handleExport = () => {
        const dataToExport = filteredBookings.map(booking => {
            const firstPayment = booking.firstPayment || {};
            const secondPayment = booking.secondPayment || {};
            const ownerPayments = booking.ownerPayments || {};
    
            return {
                // Boat Info
                'Boat Name': booking.boatName,
                'Company': booking.boatCompany,
                'Trip Date': formatDate(booking.embarkedDate),
                'Priority': priorityLevels[booking.priority]?.label || '',
    
                // Client Payments
                'First Payment Amount': firstPayment.amount || 0,
                'First Payment Status': firstPayment.received ? 'Received' : 'Pending',
                'First Payment Date': formatDate(firstPayment.date),
                'First Payment Method': firstPayment.method || '',
    
                'Second Payment Amount': secondPayment.amount || 0,
                'Second Payment Status': secondPayment.received ? 'Received' : 'Pending',
                'Second Payment Date': formatDate(secondPayment.date),
                'Second Payment Method': secondPayment.method || '',
    
                // Owner Payments
                'Owner First Payment': ownerPayments.firstPayment?.amount || 0,
                'Owner First Payment Date': formatDate(ownerPayments.firstPayment?.date),
                'Owner First Payment Status': ownerPayments.firstPayment?.signature ? 'Signed' : 'Pending',
                'Owner Second Payment': ownerPayments.secondPayment?.amount || 0,
                'Owner Second Payment Date': formatDate(ownerPayments.secondPayment?.date),
                'Owner Second Payment Status': ownerPayments.secondPayment?.signature ? 'Signed' : 'Pending',
    
                // Transfer Payment
                'Transfer Amount': booking.hasTransfer ? (ownerPayments.transferPayment?.amount || 0) : 'N/A',
                'Transfer Date': booking.hasTransfer ? formatDate(ownerPayments.transferPayment?.date) : '',
                'Transfer Status': booking.hasTransfer ? (ownerPayments.transferPayment?.signature ? 'Signed' : 'Pending') : 'N/A'
            };
        });
    
        // Create Excel file
        const ws = XLSX.utils.json_to_sheet(dataToExport);
    
        // Set column widths
        ws['!cols'] = [
            { wch: 20 }, // Boat Name
            { wch: 15 }, // Company
            { wch: 12 }, // Trip Date
            { wch: 10 }, // Priority
            { wch: 15 }, // First Payment Amount
            { wch: 15 }, // First Payment Status
            { wch: 12 }, // First Payment Date
            { wch: 15 }, // First Payment Method
            { wch: 15 }, // Second Payment Amount
            { wch: 15 }, // Second Payment Status
            { wch: 12 }, // Second Payment Date
            { wch: 15 }, // Second Payment Method
            { wch: 15 }, // Owner First Payment
            { wch: 12 }, // Owner First Payment Date
            { wch: 15 }, // Owner First Payment Status
            { wch: 15 }, // Owner Second Payment
            { wch: 12 }, // Owner Second Payment Date
            { wch: 15 }, // Owner Second Payment Status
            { wch: 15 }, // Transfer Amount
            { wch: 12 }, // Transfer Date
            { wch: 15 }  // Transfer Status
        ];
    
        // Create workbook and save file
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Payments');
        XLSX.writeFile(wb, `payments_export_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
        
        showNotification(`Exported ${dataToExport.length} bookings to Excel`);
    };

    // Handle sort change
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Calculate data for summary cards
    const summaryData = useMemo(() => {
        const totalBookings = bookings.length;
        const completedPayments = bookings.filter(booking => isBookingComplete(booking)).length;
        const pendingPayments = totalBookings - completedPayments;
        const totalRevenue = bookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
        const criticalCount = bookings.filter(b => b.priority === 'CRITICAL').length;
        const highCount = bookings.filter(b => b.priority === 'HIGH').length;
        const upcomingCount = bookings.filter(b => 
            b.embarkedDate && 
            new Date(b.embarkedDate) >= new Date() && 
            b.priority !== 'COMPLETE'
        ).length;
        
        return {
            totalBookings,
            completedPayments,
            pendingPayments,
            totalRevenue,
            criticalCount,
            highCount,
            upcomingCount
        };
    }, [bookings]);

    // Get unique boat companies for filtering
    const boatCompanies = useMemo(() => {
        return [...new Set(bookings.map(booking => booking.boatCompany))].filter(Boolean);
    }, [bookings]);

    // Pagination helpers
    const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredBookings.slice(indexOfFirstItem, indexOfLastItem);

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            {taskInProgress && (
                <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                    <div className="bg-white p-4 rounded-lg flex items-center space-x-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                        <span>Processing...</span>
                    </div>
                </div>
            )}
            
            {/* Notification System */}
            {notification && (
                <CustomAlert type={notification.type} onClose={() => setNotification(null)}>
                    {notification.message}
                </CustomAlert>
            )}

            {/* Alerts Panel */}
            {alerts.length > 0 && (
                <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-yellow-800 flex items-center">
                            <AlertTriangle className="w-5 h-5 mr-2" />
                            Payment Alerts ({alerts.length})
                        </h3>
                        <button 
                            onClick={() => setAlerts([])}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                        {alerts.map(alert => (
                            <div 
                                key={alert.id}
                                className={`p-2 rounded-lg ${
                                    alert.type === 'error' 
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                }`}
                            >
                                {decodeHtmlEntities(alert.message)}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Header Section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 space-y-4 lg:space-y-0">
                <div className="flex items-center space-x-4">
                    <h2 className="text-xl font-semibold">Payment Tracking</h2>
                    <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                        {filters.includeSanAntonioTours ? 'All Bookings' : 'Regular Bookings Only'}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handleExport}
                        className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
                    >
                        <FileText className="w-4 h-4 mr-1" />
                        Export
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center"
                    >
                        <Printer className="w-4 h-4 mr-1" />
                        Print
                    </button>
                </div>
            </div>
            
            {/* Summary Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <PaymentSummaryCard 
                    title="Total Bookings" 
                    value={summaryData.totalBookings} 
                    icon={Layers} 
                    color="border-blue-600" 
                />
                <PaymentSummaryCard 
                    title="Completed Payments" 
                    value={summaryData.completedPayments} 
                    icon={CheckCircle} 
                    color="border-green-600" 
                    trend="up"
                    percent={(summaryData.completedPayments / (summaryData.totalBookings || 1) * 100).toFixed(1)}
                />
                <PaymentSummaryCard 
                    title="Urgent Payments" 
                    value={summaryData.criticalCount + summaryData.highCount} 
                    icon={AlertTriangle} 
                    color="border-red-600" 
                />
                <PaymentSummaryCard 
                    title="Total Revenue" 
                    value={formatCurrency(summaryData.totalRevenue)} 
                    icon={Euro} 
                    color="border-purple-600" 
                />
            </div>

            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-2 mb-6">
                <TabButton
                    active={activeTab === 'all'}
                    onClick={() => setActiveTab('all')}
                    icon={Layers}
                >
                    All Bookings ({filteredBookings.length})
                </TabButton>
                <TabButton
                    active={activeTab === 'urgent'}
                    onClick={() => setActiveTab('urgent')}
                    icon={AlertTriangle}
                >
                    Urgent ({summaryData.criticalCount + summaryData.highCount})
                </TabButton>
                <TabButton
                    active={activeTab === 'upcoming'}
                    onClick={() => setActiveTab('upcoming')}
                    icon={Clock}
                >
                    Upcoming ({summaryData.upcomingCount})
                </TabButton>
                <TabButton
                    active={activeTab === 'completed'}
                    onClick={() => setActiveTab('completed')}
                    icon={CheckCircle}
                >
                    Completed ({summaryData.completedPayments})
                </TabButton>
                <TabButton
                    active={activeTab === 'overdue'}
                    onClick={() => setActiveTab('overdue')}
                    icon={Info}
                >
                    Overdue
                </TabButton>
            </div>

            {/* Help Documentation Panel */}
            {showHelp && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold mb-2">Quick Help Guide</h3>
                    <ul className="space-y-2 text-sm">
                        <li>• <strong>Tabs:</strong> Quickly filter payments by status</li>
                        <li>• <strong>Alerts:</strong> System automatically highlights urgent payments</li>
                        <li>• <strong>Priority System:</strong> Payments are color-coded by urgency</li>
                        <li>• <strong>Keyboard Shortcuts:</strong> Ctrl/Cmd+F (search), Ctrl/Cmd+E (export)</li>
                        <li>• <strong>Signed Payments:</strong> Signed payments are locked and shown with green background</li>
                    </ul>
                </div>
            )}

            {/* Filters Section */}
            <div className={`mb-4 sm:mb-6 space-y-3 ${showFilters ? '' : 'hidden'}`}>
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search boats, companies..."
                        className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-2 focus:ring-blue-500"
                        value={filters.search}
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    />
                </div>

                {/* Date Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-2">
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="date"
                                className="pl-10 pr-2 py-2 w-full border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                value={filters.dateFrom}
                                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                            />
                        </div>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="date"
                                className="pl-10 pr-2 py-2 w-full border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                value={filters.dateTo}
                                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                            />
                        </div>
                    </div>
                    <select
                        className="border rounded-lg px-3 py-2"
                        onChange={(e) => handleDatePresetChange(e.target.value)}
                    >
                        <option value="">Select Date Range</option>
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="last7days">Last 7 Days</option>
                        <option value="last30days">Last 30 Days</option>
                        <option value="next7days">Next 7 Days</option>
                        <option value="next30days">Next 30 Days</option>
                        <option value="thisMonth">This Month</option>
                        <option value="lastMonth">Last Month</option>
                        <option value="custom">Custom Range</option>
                    </select>
                </div>

                {/* Dropdown Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <Filter className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <select
                            className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-2 focus:ring-blue-500"
                            value={filters.paymentStatus}
                            onChange={(e) => setFilters(prev => ({ ...prev, paymentStatus: e.target.value }))}
                        >
                            <option value="all">All Payments</option>
                            <option value="pending">Pending Payments</option>
                            <option value="completed">Completed Payments</option>
                        </select>
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <select
                            className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-2 focus:ring-blue-500"
                            value={filters.boatCompany}
                            onChange={(e) => setFilters(prev => ({ ...prev, boatCompany: e.target.value }))}
                        >
                            <option value="all">All Companies</option>
                            {boatCompanies.map(company => (
                                <option key={company} value={company}>{company}</option>
                            ))}
                        </select>
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <select
                            className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-2 focus:ring-blue-500"
                            value={filters.paymentPriority}
                            onChange={(e) => setFilters(prev => ({ ...prev, paymentPriority: e.target.value }))}
                        >
                            <option value="all">All Priorities</option>
                            <option value="CRITICAL">Critical</option>
                            <option value="HIGH">High</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="LOW">Low</option>
                            <option value="COMPLETE">Complete</option>
                        </select>
                    </div>
                </div>

                {/* Additional Filters */}
                <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            className="form-checkbox h-4 w-4 text-blue-500"
                            checked={filters.transferOnly}
                            onChange={(e) => setFilters(prev => ({ ...prev, transferOnly: e.target.checked }))}
                        />
                        <span className="text-sm text-gray-700">Show only bookings with transfers</span>
                    </label>
                    
                    <label className="flex items-center space-x-2 bg-blue-50 px-3 py-1 rounded-lg">
                        <input
                            type="checkbox"
                            className="form-checkbox h-4 w-4 text-blue-500"
                            checked={filters.includeSanAntonioTours}
                            onChange={(e) => setFilters(prev => ({ 
                                ...prev, 
                                includeSanAntonioTours: e.target.checked 
                            }))}
                        />
                        <span className="text-sm text-blue-800">Include San Antonio Tours</span>
                    </label>
                    
                    <div className="text-sm text-gray-600">
                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredBookings.length)} of {filteredBookings.length} entries
                    </div>
                </div>
            </div>

            {/* Table with bookings */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                        <tr>
                            <th className="px-4 py-2 text-left" onClick={() => handleSort('boatName')}>
                                Boat Name {sortConfig.key === 'boatName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-4 py-2 text-left" onClick={() => handleSort('boatCompany')}>
                                Company {sortConfig.key === 'boatCompany' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-4 py-2 text-left" onClick={() => handleSort('embarkedDate')}>
                                Trip Date {sortConfig.key === 'embarkedDate' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-4 py-2 text-left" onClick={() => handleSort('priority')}>
                                Priority {sortConfig.key === 'priority' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-4 py-2 text-left">First Payment</th>
                            <th className="px-4 py-2 text-left">Second Payment</th>
                            <th className="px-4 py-2 text-left">Payment Status</th>
                            <th className="px-4 py-2 text-center">Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentItems.map(booking => {
                            // Calculate payment completion
                            const totalPayments = 2 + (booking.hasTransfer ? 1 : 0);
                            
                            // Count completed payments
                            let completedPayments = 0;
                            if (booking.ownerPayments?.firstPayment?.signature) completedPayments++;
                            if (booking.ownerPayments?.secondPayment?.signature) completedPayments++;
                            if (booking.hasTransfer && booking.ownerPayments?.transferPayment?.signature) completedPayments++;
                            
                            // Calculate percentage
                            const percentComplete = Math.round((completedPayments / totalPayments) * 100);
                            
                            // Choose background based on completion
                            let rowBgClass = '';
                            if (percentComplete === 100) {
                                rowBgClass = 'bg-green-50';
                            } else if (booking.priority === 'CRITICAL') {
                                rowBgClass = 'bg-red-50';
                            } else if (booking.priority === 'HIGH') {
                                rowBgClass = 'bg-orange-50';
                            } else if (booking.isSanAntonioTour) {
                                rowBgClass = 'bg-blue-50';
                            }
                            
                            // Check if payment due date is past
                            const isDueDatePast = booking.paymentDueDate ? 
                              isPast(new Date(booking.paymentDueDate)) : false;
                            
                            return (
                                <React.Fragment key={booking.id}>
                                    <tr className={`${rowBgClass} hover:bg-gray-50`}>
                                        <td className="px-4 py-2">
                                            <div className="flex flex-col">
                                                <span>{booking.boatName}</span>
                                                {percentComplete < 100 && (
                                                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                                        <div 
                                                            className={`h-2 rounded-full ${
                                                                percentComplete === 100 ? 'bg-green-500' :
                                                                percentComplete >= 66 ? 'bg-blue-500' :
                                                                percentComplete >= 33 ? 'bg-yellow-500' :
                                                                'bg-red-500'
                                                            }`}
                                                            style={{ width: `${percentComplete}%` }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2">{booking.boatCompany}</td>
                                        <td className="px-4 py-2">{formatDate(booking.embarkedDate)}</td>
                                        <td className="px-4 py-2">
                                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${priorityLevels[booking.priority].class}`}>
                                                {priorityLevels[booking.priority].label}
                                            </span>
                                            {isDueDatePast && booking.priority !== 'COMPLETE' && (
                                                <span className="ml-1 text-xs text-red-600">Overdue</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2">
                                            {editingPayment && editingPayment.id === booking.id && editingPayment.type === 'first' ? (
                                                <div className="flex">
                                                    <input
                                                        type="number"
                                                        value={editingAmount}
                                                        onChange={(e) => setEditingAmount(e.target.value)}
                                                        className="w-24 p-1 border rounded-l"
                                                        min="0"
                                                        step="0.01"
                                                    />
                                                    <button
                                                        onClick={() => handlePaymentAmountChange(booking.id, 'first', editingAmount)}
                                                        className="bg-green-600 text-white p-1 rounded-r"
                                                    >
                                                        <Save className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <OwnerPaymentCell 
                                                    payment={booking.ownerPayments?.firstPayment}
                                                    onEditClick={() => handleEditPayment(booking.id, 'first')}
                                                    onSignatureClick={() => handleSignatureClick(booking.id, 'first')}
                                                    onViewSignature={(payment) => setIsModalOpen(payment)}
                                                />
                                            )}
                                        </td>
                                        <td className="px-4 py-2">
                                            {editingPayment && editingPayment.id === booking.id && editingPayment.type === 'second' ? (
                                                <div className="flex">
                                                    <input
                                                        type="number"
                                                        value={editingAmount}
                                                        onChange={(e) => setEditingAmount(e.target.value)}
                                                        className="w-24 p-1 border rounded-l"
                                                        min="0"
                                                        step="0.01"
                                                    />
                                                    <button
                                                        onClick={() => handlePaymentAmountChange(booking.id, 'second', editingAmount)}
                                                        className="bg-green-600 text-white p-1 rounded-r"
                                                    >
                                                        <Save className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <OwnerPaymentCell 
                                                    payment={booking.ownerPayments?.secondPayment}
                                                    onEditClick={() => handleEditPayment(booking.id, 'second')}
                                                    onSignatureClick={() => handleSignatureClick(booking.id, 'second')}
                                                    onViewSignature={(payment) => setIsModalOpen(payment)}
                                                />
                                            )}
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="flex flex-col">
                                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                                    percentComplete === 100 
                                                    ? 'bg-green-100 text-green-800' 
                                                    : percentComplete > 0
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : 'bg-red-100 text-red-800'
                                                }`}>
                                                    {percentComplete === 100 
                                                        ? 'Complete' 
                                                        : percentComplete > 0
                                                        ? 'Partial'
                                                        : 'Pending'
                                                    }
                                                </span>
                                                <span className="text-xs mt-1">
                                                    {completedPayments}/{totalPayments} payments
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <button
                                                onClick={() => toggleRowExpansion(booking.id)}
                                                className="p-1 rounded hover:bg-gray-200"
                                                title={expandedRows.includes(booking.id) ? "Hide details" : "Show details"}
                                            >
                                                {expandedRows.includes(booking.id) ? (
                                                    <ChevronUp className="w-5 h-5 text-gray-600" />
                                                ) : (
                                                    <ChevronDown className="w-5 h-5 text-gray-600" />
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                    
                                    {/* Expanded Row */}
                                    {expandedRows.includes(booking.id) && (
                                        <ExpandedPaymentRow
                                            booking={booking}
                                            onClose={() => toggleRowExpansion(booking.id)}
                                            onSignatureClick={handleSignatureClick}
                                            onEditPayment={handleEditPayment}
                                            onViewSignature={(payment) => setIsModalOpen(payment)}
                                        />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="w-full sm:w-auto flex items-center justify-center space-x-2">
                    <select
                        className="border rounded-lg px-3 py-2"
                        value={itemsPerPage}
                        onChange={(e) => {
                            setItemsPerPage(Number(e.target.value));
                            setCurrentPage(1);
                        }}
                    >
                        <option value={10}>10 per page</option>
                        <option value={25}>25 per page</option>
                        <option value={50}>50 per page</option>
                        <option value={100}>100 per page</option>
                    </select>
                    <span className="text-sm text-gray-600">per page</span>
                </div>

                <div className="flex items-center justify-center space-x-2">
                    <button
                        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1 || taskInProgress}
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    
                    <span className="text-sm whitespace-nowrap">
                        Page {currentPage} of {totalPages || 1}
                    </span>

                    <button
                        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages || totalPages === 0 || taskInProgress}
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Signature Modal - Using Enhanced Version */}
            {isSignatureModalOpen && (
                <EnhancedSignatureModal
                    isOpen={isSignatureModalOpen}
                    onClose={() => setIsSignatureModalOpen(false)}
                    onSave={handleSignatureSave}
                    paymentInfo={selectedPayment}
                />
            )}

            {/* Signature Details Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-96">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Signature Details</h3>
                            <button
                                onClick={() => setIsModalOpen(null)}
                                className="text-gray-500 hover:text-gray-700"
                                disabled={taskInProgress}
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="mb-4">
                            <img src={isModalOpen.signature} alt="Signature" className="h-24 w-full object-contain" />
                        </div>
                        <div className="text-sm">
                            <p><strong>Name:</strong> {isModalOpen.paidBy || 'N/A'}</p>
                            <p><strong>Date:</strong> {isModalOpen.date ? formatDate(isModalOpen.date) : 'N/A'}</p>
                            <p><strong>Amount:</strong> {formatCurrency(isModalOpen.amount || 0)}</p>
                            <div className="mt-2 flex items-center bg-green-50 p-2 rounded text-green-800">
                                <Lock className="w-4 h-4 mr-2" />
                                This payment is locked and cannot be edited
                            </div>
                        </div>
                        <div className="mt-4">
                            <button
                                onClick={() => setIsModalOpen(null)}
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                disabled={taskInProgress}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Menu */}
            {isMobile && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t z-40">
                    <div className="flex justify-around p-2">
                        <CustomTooltip content="Search">
                            <button 
                                className="p-2 text-gray-600"
                                onClick={() => setShowFilters(!showFilters)}
                                disabled={taskInProgress}
                            >
                                <Search className="w-5 h-5" />
                            </button>
                        </CustomTooltip>

                        <CustomTooltip content="Filter">
                            <button 
                                className="p-2 text-gray-600"
                                onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                                disabled={taskInProgress}
                            >
                                <Filter className="w-5 h-5" />
                            </button>
                        </CustomTooltip>

                        <CustomTooltip content="Export">
                            <button 
                                onClick={handleExport}
                                className="p-2 text-gray-600"
                                disabled={taskInProgress}
                            >
                                <FileText className="w-5 h-5" />
                            </button>
                        </CustomTooltip>

                        <CustomTooltip content="Help">
                            <button 
                                onClick={() => setShowHelp(!showHelp)}
                                className="p-2 text-gray-600"
                                disabled={taskInProgress}
                            >
                                <Info className="w-5 h-5" />
                            </button>
                        </CustomTooltip>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentTracking;

