import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, getDocs, doc, updateDoc, getDoc, deleteDoc, addDoc, onSnapshot, limit, startAfter } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { format } from 'date-fns';
import Papa from 'papaparse';
import _ from 'lodash';
import { 
  Trash2, ChevronDown, ChevronUp, FileText, RefreshCw, Download, 
  Plus, Filter, X, CheckSquare, Calendar, Search,
  Download as DownloadIcon, PieChart
} from 'lucide-react';

const ExpenseOverview = () => {
  // Main state variables
  const [expenses, setExpenses] = useState([]);
  const [filteredExpenses, setFilteredExpenses] = useState([]);
  const [selectedExpenses, setSelectedExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: { count: 0, amount: 0 },
    company: { count: 0, amount: 0 },
    client: { count: 0, amount: 0 },
    invoice: { count: 0, amount: 0 }
  });

  // UI state variables
  const [view, setView] = useState('grid'); // 'grid', 'table'
  const [activeTab, setActiveTab] = useState('all');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState(null);
  const [bulkActionMenuOpen, setBulkActionMenuOpen] = useState(false);

  // Expense operation state
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState(null);
  
  // Pagination state
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastVisibleDoc, setLastVisibleDoc] = useState(null);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [paginationMode] = useState('client'); // 'client' or 'server'

  // Filter states
  const [filterCriteria, setFilterCriteria] = useState({
    query: '',
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: '',
    paymentStatus: 'all', // 'all', 'paid', 'pending'
    categories: [], // selected categories
    hasDocument: null, // true, false, null (all)
    hasBooking: null, // true, false, null (all)
    sortBy: 'date', // 'date', 'amount', 'category'
    sortDirection: 'desc' // 'asc', 'desc'
  });

  // Reference data
  const [categories, setCategories] = useState([]);
  const [bookings, setBookings] = useState([]);

  // Initialize and fetch data
  useEffect(() => {
    fetchExpenses();
    fetchCategories();
    fetchBookings();
  }, []);

  // Listen for real-time updates with strict type checking
  useEffect(() => {
    const expensesRef = collection(db, 'expenses');
    
    // Create the appropriate query based on the pagination mode
    let q;
    if (paginationMode === 'server') {
      // Use server-side pagination
      const baseQuery = query(
        expensesRef, 
        orderBy('timestamp', 'desc'), 
        limit(itemsPerPage)
      );
      q = baseQuery;
    } else {
      // Use client-side pagination (fetch all)
      q = query(expensesRef, orderBy('timestamp', 'desc'));
    }
  
    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      setLoading(true);
      
      try {
        // Map docs to data with strict type validation
        const allExpenses = [];
        const processedIds = new Set(); // Track processed IDs to prevent duplicates
        
        for (const docSnap of querySnapshot.docs) {
          const docData = docSnap.data();
          const docId = docSnap.id;
          
          // Skip if we've already processed this ID
          if (processedIds.has(docId)) continue;
          processedIds.add(docId);
          
          // CRITICAL: Validate expense type
          let expenseType = docData.type;
          
          // Normalize type to lowercase
          if (typeof expenseType === 'string') {
            expenseType = expenseType.toLowerCase();
            
            // Validate it's one of the allowed values
            if (expenseType !== 'company' && expenseType !== 'client' && expenseType !== 'invoice') {
              console.warn(`Expense ${docId} has invalid type '${expenseType}', defaulting to 'company'`);
              expenseType = 'company';
            }
          } else {
            // Default to 'company' if type is missing or invalid
            console.warn(`Expense ${docId} has missing or invalid type, defaulting to 'company'`);
            expenseType = 'company';
          }
          
          allExpenses.push({ 
            id: docId, 
            ...docData,
            type: expenseType, // Use normalized type
            date: docData.date,
            timestamp: docData.timestamp?.toDate().toISOString() || new Date().toISOString()
          });
        }
    
        // Now do the parent/child grouping with type consistency enforcement
        const parentExpenses = allExpenses.filter(exp => !exp.parentId);
        const childExpenses = allExpenses.filter(exp => exp.parentId);
        
        // Ensure child expenses have the same type as their parent
        childExpenses.forEach(child => {
          const parent = parentExpenses.find(p => p.id === child.parentId);
          if (parent && child.type !== parent.type) {
            console.log(`Child expense ${child.id} type '${child.type}' doesn't match parent type '${parent.type}', fixing...`);
            child.type = parent.type;
          }
        });
    
        const groupedExpenses = parentExpenses.map(parent => ({
          ...parent,
          subExpenses: childExpenses.filter(child => child.parentId === parent.id),
        }));
    
        console.log(`Strict Expense Filtering: Loaded ${groupedExpenses.length} expenses with tab '${activeTab}'`);
        setExpenses(groupedExpenses);
        applyFilters(groupedExpenses);
        calculateStats(groupedExpenses);
        
        // Update lastVisibleDoc for server-side pagination
        if (querySnapshot.docs.length > 0) {
          setLastVisibleDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
          setHasMoreData(querySnapshot.docs.length === itemsPerPage);
        } else {
          setHasMoreData(false);
        }
      } catch (error) {
        console.error("Error processing expenses:", error);
      } finally {
        setLoading(false);
      }
    });
  
    // Clean up the listener when unmounting
    return () => unsubscribe();
  }, [itemsPerPage, paginationMode, activeTab]);

  // Calculate statistics for expenses
  const calculateStats = (expensesList) => {
    const stats = {
      total: { count: 0, amount: 0 },
      company: { count: 0, amount: 0 },
      client: { count: 0, amount: 0 },
      invoice: { count: 0, amount: 0 }
    };

    expensesList.forEach(expense => {
      // Calculate the total amount including subexpenses
      const mainAmount = Number(expense.amount) || 0;
      const subExpensesTotal = expense.subExpenses?.reduce(
        (subSum, subExp) => subSum + (Number(subExp.amount) || 0),
        0
      ) || 0;
      const totalAmount = mainAmount + subExpensesTotal;
      
      // Update total stats
      stats.total.count++;
      stats.total.amount += totalAmount;
      
      // Update category stats
      const type = expense.type || 'company';
      stats[type].count++;
      stats[type].amount += totalAmount;
    });

    setStats(stats);
  };

  // Apply filters to expenses with EXTREME STRICTNESS
  const applyFilters = (expensesList = expenses) => {
    let filtered = [...expensesList];
    const {
      query, dateFrom, dateTo, minAmount, maxAmount,
      paymentStatus, categories, hasDocument, hasBooking,
      sortBy, sortDirection
    } = filterCriteria;

    // CRITICAL: Debug expense types before filtering
    console.log("BEFORE FILTERING:", filtered.map(exp => ({id: exp.id, type: exp.type})));

    // ULTRA STRICT RULE: Filter by active tab first with exact type matching
    if (activeTab !== 'all') {
      // Before filtering, log the current tab and what we're looking for
      console.log(`APPLYING ULTRA STRICT TAB FILTER: Looking for expenses with type='${activeTab}' exactly`);
      
      filtered = filtered.filter(expense => {
        // Use strict equality to ensure exact type matching
        const isMatch = expense.type === activeTab;
        
        // If it doesn't match, log it for debugging
        if (!isMatch) {
          console.log(`FILTERED OUT: Expense ID ${expense.id} with type='${expense.type}' doesn't match tab='${activeTab}'`);
        }
        
        return isMatch;
      });
      
      console.log(`AFTER TAB FILTERING: Found ${filtered.length} expenses with exact type '${activeTab}'`);
    }

    // Filter by search query
    if (query) {
      const searchTerm = query.toLowerCase();
      filtered = filtered.filter(expense =>
        expense.category?.toLowerCase().includes(searchTerm) ||
        expense.description?.toLowerCase().includes(searchTerm) ||
        expense.bookingData?.bookingDetails?.boatName?.toLowerCase().includes(searchTerm) ||
        expense.bookingData?.clientDetails?.name?.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by date range
    if (dateFrom) {
      filtered = filtered.filter(expense => expense.date >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter(expense => expense.date <= dateTo);
    }

    // Filter by amount range
    if (minAmount) {
      filtered = filtered.filter(expense => Number(expense.amount) >= Number(minAmount));
    }
    if (maxAmount) {
      filtered = filtered.filter(expense => Number(expense.amount) <= Number(maxAmount));
    }

    // Filter by payment status
    if (paymentStatus !== 'all') {
      filtered = filtered.filter(expense => expense.paymentStatus === paymentStatus);
    }

    // Filter by categories
    if (categories.length > 0) {
      filtered = filtered.filter(expense => categories.includes(expense.category));
    }

    // Filter by document presence
    if (hasDocument !== null) {
      filtered = filtered.filter(expense => 
        (hasDocument && expense.imageURL) || (!hasDocument && !expense.imageURL)
      );
    }

    // Filter by booking presence
    if (hasBooking !== null) {
      filtered = filtered.filter(expense => 
        (hasBooking && expense.bookingId) || (!hasBooking && !expense.bookingId)
      );
    }

    // Sort expenses
    filtered = _.orderBy(
      filtered, 
      [expense => {
        if (sortBy === 'date') return new Date(expense.date);
        if (sortBy === 'amount') return Number(expense.amount);
        return expense[sortBy];
      }], 
      [sortDirection]
    );

    setFilteredExpenses(filtered);
    
    // Reset to first page when filters change
    if (paginationMode === 'client') {
      setCurrentPage(1);
    }
  };
  
  // Fetch expenses from Firebase with additional validation
  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const expensesRef = collection(db, 'expenses');
      const q = query(expensesRef, orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      
      // Process all expenses with type validation
      const allExpenses = await Promise.all(
        querySnapshot.docs.map(async (doc) => {
          const docData = doc.data();
          const expenseId = doc.id;
          
          // CRITICAL: Validate and normalize expense type
          let expenseType = docData.type;
          
          // Force lowercase type for consistency and debugging
          if (typeof expenseType === 'string') {
            const originalType = expenseType;
            expenseType = expenseType.toLowerCase();
            
            // If we had to normalize, log it
            if (expenseType !== originalType) {
              console.log(`TYPE NORMALIZED: Expense ${expenseId} type changed from '${originalType}' to '${expenseType}'`);
              
              // Update the database to normalize the type
              try {
                await updateDoc(doc.ref, { type: expenseType });
                console.log(`DATABASE UPDATED: Expense ${expenseId} type normalized in database`);
              } catch (err) {
                console.error("Failed to update expense type in database:", err);
              }
            }
          }
          
          // Validate expense has a valid type or default to company
          if (!expenseType || (expenseType !== 'company' && expenseType !== 'client' && expenseType !== 'invoice')) {
            console.warn(`INVALID TYPE: Expense ${expenseId} has invalid type '${expenseType}', defaulting to 'company'`);
            expenseType = 'company';
            
            // Update the database with the default type
            try {
              await updateDoc(doc.ref, { type: expenseType });
              console.log(`DATABASE UPDATED: Expense ${expenseId} given default type 'company'`);
            } catch (err) {
              console.error("Failed to update expense type in database:", err);
            }
          }
          
          // Log for debugging
          console.log(`EXPENSE LOADED: ID=${expenseId}, type=${expenseType}`);
          
          const expense = {
            id: expenseId,
            ...docData,
            type: expenseType, // Use the validated type
            date: docData.date,
            timestamp: docData.timestamp?.toDate().toISOString() || new Date().toISOString()
          };
          
          // Fetch associated booking data if available
          if (expense.bookingId) {
            const bookingData = await fetchBookingData(expense);
            
            // If linked to booking, ensure it's a client expense
            if (bookingData && expense.type !== 'client') {
              console.warn(`TYPE MISMATCH: Expense ${expenseId} has booking but type is '${expense.type}' not 'client'`);
              expense.type = 'client';
              
              // Update the database to fix the type
              try {
                await updateDoc(doc.ref, { type: 'client' });
                console.log(`DATABASE UPDATED: Expense ${expenseId} type corrected to 'client' (has booking)`);
              } catch (err) {
                console.error("Failed to update expense type in database:", err);
              }
            }
            
            return { ...expense, bookingData };
          }
          
          return expense;
        })
      );
  
      // Group expenses into parent-child relationships
      const parentExpenses = allExpenses.filter(exp => !exp.parentId);
      const childExpenses = allExpenses.filter(exp => exp.parentId);
  
      // Validate child expense types match their parents
      for (const child of childExpenses) {
        const parentId = child.parentId;
        const parent = parentExpenses.find(p => p.id === parentId);
        
        if (parent && child.type !== parent.type) {
          console.warn(`TYPE MISMATCH: Child expense ${child.id} has type '${child.type}' but parent ${parentId} has type '${parent.type}'`);
          
          // Force child to match parent type
          child.type = parent.type;
          
          // Update in database
          try {
            await updateDoc(doc(db, 'expenses', child.id), { type: parent.type });
            console.log(`DATABASE UPDATED: Child expense ${child.id} type corrected to match parent: '${parent.type}'`);
          } catch (err) {
            console.error("Failed to update child expense type in database:", err);
          }
        }
      }
  
      const groupedExpenses = parentExpenses.map(parent => {
        const children = childExpenses.filter(child => child.parentId === parent.id);
        if (children.length > 0) {
          return {
            ...parent,
            subExpenses: children,
            totalAmount: children.reduce((sum, child) => sum + Number(child.amount), Number(parent.amount))
          };
        }
        return { ...parent, subExpenses: [] };
      });
      
      // Log types for debugging
      console.log("EXPENSE TYPES CHECK: ", groupedExpenses.map(exp => ({
        id: exp.id,
        type: exp.type,
        children: exp.subExpenses?.map(sub => ({id: sub.id, type: sub.type}))
      })));
  
      setExpenses(groupedExpenses);
      
      // Apply strict filtering based on current active tab
      console.log(`STRICT TAB FILTERING: Current active tab is '${activeTab}'`);
      applyFilters(groupedExpenses);
      
      calculateStats(groupedExpenses);
      
      // Set up pagination - handled in the component
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      setLoading(false);
    }
  };

  // Fetch booking data for an expense
  const fetchBookingData = async (expense) => {
    try {
      if (!expense.bookingId) {
        return null;
      }
      const bookingRef = doc(db, 'bookings', expense.bookingId);
      const bookingSnap = await getDoc(bookingRef);

      if (bookingSnap.exists()) {
        return bookingSnap.data();
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error fetching booking data', error);
      return null;
    }
  };

  // Fetch categories for filtering
  const fetchCategories = async () => {
    try {
      // This could be a separate collection, or extracted from expenses
      const expensesRef = collection(db, 'expenses');
      const querySnapshot = await getDocs(expensesRef);
      
      // Extract unique categories
      const uniqueCategories = new Set();
      querySnapshot.docs.forEach(doc => {
        const category = doc.data().category;
        if (category) uniqueCategories.add(category);
      });
      
      setCategories(Array.from(uniqueCategories));
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // Fetch bookings for expense association
  const fetchBookings = async () => {
    try {
      const bookingsRef = collection(db, 'bookings');
      const q = query(bookingsRef, orderBy('bookingDetails.date', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const bookingsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setBookings(bookingsData);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
  };

  // Load next page for server-side pagination
  const loadNextPage = async () => {
    if (!hasMoreData || !lastVisibleDoc) return;
    
    setLoading(true);
    try {
      const expensesRef = collection(db, 'expenses');
      const q = query(
        expensesRef,
        orderBy('timestamp', 'desc'),
        startAfter(lastVisibleDoc),
        limit(itemsPerPage)
      );
      
      const querySnapshot = await getDocs(q);
      
      // Process the new page of expenses
      const newExpenses = await Promise.all(
        querySnapshot.docs.map(async (doc) => {
          const expenseData = {
            id: doc.id,
            ...doc.data(),
            date: doc.data().date,
            timestamp: doc.data().timestamp?.toDate().toISOString() || new Date().toISOString()
          };
          
          if (expenseData.bookingId) {
            const bookingData = await fetchBookingData(expenseData);
            return { ...expenseData, bookingData };
          }
          
          return expenseData;
        })
      );
      
      // Update the last visible document for pagination
      if (querySnapshot.docs.length > 0) {
        setLastVisibleDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
        setHasMoreData(querySnapshot.docs.length === itemsPerPage);
      } else {
        setHasMoreData(false);
      }
      
      // Append the new expenses to the existing ones
      setExpenses(prev => [...prev, ...newExpenses]);
      setCurrentPage(prev => prev + 1);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading next page:', error);
      setLoading(false);
    }
  };

  // Handle payment status update
  const handleUpdatePaymentStatus = async (expenseId, currentStatus) => {
    // Save expanded rows state
    const oldExpanded = new Set(expandedRows);
    setUpdatingStatus(expenseId);
    
    const newStatus = currentStatus === 'pending' ? 'paid' : 'pending';
  
    try {
      const expenseRef = doc(db, 'expenses', expenseId);
      await updateDoc(expenseRef, { paymentStatus: newStatus });
  
      // Update local state
      setExpenses((prevExpenses) => {
        const updatedExpenses = prevExpenses.map((expense) => {
          if (expense.id === expenseId) {
            return { ...expense, paymentStatus: newStatus };
          }
          
          if (expense.subExpenses) {
            const updatedSubs = expense.subExpenses.map((sub) =>
              sub.id === expenseId ? { ...sub, paymentStatus: newStatus } : sub
            );
            return { ...expense, subExpenses: updatedSubs };
          }
          
          return expense;
        });
        
        // Reapply filters to the updated expenses
        applyFilters(updatedExpenses);
        return updatedExpenses;
      });
      
      // Restore expanded rows
      setExpandedRows(oldExpanded);
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('Failed to update payment status. Please try again.');
    } finally {
      setUpdatingStatus(null);
    }
  };
  
  // Handle expense deletion
  const handleDeleteExpense = async (expenseId) => {
    if (window.confirm('Are you sure you want to delete this expense? This action cannot be undone.')) {
      setDeletingExpenseId(expenseId);
      
      try {
        const expenseRef = doc(db, 'expenses', expenseId);
  
        // Update local state first for immediate UI feedback
        setExpenses(prevExpenses => {
          const updatedExpenses = prevExpenses.map(expense => {
            if (expense.subExpenses) {
              return {
                ...expense,
                subExpenses: expense.subExpenses.filter(sub => sub.id !== expenseId),
                totalAmount: expense.subExpenses
                  .filter(sub => sub.id !== expenseId)
                  .reduce((sum, sub) => sum + Number(sub.amount), Number(expense.amount))
              };
            }
            return expense;
          }).filter(expense => expense.id !== expenseId);
  
          // Recalculate totals and reapply filters
          calculateStats(updatedExpenses);
          applyFilters(updatedExpenses);
          return updatedExpenses;
        });
  
        // Perform the deletion in Firestore
        await deleteDoc(expenseRef);
  
        // If it was a sub-expense, update the parent
        const parentExpense = expenses.find(exp => 
          exp.subExpenses?.some(sub => sub.id === expenseId)
        );
  
        if (parentExpense) {
          const updatedSubExpenses = parentExpense.subExpenses.filter(sub => sub.id !== expenseId);
          const newTotal = updatedSubExpenses.reduce(
            (sum, sub) => sum + Number(sub.amount),
            Number(parentExpense.amount)
          );
  
          await updateDoc(doc(db, 'expenses', parentExpense.id), {
            subExpenses: updatedSubExpenses,
            totalAmount: newTotal
          });
        }
  
        alert("Expense deleted successfully");
      } catch (error) {
        console.error('Error deleting expense:', error);
        alert("Failed to delete expense. Please try again.");
        await fetchExpenses();
      } finally {
        setDeletingExpenseId(null);
      }
    }
  };
  
  // Handle bulk deletion
  const handleBulkDelete = async () => {
    if (selectedExpenses.length === 0) {
      alert('No expenses selected');
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete ${selectedExpenses.length} expenses? This action cannot be undone.`)) {
      setLoading(true);
      
      try {
        // Delete each selected expense
        for (const expenseId of selectedExpenses) {
          await deleteDoc(doc(db, 'expenses', expenseId));
        }
        
        // Update local state
        setExpenses(prev => prev.filter(exp => !selectedExpenses.includes(exp.id)));
        setSelectedExpenses([]);
        alert(`${selectedExpenses.length} expenses deleted successfully`);
        await fetchExpenses();
      } catch (error) {
        console.error('Error performing bulk delete:', error);
        alert('Failed to delete some expenses. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };
  
  // Handle bulk status update
  const handleBulkStatusUpdate = async (newStatus) => {
    if (selectedExpenses.length === 0) {
      alert('No expenses selected');
      return;
    }
    
    setLoading(true);
    
    try {
      // Update each selected expense
      for (const expenseId of selectedExpenses) {
        await updateDoc(doc(db, 'expenses', expenseId), { paymentStatus: newStatus });
      }
      
      // Update local state
      setExpenses(prev => 
        prev.map(expense => {
          if (selectedExpenses.includes(expense.id)) {
            return { ...expense, paymentStatus: newStatus };
          }
          
          // Also check subexpenses
          if (expense.subExpenses) {
            const updatedSubs = expense.subExpenses.map(sub => 
              selectedExpenses.includes(sub.id) ? { ...sub, paymentStatus: newStatus } : sub
            );
            return { ...expense, subExpenses: updatedSubs };
          }
          
          return expense;
        })
      );
      
      alert(`${selectedExpenses.length} expenses updated to ${newStatus}`);
      setSelectedExpenses([]);
    } catch (error) {
      console.error('Error performing bulk status update:', error);
      alert('Failed to update some expenses. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle adding an expense
  // Modified handleAddExpense function to prevent duplicates
const handleAddExpense = async (expenseData, parentId = null) => {
  try {
    // VALIDATION: Require expense type to be explicitly set
    if (!expenseData.type) {
      alert('Error: Expense type must be explicitly set (company, client, or invoice)');
      setLoading(false);
      return;
    }
    
    // Normalize type to lowercase
    const normalizedType = expenseData.type.toLowerCase();
    
    // Validate type is one of the allowed values
    if (normalizedType !== 'company' && normalizedType !== 'client' && normalizedType !== 'invoice') {
      alert(`Error: Invalid expense type '${normalizedType}'. Must be 'company', 'client', or 'invoice'`);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const expenseRef = collection(db, 'expenses');
    
    // STRICT RULE: Force expense type based on booking presence
    let finalExpenseType = normalizedType;
    
    // If a booking is linked, it MUST be a client expense
    if (expenseData.bookingId && finalExpenseType !== 'client') {
      finalExpenseType = 'client';
      console.log("STRICT TYPE CHANGE: Booking is linked, forcing type to 'client'");
    }
    
    // For parent/child consistency, ensure child matches parent type
    if (parentId) {
      const parentDoc = await getDoc(doc(db, 'expenses', parentId));
      if (parentDoc.exists()) {
        const parentType = parentDoc.data().type;
        
        if (finalExpenseType !== parentType) {
          finalExpenseType = parentType;
          console.log(`STRICT TYPE CHANGE: Sub-expense must match parent type '${parentType}'`);
        }
      }
    }
    
    const newExpense = {
      ...expenseData,
      type: finalExpenseType, // Use strictly enforced type
      timestamp: new Date(),
      paymentStatus: 'pending',
      parentId: parentId || null,
      amount: Number(expenseData.amount) || 0,
    };
    
    console.log("STRICT EXPENSE CREATION: Creating expense with type:", newExpense.type);

    const docRef = await addDoc(expenseRef, newExpense);
    
    // Update parent doc in Firestore if this is a sub-expense
    if (parentId) {
      const parentExpense = expenses.find((e) => e.id === parentId);
      if (parentExpense) {
        const updatedSubExpenses = [
          ...(parentExpense.subExpenses || []),
          {
            id: docRef.id,
            amount: Number(newExpense.amount),
            bookingId: expenseData.bookingId,
          },
        ];
        
        const totalAmount = updatedSubExpenses.reduce(
          (sum, sub) => sum + Number(sub.amount),
          Number(parentExpense.amount)
        );

        await updateDoc(doc(db, 'expenses', parentId), {
          totalAmount,
          subExpenses: updatedSubExpenses,
        });
      }
    }

    setIsAddExpenseModalOpen(false);
    setSelectedParentId(null);
    alert('Expense added successfully!');
    
    // We're NOT manually updating the state here anymore
    // The onSnapshot listener will handle state updates automatically
    
  } catch (error) {
    console.error('Error adding expense:', error);
    alert('Failed to add expense. Please try again.');
  } finally {
    setLoading(false);
  }
};
  
  // Handle document viewing
  const handleViewDocument = (url) => {
    if (!url) {
      alert('No document available to view');
      return;
    }
  
    // Open the document in a new tab
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  
  // Handle document download
  const downloadDocument = async (url, fileName = 'document') => {
    if (!url) {
      alert('No document available to download');
      return;
    }
  
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading the document:', error);
      alert('Failed to download the document. Please try again.');
    }
  };
  
  // Export data as CSV
  const downloadCSV = () => {
    const expensesToExport = filteredExpenses;
    
    // Flatten the data for CSV export (including sub-expenses)
    const flattenedExpenses = [];
    
    expensesToExport.forEach(expense => {
      // Add main expense
      flattenedExpenses.push({
        Date: format(new Date(expense.date), 'dd/MM/yyyy'),
        Type: expense.type,
        Category: expense.category,
        Description: expense.description,
        Amount: expense.amount,
        'Payment Status': expense.paymentStatus || 'N/A',
        'Payment Method': expense.paymentMethod || 'N/A',
        'Boat Name': expense.bookingData?.bookingDetails?.boatName || 'N/A',
        'Booking Date': expense.bookingData?.bookingDetails?.date ? 
          format(new Date(expense.bookingData.bookingDetails.date), 'dd/MM/yyyy') : 'N/A',
        'Client Name': expense.bookingData?.clientDetails?.name || 'N/A',
        'Invoice Number': expense.invoiceNumber || 'N/A',
        'IsSubExpense': 'No',
        'Parent Description': '',
      });
      
      // Add sub-expenses
      if (expense.subExpenses && expense.subExpenses.length > 0) {
        expense.subExpenses.forEach(sub => {
          flattenedExpenses.push({
            Date: format(new Date(sub.date), 'dd/MM/yyyy'),
            Type: sub.type || expense.type,
            Category: sub.category,
            Description: sub.description,
            Amount: sub.amount,
            'Payment Status': sub.paymentStatus || 'N/A',
            'Payment Method': sub.paymentMethod || 'N/A',
            'Boat Name': sub.bookingData?.bookingDetails?.boatName || 
              expense.bookingData?.bookingDetails?.boatName || 'N/A',
            'Booking Date': sub.bookingData?.bookingDetails?.date ? 
              format(new Date(sub.bookingData.bookingDetails.date), 'dd/MM/yyyy') : 
              (expense.bookingData?.bookingDetails?.date ? 
                format(new Date(expense.bookingData.bookingDetails.date), 'dd/MM/yyyy') : 'N/A'),
            'Client Name': sub.bookingData?.clientDetails?.name || 
              expense.bookingData?.clientDetails?.name || 'N/A',
            'Invoice Number': sub.invoiceNumber || 'N/A',
            'IsSubExpense': 'Yes',
            'Parent Description': expense.description,
          });
        });
      }
    });

    const csv = Papa.unparse(flattenedExpenses);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `expenses_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Toggle row expansion
  const toggleRowExpansion = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };
  
  // Handle expense selection for bulk actions
  const handleExpenseSelection = (expenseId, isSelected) => {
    if (isSelected) {
      setSelectedExpenses(prev => [...prev, expenseId]);
    } else {
      setSelectedExpenses(prev => prev.filter(id => id !== expenseId));
    }
  };
  
  // Select all expenses currently visible
  const handleSelectAll = (isSelected) => {
    if (isSelected) {
      // Get IDs of all expenses currently visible (considering pagination)
      const currentPageExpenses = paginateData(filteredExpenses, currentPage, itemsPerPage);
      const ids = currentPageExpenses.map(exp => exp.id);
      setSelectedExpenses(ids);
    } else {
      setSelectedExpenses([]);
    }
  };
  
  // Reset all filters to default values
  const handleClearFilters = () => {
    setFilterCriteria({
      query: '',
      dateFrom: '',
      dateTo: '',
      minAmount: '',
      maxAmount: '',
      paymentStatus: 'all',
      categories: [],
      hasDocument: null,
      hasBooking: null, 
      sortBy: 'date',
      sortDirection: 'desc'
    });
    
    // Reapply filters with the reset criteria
    applyFilters(expenses);
  };
  
  // Apply the current filter settings
  const handleApplyFilters = () => {
    applyFilters(expenses);
    setIsFilterDrawerOpen(false);
  };
  
  // Get paginated data
  const paginateData = (items, currentPage, itemsPerPage) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return items.slice(startIndex, startIndex + itemsPerPage);
  };
  
  // Calculate the total amount for an expense including sub-expenses
  const calculateTotalAmount = (expense) => {
    const mainAmount = Number(expense.amount) || 0;
    const subExpensesTotal = expense.subExpenses?.reduce(
      (sum, subExp) => sum + Number(subExp.amount), 0
    ) || 0;
    return mainAmount + subExpensesTotal;
  };
  
  // Get expenses for current page based on pagination mode
  const currentPageExpenses = useMemo(() => {
    if (paginationMode === 'client') {
      return paginateData(filteredExpenses, currentPage, itemsPerPage);
    } else {
      // For server-side pagination, we already have the current page data
      return filteredExpenses;
    }
  }, [filteredExpenses, currentPage, itemsPerPage, paginationMode]);
  
  // Change page in pagination
  const handlePageChange = (newPage) => {
    if (paginationMode === 'client') {
      // For client-side pagination, just update the page
      setCurrentPage(newPage);
    } else {
      // For server-side pagination, need to fetch data
      if (newPage > currentPage) {
        loadNextPage();
      } else if (newPage < currentPage) {
        // Going back to previous pages might require refetching from the beginning
        fetchExpenses();
        setCurrentPage(1);
      }
    }
  };
  
  // Check if all currently visible expenses are selected
  const areAllSelected = useMemo(() => {
    const currentPageIds = currentPageExpenses.map(exp => exp.id);
    return currentPageIds.length > 0 && 
      currentPageIds.every(id => selectedExpenses.includes(id));
  }, [currentPageExpenses, selectedExpenses]);

  // Loading component
  const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>
  );
  
  // Pagination component
  const Pagination = ({ 
    totalItems, 
    itemsPerPage, 
    currentPage, 
    onPageChange,
    hasMore,
    paginationMode 
  }) => {
    // Handle different pagination modes
    if (paginationMode === 'client') {
      const calculatedTotalPages = Math.ceil(totalItems / itemsPerPage);
      if (calculatedTotalPages <= 1) return null;
    } else {
      // For server-side pagination, we don't know the total pages
      if (!hasMore && currentPage === 1) return null;
    }

    return (
      <div className="flex justify-between items-center mt-4 mb-6 px-4">
        <div className="flex items-center space-x-2">
          <select 
            value={itemsPerPage}
            onChange={(e) => {
              const newItemsPerPage = Number(e.target.value);
              setItemsPerPage(newItemsPerPage);
              setCurrentPage(1);
            }}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
          
          <span className="text-sm text-gray-600">
            {paginationMode === 'client' 
              ? `Showing ${(currentPage - 1) * itemsPerPage + 1} to ${Math.min(currentPage * itemsPerPage, totalItems)} of ${totalItems} expenses`
              : `Page ${currentPage}`
            }
          </span>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded bg-white border border-gray-300 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          
          {paginationMode === 'client' && (
            <span className="text-sm text-gray-600 flex items-center">
              Page {currentPage} of {Math.ceil(totalItems / itemsPerPage)}
            </span>
          )}

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={paginationMode === 'client' 
              ? currentPage >= Math.ceil(totalItems / itemsPerPage) 
              : !hasMore}
            className="px-3 py-1 rounded bg-white border border-gray-300 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  // Component for the filter drawer
  const FilterDrawer = ({ isOpen, onClose, onApply }) => {
    const [localFilters, setLocalFilters] = useState({
      query: '',
      dateFrom: '',
      dateTo: '',
      minAmount: '',
      maxAmount: '',
      paymentStatus: 'all',
      categories: [],
      hasDocument: null,
      hasBooking: null,
      sortBy: 'date',
      sortDirection: 'desc'
    });
    
    // Reset local filters when drawer opens
    useEffect(() => {
      if (isOpen) {
        setLocalFilters(filterCriteria);
      }
    }, [isOpen]);
    
    if (!isOpen) return null;
    
    return (
      <div className="fixed inset-0 z-50 overflow-hidden">
        <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
        
        <div className="absolute top-0 right-0 bottom-0 w-full md:w-96 bg-white shadow-lg transform transition-transform duration-300">
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Advanced Filters</h3>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Type Filter - Don't include in filter drawer */}
              {/* Removed expenseType filter to avoid conflict with tabs */}
              
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500">From</label>
                    <input
                      type="date"
                      value={localFilters.dateFrom}
                      onChange={(e) => setLocalFilters({...localFilters, dateFrom: e.target.value})}
                      className="w-full rounded-md border border-gray-300 shadow-sm p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">To</label>
                    <input
                      type="date"
                      value={localFilters.dateTo}
                      onChange={(e) => setLocalFilters({...localFilters, dateTo: e.target.value})}
                      className="w-full rounded-md border border-gray-300 shadow-sm p-2"
                    />
                  </div>
                </div>
              </div>
              
              {/* Amount Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500">Min (€)</label>
                    <input
                      type="number"
                      value={localFilters.minAmount}
                      onChange={(e) => setLocalFilters({...localFilters, minAmount: e.target.value})}
                      className="w-full rounded-md border border-gray-300 shadow-sm p-2"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Max (€)</label>
                    <input
                      type="number"
                      value={localFilters.maxAmount}
                      onChange={(e) => setLocalFilters({...localFilters, maxAmount: e.target.value})}
                      className="w-full rounded-md border border-gray-300 shadow-sm p-2"
                      placeholder="Any"
                    />
                  </div>
                </div>
              </div>
              
              {/* Payment Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status</label>
                <select
                  value={localFilters.paymentStatus}
                  onChange={(e) => setLocalFilters({...localFilters, paymentStatus: e.target.value})}
                  className="w-full rounded-md border border-gray-300 shadow-sm p-2"
                >
                  <option value="all">All Statuses</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              
              {/* Categories - Multi Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categories</label>
                <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
                  {categories.map(category => (
                    <div key={category} className="flex items-center mb-1">
                      <input
                        type="checkbox"
                        id={`category-${category}`}
                        checked={localFilters.categories.includes(category)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setLocalFilters({
                              ...localFilters, 
                              categories: [...localFilters.categories, category]
                            });
                          } else {
                            setLocalFilters({
                              ...localFilters,
                              categories: localFilters.categories.filter(c => c !== category)
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <label htmlFor={`category-${category}`} className="text-sm">
                        {category}
                      </label>
                    </div>
                  ))}
                  {categories.length === 0 && (
                    <div className="text-sm text-gray-500 py-2">No categories available</div>
                  )}
                </div>
              </div>
              
              {/* Has Document */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Document Status</label>
                <select
                  value={localFilters.hasDocument === null ? 'all' : (localFilters.hasDocument ? 'yes' : 'no')}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLocalFilters({
                      ...localFilters, 
                      hasDocument: val === 'all' ? null : (val === 'yes')
                    });
                  }}
                  className="w-full rounded-md border border-gray-300 shadow-sm p-2"
                >
                  <option value="all">All</option>
                  <option value="yes">Has Document</option>
                  <option value="no">No Document</option>
                </select>
              </div>
              
              {/* Has Booking */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Booking Status</label>
                <select
                  value={localFilters.hasBooking === null ? 'all' : (localFilters.hasBooking ? 'yes' : 'no')}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLocalFilters({
                      ...localFilters, 
                      hasBooking: val === 'all' ? null : (val === 'yes')
                    });
                  }}
                  className="w-full rounded-md border border-gray-300 shadow-sm p-2"
                >
                  <option value="all">All</option>
                  <option value="yes">Linked to Booking</option>
                  <option value="no">Not Linked</option>
                </select>
              </div>
              
              {/* Sort Options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <div className="flex space-x-2">
                  <select
                    value={localFilters.sortBy}
                    onChange={(e) => setLocalFilters({...localFilters, sortBy: e.target.value})}
                    className="flex-1 rounded-md border border-gray-300 shadow-sm p-2"
                  >
                    <option value="date">Date</option>
                    <option value="amount">Amount</option>
                    <option value="category">Category</option>
                    <option value="description">Description</option>
                  </select>
                  <select
                    value={localFilters.sortDirection}
                    onChange={(e) => setLocalFilters({...localFilters, sortDirection: e.target.value})}
                    className="w-24 rounded-md border border-gray-300 shadow-sm p-2"
                  >
                    <option value="asc">Asc</option>
                    <option value="desc">Desc</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 flex justify-between">
              <button
                onClick={() => {
                  setLocalFilters({
                    query: '',
                    dateFrom: '',
                    dateTo: '',
                    minAmount: '',
                    maxAmount: '',
                    paymentStatus: 'all',
                    categories: [],
                    hasDocument: null,
                    hasBooking: null,
                    expenseType: 'all',
                    sortBy: 'date',
                    sortDirection: 'desc'
                  });
                }}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Reset
              </button>
              <div className="space-x-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setFilterCriteria(localFilters);
                    onApply();
                  }}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Component for the add expense modal
  const AddExpenseModal = ({ isOpen, onClose, onSubmit, parentExpenseId = null }) => {
    // STRICT RULE: Initialize with required type based on current tab
    // Default to the active tab or force to "company" if all tabs are shown
    const initialType = activeTab !== 'all' ? activeTab : 'company';
    
    const [newExpense, setNewExpense] = useState({
      amount: '',
      description: '',
      category: '',
      type: parentExpenseId ? (activeTab !== 'all' ? activeTab : 'client') : initialType, // Strict type setting
      date: new Date().toISOString().split('T')[0],
      imageURL: '',
      bookingId: ''
    });
    const [isLoadingBookings] = useState(false);

    // Reset form when modal opens
    useEffect(() => {
      if (isOpen) {
        // STRICT RULE: Always reset with the current active tab type for consistency
        const strictType = activeTab !== 'all' ? activeTab : 'company';
        
        setNewExpense({
          amount: '',
          description: '',
          category: '',
          type: parentExpenseId ? (activeTab !== 'all' ? activeTab : 'client') : strictType,
          date: new Date().toISOString().split('T')[0],
          imageURL: '',
          bookingId: ''
        });
        
        console.log("STRICT MODAL RESET: Setting initial expense type to:", 
          parentExpenseId ? (activeTab !== 'all' ? activeTab : 'client') : strictType);
      }
    }, [isOpen, parentExpenseId, activeTab]);

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <h3 className="text-lg font-semibold mb-4">
            {parentExpenseId ? 'Add Sub-expense' : 'Add New Expense'}
          </h3>
          <div className="space-y-4">
            {/* Expense Type (only for main expenses) - CRITICAL FIELD */}
            {!parentExpenseId && (
              <div className="border-2 border-blue-200 p-4 rounded-lg mb-4 bg-blue-50">
                <label className="block text-sm font-bold text-gray-700">
                  Expense Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={newExpense.type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    // If changing to non-client type, clear any booking selection
                    if (newType !== 'client' && newExpense.bookingId) {
                      if (confirm("Changing to a non-client expense type will remove the booking link. Continue?")) {
                        setNewExpense({...newExpense, type: newType, bookingId: ''});
                      }
                    } else {
                      setNewExpense({...newExpense, type: newType});
                    }
                    console.log("STRICT TYPE CHANGE: Type changed to", newType);
                  }}
                  className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                >
                  <option value="company">Company Expense</option>
                  <option value="client">Client Expense</option>
                  <option value="invoice">Invoice</option>
                </select>
                <p className="mt-2 text-sm font-medium text-blue-700">
                  This expense will be added to the <span className="underline">{newExpense.type}</span> category
                </p>
                {activeTab !== 'all' && activeTab !== newExpense.type && (
                  <div className="mt-2 p-2 bg-yellow-100 text-yellow-800 rounded-md">
                    <strong>Warning:</strong> This expense will not appear in the current tab 
                    ({activeTab}) after being added.
                  </div>
                )}
              </div>
            )}
            
            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Amount</label>
              <input
                type="number"
                value={newExpense.amount}
                onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            
              {/* Booking Selection - Links directly to Client expenses */}
            <div className={`${newExpense.type === 'client' ? 'border-2 border-green-200 p-4 rounded-lg bg-green-50' : ''}`}>
              <label className="block text-sm font-medium text-gray-700">Link to Booking (Only for Client Expenses)</label>
              <select
                value={newExpense.bookingId}
                onChange={(e) => {
                  const bookingId = e.target.value;
                  
                  // STRICT RULE: Booking selection forces client expense type
                  if (bookingId) {
                    if (newExpense.type !== 'client') {
                      console.log("STRICT TYPE ENFORCEMENT: Booking selected, changing type to client");
                      setNewExpense({
                        ...newExpense, 
                        bookingId: bookingId,
                        type: 'client' // Force client type when booking is selected
                      });
                    } else {
                      setNewExpense({...newExpense, bookingId: bookingId});
                    }
                  } else {
                    // Just update booking ID if cleared
                    setNewExpense({...newExpense, bookingId: bookingId});
                  }
                }}
                className={`mt-2 block w-full rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 
                  ${newExpense.type !== 'client' ? 'border-gray-300 bg-gray-100 text-gray-500' : 'border-gray-300'}`}
                disabled={newExpense.type !== 'client' || isLoadingBookings}
              >
                <option value="">Select a booking</option>
                {bookings.map(booking => (
                  <option key={booking.id} value={booking.id}>
                    {booking.bookingDetails?.boatName || 'Unnamed boat'} - 
                    {booking.clientDetails?.name || 'Unnamed client'} - 
                    {booking.bookingDetails?.date ? 
                      format(new Date(booking.bookingDetails.date), 'dd/MM/yyyy') : 
                      'No date'
                    }
                  </option>
                ))}
              </select>
              {isLoadingBookings && (
                <div className="mt-1 text-sm text-gray-500">Loading bookings...</div>
              )}
              {newExpense.type !== 'client' && (
                <p className="mt-2 text-sm text-gray-500">
                  Booking selection is only available for client expenses
                </p>
              )}
              {newExpense.bookingId && (
                <p className="mt-2 text-sm font-medium text-green-700">
                  ✓ This expense is linked to a booking and will appear in the client tab
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <input
                type="text"
                value={newExpense.description}
                onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <input
                type="text"
                value={newExpense.category}
                onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                list="categories-list"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <datalist id="categories-list">
                {categories.map(category => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
            
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                value={newExpense.date}
                onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            
            {/* Document URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Document URL (optional)</label>
              <input
                type="text"
                value={newExpense.imageURL}
                onChange={(e) => setNewExpense({...newExpense, imageURL: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onSubmit(newExpense, parentExpenseId);
                }}
                disabled={!newExpense.amount || !newExpense.description}
                className={`px-4 py-2 text-sm font-medium text-white ${
                  !newExpense.amount || !newExpense.description 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'
                } rounded-md`}
              >
                Add Expense
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Component for the expense table view
  const ExpenseTable = ({ expenses, onDelete, onAddSubExpense, onUpdateStatus, onSelect }) => {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="w-8 px-4 py-3">
                <input
                  type="checkbox"
                  checked={areAllSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Document
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {expenses.map((expense) => (
              <ExpenseTableRow
                key={expense.id}
                expense={expense}
                onDelete={onDelete}
                onAddSubExpense={onAddSubExpense}
                onUpdateStatus={onUpdateStatus}
                onSelect={onSelect}
                isSelected={selectedExpenses.includes(expense.id)}
              />
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                  No expenses found that match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };
  
  // Component for a row in the expense table
  const ExpenseTableRow = ({
    expense,
    onDelete,
    onAddSubExpense,
    onUpdateStatus,
    onSelect,
    isSelected,
    isSubExpense = false
  }) => {
    const hasSubExpenses = expense.subExpenses?.length > 0;
    const isExpanded = expandedRows.has(expense.id);
    
    // Get appropriate color based on expense type for visual distinction
    const getTypeColor = (type) => {
      switch(type) {
        case 'company': return 'border-l-4 border-blue-500';
        case 'client': return 'border-l-4 border-green-500';
        case 'invoice': return 'border-l-4 border-purple-500';
        default: return '';
      }
    };
    
    const typeColor = !isSubExpense ? getTypeColor(expense.type) : '';
  
    return (
      <>
        <tr
          className={`
            hover:bg-gray-50
            ${typeColor}
            ${isSubExpense
              ? 'bg-gray-50 border-l-4 border-gray-300'
              : ''}
          `}
        >
          <td className="w-8 px-4 py-4">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelect(expense.id, e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </td>
          <td
            className={`
              px-4 py-4 whitespace-nowrap
              ${isSubExpense ? 'pl-8' : ''}
            `}
          >
            {format(new Date(expense.date), 'dd/MM/yyyy')}
          </td>
          <td className="px-4 py-4 whitespace-nowrap">
            <div className="flex items-center">
              {!isSubExpense && (
                <span className={`mr-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                  expense.type === 'company' ? 'bg-blue-100 text-blue-800' :
                  expense.type === 'client' ? 'bg-green-100 text-green-800' :
                  'bg-purple-100 text-purple-800'
                }`}>
                  {expense.type}
                </span>
              )}
              {expense.category}
            </div>
          </td>
          <td className="px-4 py-4 max-w-xs truncate">{expense.description}</td>
          <td className="px-4 py-4 whitespace-nowrap font-medium">
            <div className="flex flex-col">
              <span>€{Number(expense.amount).toFixed(2)}</span>
              {hasSubExpenses && (
                <span className="text-sm text-gray-500">
                  Total: €{calculateTotalAmount(expense).toFixed(2)}
                </span>
              )}
            </div>
          </td>
          <td className="px-4 py-4 whitespace-nowrap">
            <button
              onClick={() => onUpdateStatus(expense.id, expense.paymentStatus || 'pending')}
              className={`px-3 py-1 rounded-full text-xs font-medium
                ${expense.paymentStatus === 'paid'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'}
              `}
            >
              {updatingStatus === expense.id ? 'Updating...' : (expense.paymentStatus || 'Pending')}
            </button>
          </td>
          <td className="px-4 py-4 whitespace-nowrap">
            {expense.imageURL ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleViewDocument(expense.imageURL)}
                  className="text-blue-500 hover:text-blue-700"
                  title="View Document"
                >
                  <FileText className="h-4 w-4" />
                </button>
                <button
                  onClick={() => downloadDocument(expense.imageURL, `expense_${expense.id}`)}
                  className="text-green-500 hover:text-green-700"
                  title="Download Document"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <span className="text-gray-400 text-sm">No document</span>
            )}
          </td>
          <td className="px-4 py-4 whitespace-nowrap">
            <div className="flex items-center space-x-2">
              {!isSubExpense && expense.type === 'client' && (
                <button
                  onClick={() => onAddSubExpense(expense.id)}
                  className="text-blue-500 hover:text-blue-700 flex items-center gap-1"
                  title="Add Sub-expense"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm">Add</span>
                </button>
              )}
              {hasSubExpenses && (
                <button
                  onClick={() => toggleRowExpansion(expense.id)}
                  className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      <span className="text-sm">Hide</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      <span className="text-sm">({expense.subExpenses.length})</span>
                    </>
                  )}
                </button>
              )}
              <button
                onClick={() => onDelete(expense.id)}
                disabled={deletingExpenseId === expense.id}
                className="text-red-500 hover:text-red-700"
              >
                {deletingExpenseId === expense.id ? 
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div> 
                  : <Trash2 className="h-4 w-4" />
                }
              </button>
            </div>
          </td>
        </tr>
  
        {isExpanded && hasSubExpenses && expense.subExpenses.map(subExpense => (
          <ExpenseTableRow
            key={`${expense.id}-${subExpense.id}`}
            expense={subExpense}
            onDelete={onDelete}
            onAddSubExpense={onAddSubExpense}
            onUpdateStatus={onUpdateStatus}
            onSelect={onSelect}
            isSelected={selectedExpenses.includes(subExpense.id)}
            isSubExpense={true}
          />
        ))}
      </>
    );
  };
  
  // Component for the expense grid view
  const ExpenseGrid = ({ expenses, onDelete, onAddSubExpense, onUpdateStatus, onSelect }) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {expenses.map((expense) => (
          <ExpenseCard
            key={expense.id}
            expense={expense}
            onDelete={onDelete}
            onAddSubExpense={onAddSubExpense}
            onUpdateStatus={onUpdateStatus}
            onSelect={onSelect}
            isSelected={selectedExpenses.includes(expense.id)}
          />
        ))}
        {expenses.length === 0 && (
          <div className="col-span-full py-8 text-center text-gray-500">
            No expenses found that match your filters.
          </div>
        )}
      </div>
    );
  };
  
  // Component for a card in the expense grid
  const ExpenseCard = ({ 
    expense, 
    onDelete, 
    onAddSubExpense, 
    onUpdateStatus,
    onSelect,
    isSelected,
    isSubExpense = false 
  }) => {
    const hasSubExpenses = expense.subExpenses?.length > 0;
    const isExpanded = expandedRows.has(expense.id);
  
    // Get appropriate color based on expense type for visual distinction
    const getTypeColor = (type) => {
      switch(type) {
        case 'company': return 'bg-blue-50 border-blue-300';
        case 'client': return 'bg-green-50 border-green-300';
        case 'invoice': return 'bg-purple-50 border-purple-300';
        default: return 'bg-gray-50 border-gray-300';
      }
    };
    
    const typeColor = getTypeColor(expense.type);
  
    return (
      <div className={`bg-white rounded-xl shadow-sm overflow-hidden border-l-4 ${typeColor} ${
        isSubExpense ? 'ml-4' : ''
      }`}>
        <div className="p-4">
          {/* Type indicator badge */}
          <div className="flex items-center justify-between mb-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              expense.type === 'company' ? 'bg-blue-100 text-blue-800' :
              expense.type === 'client' ? 'bg-green-100 text-green-800' :
              'bg-purple-100 text-purple-800'
            }`}>
              {expense.type}
            </span>
          </div>
          
          {/* Header with checkbox */}
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => onSelect(expense.id, e.target.checked)}
                className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="text-sm text-gray-600">
                  {format(new Date(expense.date), 'dd/MM/yyyy')}
                </div>
                <div className="font-medium">{expense.category}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">€{Number(expense.amount).toFixed(2)}</div>
              {hasSubExpenses && (
                <div className="text-sm text-gray-500">
                  Total: €{calculateTotalAmount(expense).toFixed(2)}
                </div>
              )}
            </div>
          </div>
          
          {/* Description */}
          <div className="mb-3 text-gray-700">
            {expense.description || 'No description'}
          </div>
          
          {/* Booking info if available */}
          {expense.bookingData && (
            <div className="mb-3 p-2 bg-blue-50 rounded text-sm">
              <div><span className="font-medium">Booking:</span> {expense.bookingData.bookingDetails?.boatName}</div>
              <div><span className="font-medium">Client:</span> {expense.bookingData.clientDetails?.name}</div>
            </div>
          )}
          
          {/* Status and actions */}
          <div className="flex justify-between items-center mt-4">
            <button
              onClick={() => onUpdateStatus(expense.id, expense.paymentStatus || 'pending')}
              className={`px-3 py-1 rounded-full text-xs font-medium
                ${expense.paymentStatus === 'paid'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'}
              `}
            >
              {updatingStatus === expense.id ? 'Updating...' : (expense.paymentStatus || 'Pending')}
            </button>
            
            <div className="flex space-x-2">
              {expense.imageURL && (
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleViewDocument(expense.imageURL)}
                    className="text-blue-500 hover:text-blue-700"
                    title="View Document"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                </div>
              )}
              
              {!isSubExpense && expense.type === 'client' && (
                <button
                  onClick={() => onAddSubExpense(expense.id)}
                  className="text-blue-500 hover:text-blue-700 flex items-center"
                  title="Add Sub-expense"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
              
              {hasSubExpenses && (
                <button
                  onClick={() => toggleRowExpansion(expense.id)}
                  className="text-gray-500 hover:text-gray-700 flex items-center"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              )}
              
              <button
                onClick={() => onDelete(expense.id)}
                disabled={deletingExpenseId === expense.id}
                className="text-red-500 hover:text-red-700"
              >
                {deletingExpenseId === expense.id ? 
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div> 
                  : <Trash2 className="h-4 w-4" />
                }
              </button>
            </div>
          </div>
        </div>
        
        {/* Sub-expenses */}
        {isExpanded && hasSubExpenses && (
          <div className="border-t border-gray-100 bg-gray-50">
            <div className="p-2 text-sm font-medium text-gray-500">Sub-expenses ({expense.subExpenses.length})</div>
            <div className="space-y-2 p-2">
              {expense.subExpenses.map(subExp => (
                <ExpenseCard
                  key={subExp.id}
                  expense={subExp}
                  onDelete={onDelete}
                  onUpdateStatus={onUpdateStatus}
                  onSelect={onSelect}
                  isSelected={selectedExpenses.includes(subExp.id)}
                  isSubExpense={true}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  // Main component render
  return (
    <div className="bg-gray-50 min-h-screen p-4 overflow-hidden">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h1 className="text-2xl font-bold">Expense Management System</h1>
            
            <div className="flex flex-wrap gap-2">
              {/* View toggle buttons */}
              <div className="flex rounded-md overflow-hidden border border-gray-300">
                <button
                  onClick={() => setView('table')}
                  className={`px-3 py-2 text-sm font-medium ${
                    view === 'table' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
                  }`}
                >
                  Table
                </button>
                <button
                  onClick={() => setView('grid')}
                  className={`px-3 py-2 text-sm font-medium ${
                    view === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
                  }`}
                >
                  Grid
                </button>
              </div>
              
              {/* Quick actions */}
              <button
                onClick={() => setIsAddExpenseModalOpen(true)}
                className="px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
              >
                <span className="hidden md:inline">Add Expense</span>
                <Plus className="h-4 w-4 md:hidden" />
              </button>
              
              <button
                onClick={() => setIsFilterDrawerOpen(true)}
                className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50 flex items-center gap-1"
              >
                <Filter className="h-4 w-4" />
                <span className="hidden md:inline">Filters</span>
              </button>
              
              <button
                onClick={() => setIsAnalyticsModalOpen(true)}
                className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50 flex items-center gap-1"
              >
                <PieChart className="h-4 w-4" />
                <span className="hidden md:inline">Analytics</span>
              </button>
              
              <div className="relative">
                <button
                  onClick={() => setBulkActionMenuOpen(!bulkActionMenuOpen)}
                  disabled={selectedExpenses.length === 0}
                  className={`px-3 py-2 text-sm font-medium rounded flex items-center gap-1 ${
                    selectedExpenses.length === 0
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
                >
                  <CheckSquare className="h-4 w-4" />
                  <span className="hidden md:inline">
                    {selectedExpenses.length} selected
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </button>
                
                {bulkActionMenuOpen && selectedExpenses.length > 0 && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                    <div className="py-1">
                      <button
                        onClick={() => handleBulkStatusUpdate('paid')}
                        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                      >
                        Mark as Paid
                      </button>
                      <button
                        onClick={() => handleBulkStatusUpdate('pending')}
                        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                      >
                        Mark as Pending
                      </button>
                      <button
                        onClick={handleBulkDelete}
                        className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                      >
                        Delete Selected
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Search and quick filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search expenses..."
                  value={filterCriteria.query}
                  onChange={(e) => {
                    setFilterCriteria({...filterCriteria, query: e.target.value});
                    // If we're doing client-side filtering, apply immediately
                    applyFilters(expenses);
                  }}
                  className="block w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            {/* Date quick filters */}
            <div>
              <select
                value={
                  filterCriteria.dateFrom
                    ? `custom`
                    : 'all'
                }
                onChange={(e) => {
                  const value = e.target.value;
                  let dateFrom = '';
                  
                  if (value === 'today') {
                    dateFrom = new Date().toISOString().split('T')[0];
                  } else if (value === 'thisWeek') {
                    const today = new Date();
                    const dayOfWeek = today.getDay();
                    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                    dateFrom = new Date(today.setDate(diff)).toISOString().split('T')[0];
                  } else if (value === 'thisMonth') {
                    const today = new Date();
                    dateFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                  } else if (value === 'thisYear') {
                    const today = new Date();
                    dateFrom = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
                  }
                  
                  setFilterCriteria({...filterCriteria, dateFrom});
                  applyFilters(expenses);
                }}
                className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All time</option>
                <option value="today">Today</option>
                <option value="thisWeek">This week</option>
                <option value="thisMonth">This month</option>
                <option value="thisYear">This year</option>
                <option value="custom">Custom range</option>
              </select>
            </div>
            
            {/* Status quick filter */}
            <div>
              <select
                value={filterCriteria.paymentStatus}
                onChange={(e) => {
                  setFilterCriteria({...filterCriteria, paymentStatus: e.target.value});
                  applyFilters(expenses);
                }}
                className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All statuses</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-500 mb-1">Total Expenses</span>
              <span className="text-3xl font-bold text-gray-900">€{stats.total.amount.toFixed(2)}</span>
              <span className="text-sm text-gray-500 mt-1">{stats.total.count} expenses</span>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-500 mb-1">Company</span>
              <span className="text-3xl font-bold text-blue-600">€{stats.company.amount.toFixed(2)}</span>
              <span className="text-sm text-gray-500 mt-1">{stats.company.count} expenses</span>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-500 mb-1">Client</span>
              <span className="text-3xl font-bold text-green-600">€{stats.client.amount.toFixed(2)}</span>
              <span className="text-sm text-gray-500 mt-1">{stats.client.count} expenses</span>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-500 mb-1">Invoices</span>
              <span className="text-3xl font-bold text-purple-600">€{stats.invoice.amount.toFixed(2)}</span>
              <span className="text-sm text-gray-500 mt-1">{stats.invoice.count} expenses</span>
            </div>
          </div>
        </div>
        
        {/* Active Filters and Actions */}
        {(filterCriteria.dateFrom || filterCriteria.dateTo || filterCriteria.minAmount || 
          filterCriteria.maxAmount || filterCriteria.categories.length > 0 || 
          filterCriteria.hasDocument !== null || filterCriteria.hasBooking !== null || 
          filterCriteria.paymentStatus !== 'all' || filterCriteria.expenseType !== 'all') && (
          <div className="bg-blue-50 rounded-lg p-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-blue-700">Active filters:</span>
            
            {filterCriteria.dateFrom && (
              <div className="flex items-center gap-1 bg-white rounded-full px-3 py-1 text-sm border border-blue-200">
                <Calendar className="h-3 w-3 text-blue-500" />
                <span>From: {format(new Date(filterCriteria.dateFrom), 'dd/MM/yyyy')}</span>
                <button
                  onClick={() => {
                    setFilterCriteria({...filterCriteria, dateFrom: ''});
                    applyFilters(expenses);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            
            {filterCriteria.dateTo && (
              <div className="flex items-center gap-1 bg-white rounded-full px-3 py-1 text-sm border border-blue-200">
                <Calendar className="h-3 w-3 text-blue-500" />
                <span>To: {format(new Date(filterCriteria.dateTo), 'dd/MM/yyyy')}</span>
                <button
                  onClick={() => {
                    setFilterCriteria({...filterCriteria, dateTo: ''});
                    applyFilters(expenses);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            
            {filterCriteria.paymentStatus !== 'all' && (
              <div className="flex items-center gap-1 bg-white rounded-full px-3 py-1 text-sm border border-blue-200">
                <span>Status: {filterCriteria.paymentStatus}</span>
                <button
                  onClick={() => {
                    setFilterCriteria({...filterCriteria, paymentStatus: 'all'});
                    applyFilters(expenses);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            
            {/* Don't show type filter tag since it's controlled by tabs */}
            
            <div className="flex-grow"></div>
            
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Clear all filters</span>
            </button>
          </div>
        )}
        
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-4">
          {[
            {id: 'all', label: 'All Expenses'},
            {id: 'company', label: 'Company'}, 
            {id: 'client', label: 'Client'}, 
            {id: 'invoice', label: 'Invoices'}
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                // Make sure activeTab exactly matches database type field value
                console.log(`STRICT TAB CHANGE: Setting tab to '${tab.id}'`);
                setActiveTab(tab.id);
                // Let the applyFilters function handle the type filtering
                applyFilters(expenses);
              }}
              className={`px-6 py-3 text-sm font-medium transition-colors
                ${activeTab === tab.id
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Export and Bulk Actions */}
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-gray-500">
            {filteredExpenses.length} {filteredExpenses.length === 1 ? 'expense' : 'expenses'} found
          </div>
          
          <div className="flex gap-2">
            <div className="relative">
              <button
                onClick={() => downloadCSV()}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded flex items-center gap-1 hover:bg-gray-50"
              >
                <DownloadIcon className="h-4 w-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Main Content Area */}
        <div className="bg-white rounded-lg shadow-sm p-4 overflow-hidden">
          {loading ? (
            <LoadingSpinner />
          ) : (
            <>
              {view === 'table' ? (
                <ExpenseTable
                  expenses={currentPageExpenses}
                  onDelete={handleDeleteExpense}
                  onAddSubExpense={(id) => {
                    setSelectedParentId(id);
                    setIsAddExpenseModalOpen(true);
                  }}
                  onUpdateStatus={handleUpdatePaymentStatus}
                  onSelect={handleExpenseSelection}
                />
              ) : (
                <ExpenseGrid
                  expenses={currentPageExpenses}
                  onDelete={handleDeleteExpense}
                  onAddSubExpense={(id) => {
                    setSelectedParentId(id);
                    setIsAddExpenseModalOpen(true);
                  }}
                  onUpdateStatus={handleUpdatePaymentStatus}
                  onSelect={handleExpenseSelection}
                />
              )}
              
              <Pagination
                totalItems={filteredExpenses.length}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                onPageChange={handlePageChange}
                hasMore={hasMoreData}
                paginationMode={paginationMode}
              />
            </>
          )}
        </div>
      </div>
      
      {/* Modals and Drawers */}
      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onApply={handleApplyFilters}
      />
      
      <AddExpenseModal
        isOpen={isAddExpenseModalOpen}
        onClose={() => {
          setIsAddExpenseModalOpen(false);
          setSelectedParentId(null);
        }}
        onSubmit={handleAddExpense}
        parentExpenseId={selectedParentId}
      />
      
      <AnalyticsModal
        isOpen={isAnalyticsModalOpen}
        onClose={() => setIsAnalyticsModalOpen(false)}
        stats={stats}
        expenses={expenses}
        filteredExpenses={filteredExpenses}
      />
    </div>
  );
};

  // Analytics Modal Component
  const AnalyticsModal = ({ isOpen, onClose, stats, filteredExpenses }) => {
    const [activeChart, setActiveChart] = useState('overview'); // 'overview', 'monthly', 'category', 'status'
    
    // Calculate various analytics data
    const calculateMonthlyData = () => {
      const monthlyData = {};
      
      // Process all expenses to gather monthly totals
      filteredExpenses.forEach(expense => {
        const date = new Date(expense.date);
        const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        
        if (!monthlyData[monthYear]) {
          monthlyData[monthYear] = {
            month: monthYear,
            company: 0,
            client: 0,
            invoice: 0,
            total: 0
          };
        }
        
        const amount = Number(expense.amount) || 0;
        monthlyData[monthYear][expense.type || 'company'] += amount;
        monthlyData[monthYear].total += amount;
        
        // Add sub-expenses if present
        if (expense.subExpenses && expense.subExpenses.length > 0) {
          expense.subExpenses.forEach(subExp => {
            const subAmount = Number(subExp.amount) || 0;
            monthlyData[monthYear][subExp.type || expense.type || 'company'] += subAmount;
            monthlyData[monthYear].total += subAmount;
          });
        }
      });
      
      // Convert to array and sort by month
      return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
    };
    
    const calculateCategoryData = () => {
      const categoryData = {};
      
      // Process expenses to gather category totals
      filteredExpenses.forEach(expense => {
        const category = expense.category || 'Uncategorized';
        
        if (!categoryData[category]) {
          categoryData[category] = {
            category,
            count: 0,
            amount: 0
          };
        }
        
        categoryData[category].count++;
        categoryData[category].amount += Number(expense.amount) || 0;
        
        // Add sub-expenses if present
        if (expense.subExpenses && expense.subExpenses.length > 0) {
          expense.subExpenses.forEach(subExp => {
            const subCategory = subExp.category || category;
            
            if (!categoryData[subCategory]) {
              categoryData[subCategory] = {
                category: subCategory,
                count: 0,
                amount: 0
              };
            }
            
            categoryData[subCategory].count++;
            categoryData[subCategory].amount += Number(subExp.amount) || 0;
          });
        }
      });
      
      // Convert to array and sort by amount (descending)
      return Object.values(categoryData).sort((a, b) => b.amount - a.amount);
    };
    
    const calculateStatusData = () => {
      const statusData = {
        paid: { status: 'Paid', count: 0, amount: 0 },
        pending: { status: 'Pending', count: 0, amount: 0 }
      };
      
      // Process expenses to gather status totals
      filteredExpenses.forEach(expense => {
        const status = expense.paymentStatus || 'pending';
        
        statusData[status].count++;
        statusData[status].amount += Number(expense.amount) || 0;
        
        // Add sub-expenses if present
        if (expense.subExpenses && expense.subExpenses.length > 0) {
          expense.subExpenses.forEach(subExp => {
            const subStatus = subExp.paymentStatus || status;
            statusData[subStatus].count++;
            statusData[subStatus].amount += Number(subExp.amount) || 0;
          });
        }
      });
      
      return Object.values(statusData);
    };
    
    const monthlyData = calculateMonthlyData();
    const categoryData = calculateCategoryData();
    const statusData = calculateStatusData();
    
    if (!isOpen) return null;
    
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div className="fixed inset-0 transition-opacity" onClick={onClose}>
            <div className="absolute inset-0 bg-gray-500 bg-opacity-75"></div>
          </div>
          
          <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
          
          <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full">
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                  <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Expense Analytics</h3>
                  
                  {/* Tab Navigation */}
                  <div className="border-b border-gray-200 mb-4">
                    <div className="flex -mb-px">
                      {[
                        { id: 'overview', label: 'Overview' },
                        { id: 'monthly', label: 'Monthly Trends' },
                        { id: 'category', label: 'Categories' },
                        { id: 'status', label: 'Payment Status' }
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveChart(tab.id)}
                          className={`mr-8 py-4 text-sm font-medium ${
                            activeChart === tab.id
                              ? 'border-b-2 border-blue-500 text-blue-600'
                              : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Overview Chart */}
                  {activeChart === 'overview' && (
                    <div className="mt-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-sm font-medium text-gray-500">Company Expenses</div>
                          <div className="mt-2 flex justify-between items-end">
                            <div className="text-2xl font-bold">€{stats.company.amount.toFixed(2)}</div>
                            <div className="text-sm text-gray-500">{stats.company.count} expenses</div>
                          </div>
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${(stats.company.amount / stats.total.amount) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-sm font-medium text-gray-500">Client Expenses</div>
                          <div className="mt-2 flex justify-between items-end">
                            <div className="text-2xl font-bold">€{stats.client.amount.toFixed(2)}</div>
                            <div className="text-sm text-gray-500">{stats.client.count} expenses</div>
                          </div>
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full" 
                              style={{ width: `${(stats.client.amount / stats.total.amount) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-sm font-medium text-gray-500">Invoices</div>
                          <div className="mt-2 flex justify-between items-end">
                            <div className="text-2xl font-bold">€{stats.invoice.amount.toFixed(2)}</div>
                            <div className="text-sm text-gray-500">{stats.invoice.count} expenses</div>
                          </div>
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-purple-600 h-2 rounded-full" 
                              style={{ width: `${(stats.invoice.amount / stats.total.amount) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="text-lg font-medium mb-4">Payment Status</h4>
                        <div className="flex flex-col md:flex-row items-center justify-around gap-4">
                          {statusData.map(status => (
                            <div key={status.status} className="flex flex-col items-center">
                              <div className="text-3xl font-bold">
                                {status.status === 'Paid' ? 
                                  <span className="text-green-600">€{status.amount.toFixed(2)}</span> : 
                                  <span className="text-yellow-600">€{status.amount.toFixed(2)}</span>
                                }
                              </div>
                              <div className="mt-1 text-sm text-gray-500">{status.status}</div>
                              <div className="mt-1 text-xs text-gray-400">{status.count} expenses</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Monthly Trends Chart */}
                  {activeChart === 'monthly' && (
                    <div className="mt-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="text-lg font-medium mb-4">Monthly Expense Trends</h4>
                        {monthlyData.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full">
                              <thead>
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {monthlyData.map((month, idx) => (
                                  <tr key={month.month} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-100'}>
                                    <td className="px-4 py-2">{month.month}</td>
                                    <td className="px-4 py-2 text-right">€{month.company.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-right">€{month.client.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-right">€{month.invoice.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-right font-medium">€{month.total.toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-gray-200">
                                  <td className="px-4 py-2 font-medium">Total</td>
                                  <td className="px-4 py-2 text-right font-medium">
                                    €{monthlyData.reduce((sum, month) => sum + month.company, 0).toFixed(2)}
                                  </td>
                                  <td className="px-4 py-2 text-right font-medium">
                                    €{monthlyData.reduce((sum, month) => sum + month.client, 0).toFixed(2)}
                                  </td>
                                  <td className="px-4 py-2 text-right font-medium">
                                    €{monthlyData.reduce((sum, month) => sum + month.invoice, 0).toFixed(2)}
                                  </td>
                                  <td className="px-4 py-2 text-right font-medium">
                                    €{monthlyData.reduce((sum, month) => sum + month.total, 0).toFixed(2)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500">No monthly data available</div>
                        )}
                      </div>
                      
                      {/* Bar Chart Visual Representation */}
                      <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                        <h4 className="text-lg font-medium mb-4">Monthly Expense Chart</h4>
                        <div className="h-64 flex items-end space-x-2">
                          {monthlyData.map(month => (
                            <div key={month.month} className="flex-1 flex flex-col items-center">
                              <div 
                                className="w-full bg-blue-500 rounded-t"
                                style={{ 
                                  height: `${Math.max(5, (month.total / Math.max(...monthlyData.map(m => m.total))) * 100)}%` 
                                }}
                              ></div>
                              <div className="text-xs mt-1 transform -rotate-45 origin-top-left truncate w-10">
                                {month.month}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Category Chart */}
                  {activeChart === 'category' && (
                    <div className="mt-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="text-lg font-medium mb-4">Expense Categories</h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead>
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                              </tr>
                            </thead>
                            <tbody>
                              {categoryData.map((category, idx) => {
                                const percentage = (category.amount / stats.total.amount) * 100;
                                return (
                                  <tr key={category.category} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-100'}>
                                    <td className="px-4 py-2">{category.category}</td>
                                    <td className="px-4 py-2 text-right">{category.count}</td>
                                    <td className="px-4 py-2 text-right">€{category.amount.toFixed(2)}</td>
                                    <td className="px-4 py-2">
                                      <div className="flex items-center">
                                        <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                                          <div 
                                            className="bg-blue-600 h-2 rounded-full" 
                                            style={{ width: `${percentage}%` }}
                                          ></div>
                                        </div>
                                        <span className="text-xs whitespace-nowrap">{percentage.toFixed(1)}%</span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Payment Status Chart */}
                  {activeChart === 'status' && (
                    <div className="mt-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="text-lg font-medium mb-4">Payment Status Overview</h4>
                        
                        {/* Progress Circle */}
                        <div className="flex justify-center mb-6">
                          <div className="relative h-40 w-40">
                            <svg className="h-full w-full" viewBox="0 0 100 100">
                              {/* Background circle */}
                              <circle
                                cx="50"
                                cy="50"
                                r="45"
                                fill="transparent"
                                stroke="#e5e7eb"
                                strokeWidth="10"
                              />
                              
                              {/* Progress circle - Paid percentage */}
                              {statusData.map((status, index) => {
                                const percentage = (status.amount / (statusData[0].amount + statusData[1].amount)) * 100;
                                const offset = 283; // Circumference of a circle with r=45 (2πr)
                                const dashOffset = offset - (offset * percentage) / 100;
                                
                                return (
                                  <circle
                                    key={status.status}
                                    cx="50"
                                    cy="50"
                                    r="45"
                                    fill="transparent"
                                    stroke={status.status === 'Paid' ? '#10B981' : '#FBBF24'}
                                    strokeWidth="10"
                                    strokeDasharray={offset}
                                    strokeDashoffset={index === 0 ? dashOffset : 0}
                                    transform="rotate(-90 50 50)"
                                  />
                                );
                              })}
                              
                              {/* Center text */}
                              <text
                                x="50"
                                y="45"
                                textAnchor="middle"
                                fill="#1F2937"
                                fontSize="16"
                                fontWeight="bold"
                              >
                                {(statusData[0].amount / (statusData[0].amount + statusData[1].amount) * 100).toFixed(0)}%
                              </text>
                              <text
                                x="50"
                                y="60"
                                textAnchor="middle"
                                fill="#4B5563"
                                fontSize="10"
                              >
                                Paid
                              </text>
                            </svg>
                          </div>
                        </div>
                        
                        {/* Status Details Table */}
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead>
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                              </tr>
                            </thead>
                            <tbody>
                              {statusData.map((status, idx) => {
                                const totalAmount = statusData.reduce((sum, s) => sum + s.amount, 0);
                                const percentage = (status.amount / totalAmount) * 100;
                                
                                return (
                                  <tr key={status.status} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-100'}>
                                    <td className="px-4 py-2">
                                      <span className={`
                                        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                                        ${status.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                                      `}>
                                        {status.status}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-right">{status.count}</td>
                                    <td className="px-4 py-2 text-right font-medium">€{status.amount.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-right">{percentage.toFixed(1)}%</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

export default ExpenseOverview;