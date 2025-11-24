import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, Download, Trash, Edit, Euro, Loader, ChevronUp, Plus,
  TrendingUp, ArrowUpDown, Eye, EyeOff, DollarSign, PieChart, Search,
  CalendarClock, AlertTriangle, Ship, Menu, X, ChevronDown
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const ExpenseTracker = () => {
  // Ref for form scroll
  const formRef = useRef(null);

  // State for entries - updated structure
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showPastEntries, setShowPastEntries] = useState(false);
  const [showFutureEntries, setShowFutureEntries] = useState(false); // New state for distant future
  const [pastEntries, setPastEntries] = useState([]);
  const [currentEntries, setCurrentEntries] = useState([]); // Today + Tomorrow
  const [futureEntries, setFutureEntries] = useState([]); // Day after tomorrow onwards
  
  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Track expanded state for mobile cards
  const [expandedEntryId, setExpandedEntryId] = useState(null);
  
  // New state for bookings - split into categories like entries
  const [pendingBookings, setPendingBookings] = useState([]);
  const [pastPendingBookings, setPastPendingBookings] = useState([]);
  const [currentPendingBookings, setCurrentPendingBookings] = useState([]);
  const [futurePendingBookings, setFuturePendingBookings] = useState([]);
  const [showPendingBookings, setShowPendingBookings] = useState(true);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // New state for showing summary
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    totalOwnerPaid: 0,
    totalOwnerOutstanding: 0,
    totalProfit: 0, // Net profit after owner payouts
    manualProfit: 0
  });
  
  const parseAmount = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  
  // State for new entry form
  const [newEntry, setNewEntry] = useState({
    // Intrari (Income) section
    data: '',
    detalii: '',
    bookingId: '',
    sumUpIulian: '',
    stripeIulian: '',
    caixaJustEnjoy: '',
    sumUpAlin: '',
    stripeAlin: '',
    cashIulian: '',
    cashAlin: '',
    
    // Cheltuieli (Expenses) section
    dataCompanie: '',
    companieBarci: '',
    numeleBarci: '',
    suma1: '',
    suma2: '',
    sumaIntegral: '',
    skipperCost: '',       // New field for skipper expenses
    transferCost: '',      // New field for transfer expenses
    fuelCost: '',          // New field for fuel expenses
    boatExpense: '',       // New field for general boat expenses
    metodaPlata: 'Cash',
    comisioane: '',
    colaboratori: '',
    metodaPlataColaboratori: '',
    suma: '',
    profitProvizoriu: '',
    profitTotal: '',
    transferatContCheltuieli: 'No'
  });
  
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [createFromBooking, setCreateFromBooking] = useState(null);
  
  // Format date function (from yyyy-mm-dd to dd/mm/yyyy)
  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    try {
      const parts = dateString.split('-');
      if (parts.length !== 3) return dateString;
      
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    } catch (e) {
      return dateString;
    }
  };
  
  // Calculate summary data
  const calculateSummary = (entriesData) => {
    const data = entriesData || entries;
    
    let manualProfitTotal = 0;
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalOwnerPaid = 0;
    let totalOwnerOutstanding = 0;
    
    data.forEach(entry => {
      manualProfitTotal += parseAmount(entry.profitTotal || 0);
      
      const income = entry.calculatedIncome !== undefined
        ? entry.calculatedIncome
        : calculateEntryIncome(entry);
      const expenses = entry.calculatedExpenses !== undefined
        ? entry.calculatedExpenses
        : calculateEntryExpenses(entry);
      
      totalIncome += income;
      totalExpenses += expenses;
      
      if (entry.ownerPaymentSummary) {
        totalOwnerPaid += parseAmount(entry.ownerPaymentSummary.ownerPaidAmount || 0);
        totalOwnerOutstanding += parseAmount(entry.ownerPaymentSummary.ownerOutstandingAmount || 0);
      }
    });
    
    const netProfit = totalIncome - totalExpenses - totalOwnerPaid;
    
    setSummaryData({
      totalIncome,
      totalExpenses,
      totalOwnerPaid,
      totalOwnerOutstanding,
      totalProfit: netProfit,
      manualProfit: manualProfitTotal
    });
  };
  
  // Fetch expenses and bookings data from Firebase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const expensesRef = collection(db, 'expenses');
        const expensesQuery = query(expensesRef, orderBy('createdAt', 'desc'));
        const expensesSnapshot = await getDocs(expensesQuery);

        const rawEntries = [];
        const expenseBookingIds = new Set();

        expensesSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const dataDate = data.data
            ? (data.data instanceof Timestamp
              ? data.data.toDate().toISOString().split('T')[0]
              : data.data)
            : '';
          const dataCompanie = data.dataCompanie
            ? (data.dataCompanie instanceof Timestamp
              ? data.dataCompanie.toDate().toISOString().split('T')[0]
              : data.dataCompanie)
            : '';

          const entry = {
            id: docSnap.id,
            ...data,
            data: dataDate,
            dataCompanie,
            createdAt: data.createdAt
          };

          rawEntries.push(entry);

          if (data.bookingId) {
            expenseBookingIds.add(data.bookingId);
          }
        });

        const bookingsRef = collection(db, 'bookings');
        const bookingsQuery = query(bookingsRef, orderBy('bookingDate', 'desc'));
        const bookingsSnapshot = await getDocs(bookingsQuery);

        const bookingSummaryMap = {};
        const allPendingBookings = [];
        const pastPendingBookings = [];
        const currentPendingBookingsLocal = [];
        const futurePendingBookings = [];

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = today.getTime();

        const dayAfterTomorrow = new Date(today);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
        const dayAfterTomorrowTimestamp = dayAfterTomorrow.getTime();

        bookingsSnapshot.forEach((docSnap) => {
          const bookingData = docSnap.data();
          const booking = {
            id: docSnap.id,
            ...bookingData,
            bookingDate: bookingData.bookingDate || '',
            createdAt: bookingData.createdAt || ''
          };

          if (!expenseBookingIds.has(docSnap.id) && bookingData.status === 'active') {
            allPendingBookings.push(booking);

            if (booking.bookingDate) {
              const bookingDate = new Date(booking.bookingDate);
              bookingDate.setHours(0, 0, 0, 0);
              const bookingTimestamp = bookingDate.getTime();

              if (bookingTimestamp < todayTimestamp) {
                pastPendingBookings.push(booking);
              } else if (bookingTimestamp >= todayTimestamp && bookingTimestamp < dayAfterTomorrowTimestamp) {
                currentPendingBookingsLocal.push(booking);
              } else {
                futurePendingBookings.push(booking);
              }
            } else {
              currentPendingBookingsLocal.push(booking);
            }
          }

          const ownerPayments = bookingData.ownerPayments || {};
          const breakdown = {};

          let ownerPaidAmount = 0;
          let ownerTotalDue = 0;

          const paymentConfigs = [
            { key: 'firstPayment', label: 'First Payment' },
            { key: 'secondPayment', label: 'Second Payment' }
          ];

          if (bookingData.hasTransfer || (ownerPayments.transferPayment && ownerPayments.transferPayment.amount)) {
            paymentConfigs.push({ key: 'transferPayment', label: 'Transfer Payment' });
          }

          paymentConfigs.forEach(({ key, label }) => {
            const payment = ownerPayments[key];
            if (!payment) {
              return;
            }

            const amount = parseAmount(payment.amount || 0);
            if (amount <= 0) {
              breakdown[key] = {
                label,
                amount: 0,
                paid: false
              };
              return;
            }

            ownerTotalDue += amount;
            const isPaid = Boolean(payment.paid) || Boolean(payment.signature);
            if (isPaid) {
              ownerPaidAmount += amount;
            }

            breakdown[key] = {
              label,
              amount,
              paid: isPaid,
              date: payment.date || null,
              paidBy: payment.paidBy || '',
              invoice: payment.invoice || ''
            };
          });

          const ownerOutstandingAmount = Math.max(ownerTotalDue - ownerPaidAmount, 0);

          bookingSummaryMap[docSnap.id] = {
            ownerPaidAmount,
            ownerOutstandingAmount,
            ownerTotalDue,
            breakdown,
            clientName: booking.clientName || booking.clientDetails?.name || '',
            boatName: booking.bookingDetails?.boatName || '',
            boatCompany: booking.bookingDetails?.boatCompany || '',
            agreedPrice: parseAmount(
              bookingData.pricing?.finalPrice ??
              bookingData.pricing?.agreedPrice ??
              0
            )
          };
        });

        const pastEntriesLocal = [];
        const currentEntriesLocal = [];
        const futureEntriesLocal = [];

        const enrichedEntries = rawEntries.map((entry) => {
          const bookingSummary = entry.bookingId ? bookingSummaryMap[entry.bookingId] : null;

          const calculatedIncome = calculateEntryIncome(entry);
          const calculatedExpenses = calculateEntryExpenses(entry);

          const ownerSummary = bookingSummary || {
            ownerPaidAmount: 0,
            ownerOutstandingAmount: 0,
            ownerTotalDue: 0,
            breakdown: {}
          };

          const autoProfitActual = calculatedIncome - calculatedExpenses - ownerSummary.ownerPaidAmount;
          const autoProfitProjected = calculatedIncome - calculatedExpenses - ownerSummary.ownerTotalDue;

          const enriched = {
            ...entry,
            ownerPaymentSummary: ownerSummary,
            calculatedIncome,
            calculatedExpenses,
            autoProfitActual,
            autoProfitProjected
          };

          if (entry.data) {
            const entryDate = new Date(entry.data);
            entryDate.setHours(0, 0, 0, 0);
            const entryTimestamp = entryDate.getTime();

            if (entryTimestamp < todayTimestamp) {
              pastEntriesLocal.push(enriched);
            } else if (entryTimestamp >= todayTimestamp && entryTimestamp < dayAfterTomorrowTimestamp) {
              currentEntriesLocal.push(enriched);
            } else {
              futureEntriesLocal.push(enriched);
            }
          } else {
            currentEntriesLocal.push(enriched);
          }

          return enriched;
        });

        const sortByDateAscending = (a, b) => {
          const aTimestamp = a.data ? new Date(a.data).getTime() : 0;
          const bTimestamp = b.data ? new Date(b.data).getTime() : 0;

          if (aTimestamp && bTimestamp) {
            return aTimestamp - bTimestamp;
          }

          return 0;
        };

        const sortBookingsByDate = (a, b) => {
          const aDate = a.bookingDate ? new Date(a.bookingDate).getTime() : 0;
          const bDate = b.bookingDate ? new Date(b.bookingDate).getTime() : 0;
          return aDate - bDate;
        };

        pastEntriesLocal.sort(sortByDateAscending);
        currentEntriesLocal.sort(sortByDateAscending);
        futureEntriesLocal.sort(sortByDateAscending);

        allPendingBookings.sort(sortBookingsByDate);
        pastPendingBookings.sort(sortBookingsByDate);
        currentPendingBookingsLocal.sort(sortBookingsByDate);
        futurePendingBookings.sort(sortBookingsByDate);

        setEntries(enrichedEntries);
        setPastEntries(pastEntriesLocal);
        setCurrentEntries(currentEntriesLocal);
        setFutureEntries(futureEntriesLocal);
        setPendingBookings(allPendingBookings);
        setPastPendingBookings(pastPendingBookings);
        setCurrentPendingBookings(currentPendingBookingsLocal);
        setFuturePendingBookings(futurePendingBookings);

        const combinedDisplayList = showPendingBookings
          ? [...currentEntriesLocal, ...currentPendingBookingsLocal]
          : currentEntriesLocal;

        setFilteredEntries(combinedDisplayList);
        calculateSummary(currentEntriesLocal);

        setError(null);
      } catch (err) {
        console.error("Error fetching data from Firebase:", err);
        setError("Failed to load data from the database. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [showPendingBookings]);
  
  // Perform search
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      clearSearch();
      return;
    }
    
    setIsSearching(true);
    
    try {
      const query = searchQuery.toLowerCase().trim();
      
      // Determine which entries to search in based on toggle states
      let entriesToSearch = [...currentEntries]; // Always include current
      if (showPastEntries) {
        entriesToSearch = [...pastEntries, ...entriesToSearch];
      }
      if (showFutureEntries) {
        entriesToSearch = [...entriesToSearch, ...futureEntries];
      }
      
      const results = entriesToSearch.filter(entry => {
        // Search in detalii field
        if (entry.detalii && entry.detalii.toLowerCase().includes(query)) {
          return true;
        }
        
        // Search in dates
        if (entry.data && entry.data.includes(query)) {
          return true;
        }
        
        if (entry.dataCompanie && entry.dataCompanie.includes(query)) {
          return true;
        }
        
        // Search in boat information
        if (entry.companieBarci && entry.companieBarci.toLowerCase().includes(query)) {
          return true;
        }
        
        if (entry.numeleBarci && entry.numeleBarci.toLowerCase().includes(query)) {
          return true;
        }
        
        // Search in booking ID
        if (entry.bookingId && entry.bookingId.toLowerCase().includes(query)) {
          return true;
        }
        
        return false;
      });
      
      // Also search in pending bookings if they're shown
      let bookingResults = [];
      if (showPendingBookings) {
        // Search in the appropriate pending booking categories based on toggle states
        let bookingsToSearch = [...currentPendingBookings]; // Always include current
        if (showPastEntries) {
          bookingsToSearch = [...pastPendingBookings, ...bookingsToSearch];
        }
        if (showFutureEntries) {
          bookingsToSearch = [...bookingsToSearch, ...futurePendingBookings];
        }
        
        bookingResults = bookingsToSearch.filter(booking => {
          // Search in client name
          if (booking.clientName && booking.clientName.toLowerCase().includes(query)) {
            return true;
          }
          
          // Search in booking date
          if (booking.bookingDate && booking.bookingDate.includes(query)) {
            return true;
          }
          
          // Search in boat information
          if (booking.bookingDetails?.boatName && booking.bookingDetails.boatName.toLowerCase().includes(query)) {
            return true;
          }
          
          if (booking.bookingDetails?.boatCompany && booking.bookingDetails.boatCompany.toLowerCase().includes(query)) {
            return true;
          }
          
          return false;
        });
      }
      
      // Combine results
      const combinedResults = [...results, ...bookingResults];
      
      setFilteredEntries(combinedResults);
      calculateSummary(results); // Only calculate summary from real expense entries
    } catch (err) {
      console.error("Error during search:", err);
    } finally {
      setIsSearching(false);
    }
  };
  
  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    
    // Reset to current view based on toggle states
    let displayEntries = [...currentEntries]; // Always show current
    if (showPastEntries) {
      displayEntries = [...pastEntries, ...displayEntries];
    }
    if (showFutureEntries) {
      displayEntries = [...displayEntries, ...futureEntries];
    }
    
    // Add appropriate pending bookings
    let displayBookings = [];
    if (showPendingBookings) {
      displayBookings = [...currentPendingBookings]; // Always show current
      if (showPastEntries) {
        displayBookings = [...pastPendingBookings, ...displayBookings];
      }
      if (showFutureEntries) {
        displayBookings = [...displayBookings, ...futurePendingBookings];
      }
    }
    
    const combinedResults = [...displayEntries, ...displayBookings];
    
    setFilteredEntries(combinedResults);
    calculateSummary(displayEntries);
  };
  
  // Toggle search panel
  const toggleSearch = () => {
    setShowSearch(!showSearch);
    if (showSearch) {
      // Reset search when closing
      clearSearch();
    }
  };
  
  // Toggle past entries visibility
  const handleTogglePastEntries = () => {
    const newShowPastEntries = !showPastEntries;
    setShowPastEntries(newShowPastEntries);
    
    // Build display list based on new state
    let displayEntries = [...currentEntries]; // Always show current
    if (newShowPastEntries) {
      displayEntries = [...pastEntries, ...displayEntries];
    }
    if (showFutureEntries) {
      displayEntries = [...displayEntries, ...futureEntries];
    }
    
    // Add appropriate pending bookings
    let displayBookings = [];
    if (showPendingBookings) {
      displayBookings = [...currentPendingBookings]; // Always show current
      if (newShowPastEntries) {
        displayBookings = [...pastPendingBookings, ...displayBookings];
      }
      if (showFutureEntries) {
        displayBookings = [...displayBookings, ...futurePendingBookings];
      }
    }
    
    const combinedResults = [...displayEntries, ...displayBookings];
    
    setFilteredEntries(combinedResults);
    calculateSummary(displayEntries);
  };
  
  // Toggle future entries visibility (new function)
  const handleToggleFutureEntries = () => {
    const newShowFutureEntries = !showFutureEntries;
    setShowFutureEntries(newShowFutureEntries);
    
    // Build display list based on new state
    let displayEntries = [...currentEntries]; // Always show current
    if (showPastEntries) {
      displayEntries = [...pastEntries, ...displayEntries];
    }
    if (newShowFutureEntries) {
      displayEntries = [...displayEntries, ...futureEntries];
    }
    
    // Add appropriate pending bookings
    let displayBookings = [];
    if (showPendingBookings) {
      displayBookings = [...currentPendingBookings]; // Always show current
      if (showPastEntries) {
        displayBookings = [...pastPendingBookings, ...displayBookings];
      }
      if (newShowFutureEntries) {
        displayBookings = [...displayBookings, ...futurePendingBookings];
      }
    }
    
    const combinedResults = [...displayEntries, ...displayBookings];
    
    setFilteredEntries(combinedResults);
    calculateSummary(displayEntries);
  };
  
  // Toggle pending bookings visibility
  const togglePendingBookings = () => {
    setShowPendingBookings(!showPendingBookings);
  };
  
  // Toggle expanded entry in mobile view
  const toggleExpandedEntry = (id) => {
    if (expandedEntryId === id) {
      setExpandedEntryId(null);
    } else {
      setExpandedEntryId(id);
    }
  };
  
  // Refresh entries list
  const refreshEntries = async () => {
    try {
      // Fetch expenses
      const expensesRef = collection(db, 'expenses');
      const expensesQuery = query(expensesRef, orderBy('createdAt', 'desc'));
      const expensesSnapshot = await getDocs(expensesQuery);
      
      const updatedEntries = [];
      const past = [];
      const current = [];
      const future = [];
      const expenseBookingIds = new Set();
      
      // Get date thresholds
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = today.getTime();
      
      const dayAfterTomorrow = new Date(today);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      const dayAfterTomorrowTimestamp = dayAfterTomorrow.getTime();
      
      expensesSnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Convert Firebase timestamps to date strings
        const dataDate = data.data ? 
          (data.data instanceof Timestamp ? data.data.toDate().toISOString().split('T')[0] : data.data) 
          : '';
          
        const dataCompanie = data.dataCompanie ? 
          (data.dataCompanie instanceof Timestamp ? data.dataCompanie.toDate().toISOString().split('T')[0] : data.dataCompanie) 
          : '';
        
        const entry = {
          id: doc.id,
          ...data,
          data: dataDate,
          dataCompanie: dataCompanie,
          createdAt: data.createdAt
        };
        
        updatedEntries.push(entry);
        
        if (data.bookingId) {
          expenseBookingIds.add(data.bookingId);
        }
        
        // Sort into past, current, and future based on date
        if (dataDate) {
          const entryDate = new Date(dataDate);
          entryDate.setHours(0, 0, 0, 0);
          const entryTimestamp = entryDate.getTime();
          
          if (entryTimestamp < todayTimestamp) {
            past.push(entry);
          } else if (entryTimestamp >= todayTimestamp && entryTimestamp < dayAfterTomorrowTimestamp) {
            current.push(entry);
          } else {
            future.push(entry);
          }
        } else {
          current.push(entry);
        }
      });
      
      // Fetch bookings
      const bookingsRef = collection(db, 'bookings');
      const bookingsQuery = query(bookingsRef, orderBy('bookingDate', 'desc'));
      const bookingsSnapshot = await getDocs(bookingsQuery);
      
      const allPendingBookings = [];
      const pastPendingBookingsList = [];
      const currentPendingBookingsList = [];
      const futurePendingBookingsList = [];
      
      bookingsSnapshot.forEach((doc) => {
        const bookingData = doc.data();
        const booking = {
          id: doc.id,
          ...bookingData,
          bookingDate: bookingData.bookingDate || '',
          createdAt: bookingData.createdAt || ''
        };
        
        // If this booking doesn't have an expense entry yet and is active, add to pending
        if (!expenseBookingIds.has(doc.id) && bookingData.status === 'active') {
          allPendingBookings.push(booking);
          
          // Categorize pending bookings by date
          if (booking.bookingDate) {
            const bookingDate = new Date(booking.bookingDate);
            bookingDate.setHours(0, 0, 0, 0);
            const bookingTimestamp = bookingDate.getTime();
            
            if (bookingTimestamp < todayTimestamp) {
              pastPendingBookingsList.push(booking);
            } else if (bookingTimestamp >= todayTimestamp && bookingTimestamp < dayAfterTomorrowTimestamp) {
              currentPendingBookingsList.push(booking);
            } else {
              futurePendingBookingsList.push(booking);
            }
          } else {
            currentPendingBookingsList.push(booking);
          }
        }
      });
      
      // Sort entries by date
      const sortByDateAscending = (a, b) => {
        const aTimestamp = a.data ? new Date(a.data).getTime() : 0;
        const bTimestamp = b.data ? new Date(b.data).getTime() : 0;
        
        if (aTimestamp && bTimestamp) {
          return aTimestamp - bTimestamp;
        }
        
        return 0;
      };
      
      past.sort(sortByDateAscending);
      current.sort(sortByDateAscending);
      future.sort(sortByDateAscending);
      
      // Sort pending bookings by date
      const sortBookingsByDate = (a, b) => {
        const aDate = a.bookingDate ? new Date(a.bookingDate).getTime() : 0;
        const bDate = b.bookingDate ? new Date(b.bookingDate).getTime() : 0;
        return aDate - bDate;
      };
      
      allPendingBookings.sort(sortBookingsByDate);
      pastPendingBookingsList.sort(sortBookingsByDate);
      currentPendingBookingsList.sort(sortBookingsByDate);
      futurePendingBookingsList.sort(sortBookingsByDate);
      
      setEntries(updatedEntries);
      setPastEntries(past);
      setCurrentEntries(current);
      setFutureEntries(future);
      setPendingBookings(allPendingBookings);
      setPastPendingBookings(pastPendingBookingsList);
      setCurrentPendingBookings(currentPendingBookingsList);
      setFuturePendingBookings(futurePendingBookingsList);
      
      // Update filtered entries based on toggle states
      let displayEntries = [...current]; // Always show current
      if (showPastEntries) {
        displayEntries = [...past, ...displayEntries];
      }
      if (showFutureEntries) {
        displayEntries = [...displayEntries, ...future];
      }
      
      // Add appropriate pending bookings
      let displayBookings = [];
      if (showPendingBookings) {
        displayBookings = [...currentPendingBookingsList]; // Always show current
        if (showPastEntries) {
          displayBookings = [...pastPendingBookingsList, ...displayBookings];
        }
        if (showFutureEntries) {
          displayBookings = [...displayBookings, ...futurePendingBookingsList];
        }
      }
      
      const combinedResults = [...displayEntries, ...displayBookings];
      
      setFilteredEntries(combinedResults);
      calculateSummary(displayEntries);
      
      return updatedEntries;
    } catch (err) {
      console.error("Error refreshing entries:", err);
      throw err;
    }
  };
  
  // Payment method options
  const paymentMethodOptions = ['Cash', 'Bank Transfer', 'Credit Card', 'PayPal'];
  
  // Transfer options
  const transferOptions = ['Yes', 'No', 'Partial', 'Transferred to Savings'];
  
  // Handle input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewEntry({
      ...newEntry,
      [name]: value
    });
  };
  
  // Handle date input change
  const handleDateChange = (e) => {
    const { name, value } = e.target;
    // Keep the original format for the input field
    setNewEntry({
      ...newEntry,
      [name]: value
    });
  };
  
  // Handle numeric input change
  const handleNumericChange = (e) => {
    const { name, value } = e.target;
    // Allow empty values (will be converted to null or 0 when saving)
    setNewEntry({
      ...newEntry,
      [name]: value
    });
  };
  
  // Parse number before saving to Firebase
  const parseNumber = (value) => {
    if (value === '' || value === null || value === undefined) {
      return 0;
    }
    return parseFloat(value);
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Prepare dates for Firebase and convert empty strings to 0 for numbers
      let dataToSave = {
        ...newEntry,
        data: newEntry.data ? new Date(newEntry.data) : null,
        dataCompanie: newEntry.dataCompanie ? new Date(newEntry.dataCompanie) : null,
        sumUpIulian: parseNumber(newEntry.sumUpIulian),
        stripeIulian: parseNumber(newEntry.stripeIulian),
        caixaJustEnjoy: parseNumber(newEntry.caixaJustEnjoy),
        sumUpAlin: parseNumber(newEntry.sumUpAlin),
        stripeAlin: parseNumber(newEntry.stripeAlin),
        cashIulian: parseNumber(newEntry.cashIulian),
        cashAlin: parseNumber(newEntry.cashAlin),
        suma1: parseNumber(newEntry.suma1),
        suma2: parseNumber(newEntry.suma2),
        sumaIntegral: parseNumber(newEntry.sumaIntegral),
        skipperCost: parseNumber(newEntry.skipperCost),   // Parse the new fields
        transferCost: parseNumber(newEntry.transferCost),
        fuelCost: parseNumber(newEntry.fuelCost),
        boatExpense: parseNumber(newEntry.boatExpense),
        comisioane: parseNumber(newEntry.comisioane),
        suma: parseNumber(newEntry.suma),
        profitProvizoriu: parseNumber(newEntry.profitProvizoriu),
        profitTotal: parseNumber(newEntry.profitTotal),
        updatedAt: serverTimestamp()
      };
      
      if (editMode) {
        // Update existing document
        const entryRef = doc(db, 'expenses', editId);
        await updateDoc(entryRef, dataToSave);
        
        // Refresh entries to get updated data
        await refreshEntries();
      } else {
        // Add new document
        dataToSave.createdAt = serverTimestamp();
        await addDoc(collection(db, 'expenses'), dataToSave);
        
        // Refresh entries to get the proper timestamp
        await refreshEntries();
      }
      
      // Reset form
      setNewEntry({
        data: '',
        detalii: '',
        bookingId: '',
        sumUpIulian: '',
        stripeIulian: '',
        caixaJustEnjoy: '',
        sumUpAlin: '',
        stripeAlin: '',
        cashIulian: '',
        cashAlin: '',
        dataCompanie: '',
        companieBarci: '',
        numeleBarci: '',
        suma1: '',
        suma2: '',
        sumaIntegral: '',
        skipperCost: '',      // Reset new fields
        transferCost: '',
        fuelCost: '',
        boatExpense: '',
        metodaPlata: 'Cash',
        comisioane: '',
        colaboratori: '',
        metodaPlataColaboratori: '',
        suma: '',
        profitProvizoriu: '',
        profitTotal: '',
        transferatContCheltuieli: 'No'
      });
      setEditMode(false);
      setEditId(null);
      setShowForm(false);
      setCreateFromBooking(null);
      setError(null);
      
      // Clear any search to show the newly added/updated entries
      if (searchQuery) {
        clearSearch();
      }
    } catch (err) {
      console.error("Error saving data to Firebase:", err);
      setError("Failed to save data to the database. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Create expense entry from booking
  const handleCreateFromBooking = (booking) => {
    // Pre-fill the form with booking data
    setNewEntry({
      data: booking.bookingDate || '',
      detalii: `${booking.clientName || 'Unknown Client'} - ${booking.bookingDetails?.boatName || 'Unknown Boat'}`,
      bookingId: booking.id || '',
      sumUpIulian: '',
      stripeIulian: '',
      caixaJustEnjoy: '',
      sumUpAlin: '',
      stripeAlin: '',
      cashIulian: '',
      cashAlin: '',
      dataCompanie: booking.bookingDate || '',
      companieBarci: booking.bookingDetails?.boatCompany || '',
      numeleBarci: booking.bookingDetails?.boatName || '',
      suma1: booking.pricing?.agreedPrice || 0,
      suma2: '',
      sumaIntegral: '',
      skipperCost: '',
      transferCost: booking.transfer?.required ? 50 : 0, // Default transfer cost if transfer is required
      fuelCost: '',
      boatExpense: '',
      metodaPlata: 'Cash',
      comisioane: '',
      colaboratori: '',
      metodaPlataColaboratori: '',
      suma: '',
      profitProvizoriu: '',
      profitTotal: '',
      transferatContCheltuieli: 'No'
    });
    
    setCreateFromBooking(booking);
    setEditMode(false);
    setEditId(null);
    setShowForm(true);
    
    // Close mobile menu when creating from booking
    setMobileMenuOpen(false);
    
    // Scroll to the form
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };
  
  // Edit an entry
  const handleEdit = (id) => {
    const entryToEdit = entries.find(entry => entry.id === id);
    if (entryToEdit) {
      // Convert numeric 0 values to empty strings for editing
      setNewEntry({
        data: entryToEdit.data || '',
        detalii: entryToEdit.detalii || '',
        bookingId: entryToEdit.bookingId || '',
        sumUpIulian: entryToEdit.sumUpIulian || '',
        stripeIulian: entryToEdit.stripeIulian || '',
        caixaJustEnjoy: entryToEdit.caixaJustEnjoy || '',
        sumUpAlin: entryToEdit.sumUpAlin || '',
        stripeAlin: entryToEdit.stripeAlin || '',
        cashIulian: entryToEdit.cashIulian || '',
        cashAlin: entryToEdit.cashAlin || '',
        dataCompanie: entryToEdit.dataCompanie || '',
        companieBarci: entryToEdit.companieBarci || '',
        numeleBarci: entryToEdit.numeleBarci || '',
        suma1: entryToEdit.suma1 || '',
        suma2: entryToEdit.suma2 || '',
        sumaIntegral: entryToEdit.sumaIntegral || '',
        skipperCost: entryToEdit.skipperCost || '',     // Add new fields for editing
        transferCost: entryToEdit.transferCost || '',
        fuelCost: entryToEdit.fuelCost || '',
        boatExpense: entryToEdit.boatExpense || '',
        metodaPlata: entryToEdit.metodaPlata || 'Cash',
        comisioane: entryToEdit.comisioane || '',
        colaboratori: entryToEdit.colaboratori || '',
        metodaPlataColaboratori: entryToEdit.metodaPlataColaboratori || '',
        suma: entryToEdit.suma || '',
        profitProvizoriu: entryToEdit.profitProvizoriu || '',
        profitTotal: entryToEdit.profitTotal || '',
        transferatContCheltuieli: entryToEdit.transferatContCheltuieli || 'No'
      });
      
      setEditMode(true);
      setEditId(id);
      setCreateFromBooking(null);
      setShowForm(true);
      
      // Scroll to the form
      setTimeout(() => {
        if (formRef.current) {
          formRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };
  
  // Delete an entry
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    
    setLoading(true);
    try {
      // Delete from Firebase
      await deleteDoc(doc(db, 'expenses', id));
      
      // Refresh entries
      await refreshEntries();
      
      setError(null);
    } catch (err) {
      console.error("Error deleting document from Firebase:", err);
      setError("Failed to delete the entry. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Format currency
  const formatCurrency = (value) => {
    if (value === 0 || value === '' || value === null || value === undefined) {
      return '-';
    }
    return `${value} €`;
  };
  
  // Export data to CSV
  const exportToCSV = () => {
    // Define headers based on your Excel structure
    const headers = [
      "Data", "Detalii", "Booking ID", "SumUp - Iulian", "Stripe - Iulian", "Caixa - Nautiq Ibiza Company",
      "SumUp - Alin", "Stripe - Alin", "Cash - Iulian", "Cash - Alin", "Data",
      "Companie Barci", "Numele Barci", "Suma 1", "Suma 2", "Suma Integral",
      "Skipper Cost", "Transfer Cost", "Fuel Cost", "Boat Expense",
      "Metoda Plata", "Comisioane", "Colaboratori", "Metoda Plata", "Suma",
      "Profit Provizoriu", "Profit Total", "Net Profit (Owner Paid)", "Projected Profit (Owner Due)", "Owner Paid", "Owner Outstanding", "Transferat Cont Cheltuieli"
    ];
    
    const csvRows = [headers.join(',')];
    
    // Only export actual expense entries, not pending bookings
    const expenseEntries = filteredEntries.filter(entry => !entry.bookingDetails); // Bookings have bookingDetails
    
    expenseEntries.forEach(entry => {
      const ownerSummary = entry.ownerPaymentSummary || {};
      const ownerPaidAmount = ownerSummary.ownerPaidAmount || 0;
      const ownerOutstandingAmount = ownerSummary.ownerOutstandingAmount || 0;
      const netProfitValue = entry.autoProfitActual !== undefined
        ? entry.autoProfitActual
        : calculateEntryIncome(entry) - calculateEntryExpenses(entry) - ownerPaidAmount;
      const projectedProfitValue = entry.autoProfitProjected !== undefined
        ? entry.autoProfitProjected
        : calculateEntryIncome(entry) - calculateEntryExpenses(entry) - (ownerSummary.ownerTotalDue || (ownerPaidAmount + ownerOutstandingAmount));
      
      const values = [
        formatDate(entry.data),
        `"${entry.detalii || ''}"`,
        entry.bookingId || '',
        entry.sumUpIulian || 0,
        entry.stripeIulian || 0,
        entry.caixaJustEnjoy || 0,
        entry.sumUpAlin || 0,
        entry.stripeAlin || 0,
        entry.cashIulian || 0,
        entry.cashAlin || 0,
        formatDate(entry.dataCompanie),
        `"${entry.companieBarci || ''}"`,
        `"${entry.numeleBarci || ''}"`,
        entry.suma1 || 0,
        entry.suma2 || 0,
        entry.sumaIntegral || 0,
        entry.skipperCost || 0,
        entry.transferCost || 0,
        entry.fuelCost || 0,
        entry.boatExpense || 0,
        `"${entry.metodaPlata || ''}"`,
        entry.comisioane || 0,
        `"${entry.colaboratori || ''}"`,
        `"${entry.metodaPlataColaboratori || ''}"`,
        entry.suma || 0,
        entry.profitProvizoriu || 0,
        entry.profitTotal || 0,
        Number.isFinite(netProfitValue) ? netProfitValue : 0,
        Number.isFinite(projectedProfitValue) ? projectedProfitValue : 0,
        ownerPaidAmount || 0,
        ownerOutstandingAmount || 0,
        entry.transferatContCheltuieli
      ];
      csvRows.push(values.join(','));
    });
    
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `expense_tracker_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Toggle form visibility
  const toggleForm = () => {
    setShowForm(!showForm);
    if (!showForm && editMode) {
      // Reset form if closing while in edit mode
      setNewEntry({
        data: '',
        detalii: '',
        bookingId: '',
        sumUpIulian: '',
        cashIulian: '',
        stripeIulian: '',
        caixaJustEnjoy: '',
        sumUpAlin: '',
        stripeAlin: '',
        cashAlin: '',
        dataCompanie: '',
        companieBarci: '',
        numeleBarci: '',
        suma1: '',
        suma2: '',
        sumaIntegral: '',
        skipperCost: '',    // Reset new fields
        transferCost: '',
        fuelCost: '',
        boatExpense: '',
        metodaPlata: 'Cash',
        comisioane: '',
        colaboratori: '',
        metodaPlataColaboratori: '',
        suma: '',
        profitProvizoriu: '',
        profitTotal: '',
        transferatContCheltuieli: 'No'
      });
      setEditMode(false);
      setEditId(null);
      setCreateFromBooking(null);
    }
    
    // Close mobile menu when toggling form
    setMobileMenuOpen(false);
  };
  
  // Toggle summary visibility
  const toggleSummary = () => {
    setShowSummary(!showSummary);
    
    // Close mobile menu when toggling summary
    setMobileMenuOpen(false);
  };
  
  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };
  
  // Check if an item is a booking (not an expense entry)
  const isBooking = (item) => {
    return item.bookingDetails !== undefined;
  };
  
  // Calculate total income for an entry
  const calculateEntryIncome = (entry) => {
    return (
      parseFloat(entry.sumUpIulian || 0) +
      parseFloat(entry.stripeIulian || 0) +
      parseFloat(entry.caixaJustEnjoy || 0) +
      parseFloat(entry.sumUpAlin || 0) +
      parseFloat(entry.stripeAlin || 0) +
      parseFloat(entry.cashIulian || 0) +
      parseFloat(entry.cashAlin || 0)
    );
  };
  
  // Calculate total expenses for an entry
  const calculateEntryExpenses = (entry) => {
    return (
      parseFloat(entry.suma1 || 0) +
      parseFloat(entry.suma2 || 0) +
      parseFloat(entry.sumaIntegral || 0) +
      parseFloat(entry.skipperCost || 0) +
      parseFloat(entry.transferCost || 0) +
      parseFloat(entry.fuelCost || 0) +
      parseFloat(entry.boatExpense || 0) +
      parseFloat(entry.comisioane || 0)
    );
  };
  
  // Render a card view for entry (mobile display)
  const renderEntryCard = (entry) => {
    // Check if entry is a past entry for styling
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const entryDate = entry.data ? new Date(entry.data) : new Date();
    entryDate.setHours(0, 0, 0, 0);
    const isPastEntry = entryDate < today;
    const isTodayEntry = entryDate.getTime() === today.getTime();
    const isTomorrowEntry = entryDate.getTime() === (today.getTime() + 24 * 60 * 60 * 1000);
    
    // Calculate if this card is expanded
    const isExpanded = expandedEntryId === entry.id;
    
    // Calculate income and expenses for this entry
    const entryIncome = entry.calculatedIncome !== undefined
      ? entry.calculatedIncome
      : calculateEntryIncome(entry);
    const entryExpenses = entry.calculatedExpenses !== undefined
      ? entry.calculatedExpenses
      : calculateEntryExpenses(entry);
    const ownerSummary = entry.ownerPaymentSummary || {
      ownerPaidAmount: 0,
      ownerOutstandingAmount: 0,
      ownerTotalDue: 0,
      breakdown: {}
    };
    const ownerPaidAmount = ownerSummary.ownerPaidAmount || 0;
    const ownerOutstandingAmount = ownerSummary.ownerOutstandingAmount || 0;
    const autoProfitActual = entry.autoProfitActual !== undefined
      ? entry.autoProfitActual
      : entryIncome - entryExpenses - ownerPaidAmount;
    const autoProfitProjected = entry.autoProfitProjected !== undefined
      ? entry.autoProfitProjected
      : entryIncome - entryExpenses - (ownerSummary.ownerTotalDue || (ownerPaidAmount + ownerOutstandingAmount));
    
    return (
      <div 
        key={entry.id}
        className={`mb-4 p-3 rounded-lg shadow border ${
          isTodayEntry ? 'border-l-4 border-green-500' : 
          isTomorrowEntry ? 'border-l-4 border-blue-500' :
          isPastEntry ? 'border-l-4 border-yellow-300' : 
          'border-gray-200'
        } bg-white`}
      >
        <div className="flex justify-between items-start mb-2">
          <div>
            <span className="text-sm font-medium">
              {formatDate(entry.data)}
              {isTodayEntry && (
                <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Today
                </span>
              )}
              {isTomorrowEntry && (
                <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Tomorrow
                </span>
              )}
            </span>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={() => handleEdit(entry.id)}
              className="p-1.5 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded"
              disabled={loading}
              title="Edit Entry"
            >
              <Edit size={14} />
            </button>
            <button 
              onClick={() => handleDelete(entry.id)}
              className="p-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded"
              disabled={loading}
              title="Delete Entry"
            >
              <Trash size={14} />
            </button>
          </div>
        </div>
        
        <h3 className="text-base font-medium mb-1 line-clamp-1">
          {entry.detalii}
          {entry.bookingId && (
            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <Ship size={10} className="mr-1" /> 
              Booking
            </span>
          )}
        </h3>
        
        <div className="grid grid-cols-2 gap-1 mt-3 text-xs border-t pt-2">
          <div className="text-gray-600">Company:</div>
          <div className="font-medium">{entry.companieBarci || '-'}</div>
          
          <div className="text-gray-600">Boat:</div>
          <div className="font-medium">{entry.numeleBarci || '-'}</div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
          <div className="flex flex-col bg-blue-50 p-2 rounded">
            <span className="text-blue-600 font-semibold text-center mb-1">Income</span>
            <span className="text-lg font-bold text-center text-blue-700">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'EUR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(entryIncome)}
            </span>
          </div>
          
          <div className="flex flex-col bg-red-50 p-2 rounded">
            <span className="text-red-600 font-semibold text-center mb-1">Expenses</span>
            <span className="text-lg font-bold text-center text-red-700">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'EUR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(entryExpenses)}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
          <div className="flex flex-col bg-amber-50 p-2 rounded">
            <span className="text-amber-700 font-semibold text-center mb-1">Owner Paid</span>
            <span className="text-lg font-bold text-center text-amber-800">
              {formatCurrency(ownerPaidAmount)}
            </span>
          </div>
          
          <div className="flex flex-col bg-yellow-50 p-2 rounded">
            <span className="text-yellow-700 font-semibold text-center mb-1">Owner Outstanding</span>
            <span className="text-lg font-bold text-center text-yellow-800">
              {formatCurrency(ownerOutstandingAmount)}
            </span>
          </div>
        </div>
        
        <div className="mt-3 space-y-2">
          <div className="p-2 rounded bg-green-50 flex justify-between items-center">
            <span className="text-sm font-medium text-green-800">Net Profit (after owner paid)</span>
            <span className={`text-lg font-bold ${autoProfitActual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(autoProfitActual)}
            </span>
          </div>
          <div className="p-2 rounded bg-emerald-50 flex justify-between items-center">
            <span className="text-sm font-medium text-emerald-800">Projected Profit (after all owner due)</span>
            <span className={`text-lg font-bold ${autoProfitProjected >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(autoProfitProjected)}
            </span>
          </div>
          <div className="p-2 rounded bg-gray-50 flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Recorded Profit</span>
            <span className={`text-lg font-bold ${parseFloat(entry.profitTotal || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(entry.profitTotal)}
            </span>
          </div>
        </div>
        
        {/* Expand/Collapse button */}
        <button
          onClick={() => toggleExpandedEntry(entry.id)}
          className="w-full flex items-center justify-center mt-2 p-1 text-xs text-gray-500 hover:bg-gray-100 rounded"
        >
          {isExpanded ? (
            <>
              <ChevronUp size={14} className="mr-1" /> Show Less
            </>
          ) : (
            <>
              <ChevronDown size={14} className="mr-1" /> Show Details
            </>
          )}
        </button>
        
        {/* Expanded details */}
        {isExpanded && (
          <div className="mt-3 pt-2 border-t border-gray-200">
            <h4 className="font-medium text-sm mb-2 text-blue-600">Income Details</h4>
            <div className="grid grid-cols-2 gap-1 text-xs mb-3">
              <div className="text-gray-600">SumUp - Iulian:</div>
              <div className="font-medium text-right">{formatCurrency(entry.sumUpIulian)}</div>
              
              <div className="text-gray-600">Stripe - Iulian:</div>
              <div className="font-medium text-right">{formatCurrency(entry.stripeIulian)}</div>
              
              <div className="text-gray-600">Cash - Iulian:</div>
              <div className="font-medium text-right">{formatCurrency(entry.cashIulian)}</div>
              
              <div className="text-gray-600">SumUp - Alin:</div>
              <div className="font-medium text-right">{formatCurrency(entry.sumUpAlin)}</div>
              
              <div className="text-gray-600">Stripe - Alin:</div>
              <div className="font-medium text-right">{formatCurrency(entry.stripeAlin)}</div>
              
              <div className="text-gray-600">Cash - Alin:</div>
              <div className="font-medium text-right">{formatCurrency(entry.cashAlin)}</div>
              
              <div className="text-gray-600">Caixa - Nautiq Ibiza:</div>
              <div className="font-medium text-right">{formatCurrency(entry.caixaJustEnjoy)}</div>
            </div>
            
            <h4 className="font-medium text-sm mb-2 text-red-600">Expense Details</h4>
            <div className="grid grid-cols-2 gap-1 text-xs mb-3">
              <div className="text-gray-600">Suma 1:</div>
              <div className="font-medium text-right">{formatCurrency(entry.suma1)}</div>
              
              <div className="text-gray-600">Suma 2:</div>
              <div className="font-medium text-right">{formatCurrency(entry.suma2)}</div>
              
              <div className="text-gray-600">Suma Integral:</div>
              <div className="font-medium text-right">{formatCurrency(entry.sumaIntegral)}</div>
              
              <div className="text-gray-600">Skipper Cost:</div>
              <div className="font-medium text-right">{formatCurrency(entry.skipperCost)}</div>
              
              <div className="text-gray-600">Transfer Cost:</div>
              <div className="font-medium text-right">{formatCurrency(entry.transferCost)}</div>
              
              <div className="text-gray-600">Fuel Cost:</div>
              <div className="font-medium text-right">{formatCurrency(entry.fuelCost)}</div>
              
              <div className="text-gray-600">Boat Expense:</div>
              <div className="font-medium text-right">{formatCurrency(entry.boatExpense)}</div>
              
              <div className="text-gray-600">Comisioane:</div>
              <div className="font-medium text-right">{formatCurrency(entry.comisioane)}</div>
            </div>
            
            {entry.bookingId && (
              <>
                <h4 className="font-medium text-sm mb-2 text-amber-600">Owner Payments</h4>
                <div className="grid grid-cols-2 gap-1 text-xs mb-3">
                  {Object.keys(ownerSummary.breakdown || {}).length > 0 ? (
                    Object.values(ownerSummary.breakdown).map((payment, idx) => (
                      <React.Fragment key={`${entry.id}-owner-${idx}`}>
                        <div className="text-gray-600">{payment.label}:</div>
                        <div className="font-medium text-right flex items-center justify-end space-x-2">
                          <span>{formatCurrency(payment.amount)}</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            payment.paid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {payment.paid ? 'Paid' : 'Pending'}
                          </span>
                        </div>
                      </React.Fragment>
                    ))
                  ) : (
                    <div className="col-span-2 text-gray-500 italic">
                      No owner payment records linked to this booking yet.
                    </div>
                  )}
                </div>
              </>
            )}
            
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className="text-gray-600">Payment Method:</div>
              <div className="font-medium">{entry.metodaPlata || '-'}</div>
              
              <div className="text-gray-600">Transferred:</div>
              <div className="font-medium">
                <span className={`inline-block rounded-full px-2 py-1 text-xs ${
                  entry.transferatContCheltuieli === 'Yes' ? 'bg-green-100 text-green-800' :
                  entry.transferatContCheltuieli === 'No' ? 'bg-red-100 text-red-800' :
                  entry.transferatContCheltuieli === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {entry.transferatContCheltuieli}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  
  // Render a card view for booking (mobile display)
  const renderBookingCard = (booking) => {
    // Check if this is today's or tomorrow's booking
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const bookingDate = booking.bookingDate ? new Date(booking.bookingDate) : null;
    const isToday = bookingDate && bookingDate.setHours(0, 0, 0, 0) === today.getTime();
    const isTomorrow = bookingDate && bookingDate.setHours(0, 0, 0, 0) === tomorrow.getTime();
    
    // Calculate if this card is expanded
    const isExpanded = expandedEntryId === booking.id;
    
    return (
      <div 
        key={booking.id}
        className={`mb-4 p-3 rounded-lg shadow border-l-4 ${
          isToday ? 'border-orange-500' : 
          isTomorrow ? 'border-orange-400' : 
          'border-orange-300'
        } bg-orange-50`}
      >
        <div className="flex justify-between items-start mb-2">
          <div>
            <span className="text-sm font-medium text-orange-800">
              {formatDate(booking.bookingDate)}
              {isToday && (
                <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-200 text-orange-800">
                  Today
                </span>
              )}
              {isTomorrow && (
                <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-200 text-blue-800">
                  Tomorrow
                </span>
              )}
            </span>
          </div>
          <div>
            <button
              onClick={() => handleCreateFromBooking(booking)}
              className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded font-medium text-xs"
            >
              <Plus size={14} className="mr-1" /> Create Expense
            </button>
          </div>
        </div>
        
        <h3 className="text-base font-medium mb-1 text-orange-900 line-clamp-2">
          {booking.clientName}
        </h3>
        
        <div className="grid grid-cols-2 gap-1 mt-3 text-xs border-t border-orange-200 pt-2">
          <div className="text-orange-700">Company:</div>
          <div className="font-medium text-orange-900">{booking.bookingDetails?.boatCompany || '-'}</div>
          
          <div className="text-orange-700">Boat:</div>
          <div className="font-medium text-orange-900">{booking.bookingDetails?.boatName || '-'}</div>
          
          <div className="text-orange-700">Time:</div>
          <div className="font-medium text-orange-900">
            {booking.bookingDetails?.startTime} - {booking.bookingDetails?.endTime}
          </div>
          
          <div className="text-orange-700">Price:</div>
          <div className="font-medium text-orange-900">
            {formatCurrency(booking.pricing?.agreedPrice)}
          </div>
        </div>
        
        {/* Expand/Collapse button */}
        <button
          onClick={() => toggleExpandedEntry(booking.id)}
          className="w-full flex items-center justify-center mt-2 p-1 text-xs text-orange-700 hover:bg-orange-100 rounded"
        >
          {isExpanded ? (
            <>
              <ChevronUp size={14} className="mr-1" /> Show Less
            </>
          ) : (
            <>
              <ChevronDown size={14} className="mr-1" /> Show Details
            </>
          )}
        </button>
        
        {/* Expanded booking details */}
        {isExpanded && (
          <div className="mt-3 pt-2 border-t border-orange-200">
            <h4 className="font-medium text-sm mb-2 text-orange-800">Booking Details</h4>
            <div className="grid grid-cols-2 gap-1 text-xs mb-3">
              <div className="text-orange-700">Client:</div>
              <div className="font-medium text-orange-900">{booking.clientName || '-'}</div>
              
              <div className="text-orange-700">Email:</div>
              <div className="font-medium text-orange-900">{booking.clientDetails?.email || '-'}</div>
              
              <div className="text-orange-700">Phone:</div>
              <div className="font-medium text-orange-900">{booking.clientDetails?.phone || '-'}</div>
              
              <div className="text-orange-700">Passengers:</div>
              <div className="font-medium text-orange-900">{booking.bookingDetails?.passengers || '-'}</div>
              
              <div className="text-orange-700">Payment Status:</div>
              <div className="font-medium text-orange-900">
                <span className={`inline-block rounded-full px-2 py-1 text-xs ${
                  booking.pricing?.paymentStatus === 'Completed' ? 'bg-green-100 text-green-800' : 
                  booking.pricing?.paymentStatus === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 
                  'bg-red-100 text-red-800'
                }`}>
                  {booking.pricing?.paymentStatus || 'Unknown'}
                </span>
              </div>
              
              {booking.transfer?.required && (
                <>
                  <div className="text-orange-700">Pickup:</div>
                  <div className="font-medium text-orange-900">
                    {booking.transfer?.pickup?.locationDetail || booking.transfer?.pickup?.location || '-'}
                  </div>
                  
                  <div className="text-orange-700">Dropoff:</div>
                  <div className="font-medium text-orange-900">
                    {booking.transfer?.dropoff?.locationDetail || booking.transfer?.dropoff?.location || '-'}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="bg-white rounded-md shadow p-4">
      {/* Header with title and mobile menu button */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Expense Tracker</h1>
        
        {/* Mobile menu button - only show on small screens */}
        <div className="md:hidden">
          <button 
            onClick={toggleMobileMenu}
            className="p-2 bg-gray-100 rounded-md"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        
        {/* Desktop buttons - hide on small screens */}
        <div className="hidden md:flex space-x-2">
          <button 
            onClick={toggleSearch}
            className={`px-4 py-2 ${showSearch ? 'bg-teal-500' : 'bg-teal-600'} text-white rounded flex items-center hover:bg-teal-700`}
          >
            <Search size={16} className="mr-2" /> Search
          </button>
          <button 
            onClick={togglePendingBookings}
            className={`px-4 py-2 ${showPendingBookings ? 'bg-orange-500' : 'bg-orange-600'} text-white rounded flex items-center hover:bg-orange-700`}
          >
            {showPendingBookings ? (
              <>
                <EyeOff size={16} className="mr-2" /> Hide Pending Bookings
              </>
            ) : (
              <>
                <Eye size={16} className="mr-2" /> Show Pending Bookings
              </>
            )}
          </button>
          <button 
            onClick={handleTogglePastEntries}
            className={`px-4 py-2 ${showPastEntries ? 'bg-yellow-500' : 'bg-yellow-600'} text-white rounded flex items-center hover:bg-yellow-700`}
          >
            {showPastEntries ? (
              <>
                <EyeOff size={16} className="mr-2" /> Hide Past Entries
              </>
            ) : (
              <>
                <Eye size={16} className="mr-2" /> Show Past Entries
              </>
            )}
          </button>
          <button 
            onClick={handleToggleFutureEntries}
            className={`px-4 py-2 ${showFutureEntries ? 'bg-purple-500' : 'bg-purple-600'} text-white rounded flex items-center hover:bg-purple-700`}
          >
            {showFutureEntries ? (
              <>
                <EyeOff size={16} className="mr-2" /> Hide Future Entries
              </>
            ) : (
              <>
                <Eye size={16} className="mr-2" /> Show Future Entries
              </>
            )}
          </button>
          <button 
            onClick={toggleSummary}
            className={`px-4 py-2 ${showSummary ? 'bg-indigo-500' : 'bg-indigo-600'} text-white rounded flex items-center hover:bg-indigo-700`}
          >
            {showSummary ? (
              <>
                <EyeOff size={16} className="mr-2" /> Hide Summary
              </>
            ) : (
              <>
                <Eye size={16} className="mr-2" /> View Summary
              </>
            )}
          </button>
          <button 
            onClick={toggleForm}
            className="px-4 py-2 bg-blue-500 text-white rounded flex items-center hover:bg-blue-600"
          >
            {showForm ? (
              <>
                <ChevronUp size={16} className="mr-2" /> Hide Form
              </>
            ) : (
              <>
                <Plus size={16} className="mr-2" /> Add New Entry
              </>
            )}
          </button>
          <button 
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-500 text-white rounded flex items-center hover:bg-green-600"
            disabled={loading || filteredEntries.length === 0}
          >
            <Download size={16} className="mr-2" /> Export CSV
          </button>
        </div>
      </div>
      
      {/* Mobile Menu - only show on small screens when menu is open */}
      {mobileMenuOpen && (
        <div className="md:hidden mb-6">
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={toggleSearch}
              className={`px-3 py-2 ${showSearch ? 'bg-teal-500' : 'bg-teal-600'} text-white rounded flex items-center justify-center hover:bg-teal-700 text-sm`}
            >
              <Search size={14} className="mr-1" /> Search
            </button>
            <button 
              onClick={togglePendingBookings}
              className={`px-3 py-2 ${showPendingBookings ? 'bg-orange-500' : 'bg-orange-600'} text-white rounded flex items-center justify-center hover:bg-orange-700 text-sm`}
            >
              {showPendingBookings ? (
                <>
                  <EyeOff size={14} className="mr-1" /> Hide Bookings
                </>
              ) : (
                <>
                  <Eye size={14} className="mr-1" /> Show Bookings
                </>
              )}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button 
              onClick={handleTogglePastEntries}
              className={`px-3 py-2 ${showPastEntries ? 'bg-yellow-500' : 'bg-yellow-600'} text-white rounded flex items-center justify-center hover:bg-yellow-700 text-sm`}
            >
              {showPastEntries ? (
                <>
                  <EyeOff size={14} className="mr-1" /> Hide Past
                </>
              ) : (
                <>
                  <Eye size={14} className="mr-1" /> Show Past
                </>
              )}
            </button>
            <button 
              onClick={handleToggleFutureEntries}
              className={`px-3 py-2 ${showFutureEntries ? 'bg-purple-500' : 'bg-purple-600'} text-white rounded flex items-center justify-center hover:bg-purple-700 text-sm`}
            >
              {showFutureEntries ? (
                <>
                  <EyeOff size={14} className="mr-1" /> Hide Future
                </>
              ) : (
                <>
                  <Eye size={14} className="mr-1" /> Show Future
                </>
              )}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button 
              onClick={toggleSummary}
              className={`px-3 py-2 ${showSummary ? 'bg-indigo-500' : 'bg-indigo-600'} text-white rounded flex items-center justify-center hover:bg-indigo-700 text-sm`}
            >
              {showSummary ? (
                <>
                  <EyeOff size={14} className="mr-1" /> Hide Summary
                </>
              ) : (
                <>
                  <Eye size={14} className="mr-1" /> Summary
                </>
              )}
            </button>
            <button 
              onClick={toggleForm}
              className="px-3 py-2 bg-blue-500 text-white rounded flex items-center justify-center hover:bg-blue-600 text-sm"
            >
              {showForm ? (
                <>
                  <ChevronUp size={14} className="mr-1" /> Hide Form
                </>
              ) : (
                <>
                  <Plus size={14} className="mr-1" /> Add Entry
                </>
              )}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 mt-2">
            <button 
              onClick={exportToCSV}
              className="px-3 py-2 bg-green-500 text-white rounded flex items-center justify-center hover:bg-green-600 text-sm"
              disabled={loading || filteredEntries.filter(entry => !isBooking(entry)).length === 0}
            >
              <Download size={14} className="mr-1" /> Export CSV
            </button>
          </div>
        </div>
      )}
      
      {/* Current View Info Banner */}
      <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-md flex items-center justify-between">
        <div className="flex items-center">
          <CalendarClock size={16} className="mr-2" />
          <span className="font-medium">
            Current View: Today & Tomorrow
            {showPastEntries && <span className="text-blue-600"> + Past Entries</span>}
            {showFutureEntries && <span className="text-purple-600"> + Future Entries</span>}
          </span>
        </div>
        <div className="text-xs">
          {currentEntries.length} current entries
          {showPastEntries && ` | ${pastEntries.length} past`}
          {showFutureEntries && ` | ${futureEntries.length} future`}
          {showPendingBookings && (
            <>
              <br />
              {currentPendingBookings.length} current bookings
              {showPastEntries && ` | ${pastPendingBookings.length} past bookings`}
              {showFutureEntries && ` | ${futurePendingBookings.length} future bookings`}
            </>
          )}
        </div>
      </div>
      
      {/* Search Panel */}
      {showSearch && (
        <div className="mb-6 border rounded-md p-4 bg-teal-50">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-bold text-teal-700">Search Entries</h2>
          </div>
          <div className="flex flex-wrap items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by client, boat, date..."
              className="flex-grow rounded-md border-gray-300 shadow-sm p-2 border mb-2 sm:mb-0 w-full sm:w-auto"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <div className="flex space-x-2 w-full sm:w-auto sm:ml-2">
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 flex-grow sm:flex-grow-0"
                disabled={isSearching}
              >
                {isSearching ? (
                  <Loader size={16} className="animate-spin mx-auto" />
                ) : (
                  <Search size={16} className="mx-auto sm:mx-0" />
                )}
                <span className="hidden sm:inline ml-2">Search</span>
              </button>
              <button
                onClick={clearSearch}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex-grow sm:flex-grow-0"
                disabled={isSearching}
              >
                <span className="mx-auto sm:mx-0">Clear</span>
              </button>
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            {filteredEntries.length === entries.length 
              ? "Showing all entries" 
              : `Found ${filteredEntries.length} entries`}
          </div>
        </div>
      )}
      
      {/* Financial Summary Panel */}
      {showSummary && (
        <div className="mb-8 border rounded-md bg-gradient-to-r from-indigo-50 to-purple-50 shadow-sm overflow-hidden">
          <div className="p-4 bg-indigo-600 text-white flex justify-between items-center">
            <h2 className="text-lg font-bold flex items-center">
              <PieChart size={20} className="mr-2" /> Financial Summary
            </h2>
            <button
              onClick={toggleSummary}
              className="p-1 rounded-full hover:bg-indigo-500"
              aria-label="Close summary"
            >
              <ChevronUp size={18} />
            </button>
          </div>
          
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-6">
              <div className="bg-blue-50 p-3 md:p-4 rounded-lg border border-blue-200 shadow-sm">
                <h3 className="font-medium text-blue-800 mb-1 flex items-center">
                  <TrendingUp size={16} className="mr-2" /> Total Income
                </h3>
                <p className="text-xl md:text-2xl font-bold text-blue-900">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'EUR'
                  }).format(summaryData.totalIncome)}
                </p>
              </div>
              
              <div className="bg-red-50 p-3 md:p-4 rounded-lg border border-red-200 shadow-sm">
                <h3 className="font-medium text-red-800 mb-1 flex items-center">
                  <ArrowUpDown size={16} className="mr-2" /> Total Expenses
                </h3>
                <p className="text-xl md:text-2xl font-bold text-red-900">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'EUR'
                  }).format(summaryData.totalExpenses)}
                </p>
              </div>
              
              <div className="bg-amber-50 p-3 md:p-4 rounded-lg border border-amber-200 shadow-sm">
                <h3 className="font-medium text-amber-800 mb-1 flex items-center">
                  <Ship size={16} className="mr-2" /> Paid to Owners
                </h3>
                <p className="text-xl md:text-2xl font-bold text-amber-900">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'EUR'
                  }).format(summaryData.totalOwnerPaid)}
                </p>
              </div>
              
              <div className="bg-yellow-50 p-3 md:p-4 rounded-lg border border-yellow-200 shadow-sm">
                <h3 className="font-medium text-yellow-800 mb-1 flex items-center">
                  <AlertTriangle size={16} className="mr-2" /> Owner Outstanding
                </h3>
                <p className="text-xl md:text-2xl font-bold text-yellow-900">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'EUR'
                  }).format(summaryData.totalOwnerOutstanding)}
                </p>
              </div>
              
              <div className={`p-3 md:p-4 rounded-lg border shadow-sm ${
                summaryData.totalProfit >= 0 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <h3 className="font-medium text-gray-800 mb-1 flex items-center">
                  <DollarSign size={16} className="mr-2" /> Net Profit (after owner paid)
                </h3>
                <p className={`text-xl md:text-2xl font-bold ${
                  summaryData.totalProfit >= 0 
                    ? 'text-green-700' 
                    : 'text-red-700'
                }`}>
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'EUR'
                  }).format(summaryData.totalProfit)}
                </p>
              </div>
              
              <div className="bg-gray-50 p-3 md:p-4 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="font-medium text-gray-800 mb-1 flex items-center">
                  <PieChart size={16} className="mr-2" /> Recorded Profit (manual)
                </h3>
                <p className="text-xl md:text-2xl font-bold text-gray-900">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'EUR'
                  }).format(summaryData.manualProfit)}
                </p>
              </div>
            </div>
            
            {/* Pending Bookings Summary */}
            {(currentPendingBookings.length > 0 || (showPastEntries && pastPendingBookings.length > 0) || (showFutureEntries && futurePendingBookings.length > 0)) && (
              <div className="mt-4">
                <div className="bg-orange-50 p-3 md:p-4 rounded-lg border border-orange-200 shadow-sm">
                  <h3 className="font-medium text-orange-800 mb-1 flex items-center">
                    <AlertTriangle size={16} className="mr-2" /> Pending Bookings
                  </h3>
                  <p className="text-base md:text-lg font-bold text-orange-900">
                    {(() => {
                      let totalBookings = currentPendingBookings.length;
                      if (showPastEntries) totalBookings += pastPendingBookings.length;
                      if (showFutureEntries) totalBookings += futurePendingBookings.length;
                      return totalBookings;
                    })()} booking{(() => {
                      let totalBookings = currentPendingBookings.length;
                      if (showPastEntries) totalBookings += pastPendingBookings.length;
                      if (showFutureEntries) totalBookings += futurePendingBookings.length;
                      return totalBookings !== 1 ? 's' : '';
                    })()} need expense entries
                  </p>
                  <p className="text-xs md:text-sm text-orange-700 mt-1">
                    Total potential revenue: {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'EUR'
                    }).format((() => {
                      let bookingsToSum = [...currentPendingBookings];
                      if (showPastEntries) bookingsToSum = [...pastPendingBookings, ...bookingsToSum];
                      if (showFutureEntries) bookingsToSum = [...bookingsToSum, ...futurePendingBookings];
                      return bookingsToSum.reduce((sum, booking) => sum + parseAmount(booking.pricing?.agreedPrice || 0), 0);
                    })())}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
          <p>{error}</p>
        </div>
      )}
      
      {/* Loading indicator for initial load */}
      {loading && filteredEntries.length === 0 && (
        <div className="flex justify-center items-center py-10">
          <Loader size={24} className="animate-spin text-blue-500 mr-2" />
          <span>Loading data...</span>
        </div>
      )}
      
      {/* Collapsible Entry Form */}
      {showForm && (
        <div ref={formRef} className="mb-8 border rounded-md p-4 bg-gray-50 transition-all duration-300">
          <h2 className="text-lg font-bold mb-4">
            {editMode ? 'Edit Entry' : createFromBooking ? `Create Expense Entry for Booking: ${createFromBooking.clientName}` : 'Add New Entry'}
          </h2>
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Intrari */}
              <div className="bg-blue-50 p-4 rounded">
                <h3 className="text-md font-semibold mb-3 text-blue-600 flex items-center">
                  <Euro size={16} className="mr-2" /> Intrari (Income)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Data</label>
                    <input
                      type="date"
                      name="data"
                      value={newEntry.data}
                      onChange={handleDateChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Detalii</label>
                    <input
                      type="text"
                      name="detalii"
                      value={newEntry.detalii}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                    />
                  </div>
                  {/* Only show booking ID field if editing or creating from booking */}
                  {(editMode || createFromBooking) && (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Booking ID</label>
                      <input
                        type="text"
                        name="bookingId"
                        value={newEntry.bookingId}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                        readOnly={createFromBooking !== null}
                      />
                    </div>
                  )}
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">SumUp - Iulian</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
                        inputMode="decimal"
                        name="sumUpIulian"
                        value={newEntry.sumUpIulian}
                        onChange={handleNumericChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2 pr-12 border"
                        placeholder="0"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">€</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Stripe - Iulian</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
                        inputMode="decimal"
                        name="stripeIulian"
                        value={newEntry.stripeIulian}
                        onChange={handleNumericChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2 pr-12 border"
                        placeholder="0"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">€</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Cash - Iulian</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
                        inputMode="decimal"
                        name="cashIulian"
                        value={newEntry.cashIulian}
                        onChange={handleNumericChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2 pr-12 border"
                        placeholder="0"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">€</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Caixa - Nautiq Ibiza</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
                        inputMode="decimal"
                        name="caixaJustEnjoy"
                        value={newEntry.caixaJustEnjoy}
                        onChange={handleNumericChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2 pr-12 border"
                        placeholder="0"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">€</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">SumUp - Alin</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
                        inputMode="decimal"
                        name="sumUpAlin"
                        value={newEntry.sumUpAlin}
                        onChange={handleNumericChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2 pr-12 border"
                        placeholder="0"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">€</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Stripe - Alin</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
                        inputMode="decimal"
                        name="stripeAlin"
                        value={newEntry.stripeAlin}
                        onChange={handleNumericChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2 pr-12 border"
                        placeholder="0"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">€</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Cash - Alin</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
                        inputMode="decimal"
                        name="cashAlin"
                        value={newEntry.cashAlin}
                        onChange={handleNumericChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2 pr-12 border"
                        placeholder="0"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">€</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Right Column - Cheltuieli */}
              <div className="bg-red-50 p-4 rounded">
                <h3 className="text-md font-semibold mb-3 text-red-600 flex items-center">
                  <Euro size={16} className="mr-2" /> Cheltuieli (Expenses)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Data Companie</label>
                    <input
                      type="date"
                      name="dataCompanie"
                      value={newEntry.dataCompanie}
                      onChange={handleDateChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Companie Barci</label>
                    <input
                      type="text"
                      name="companieBarci"
                      value={newEntry.companieBarci}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Numele Barci</label>
                    <input
                      type="text"
                      name="numeleBarci"
                      value={newEntry.numeleBarci}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Suma 1</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
                        inputMode="decimal"
                        name="suma1"
                        value={newEntry.suma1}
                        onChange={handleNumericChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2 pr-12 border"
                        placeholder="0"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">€</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Suma 2</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
                        inputMode="decimal"
                        name="suma2"
                        value={newEntry.suma2}
                        onChange={handleNumericChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2 pr-12 border"
                        placeholder="0"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">€</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Suma Integral</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
                        inputMode="decimal"
                        name="sumaIntegral"
                        value={newEntry.sumaIntegral}
                        onChange={handleNumericChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2 pr-12 border"
                        placeholder="0"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">€</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* New Expense Fields */}
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Skipper Cost</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
                        inputMode="decimal"
                        name="skipperCost"
                        value={newEntry.skipperCost}
                        onChange={handleNumericChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2 pr-12 border"
                        placeholder="0"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">€</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Transfer Cost</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
                        inputMode="decimal"
                        name="transferCost"
                        value={newEntry.transferCost}
                        onChange={handleNumericChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2 pr-12 border"
                        placeholder="0"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">€</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Fuel Cost</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
                        inputMode="decimal"
                        name="fuelCost"
                        value={newEntry.fuelCost}
                        onChange={handleNumericChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2 pr-12 border"
                        placeholder="0"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">€</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Boat Expense</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
                        inputMode="decimal"
                        name="boatExpense"
                        value={newEntry.boatExpense}
                        onChange={handleNumericChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2 pr-12 border"
                        placeholder="0"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">€</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Metoda Plata</label>
                    <select
                      name="metodaPlata"
                      value={newEntry.metodaPlata}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                    >
                      {paymentMethodOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Comisioane</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
                        inputMode="decimal"
                        name="comisioane"
                        value={newEntry.comisioane}
                        onChange={handleNumericChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2 pr-12 border"
                        placeholder="0"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">€</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Colaboratori</label>
                    <input
                      type="text"
                      name="colaboratori"
                      value={newEntry.colaboratori}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Metoda Plata Colaboratori</label>
                    <select
                      name="metodaPlataColaboratori"
                      value={newEntry.metodaPlataColaboratori}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                    >
                      <option value="">Select...</option>
                      {paymentMethodOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Profit Provizoriu</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
                        inputMode="decimal"
                        name="profitProvizoriu"
                        value={newEntry.profitProvizoriu}
                        onChange={handleNumericChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2 pr-12 border"
                        placeholder="0"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">€</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Profit Total</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
                        inputMode="decimal"
                        name="profitTotal"
                        value={newEntry.profitTotal}
                        onChange={handleNumericChange}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2 pr-12 border"
                        placeholder="0"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">€</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-700">Transferat Cont Cheltuieli</label>
                    <select
                      name="transferatContCheltuieli"
                      value={newEntry.transferatContCheltuieli}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                    >
                      {transferOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={toggleForm}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-500 text-white rounded flex items-center justify-center w-full sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader size={16} className="animate-spin mr-2" />
                    {editMode ? 'Updating...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    <Save size={16} className="mr-2" />
                    {editMode ? 'Update Entry' : 'Save Entry'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Floating Total Profit Button - Always visible */}
      <div className="fixed bottom-6 right-6 z-10">
        <button 
          onClick={toggleSummary}
          className={`flex items-center justify-center p-3 md:p-4 rounded-full shadow-lg text-white ${showSummary ? 'bg-green-600' : 'bg-green-500 hover:bg-green-600'} transform transition-transform hover:scale-105`}
          title="View Net Profit Summary"
        >
          <Euro size={20} className="md:hidden" />
          <Euro size={24} className="hidden md:block" />
          <span className="ml-2 font-bold text-sm md:text-base">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'EUR',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(summaryData.totalProfit)}
          </span>
        </button>
      </div>
      
      {/* Pending Bookings Section */}
      {showPendingBookings && (currentPendingBookings.length > 0 || (showPastEntries && pastPendingBookings.length > 0) || (showFutureEntries && futurePendingBookings.length > 0)) && (
        <div className="mb-8 border rounded-md p-4 bg-orange-50">
          <h2 className="text-lg font-bold mb-4 text-orange-800 flex items-center">
            <CalendarClock size={20} className="mr-2" /> Pending Bookings ({(() => {
              let totalBookings = currentPendingBookings.length;
              if (showPastEntries) totalBookings += pastPendingBookings.length;
              if (showFutureEntries) totalBookings += futurePendingBookings.length;
              return totalBookings;
            })()})
          </h2>
          
          {/* Mobile view for bookings - only show on small screens */}
          <div className="md:hidden">
            {(() => {
              let bookingsToShow = [...currentPendingBookings];
              if (showPastEntries) bookingsToShow = [...pastPendingBookings, ...bookingsToShow];
              if (showFutureEntries) bookingsToShow = [...bookingsToShow, ...futurePendingBookings];
              return bookingsToShow.map(booking => renderBookingCard(booking));
            })()}
          </div>
          
          {/* Desktop view for bookings - hide on small screens */}
          <div className="hidden md:block overflow-x-auto rounded-lg shadow">
            <table className="min-w-full divide-y divide-orange-200 border-collapse">
              <thead>
                <tr>
                  <th className="px-3 py-3 bg-orange-100 text-left text-xs font-semibold text-orange-800 uppercase tracking-wider sticky top-0">Date</th>
                  <th className="px-3 py-3 bg-orange-100 text-left text-xs font-semibold text-orange-800 uppercase tracking-wider sticky top-0">Client</th>
                  <th className="px-3 py-3 bg-orange-100 text-left text-xs font-semibold text-orange-800 uppercase tracking-wider sticky top-0">Boat</th>
                  <th className="px-3 py-3 bg-orange-100 text-left text-xs font-semibold text-orange-800 uppercase tracking-wider sticky top-0">Company</th>
                  <th className="px-3 py-3 bg-orange-100 text-left text-xs font-semibold text-orange-800 uppercase tracking-wider sticky top-0">Price</th>
                  <th className="px-3 py-3 bg-orange-100 text-left text-xs font-semibold text-orange-800 uppercase tracking-wider sticky top-0">Time</th>
                  <th className="px-3 py-3 bg-orange-100 text-left text-xs font-semibold text-orange-800 uppercase tracking-wider sticky top-0">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-orange-200">
                {(() => {
                  let bookingsToShow = [...currentPendingBookings];
                  if (showPastEntries) bookingsToShow = [...pastPendingBookings, ...bookingsToShow];
                  if (showFutureEntries) bookingsToShow = [...bookingsToShow, ...futurePendingBookings];
                  return bookingsToShow.map((booking) => {
                    // Check if this is today's or tomorrow's booking
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    
                    const bookingDate = booking.bookingDate ? new Date(booking.bookingDate) : null;
                    const isToday = bookingDate && bookingDate.setHours(0, 0, 0, 0) === today.getTime();
                    const isTomorrow = bookingDate && bookingDate.setHours(0, 0, 0, 0) === tomorrow.getTime();
                    
                    return (
                      <tr 
                        key={booking.id} 
                        className={`${
                          isToday ? 'border-l-4 border-orange-500' : 
                          isTomorrow ? 'border-l-4 border-orange-400' : ''
                        }`}
                        onMouseEnter={(e) => e.currentTarget.classList.add('bg-orange-100')}
                        onMouseLeave={(e) => e.currentTarget.classList.remove('bg-orange-100')}
                      >
                        <td className="px-3 py-3 text-sm">
                          <span className={`font-medium ${isToday || isTomorrow ? 'text-orange-600' : ''}`}>
                            {formatDate(booking.bookingDate)}
                          </span>
                          {isToday && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-200 text-orange-800">
                              Today
                            </span>
                          )}
                          {isTomorrow && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-200 text-blue-800">
                              Tomorrow
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm">{booking.clientName}</td>
                        <td className="px-3 py-3 text-sm">{booking.bookingDetails?.boatName || '-'}</td>
                        <td className="px-3 py-3 text-sm">{booking.bookingDetails?.boatCompany || '-'}</td>
                        <td className="px-3 py-3 text-sm font-mono">
                          {formatCurrency(booking.pricing?.agreedPrice)}
                        </td>
                        <td className="px-3 py-3 text-sm">
                          {booking.bookingDetails?.startTime} - {booking.bookingDetails?.endTime}
                        </td>
                        <td className="px-3 py-3 text-sm whitespace-nowrap">
                          <button
                            onClick={() => handleCreateFromBooking(booking)}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded font-medium text-xs"
                          >
                            <Plus size={14} className="mr-1" /> Create Expense
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Hidden entries notices */}
      {!showPastEntries && (pastEntries.length > 0 || pastPendingBookings.length > 0) && (
        <div className="mb-4 p-2 bg-yellow-100 text-yellow-800 rounded-md flex items-center justify-center">
          <Eye size={16} className="mr-2" /> 
          <span>
            {pastEntries.length > 0 && `${pastEntries.length} past entries`}
            {pastEntries.length > 0 && pastPendingBookings.length > 0 && ' and '}
            {pastPendingBookings.length > 0 && `${pastPendingBookings.length} past bookings`}
            {' '}from previous dates are hidden. Click Show Past Entries to view them.
          </span>
        </div>
      )}
      
      {!showFutureEntries && (futureEntries.length > 0 || futurePendingBookings.length > 0) && (
        <div className="mb-4 p-2 bg-purple-100 text-purple-800 rounded-md flex items-center justify-center">
          <Eye size={16} className="mr-2" /> 
          <span>
            {futureEntries.length > 0 && `${futureEntries.length} future entries`}
            {futureEntries.length > 0 && futurePendingBookings.length > 0 && ' and '}
            {futurePendingBookings.length > 0 && `${futurePendingBookings.length} future bookings`}
            {' '}(day after tomorrow onwards) are hidden. Click Show Future Entries to view them.
          </span>
        </div>
      )}
      
      {/* Data Display for Entries */}
      {filteredEntries.filter(entry => !isBooking(entry)).length > 0 ? (
        <>          
          {/* Mobile view for entries - only show on small screens */}
          <div className="md:hidden">
            {filteredEntries
              .filter(entry => !isBooking(entry))
              .map((entry) => renderEntryCard(entry))}
          </div>
          
          {/* Desktop view for entries - hide on small screens */}
          <div className="hidden md:block overflow-x-auto rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200 border-collapse">
              <thead>
                <tr>
                  {/* Intrari Headers */}
                  <th className="px-2 py-3 bg-blue-100 text-left text-xs font-semibold text-blue-800 uppercase tracking-wider sticky top-0 border-b-2 border-blue-200">Data</th>
                  <th className="px-2 py-3 bg-blue-100 text-left text-xs font-semibold text-blue-800 uppercase tracking-wider sticky top-0 border-b-2 border-blue-200">Detalii</th>
                  <th className="px-2 py-3 bg-blue-100 text-left text-xs font-semibold text-blue-800 uppercase tracking-wider sticky top-0 border-b-2 border-blue-200">SumUp - Iulian</th>
                  <th className="px-2 py-3 bg-blue-100 text-left text-xs font-semibold text-blue-800 uppercase tracking-wider sticky top-0 border-b-2 border-blue-200">Stripe - Iulian</th>
                  <th className="px-2 py-3 bg-blue-100 text-left text-xs font-semibold text-blue-800 uppercase tracking-wider sticky top-0 border-b-2 border-blue-200">Caixa - JE</th>
                  <th className="px-2 py-3 bg-blue-100 text-left text-xs font-semibold text-blue-800 uppercase tracking-wider sticky top-0 border-b-2 border-blue-200">SumUp - Alin</th>
                  <th className="px-2 py-3 bg-blue-100 text-left text-xs font-semibold text-blue-800 uppercase tracking-wider sticky top-0 border-b-2 border-blue-200">Stripe - Alin</th>
                  <th className="px-2 py-3 bg-blue-100 text-left text-xs font-semibold text-blue-800 uppercase tracking-wider sticky top-0 border-b-2 border-blue-200">Cash - Iulian</th>
                  <th className="px-2 py-3 bg-blue-100 text-left text-xs font-semibold text-blue-800 uppercase tracking-wider sticky top-0 border-b-2 border-blue-200">Cash - Alin</th>
                  
                  {/* Cheltuieli Headers */}
                  <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Data</th>
                  <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Companie</th>
                  <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Barci</th>
                  <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Suma 1</th>
                  <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Suma 2</th>
                  <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Integral</th>
                  
                  {/* New Expense Headers */}
                  <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Skipper</th>
                  <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Transfer</th>
                  <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Fuel</th>
                  <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Boat Exp</th>
                  
                  <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Metoda</th>
                  <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Comisioane</th>
                  <th className="px-2 py-3 bg-amber-100 text-left text-xs font-semibold text-amber-800 uppercase tracking-wider sticky top-0 border-b-2 border-amber-200">Owner Paid</th>
                  <th className="px-2 py-3 bg-yellow-100 text-left text-xs font-semibold text-yellow-800 uppercase tracking-wider sticky top-0 border-b-2 border-yellow-200">Owner Outstanding</th>
                  <th className="px-2 py-3 bg-green-100 text-left text-xs font-semibold text-green-800 uppercase tracking-wider sticky top-0 border-b-2 border-green-200">Net Profit</th>
                  <th className="px-2 py-3 bg-gray-100 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider sticky top-0 border-b-2 border-gray-200">Recorded Profit</th>
                  <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Transferat</th>
                  <th className="px-2 py-3 bg-gray-100 text-center text-xs font-semibold text-gray-800 uppercase tracking-wider sticky top-0 border-b-2 border-gray-200 w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEntries
                  .filter(entry => !isBooking(entry)) // Only show expense entries, not bookings
                  .map((entry, index) => {
                    // Check if entry is a past entry for styling
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const entryDate = entry.data ? new Date(entry.data) : new Date();
                    entryDate.setHours(0, 0, 0, 0);
                    const isPastEntry = entryDate < today;
                    const isTodayEntry = entryDate.getTime() === today.getTime();
                    const isTomorrowEntry = entryDate.getTime() === (today.getTime() + 24 * 60 * 60 * 1000);
                    const ownerSummary = entry.ownerPaymentSummary || {};
                    const ownerPaidAmount = ownerSummary.ownerPaidAmount || 0;
                    const ownerOutstandingAmount = ownerSummary.ownerOutstandingAmount || 0;
                    const netProfit = entry.autoProfitActual !== undefined
                      ? entry.autoProfitActual
                      : calculateEntryIncome(entry) - calculateEntryExpenses(entry) - ownerPaidAmount;
                    
                    return (
                      <tr 
                        key={entry.id} 
                        className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} 
                        ${isPastEntry ? 'border-l-4 border-yellow-300' : ''}
                        ${isTodayEntry ? 'border-l-4 border-green-500' : ''}
                        ${isTomorrowEntry ? 'border-l-4 border-blue-500' : ''}`}
                        onMouseEnter={(e) => e.currentTarget.classList.add('bg-gray-100')}
                        onMouseLeave={(e) => e.currentTarget.classList.remove('bg-gray-100')}>
                        {/* Intrari Data */}
                        <td className="px-2 py-3 text-xs border-r border-blue-100">
                          {formatDate(entry.data)}
                          {isTodayEntry && (
                            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Today
                            </span>
                          )}
                          {isTomorrowEntry && (
                            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Tomorrow
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-3 text-xs border-r border-blue-100 max-w-xs truncate">
                          {entry.detalii}
                          {entry.bookingId && (
                            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <Ship size={10} className="mr-1" /> 
                              Booking
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-3 text-xs border-r border-blue-100 font-mono text-right">{formatCurrency(entry.sumUpIulian)}</td>
                        <td className="px-2 py-3 text-xs border-r border-blue-100 font-mono text-right">{formatCurrency(entry.stripeIulian)}</td>
                        <td className="px-2 py-3 text-xs border-r border-blue-100 font-mono text-right">{formatCurrency(entry.caixaJustEnjoy)}</td>
                        <td className="px-2 py-3 text-xs border-r border-blue-100 font-mono text-right">{formatCurrency(entry.sumUpAlin)}</td>
                        <td className="px-2 py-3 text-xs border-r border-blue-100 font-mono text-right">{formatCurrency(entry.stripeAlin)}</td>
                        <td className="px-2 py-3 text-xs border-r border-blue-100 font-mono text-right">{formatCurrency(entry.cashIulian)}</td>
                        <td className="px-2 py-3 text-xs border-r border-blue-100 font-mono text-right">{formatCurrency(entry.cashAlin)}</td>
                        
                        {/* Cheltuieli Data */}
                        <td className="px-2 py-3 text-xs border-r border-red-100">{formatDate(entry.dataCompanie)}</td>
                        <td className="px-2 py-3 text-xs border-r border-red-100 max-w-xs truncate">{entry.companieBarci}</td>
                        <td className="px-2 py-3 text-xs border-r border-red-100 max-w-xs truncate">{entry.numeleBarci}</td>
                        <td className="px-2 py-3 text-xs border-r border-red-100 font-mono text-right">{formatCurrency(entry.suma1)}</td>
                        <td className="px-2 py-3 text-xs border-r border-red-100 font-mono text-right">{formatCurrency(entry.suma2)}</td>
                        <td className="px-2 py-3 text-xs border-r border-red-100 font-mono text-right">{formatCurrency(entry.sumaIntegral)}</td>
                        
                        {/* New Expense Cells */}
                        <td className="px-2 py-3 text-xs border-r border-red-100 font-mono text-right">{formatCurrency(entry.skipperCost)}</td>
                        <td className="px-2 py-3 text-xs border-r border-red-100 font-mono text-right">{formatCurrency(entry.transferCost)}</td>
                        <td className="px-2 py-3 text-xs border-r border-red-100 font-mono text-right">{formatCurrency(entry.fuelCost)}</td>
                        <td className="px-2 py-3 text-xs border-r border-red-100 font-mono text-right">{formatCurrency(entry.boatExpense)}</td>
                        
                        <td className="px-2 py-3 text-xs border-r border-red-100">{entry.metodaPlata}</td>
                        <td className="px-2 py-3 text-xs border-r border-red-100 font-mono text-right">{formatCurrency(entry.comisioane)}</td>
                        <td className="px-2 py-3 text-xs border-r border-amber-100 font-mono text-right">{formatCurrency(ownerPaidAmount)}</td>
                        <td className="px-2 py-3 text-xs border-r border-yellow-100 font-mono text-right">{formatCurrency(ownerOutstandingAmount)}</td>
                        <td className={`px-2 py-3 text-xs border-r border-green-100 font-mono text-right font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(netProfit)}
                        </td>
                        <td className="px-2 py-3 text-xs border-r border-gray-200 font-mono text-right font-bold">{formatCurrency(entry.profitTotal)}</td>
                        <td className="px-2 py-3 text-xs border-r border-red-100">
                          <span className={`inline-block rounded-full px-2 py-1 text-xs ${
                            entry.transferatContCheltuieli === 'Yes' ? 'bg-green-100 text-green-800' :
                            entry.transferatContCheltuieli === 'No' ? 'bg-red-100 text-red-800' :
                            entry.transferatContCheltuieli === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {entry.transferatContCheltuieli}
                          </span>
                        </td>
                        
                        {/* Actions */}
                        <td className="px-2 py-3 text-xs whitespace-nowrap">
                          <div className="flex space-x-2 justify-center">
                            <button 
                              onClick={() => handleEdit(entry.id)}
                              className="p-1 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded"
                              disabled={loading}
                              title="Edit Entry"
                              aria-label="Edit Entry"
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              onClick={() => handleDelete(entry.id)}
                              className="p-1 bg-red-100 text-red-600 hover:bg-red-200 rounded"
                              disabled={loading}
                              title="Delete Entry"
                              aria-label="Delete Entry"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          
          {/* Dividers between entry types when showing multiple views */}
          {showPastEntries && showFutureEntries && pastEntries.length > 0 && currentEntries.length > 0 && (
            <div className="my-4 p-2 bg-yellow-100 text-yellow-800 rounded-md flex items-center justify-center">
              <span>Past entries above ⬆️ | Current entries (Today & Tomorrow) below ⬇️</span>
            </div>
          )}
          
          {showFutureEntries && currentEntries.length > 0 && futureEntries.length > 0 && (
            <div className="my-4 p-2 bg-purple-100 text-purple-800 rounded-md flex items-center justify-center">
              <span>Current entries (Today & Tomorrow) above ⬆️ | Future entries (Day after tomorrow onwards) below ⬇️</span>
            </div>
          )}
        </>
      ) : (!showPendingBookings || pendingBookings.length === 0) && (
        <div className="text-center py-8 bg-gray-50 rounded-md">
          <p className="text-gray-500 mb-2">No entries found</p>
          <p className="text-sm text-gray-400">
            {searchQuery ? 'Try different search terms or clear the search' : 'Add a new entry using the form above'}
          </p>
        </div>
      )}
    </div>
  );
};

export default ExpenseTracker;
