import React, { useState, useEffect } from 'react';
import { 
  Save, Download, Trash, Edit, Euro, Loader, ChevronUp, Plus,
  TrendingUp, ArrowUpDown,  Eye, EyeOff, DollarSign, PieChart
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
  // State for entries
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  
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
  
  // Fetch data from Firebase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const expensesRef = collection(db, 'expenses');
        const q = query(expensesRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const fetchedEntries = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          
          // Convert Firebase timestamps to date strings
          const dataDate = data.data ? 
            (data.data instanceof Timestamp ? data.data.toDate().toISOString().split('T')[0] : data.data) 
            : '';
            
          const dataCompanie = data.dataCompanie ? 
            (data.dataCompanie instanceof Timestamp ? data.dataCompanie.toDate().toISOString().split('T')[0] : data.dataCompanie) 
            : '';
            
          fetchedEntries.push({
            id: doc.id,
            ...data,
            data: dataDate,
            dataCompanie: dataCompanie
          });
        });
        
        setEntries(fetchedEntries);
        
        // Calculate summary when data is loaded
        calculateSummary(fetchedEntries);
        
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
      
      let updatedEntries;
      
      if (editMode) {
        // Update existing document
        const entryRef = doc(db, 'expenses', editId);
        await updateDoc(entryRef, dataToSave);
        
        // Update the local state
        updatedEntries = entries.map(entry => 
          entry.id === editId ? { 
            ...dataToSave, 
            id: editId, 
            data: newEntry.data, // Keep the formatted date strings for display
            dataCompanie: newEntry.dataCompanie 
          } : entry
        );
        setEntries(updatedEntries);
      } else {
        // Add new document
        dataToSave.createdAt = serverTimestamp();
        const docRef = await addDoc(collection(db, 'expenses'), dataToSave);
        
        // Add the new entry to local state
        updatedEntries = [{ 
          ...dataToSave, 
          id: docRef.id,
          data: newEntry.data, // Keep the formatted date strings for display
          dataCompanie: newEntry.dataCompanie
        }, ...entries];
        setEntries(updatedEntries);
      }
      
      // Recalculate summary data
      calculateSummary(updatedEntries);
      
      // Reset form
      setNewEntry({
        data: '',
        detalii: '',
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
    }
  };
  
  // Delete an entry
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    
    setLoading(true);
    try {
      // Delete from Firebase
      await deleteDoc(doc(db, 'expenses', id));
      
      // Update local state
      const updatedEntries = entries.filter(entry => entry.id !== id);
      setEntries(updatedEntries);
      
      // Recalculate summary
      calculateSummary(updatedEntries);
      
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
      "Data", "Detalii", "SumUp - Iulian", "Stripe - Iulian", "Caixa - Just Enjoy Company",
      "SumUp - Alin", "Stripe - Alin", "Cash - Iulian", "Cash - Alin", "Data",
      "Companie Barci", "Numele Barci", "Suma 1", "Suma 2", "Suma Integral",
      "Metoda Plata", "Comisioane", "Colaboratori", "Metoda Plata", "Suma",
      "Profit Provizoriu", "Profit Total", "Transferat Cont Cheltuieli"
    ];
    
    const csvRows = [headers.join(',')];
    
    entries.forEach(entry => {
      const values = [
        entry.data,
        `"${entry.detalii || ''}"`,
        entry.sumUpIulian || 0,
        entry.stripeIulian || 0,
        entry.caixaJustEnjoy || 0,
        entry.sumUpAlin || 0,
        entry.stripeAlin || 0,
        entry.cashIulian || 0,
        entry.cashAlin || 0,
        entry.dataCompanie,
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
            disabled={loading || entries.length === 0}
          >
            <Download size={16} className="mr-2" /> Export CSV
          </button>
        </div>
      </div>
      
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
      {loading && entries.length === 0 && (
        <div className="flex justify-center items-center py-10">
          <Loader size={24} className="animate-spin text-blue-500 mr-2" />
          <span>Loading data...</span>
        </div>
      )}
      
      {/* Collapsible Entry Form */}
      {showForm && (
        <div className="mb-8 border rounded-md p-4 bg-gray-50 transition-all duration-300">
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
                      onChange={handleInputChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                    />
                  </div>
                  <div>
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
                      onChange={handleInputChange}
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
          <DollarSign size={24} />
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
      {entries.length > 0 && (
        <div className="overflow-x-auto rounded-lg shadow">
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
              {entries.map((entry, index) => (
                <tr key={entry.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} 
                    onMouseEnter={(e) => e.currentTarget.classList.add('bg-gray-100')}
                    onMouseLeave={(e) => e.currentTarget.classList.remove('bg-gray-100')}>
                  {/* Intrari Data */}
                  <td className="px-2 py-3 text-xs border-r border-blue-100">{entry.data}</td>
                  <td className="px-2 py-3 text-xs border-r border-blue-100">{entry.detalii}</td>
                  <td className="px-2 py-3 text-xs border-r border-blue-100 font-mono text-right">{formatCurrency(entry.sumUpIulian)}</td>
                  <td className="px-2 py-3 text-xs border-r border-blue-100 font-mono text-right">{formatCurrency(entry.stripeIulian)}</td>
                  <td className="px-2 py-3 text-xs border-r border-blue-100 font-mono text-right">{formatCurrency(entry.cashIulian)}</td>
                  <td className="px-2 py-3 text-xs border-r border-blue-100 font-mono text-right">{formatCurrency(entry.caixaJustEnjoy)}</td>
                  <td className="px-2 py-3 text-xs border-r border-blue-100 font-mono text-right">{formatCurrency(entry.sumUpAlin)}</td>
                  <td className="px-2 py-3 text-xs border-r border-blue-100 font-mono text-right">{formatCurrency(entry.stripeAlin)}</td>
                  <td className="px-2 py-3 text-xs border-r border-blue-100 font-mono text-right">{formatCurrency(entry.cashAlin)}</td>
                  
                  {/* Cheltuieli Data */}
                  <td className="px-2 py-3 text-xs border-r border-red-100">{entry.dataCompanie}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* No data message */}
      {!loading && entries.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-md">
          <p className="text-gray-500 mb-2">No entries found</p>
          <p className="text-sm text-gray-400">Add a new entry using the form above</p>
        </div>
      )}
    </div>
  );
};

export default ExpenseTracker;