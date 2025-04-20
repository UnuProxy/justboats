import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, Download, Trash, Edit, Euro, Loader, ChevronUp, Plus,
  TrendingUp, ArrowUpDown, Eye, EyeOff, DollarSign, PieChart, Search
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
  serverTimestamp,
  
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const ExpenseTracker = () => {
  // Ref for form scroll
  const formRef = useRef(null);

  // State for entries
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showPastEntries, setShowPastEntries] = useState(false);
  const [pastEntries, setPastEntries] = useState([]);
  const [futureEntries, setFutureEntries] = useState([]);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // New state for showing summary
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState({
    totalProfit: 0,
    totalIncome: 0,
    totalExpenses: 0
  });
  
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
    
    let totalProfit = 0;
    let totalIncome = 0;
    let totalExpenses = 0;
    
    data.forEach(entry => {
      // Calculate profit
      if (entry.profitTotal) {
        totalProfit += parseFloat(entry.profitTotal) || 0;
      }
      
      // Calculate income (sum of all income fields)
      const income = (
        parseFloat(entry.sumUpIulian || 0) +
        parseFloat(entry.stripeIulian || 0) +
        parseFloat(entry.caixaJustEnjoy || 0) +
        parseFloat(entry.sumUpAlin || 0) +
        parseFloat(entry.stripeAlin || 0) +
        parseFloat(entry.cashIulian || 0) +
        parseFloat(entry.cashAlin || 0)
      );
      
      totalIncome += income;
      
      // Calculate expenses (sum of expense-related fields)
      const expenses = (
        parseFloat(entry.suma1 || 0) +
        parseFloat(entry.suma2 || 0) +
        parseFloat(entry.sumaIntegral || 0) +
        parseFloat(entry.comisioane || 0)
      );
      
      totalExpenses += expenses;
    });
    
    setSummaryData({
      totalProfit,
      totalIncome,
      totalExpenses
    });
  };
  
  // Fetch expenses data from Firebase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const expensesRef = collection(db, 'expenses');
        const q = query(expensesRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const fetchedEntries = [];
        const past = [];
        const future = [];
        
        // Get today's date at midnight for comparison
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = today.getTime();
        
        querySnapshot.forEach((doc) => {
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
          
          fetchedEntries.push(entry);
          
          // Sort into past and future based on date
          if (dataDate) {
            const entryDate = new Date(dataDate);
            entryDate.setHours(0, 0, 0, 0);
            
            if (entryDate.getTime() >= todayTimestamp) {
              future.push(entry);
            } else {
              past.push(entry);
            }
          } else {
            // If no date, consider it as future
            future.push(entry);
          }
        });
        
        // Sort ALL entries by date (ascending - earliest first)
        const sortByDateAscending = (a, b) => {
          const aTimestamp = a.data ? new Date(a.data).getTime() : 0;
          const bTimestamp = b.data ? new Date(b.data).getTime() : 0;
          
          if (aTimestamp && bTimestamp) {
            return aTimestamp - bTimestamp;
          }
          
          return 0;
        };
        
        past.sort(sortByDateAscending);
        future.sort(sortByDateAscending);
        
        setEntries(fetchedEntries);
        setPastEntries(past);
        setFutureEntries(future);
        
        // Show only future entries by default
        setFilteredEntries(future);
        
        // Calculate summary based on visible entries
        calculateSummary(future);
        
        setError(null);
      } catch (err) {
        console.error("Error fetching data from Firebase:", err);
        setError("Failed to load data from the database. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  

  
  // Perform search
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      clearSearch();
      return;
    }
    
    setIsSearching(true);
    
    try {
      const query = searchQuery.toLowerCase().trim();
      
      // Determine which entries to search in based on past entries toggle
      const entriesToSearch = showPastEntries ? entries : futureEntries;
      
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
      
      setFilteredEntries(results);
      calculateSummary(results);
    } catch (err) {
      console.error("Error during search:", err);
    } finally {
      setIsSearching(false);
    }
  };
  
  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    
    // Reset to either all entries or just future entries based on toggle state
    if (showPastEntries) {
      // Show all entries in chronological order
      const allEntries = [...pastEntries, ...futureEntries];
      setFilteredEntries(allEntries);
      calculateSummary(allEntries);
    } else {
      // Only show future entries
      setFilteredEntries(futureEntries);
      calculateSummary(futureEntries);
    }
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
    if (showPastEntries) {
      // Hide past entries
      setShowPastEntries(false);
      setFilteredEntries(futureEntries);
      calculateSummary(futureEntries);
    } else {
      // Show past entries - chronological order (past then future)
      setShowPastEntries(true);
      const allEntries = [...pastEntries, ...futureEntries];
      setFilteredEntries(allEntries);
      calculateSummary(allEntries);
    }
  };
  
  // Refresh entries list
  const refreshEntries = async () => {
    try {
      const expensesRef = collection(db, 'expenses');
      const q = query(expensesRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const updatedEntries = [];
      const past = [];
      const future = [];
      
      // Get today's date at midnight for comparison
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = today.getTime();
      
      querySnapshot.forEach((doc) => {
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
        
        // Sort into past and future based on date
        if (dataDate) {
          const entryDate = new Date(dataDate);
          entryDate.setHours(0, 0, 0, 0);
          
          if (entryDate.getTime() >= todayTimestamp) {
            future.push(entry);
          } else {
            past.push(entry);
          }
        } else {
          // If no date, consider it as future
          future.push(entry);
        }
      });
      
      // Sort future entries by date (ascending - closest future date first)
      future.sort((a, b) => {
        const aTimestamp = a.data ? new Date(a.data).getTime() : 0;
        const bTimestamp = b.data ? new Date(b.data).getTime() : 0;
        
        if (aTimestamp && bTimestamp) {
          return aTimestamp - bTimestamp;
        }
        
        return 0;
      });
      
      // Sort past entries by date (descending - most recent past date first)
      past.sort((a, b) => {
        const aTimestamp = a.data ? new Date(a.data).getTime() : 0;
        const bTimestamp = b.data ? new Date(b.data).getTime() : 0;
        
        if (aTimestamp && bTimestamp) {
          return bTimestamp - aTimestamp;
        }
        
        return 0;
      });
      
      setEntries(updatedEntries);
      setPastEntries(past);
      setFutureEntries(future);
      
      // Update filtered entries based on toggle state
      if (showPastEntries) {
        // Show all entries - past entries at TOP, followed by future entries
        const allEntries = [...past, ...future];
        setFilteredEntries(allEntries);
        calculateSummary(allEntries);
      } else {
        // Only show future entries
        setFilteredEntries(future);
        calculateSummary(future);
      }
      
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
      "Data", "Detalii", "Booking ID", "SumUp - Iulian", "Stripe - Iulian", "Caixa - Just Enjoy Company",
      "SumUp - Alin", "Stripe - Alin", "Cash - Iulian", "Cash - Alin", "Data",
      "Companie Barci", "Numele Barci", "Suma 1", "Suma 2", "Suma Integral",
      "Metoda Plata", "Comisioane", "Colaboratori", "Metoda Plata", "Suma",
      "Profit Provizoriu", "Profit Total", "Transferat Cont Cheltuieli"
    ];
    
    const csvRows = [headers.join(',')];
    
    filteredEntries.forEach(entry => {
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
        `"${entry.metodaPlata || ''}"`,
        entry.comisioane || 0,
        `"${entry.colaboratori || ''}"`,
        `"${entry.metodaPlataColaboratori || ''}"`,
        entry.suma || 0,
        entry.profitProvizoriu || 0,
        entry.profitTotal || 0,
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
    }
  };
  
  // Toggle summary visibility
  const toggleSummary = () => {
    setShowSummary(!showSummary);
  };
  
  return (
    <div className="bg-white rounded-md shadow p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Expense Tracker</h1>
        <div className="flex space-x-2">
          <button 
            onClick={toggleSearch}
            className={`px-4 py-2 ${showSearch ? 'bg-teal-500' : 'bg-teal-600'} text-white rounded flex items-center hover:bg-teal-700`}
          >
            <Search size={16} className="mr-2" /> Search
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
      
      {/* Search Panel */}
      {showSearch && (
        <div className="mb-6 border rounded-md p-4 bg-teal-50">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-bold text-teal-700">Search Entries</h2>
          </div>
          <div className="flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by client, boat, date..."
              className="flex-grow rounded-md border-gray-300 shadow-sm p-2 border"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              className="ml-2 px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600"
              disabled={isSearching}
            >
              {isSearching ? (
                <Loader size={16} className="animate-spin" />
              ) : (
                <Search size={16} />
              )}
            </button>
            <button
              onClick={clearSearch}
              className="ml-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              disabled={isSearching}
            >
              Clear
            </button>
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
            >
              <ChevronUp size={18} />
            </button>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm">
                <h3 className="font-medium text-blue-800 mb-1 flex items-center">
                  <TrendingUp size={16} className="mr-2" /> Total Income
                </h3>
                <p className="text-2xl font-bold text-blue-900">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'EUR'
                  }).format(summaryData.totalIncome)}
                </p>
              </div>
              
              <div className="bg-red-50 p-4 rounded-lg border border-red-200 shadow-sm">
                <h3 className="font-medium text-red-800 mb-1 flex items-center">
                  <ArrowUpDown size={16} className="mr-2" /> Total Expenses
                </h3>
                <p className="text-2xl font-bold text-red-900">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'EUR'
                  }).format(summaryData.totalExpenses)}
                </p>
              </div>
              
              <div className={`p-4 rounded-lg border shadow-sm ${
                summaryData.totalProfit >= 0 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <h3 className="font-medium text-gray-800 mb-1 flex items-center">
                  <DollarSign size={16} className="mr-2" /> Total Profit
                </h3>
                <p className={`text-2xl font-bold ${
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
            </div>
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
          <h2 className="text-lg font-bold mb-4">{editMode ? 'Edit Entry' : 'Add New Entry'}</h2>
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Intrari */}
              <div className="bg-blue-50 p-4 rounded">
                <h3 className="text-md font-semibold mb-3 text-blue-600 flex items-center">
                  <Euro size={16} className="mr-2" /> Intrari (Income)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700">SumUp - Iulian</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Stripe - Iulian</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Cash - Iulian</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Caixa - Just Enjoy</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700">SumUp - Alin</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Stripe - Alin</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
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
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Cash - Alin</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data Companie</label>
                    <input
                      type="date"
                      name="dataCompanie"
                      value={newEntry.dataCompanie}
                      onChange={handleDateChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Companie Barci</label>
                    <input
                      type="text"
                      name="companieBarci"
                      value={newEntry.companieBarci}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Numele Barci</label>
                    <input
                      type="text"
                      name="numeleBarci"
                      value={newEntry.numeleBarci}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Suma 1</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Suma 2</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Suma Integral</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
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
                  <div>
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Comisioane</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Colaboratori</label>
                    <input
                      type="text"
                      name="colaboratori"
                      value={newEntry.colaboratori}
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                    />
                  </div>
                  <div>
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Profit Provizoriu</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Profit Total</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="number"
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
                  <div>
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
            
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={toggleForm}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded mr-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-500 text-white rounded flex items-center"
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
          className={`flex items-center justify-center p-4 rounded-full shadow-lg text-white ${showSummary ? 'bg-green-600' : 'bg-green-500 hover:bg-green-600'} transform transition-transform hover:scale-105`}
          title="View Total Profit Summary"
        >
          <Euro size={24} />
          <span className="ml-2 font-bold">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'EUR',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(summaryData.totalProfit)}
          </span>
        </button>
      </div>
      
      {/* Data Display */}
      {filteredEntries.length > 0 ? (
        <div className="overflow-x-auto rounded-lg shadow">
          {!showPastEntries && pastEntries.length > 0 && (
            <div className="mb-2 p-2 bg-yellow-100 text-yellow-800 rounded-md flex items-center justify-center">
              <Eye size={16} className="mr-2" /> 
              <span>{pastEntries.length} past entries from previous dates are hidden. Click Show Past Entries to view them.</span>
            </div>
          )}
          
          <table className="min-w-full divide-y divide-gray-200 border-collapse">
            <thead>
              <tr>
                {/* Intrari Headers */}
                <th className="px-2 py-3 bg-blue-100 text-left text-xs font-semibold text-blue-800 uppercase tracking-wider sticky top-0 border-b-2 border-blue-200">Data</th>
                <th className="px-2 py-3 bg-blue-100 text-left text-xs font-semibold text-blue-800 uppercase tracking-wider sticky top-0 border-b-2 border-blue-200">Detalii</th>
                <th className="px-2 py-3 bg-blue-100 text-left text-xs font-semibold text-blue-800 uppercase tracking-wider sticky top-0 border-b-2 border-blue-200">SumUp - Iulian</th>
                <th className="px-2 py-3 bg-blue-100 text-left text-xs font-semibold text-blue-800 uppercase tracking-wider sticky top-0 border-b-2 border-blue-200">Stripe - Iulian</th>
                <th className="px-2 py-3 bg-blue-100 text-left text-xs font-semibold text-blue-800 uppercase tracking-wider sticky top-0 border-b-2 border-blue-200">Caixa - Just Enjoy</th>
                <th className="px-2 py-3 bg-blue-100 text-left text-xs font-semibold text-blue-800 uppercase tracking-wider sticky top-0 border-b-2 border-blue-200">SumUp - Alin</th>
                <th className="px-2 py-3 bg-blue-100 text-left text-xs font-semibold text-blue-800 uppercase tracking-wider sticky top-0 border-b-2 border-blue-200">Stripe - Alin</th>
                <th className="px-2 py-3 bg-blue-100 text-left text-xs font-semibold text-blue-800 uppercase tracking-wider sticky top-0 border-b-2 border-blue-200">Cash - Iulian</th>
                <th className="px-2 py-3 bg-blue-100 text-left text-xs font-semibold text-blue-800 uppercase tracking-wider sticky top-0 border-b-2 border-blue-200">Cash - Alin</th>
                
                {/* Cheltuieli Headers */}
                <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Data</th>
                <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Companie Barci</th>
                <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Numele Barci</th>
                <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Suma 1</th>
                <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Suma 2</th>
                <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Suma Integral</th>
                <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Metoda Plata</th>
                <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Comisioane</th>
                <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Profit Total</th>
                <th className="px-2 py-3 bg-red-100 text-left text-xs font-semibold text-red-800 uppercase tracking-wider sticky top-0 border-b-2 border-red-200">Transferat</th>
                <th className="px-2 py-3 bg-gray-100 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider sticky top-0 border-b-2 border-gray-200">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEntries.map((entry, index) => {
                // Check if entry is a past entry for styling
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const entryDate = entry.data ? new Date(entry.data) : new Date();
                entryDate.setHours(0, 0, 0, 0);
                const isPastEntry = entryDate < today;
                
                return (
                  <tr 
                    key={entry.id} 
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${isPastEntry ? 'border-l-4 border-yellow-300' : ''}`} 
                    onMouseEnter={(e) => e.currentTarget.classList.add('bg-gray-100')}
                    onMouseLeave={(e) => e.currentTarget.classList.remove('bg-gray-100')}>
                    {/* Intrari Data */}
                    <td className="px-2 py-3 text-xs border-r border-blue-100">{formatDate(entry.data)}</td>
                    <td className="px-2 py-3 text-xs border-r border-blue-100">{entry.detalii}</td>
                    <td className="px-2 py-3 text-xs border-r border-blue-100 font-mono text-right">{formatCurrency(entry.sumUpIulian)}</td>
                    <td className="px-2 py-3 text-xs border-r border-blue-100 font-mono text-right">{formatCurrency(entry.stripeIulian)}</td>
                    <td className="px-2 py-3 text-xs border-r border-blue-100 font-mono text-right">{formatCurrency(entry.caixaJustEnjoy)}</td>
                    <td className="px-2 py-3 text-xs border-r border-blue-100 font-mono text-right">{formatCurrency(entry.sumUpAlin)}</td>
                    <td className="px-2 py-3 text-xs border-r border-blue-100 font-mono text-right">{formatCurrency(entry.stripeAlin)}</td>
                    <td className="px-2 py-3 text-xs border-r border-blue-100 font-mono text-right">{formatCurrency(entry.cashIulian)}</td>
                    <td className="px-2 py-3 text-xs border-r border-blue-100 font-mono text-right">{formatCurrency(entry.cashAlin)}</td>
                    
                    {/* Cheltuieli Data */}
                    <td className="px-2 py-3 text-xs border-r border-red-100">{formatDate(entry.dataCompanie)}</td>
                    <td className="px-2 py-3 text-xs border-r border-red-100">{entry.companieBarci}</td>
                    <td className="px-2 py-3 text-xs border-r border-red-100">{entry.numeleBarci}</td>
                    <td className="px-2 py-3 text-xs border-r border-red-100 font-mono text-right">{formatCurrency(entry.suma1)}</td>
                    <td className="px-2 py-3 text-xs border-r border-red-100 font-mono text-right">{formatCurrency(entry.suma2)}</td>
                    <td className="px-2 py-3 text-xs border-r border-red-100 font-mono text-right">{formatCurrency(entry.sumaIntegral)}</td>
                    <td className="px-2 py-3 text-xs border-r border-red-100">{entry.metodaPlata}</td>
                    <td className="px-2 py-3 text-xs border-r border-red-100 font-mono text-right">{formatCurrency(entry.comisioane)}</td>
                    <td className="px-2 py-3 text-xs border-r border-red-100 font-mono text-right font-bold">{formatCurrency(entry.profitTotal)}</td>
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
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleEdit(entry.id)}
                          className="p-1 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded"
                          disabled={loading}
                          title="Edit Entry"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => handleDelete(entry.id)}
                          className="p-1 bg-red-100 text-red-600 hover:bg-red-200 rounded"
                          disabled={loading}
                          title="Delete Entry"
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
          
          {/* Divider between past and future entries - when viewing all entries */}
          {showPastEntries && pastEntries.length > 0 && futureEntries.length > 0 && (
            <div className="my-4 p-2 bg-green-100 text-green-800 rounded-md flex items-center justify-center">
              <span>Todays Date: {new Date().toLocaleDateString()} | Upcoming entries below ⬇️</span>
            </div>
          )}
        </div>
      ) : (
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