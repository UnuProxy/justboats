import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { storage } from '../firebase/firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../firebase/firebaseConfig';
import { format } from 'date-fns';
import { 
    Upload, 
    Edit, 
    X, 
    FileText, 
    Save, 
    Search, 
    Filter, 
    Calendar, 
    ChevronLeft, 
    ChevronRight, 
} from 'lucide-react';
import SignatureModal from './SignatureModal';
import * as XLSX from 'xlsx';

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

const CustomAlert = ({ children, type = 'success' }) => (
    <div className={`p-4 rounded-lg mb-4 ${
        type === 'error' 
            ? 'bg-red-50 border border-red-200 text-red-700' 
            : 'bg-green-50 border border-green-200 text-green-700'
    }`}>
        <div className="flex">
            <div className="ml-3">
                <p className={`text-sm ${type === 'error' ? 'text-red-800' : 'text-green-800'}`}>
                    {children}
                </p>
            </div>
        </div>
    </div>
);

const PaymentTracking = () => {
    const [bookings, setBookings] = useState([]);
    const [filteredBookings, setFilteredBookings] = useState([]);
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(null);
    const [editingPayment, setEditingPayment] = useState(null);
    const [editingAmount, setEditingAmount] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [filters, setFilters] = useState({
        search: '',
        dateFrom: '',
        dateTo: '',
        paymentStatus: 'all',
        boatCompany: 'all',
        transferOnly: false,
        completionStatus: 'all'
    });

    // State variables
    const [notification, setNotification] = useState(null);
    const [savedFilters, setSavedFilters] = useState([]);
    const [showHelp] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [showFilters] = useState(false);

    useEffect(() => {
        const bookingsRef = collection(db, "bookings");
        const q = query(bookingsRef, orderBy("bookingDate", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const bookingsData = snapshot.docs.map(doc => {
                const data = doc.data();
                
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

                return {
                    id: doc.id,
                    boatName: data.bookingDetails?.boatName || '',
                    boatCompany: data.bookingDetails?.boatCompany || '',
                    clientName: data.clientName || '',
                    bookingDate: data.bookingDate || null,
                    embarkedDate: data.bookingDetails?.date || null,
                    hasTransfer,
                    transferDetails,
                    totalAmount: data.pricing?.agreedPrice || 0,
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
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        let filtered = [...bookings];

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            filtered = filtered.filter(booking => 
                booking.boatName.toLowerCase().includes(searchTerm) ||
                booking.boatCompany.toLowerCase().includes(searchTerm) ||
                booking.clientName.toLowerCase().includes(searchTerm)
            );
        }

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

        if (filters.paymentStatus !== 'all') {
            filtered = filtered.filter(booking => {
                if (filters.paymentStatus === 'pending') {
                    return !booking.firstPayment.received || !booking.secondPayment.received;
                }
                return booking.firstPayment.received && booking.secondPayment.received;
            });
        }

        if (filters.boatCompany !== 'all') {
            filtered = filtered.filter(booking => 
                booking.boatCompany === filters.boatCompany
            );
        }

        if (filters.transferOnly) {
            filtered = filtered.filter(booking => booking.hasTransfer);
        }
        if (filters.completionStatus !== 'all') {
            filtered = filtered.filter(booking => {
                const complete = isBookingComplete(booking);
                return filters.completionStatus === 'complete' ? complete : !complete;
            });
        }

        setFilteredBookings(filtered);
        setCurrentPage(1);
    }, [filters, bookings]);

    const handleFileUpload = async (bookingId, paymentType, file) => {
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
        }
    };
    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };
    const handleSaveFilter = () => {
        const filterName = prompt('Enter a name for this filter combination:');
        if (filterName) {
            setSavedFilters([...savedFilters, { name: filterName, filters: { ...filters } }]);
            showNotification('Filter combination saved!');
        }
    }

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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
                        handleExport(true);
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
            default:
                return;
        }

        setFilters(prev => ({
            ...prev,
            dateFrom: dateFrom.toISOString().split('T')[0],
            dateTo: dateTo.toISOString().split('T')[0]
        }));
    };

    const isBookingComplete = (booking) => {
        
        const clientPaymentsComplete = 
            booking.firstPayment?.received && 
            booking.secondPayment?.received;
    
        console.log('Client payments:', {
            firstReceived: booking.firstPayment?.received,
            secondReceived: booking.secondPayment?.received,
            clientPaymentsComplete
        });
    
        // Check owner payments
        const ownerFirstPaymentComplete = 
            booking.ownerPayments?.firstPayment?.signature && 
            booking.ownerPayments?.firstPayment?.amount > 0;
    
        const ownerSecondPaymentComplete = 
            booking.ownerPayments?.secondPayment?.signature && 
            booking.ownerPayments?.secondPayment?.amount > 0;
    
        console.log('Owner payments:', {
            firstComplete: ownerFirstPaymentComplete,
            firstSignature: booking.ownerPayments?.firstPayment?.signature,
            firstAmount: booking.ownerPayments?.firstPayment?.amount,
            secondComplete: ownerSecondPaymentComplete,
            secondSignature: booking.ownerPayments?.secondPayment?.signature,
            secondAmount: booking.ownerPayments?.secondPayment?.amount
        });
    
        // For transfer, only check if booking has transfer
        const transferComplete = !booking.hasTransfer || 
            (booking.hasTransfer && 
             booking.ownerPayments?.transferPayment?.signature && 
             booking.ownerPayments?.transferPayment?.amount > 0);
    
        console.log('Transfer:', {
            hasTransfer: booking.hasTransfer,
            signature: booking.ownerPayments?.transferPayment?.signature,
            amount: booking.ownerPayments?.transferPayment?.amount,
            transferComplete
        });
    
        const isComplete = clientPaymentsComplete && 
                          ownerFirstPaymentComplete && 
                          ownerSecondPaymentComplete && 
                          transferComplete;
    
        console.log('Final result:', isComplete);
    
        return isComplete;
    };

    const handlePaymentAmountChange = async (bookingId, paymentType, amount) => {
        try {
            const bookingRef = doc(db, "bookings", bookingId);
            const updateData = {
                [`ownerPayments.${paymentType}Payment.amount`]: parseFloat(amount),
                [`ownerPayments.${paymentType}Payment.date`]: new Date().toISOString()
            };
            await updateDoc(bookingRef, updateData);
            setEditingPayment(null);
            setEditingAmount('');
        } catch (error) {
            console.error('Error updating payment amount:', error);
            alert('Failed to update payment amount. Please try again.');
        }
    };

    const handleSignatureClick = (bookingId, paymentType) => {
        setSelectedPayment({ bookingId, paymentType });
        setIsSignatureModalOpen(true);
    };

    const handleSignatureSave = async (signatureData, name, paymentInfo) => {
        if (!paymentInfo || !paymentInfo.bookingId) {
            console.error('Invalid payment info');
            return;
        }
    
        try {
            const bookingRef = doc(db, "bookings", paymentInfo.bookingId);
            const ownerPaymentField = `ownerPayments.${paymentInfo.paymentType}Payment`;
            
            // Create the update object with all necessary fields
            const updateData = {
                [`${ownerPaymentField}.signature`]: signatureData,
                [`${ownerPaymentField}.paidBy`]: name,
                [`${ownerPaymentField}.date`]: new Date().toISOString(),
                [`${ownerPaymentField}.paid`]: true  // Add this line to mark as paid
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
        } catch (error) {
            console.error('Error saving signature:', error);
            alert('Failed to save signature. Please try again.');
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2
        }).format(amount);
    };

    const handleExport = () => {
        // Format helper function
        const formatDate = (date) => date ? format(new Date(date), 'dd/MM/yyyy') : '';
        
        // Map data for export
        const dataToExport = filteredBookings.map(booking => {
            // Get payment info with defaults
            const firstPayment = booking.firstPayment || {};
            const secondPayment = booking.secondPayment || {};
            const ownerPayments = booking.ownerPayments || {};
    
            return {
                // Boat Info
                'Boat Name': booking.boatName,
                'Company': booking.boatCompany,
                'Trip Date': formatDate(booking.embarkedDate),
    
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
                'Owner Second Payment': ownerPayments.secondPayment?.amount || 0,
                'Owner Second Payment Date': formatDate(ownerPayments.secondPayment?.date),
    
                // Transfer Payment
                'Transfer Amount': booking.hasTransfer ? (ownerPayments.transferPayment?.amount || 0) : 'N/A',
                'Transfer Date': booking.hasTransfer ? formatDate(ownerPayments.transferPayment?.date) : ''
            };
        });
    
        // Create Excel file
        const ws = XLSX.utils.json_to_sheet(dataToExport);
    
        // Set column widths
        ws['!cols'] = [
            { wch: 20 }, // Boat Name
            { wch: 15 }, // Company
            { wch: 12 }, // Trip Date
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
            { wch: 15 }, // Owner Second Payment
            { wch: 12 }, // Owner Second Payment Date
            { wch: 15 }, // Transfer Amount
            { wch: 12 }  // Transfer Date
        ];
    
        // Create workbook and save file
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Payments');
        XLSX.writeFile(wb, `payments_export_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
    };

    const boatCompanies = [...new Set(bookings.map(booking => booking.boatCompany))].filter(Boolean);
    const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredBookings.slice(indexOfFirstItem, indexOfLastItem);

    const PaymentAmountCell = ({ booking, paymentType, isReceived }) => {
        const isEditing = editingPayment?.bookingId === booking.id && editingPayment?.type === paymentType;
        const payment = booking.ownerPayments?.[`${paymentType}Payment`];
        
        if (!isReceived && paymentType !== 'transfer') return <td className="px-4 py-2 border-r">-</td>;
        if (paymentType === 'transfer' && !booking.hasTransfer) return <td className="px-4 py-2 border-r">-</td>;
        
        if (isEditing) {
            return (
                <td className="px-4 py-2 border-r">
                    <div className="flex items-center space-x-2">
                        <input
                            type="number"
                            className="w-24 px-2 py-1 border rounded"
                            value={editingAmount}
                            onChange={(e) => setEditingAmount(e.target.value)}
                            autoFocus
                        />
                        <button
                            onClick={() => handlePaymentAmountChange(booking.id, paymentType, editingAmount)}
                            className="text-green-500 hover:text-green-700"
                        >
                            <Save className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => {
                                setEditingPayment(null);
                                setEditingAmount('');
                            }}
                            className="text-red-500 hover:text-red-700"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </td>
            );
        }

        return (
            <td className="px-4 py-2 border-r">
                <div className="flex items-center space-x-2">
                    <span>{formatCurrency(payment?.amount || 0)}</span>
                    <button
                        onClick={() => {
                            setEditingPayment({ bookingId: booking.id, type: paymentType });
                            setEditingAmount(payment?.amount?.toString() || '0');
                        }}
                        className="text-blue-500 hover:text-blue-700"
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                </div>
            </td>
        );
    };

    const InvoiceCell = ({ booking, paymentType, isReceived }) => {
        const payment = booking.ownerPayments?.[`${paymentType}Payment`];
        
        if (!isReceived && paymentType !== 'transfer') return <td className="px-4 py-2 border-r">-</td>;
        if (paymentType === 'transfer' && !booking.hasTransfer) return <td className="px-4 py-2 border-r">-</td>;

        return (
            <td className="px-4 py-2 border-r">
                <div className="flex items-center space-x-2">
                    {payment?.invoice ? (
                        <a
                            href={payment.invoice}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700"
                        >
                            <FileText className="w-4 h-4" />
                        </a>
                    ) : (
                        <label className="cursor-pointer">
                            <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                        handleFileUpload(booking.id, paymentType, e.target.files[0]);
                                    }
                                }}
                            />
                            <Upload className="w-4 h-4 text-blue-500 hover:text-blue-700" />
                        </label>
                    )}
                </div>
            </td>
        );
    };

    const SignatureCell = ({ booking, paymentType, isReceived }) => {
        const payment = booking.ownerPayments?.[`${paymentType}Payment`];
        
        if (!isReceived && paymentType !== 'transfer') return <td className="px-4 py-2 border-r">-</td>;
        if (paymentType === 'transfer' && !booking.hasTransfer) return <td className="px-4 py-2 border-r">-</td>;

        return (
            <td className="px-4 py-2 border-r">
                {payment?.signature ? (
                    <button
                        onClick={() =>
                            setIsModalOpen({
                                bookingId: booking.id,
                                paymentType,
                                signature: payment.signature,
                                name: payment.paidBy,
                                date: payment.date,
                            })
                        }
                        className="text-blue-500"
                    >
                        <img
                            src={payment.signature}
                            alt={`${paymentType} Payment Signature`}
                            className="h-8"
                        />
                    </button>
                ) : (
                    <button
                        onClick={() => handleSignatureClick(booking.id, paymentType)}
                        className="text-blue-500"
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                )}
            </td>
        );
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            {/* Notification System */}
            {notification && (
                <CustomAlert type={notification.type}>
                    {notification.message}
                </CustomAlert>
            )}

            {/* Header Section */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-4">
                    <h2 className="text-xl font-semibold">Payment Tracking</h2>
                </div>
            </div>
            
            {/* Summary Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Total Bookings</div>
                    <div className="text-2xl font-bold">{bookings.length}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Completed Payments</div>
                    <div className="text-2xl font-bold">
                        {bookings.filter(booking => isBookingComplete(booking)).length}
                    </div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Pending Payments</div>
                    <div className="text-2xl font-bold">
                        {bookings.filter(booking => !isBookingComplete(booking)).length}
                    </div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600">Total Revenue</div>
                    <div className="text-2xl font-bold">
                        {formatCurrency(
                            bookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0)
                        )}
                    </div>
                </div>
            </div>

            {/* Help Documentation Panel */}
            {showHelp && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold mb-2">Quick Help Guide</h3>
                    <ul className="space-y-2 text-sm">
                        <li>• Use the search bar to find specific boats or companies</li>
                        <li>• Filter by date range or use quick date presets</li>
                        <li>• Save frequently used filter combinations</li>
                        <li>• Click column headers to sort the table</li>
                        <li>• Use the checkboxes to show/hide specific payment types</li>
                        <li>• Export data to Excel for further analysis</li>
                        <li>• Use keyboard shortcuts for quick actions</li>
                    </ul>
                </div>
            )}

            {/* Filters Section */}
            <div className={`mb-4 sm:mb-6 space-y-3 ${isMobile && !showFilters ? 'hidden' : ''}`}>
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
                            value={filters.completionStatus}
                            onChange={(e) => setFilters(prev => ({ ...prev, completionStatus: e.target.value }))}
                        >
                            <option value="all">All Bookings</option>
                            <option value="complete">Completed Payments</option>
                            <option value="incomplete">Incomplete Payments</option>
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
                    <div className="text-sm text-gray-600">
                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredBookings.length)} of {filteredBookings.length} entries
                    </div>
                </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto border rounded-lg -mx-6 md:mx-0">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                        <tr className="bg-gray-100">
                            <th colSpan="3" className="px-4 py-2 text-left bg-blue-50 border-b-2 border-blue-200">
                                <div className="flex items-center">
                                    <span>Boat Information</span>
                                </div>
                            </th>
                            <th colSpan="6" className="px-4 py-2 text-left bg-green-50 border-b-2 border-green-200">
                                <div className="flex items-center">
                                    <span>Client Payments</span>
                                </div>
                            </th>
                            <th colSpan="6" className="px-4 py-2 text-left bg-yellow-50 border-b-2 border-yellow-200">
                                <div className="flex items-center">
                                    <span>Owner Payments</span>
                                </div>
                            </th>
                            <th colSpan="3" className="px-4 py-2 text-left bg-purple-50 border-b-2 border-purple-200">
                                <div className="flex items-center">
                                    <span>Transfer Payments</span>
                                </div>
                            </th>
                        </tr>
                        <tr className="bg-gray-50">
                            {/* Boat Information */}
                            <th className="px-4 py-2 text-left border-r font-medium">Boat Name</th>
                            <th className="px-4 py-2 text-left border-r font-medium">Company</th>
                            <th className="px-4 py-2 text-left border-r font-medium">Trip Date</th>
                            
                            {/* Client Payments */}
                            <th className="px-4 py-2 text-left border-r font-medium">First Payment</th>
                            <th className="px-4 py-2 text-left border-r font-medium">Status/Date</th>
                            <th className="px-4 py-2 text-left border-r font-medium">Method</th>
                            <th className="px-4 py-2 text-left border-r font-medium">Second Payment</th>
                            <th className="px-4 py-2 text-left border-r font-medium">Status/Date</th>
                            <th className="px-4 py-2 text-left border-r font-medium">Method</th>
                            
                            {/* Owner Payments */}
                            <th className="px-4 py-2 text-left border-r font-medium">First Payment</th>
                            <th className="px-4 py-2 text-left border-r font-medium">Invoice</th>
                            <th className="px-4 py-2 text-left border-r font-medium">Signature</th>
                            <th className="px-4 py-2 text-left border-r font-medium">Second Payment</th>
                            <th className="px-4 py-2 text-left border-r font-medium">Invoice</th>
                            <th className="px-4 py-2 text-left border-r font-medium">Signature</th>

                            {/* Transfer Payments */}
                            <th className="px-4 py-2 text-left border-r font-medium">Amount</th>
                            <th className="px-4 py-2 text-left border-r font-medium">Invoice</th>
                            <th className="px-4 py-2 text-left border-r font-medium">Signature</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {currentItems.map(booking => (
                            <tr key={booking.id} 
                                className={`${booking.firstPayment?.method === 'Sabadell_link' ? 'bg-red-50' : ''} 
                                        ${isBookingComplete(booking) ? 'bg-green-50' : ''}`}>
                                <td className="px-4 py-2 border-r">
                                    <div className="flex items-center space-x-2">
                                        {isBookingComplete(booking) && (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 whitespace-nowrap">
                                                Complete
                                            </span>
                                        )}
                                        <span>{booking.boatName || ''}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-2 border-r">{booking.boatCompany || ''}</td>
                                <td className="px-4 py-2 border-r">
                                    {booking.embarkedDate && format(new Date(booking.embarkedDate), 'dd/MM/yyyy')}
                                </td>

                                <td className="px-4 py-2 border-r">{formatCurrency(booking.firstPayment?.amount || 0)}</td>
                                <td className="px-4 py-2 border-r">
                                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium
                                        ${booking.firstPayment?.received ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {booking.firstPayment?.received && booking.firstPayment?.date ? 
                                            format(new Date(booking.firstPayment.date), 'dd/MM/yyyy') : 
                                            'Pending'}
                                    </span>
                                </td>
                                <td className="px-4 py-2 border-r">{booking.firstPayment?.method || ''}</td>

                                <td className="px-4 py-2 border-r">{formatCurrency(booking.secondPayment?.amount || 0)}</td>
                                <td className="px-4 py-2 border-r">
                                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium
                                        ${booking.secondPayment?.received ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {booking.secondPayment?.received && booking.secondPayment?.date ? 
                                            format(new Date(booking.secondPayment.date), 'dd/MM/yyyy') : 
                                            'Pending'}
                                    </span>
                                </td>
                                <td className="px-4 py-2 border-r">{booking.secondPayment?.method || ''}</td>

                                <PaymentAmountCell
                                    booking={booking}
                                    paymentType="first"
                                    isReceived={booking.firstPayment?.received}
                                />
                                <InvoiceCell
                                    booking={booking}
                                    paymentType="first"
                                    isReceived={booking.firstPayment?.received}
                                />
                                <SignatureCell
                                    booking={booking}
                                    paymentType="first"
                                    isReceived={booking.firstPayment?.received}
                                />
                                
                                <PaymentAmountCell
                                    booking={booking}
                                    paymentType="second"
                                    isReceived={booking.secondPayment?.received}
                                />
                                <InvoiceCell
                                    booking={booking}
                                    paymentType="second"
                                    isReceived={booking.secondPayment?.received}
                                />
                                <SignatureCell
                                    booking={booking}
                                    paymentType="second"
                                    isReceived={booking.secondPayment?.received}
                                />

                                <PaymentAmountCell
                                    booking={booking}
                                    paymentType="transfer"
                                    isReceived={true}
                                />
                                <InvoiceCell
                                    booking={booking}
                                    paymentType="transfer"
                                    isReceived={true}
                                />
                                <SignatureCell
                                    booking={booking}
                                    paymentType="transfer"
                                    isReceived={true}
                                />
                            </tr>
                        ))}
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
                    </select>
                    <span className="text-sm text-gray-600">per page</span>
                </div>

                <div className="flex items-center justify-center space-x-2">
                    <button
                        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    
                    <span className="text-sm whitespace-nowrap">
                        Page {currentPage} of {totalPages}
                    </span>

                    <button
                        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Modals and Floating UI */}
            {/* Signature Details Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-96">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Signature Details</h3>
                            <button
                                onClick={() => setIsModalOpen(null)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="mb-4">
                            <img src={isModalOpen.signature} alt="Signature" className="h-24 w-full object-contain" />
                        </div>
                        <div className="text-sm">
                            <p><strong>Name:</strong> {isModalOpen.name || 'N/A'}</p>
                            <p><strong>Date:</strong> {isModalOpen.date ? format(new Date(isModalOpen.date), 'dd/MM/yyyy') : 'N/A'}</p>
                        </div>
                        <div className="mt-4">
                            <button
                                onClick={() => setIsModalOpen(null)}
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Signature Modal */}
            {isSignatureModalOpen && (
                <SignatureModal
                    isOpen={isSignatureModalOpen}
                    onClose={() => setIsSignatureModalOpen(false)}
                    onSave={handleSignatureSave}
                    paymentInfo={selectedPayment}
                />
            )}

            {/* Mobile Menu */}
            {isMobile && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t z-40">
                    <div className="flex justify-around p-2">
                    <CustomTooltip content="Content">
    <button>...</button>
</CustomTooltip>

<CustomTooltip content="Content">
    <button>...</button>
</CustomTooltip>

<CustomTooltip content="Content">
    <button>...</button>
</CustomTooltip>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentTracking;

