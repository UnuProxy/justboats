import React, { useState, useEffect, useCallback, useMemo } from "react";
import { collection, query, where, addDoc, getDocs } from "firebase/firestore";
import { db } from '../firebase/firebaseConfig';
import { Users, Ship, Euro, MapPin, Clock } from "lucide-react";
import { getAuth } from 'firebase/auth';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import ClientPaymentForm from './ClientPaymentForm';
import { createBookingNotification, createPaymentNotification, createClientUpdateNotification, createTransferNotification } from '../utils/notification-utils';
import { increment } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/firebaseConfig';
import MultiBoatBooking from './MultiBoatBooking';
import { useNavigate } from "react-router-dom";
import { sendClientWelcomeEmail } from '../services/emailService';

// Updated email function that supports both single and multi-boat bookings
const sendBookingConfirmationEmail = async (bookingData, isMultiBoat = false, allBoats = []) => {
  try {
    console.log('Starting email send process with data:', {
      client: bookingData.clientDetails?.name,
      email: bookingData.clientDetails?.email,
      isMultiBoat: isMultiBoat,
      boatCount: isMultiBoat ? allBoats.length : 1
    });
    
    // Prepare email payload based on booking type
    let emailPayload;
    
    if (isMultiBoat) {
      // Multi-boat booking payload
      emailPayload = {
        clientName: bookingData.clientDetails?.name || '',
        clientEmail: bookingData.clientDetails?.email || '',
        multiBoat: true,
        boats: allBoats.map(boat => ({
          boatName: boat.boatName || '',
          date: boat.date || '',
          startTime: boat.startTime || '',
          endTime: boat.endTime || '',
          passengers: boat.passengers?.toString() || '',
          pricing: {
            agreedPrice: boat.pricing?.agreedPrice?.toString() || '0'
          }
        }))
      };
    } else {
      // Single boat booking payload
      emailPayload = {
        clientName: bookingData.clientDetails?.name || '',
        clientEmail: bookingData.clientDetails?.email || '',
        bookingDetails: {
          boatName: bookingData.bookingDetails?.boatName || '',
          date: bookingData.bookingDetails?.date || '',
          startTime: bookingData.bookingDetails?.startTime || '',
          endTime: bookingData.bookingDetails?.endTime || '',
          passengers: bookingData.bookingDetails?.passengers?.toString() || '',
          price: bookingData.pricing?.agreedPrice?.toString() || '0'
        }
      };
    }

    // Validate required fields before sending
    if (!emailPayload.clientName || !emailPayload.clientEmail) {
      console.error('Missing required fields:', { 
        name: emailPayload.clientName, 
        email: emailPayload.clientEmail 
      });
      return false;
    }

    // Try to use the callable function first
    try {
      console.log('Attempting to send email using callable function');
      const sendEmail = httpsCallable(functions, 'sendBookingConfirmation');
      const result = await sendEmail(emailPayload);
      console.log('Email sent successfully via callable function:', result.data);
      return true;
    } catch (callableError) {
      console.error('Error sending email via callable function:', callableError);
      
      // Try HTTP fallback if callable fails
      try {
        console.log('Falling back to HTTP function for email');
        const authInstance = getAuth();
        const currentUser = authInstance.currentUser;
        const idToken = currentUser ? await currentUser.getIdToken() : null;

        if (!idToken) {
          throw new Error('No authenticated user token available for secure fallback request.');
        }

        const response = await fetch('https://sendbookingconfirmationhttp-xwscel2gqa-uc.a.run.app', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': window.location.origin,
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify(emailPayload)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`HTTP function failed with status ${response.status}: ${JSON.stringify(errorData)}`);
        }
        
        console.log('Email sent successfully via HTTP function');
        return true;
      } catch (httpError) {
        console.error('HTTP function failed:', httpError);
        console.log('All email sending methods failed');
        
        // Store this failed email for later retry if needed
        try {
          sessionStorage.setItem('failedEmail', JSON.stringify({
            timestamp: new Date().toISOString(),
            payload: emailPayload
          }));
        } catch (storageError) {
          console.error('Could not store failed email details:', storageError);
        }
        
        return false;
      }
    }
  } catch (error) {
    console.error('Unexpected error in sendBookingConfirmationEmail:', error);
    return false;
  }
};

const SnapshotTile = ({ icon: Icon, label, value, accent = "text-slate-600" }) => (
  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
    <div className="rounded-full bg-slate-100 p-2 text-slate-500">
      <Icon size={16} />
    </div>
    <div>
      <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{label}</p>
      <p className={`text-sm font-semibold ${accent}`}>{value || "—"}</p>
    </div>
  </div>
);

const SuccessInvoiceBanner = ({ invoices = [], onGenerate, onDismiss }) => {
  if (!invoices.length) return null;
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 shadow-sm mb-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-900">
            Booking saved • {invoices.length} invoice{invoices.length > 1 ? "s" : ""} ready
          </p>
          <p className="text-xs text-emerald-700">
            Tap “Open invoice” to jump straight into the generator and download the PDF for your client.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="self-start rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-white md:self-auto"
        >
          Hide banner
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {invoices.map((inv, index) => (
          <div
            key={`${inv.bookingId}-${index}`}
            className="flex flex-col gap-2 rounded-xl border border-emerald-100 bg-white/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-emerald-900">
                Invoice {index + 1} • {inv.items?.[0]?.description || "Booking"}
              </p>
              <p className="text-xs text-emerald-600">
                Amount: €{Number(inv.items?.[0]?.unitPrice || 0).toFixed(2)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onGenerate(inv)}
                className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Open invoice
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function AddBooking() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    clientType: "",
    selectedPartner: "",
    clientSource: "",
    clientDetails: {
      name: "",
      phone: "",
      email: "",
      passportNumber: "",
      address: "",
    },
    bookingDetails: {
      boatCompany: "",
      boatName: "",
      passengers: "",
      date: "",
      startTime: "",
      endTime: "",
    },
    pricing: {
      agreedPrice: "",
      pricingType: "standard", 
      firstPayment: {
        useCustomAmount: false,
        percentage: "30",
        amount: "",
        method: "cash",
        received: false,
        date: "",
        excludeVAT: false
      },
      secondPayment: {
        amount: "",
        method: "pos",
        received: false,
        date: "",
        excludeVAT: false
      },
      paymentStatus: "No Payment",
      totalPaid: 0,
    },
    transfer: {
      required: false,
      pickup: {
        location: '',
        locationDetail: '',
        time: ''
      },
      dropoff: {
        location: '',
        locationDetail: ''
      }
    },
    tripHandling: {
      type: 'internal',
      company: ''
    },
    notes: "",
  });

  // Add these two state variables for multi-boat support
  const [multiBoatMode, setMultiBoatMode] = useState(false);
  const [boats, setBoats] = useState([]);
  
  const [partners, setPartners] = useState([]);
  const [existingClients, setExistingClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [restaurantName, setRestaurantName] = useState('');
  const [preparedInvoices, setPreparedInvoices] = useState([]);
  const [showInvoiceBanner, setShowInvoiceBanner] = useState(false);

  const buildInvoicePrefill = useCallback((bookingId, bookingData) => {
    if (!bookingData) return null;
    const fallbackDate = new Date().toISOString().split("T")[0];
    const invoiceNumber = `INV-${new Date().getFullYear()}-${bookingId.slice(-5).toUpperCase()}`;
    const boatName = bookingData.bookingDetails?.boatName || "Charter";
    const charterDate = bookingData.bookingDetails?.date || fallbackDate;

    return {
      bookingId,
      invoice: {
        invoiceNumber,
        invoiceDate: charterDate,
        notes: bookingData.notes || "Courtesy drinks, towels and skipper included.",
        terms:
          "Payment terms: Net 30 days from invoice date. Please include the invoice number as the payment reference.",
      },
      client: {
        name: bookingData.clientDetails?.name || "",
        companyName: bookingData.clientDetails?.companyName || "",
        email: bookingData.clientDetails?.email || "",
        phone: bookingData.clientDetails?.phone || "",
        address: bookingData.clientDetails?.address || "",
        country: bookingData.clientDetails?.country || "",
        city: bookingData.clientDetails?.city || "",
        postalCode: bookingData.clientDetails?.postalCode || "",
        taxId: bookingData.clientDetails?.taxId || "",
      },
      items: [
        {
          id: bookingId,
          description: `${boatName} · ${charterDate}`,
          unitPrice: Number(bookingData.pricing?.agreedPrice) || 0,
          discount: 0,
        },
      ],
    };
  }, []);

  const bookingSnapshot = useMemo(() => {
    if (multiBoatMode && boats.length) {
      const totalValue = boats.reduce(
        (sum, boat) => sum + (parseFloat(boat.pricing?.agreedPrice) || 0),
        0
      );
      return {
        title: `${boats.length} boats scheduled`,
        client: formData.clientDetails.name || "Client TBD",
        schedule: `${boats[0]?.date || "Date TBC"} • ${boats[0]?.startTime || "--"}`,
        boat: "Multi-boat charter",
        passengers: boats.reduce((sum, boat) => sum + (parseInt(boat.passengers, 10) || 0), 0),
        price: `€${totalValue.toFixed(2)}`,
      };
    }

    return {
      title: formData.bookingDetails.boatName || "Boat not selected",
      client: formData.clientDetails.name || "Client TBD",
      schedule: `${formData.bookingDetails.date || "Date TBC"} • ${
        formData.bookingDetails.startTime || "--"
      }`,
      boat: formData.bookingDetails.boatName || "Boat not assigned",
      passengers: formData.bookingDetails.passengers || "—",
      price: formData.pricing.agreedPrice
        ? `€${Number(formData.pricing.agreedPrice).toFixed(2)}`
        : "—",
    };
  }, [boats, formData, multiBoatMode]);

  const handleInvoiceNavigation = useCallback(
    (invoicePrefill) => {
      if (!invoicePrefill) return;
      navigate("/invoice-generator", { state: { prefillInvoice: invoicePrefill } });
    },
    [navigate]
  );

  // Load partners based on type
  useEffect(() => {
    const loadPartnersByType = async () => {
      if (!formData.clientType) return;
      try {
        const partnerCollection = formData.clientType.toLowerCase() + "s";
        const querySnapshot = await getDocs(collection(db, partnerCollection));
        const partnersData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setPartners(partnersData);
      } catch (error) {
        console.error("Error loading partners:", error);
      }
    };

    loadPartnersByType();
  }, [formData.clientType]);

  // Search existing clients and pre-fill form
  useEffect(() => {
    const searchClients = async () => {
      if (searchTerm.length < 2) {
        setExistingClients([]);
        return;
      }
    
      try {
        const q = query(
          collection(db, "clients"),
          where("name", ">=", searchTerm),
          where("name", "<=", searchTerm + "\uf8ff")
        );
        const querySnapshot = await getDocs(q);
        const clientsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setExistingClients(clientsData);

        // If there's exactly one match, pre-fill the form
        if (clientsData.length === 1) {
          const client = clientsData[0];
          setFormData(prev => ({
            ...prev,
            clientDetails: {
              name: client.name || "",
              phone: client.phone || "",
              email: client.email || "",
              passportNumber: client.passportNumber || "",
            },
          }));
        }
      } catch (error) {
        console.error("Error searching clients:", error);
      }
    };

    const debounce = setTimeout(searchClients, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const handleClientTypeSelect = (type) => {
    setFormData((prev) => ({
      ...prev,
      clientType: type,
      selectedPartner: "",
      clientDetails: {
        name: "",
        phone: "",
        email: "",
        passportNumber: "",
      },
    }));
  };

  const handleExistingClientSelect = (client) => {
    setFormData((prev) => ({
      ...prev,
      clientDetails: {
        name: client.name,
        phone: client.phone,
        email: client.email,
        passportNumber: client.passportNumber || "",
      },
    }));
    setSearchTerm("");
    setExistingClients([]);
  };

  const handlePartnerSelect = (partnerId) => {
    setFormData((prev) => ({
      ...prev,
      selectedPartner: partnerId,
    }));
  };

  // Add this function to handle boats data from MultiBoatBooking component
  const handleBoatsChange = (boatsData) => {
    setBoats(boatsData);
  };

  const handleInputChange = (section, field, value) => {
    setFormData((prev) => {
      
      let processedValue = value;
      if (typeof value === 'string' && 
          !(section === 'bookingDetails' && (field === 'boatName' || field === 'boatCompany')) &&
          !(section === 'clientDetails' && field === 'name')) {
        processedValue = value.trim();
      }
      if (section === 'bookingDetails' && field === 'startTime') {
        const startHour = parseInt(value.split(':')[0]);
        const startMinutes = value.split(':')[1];
        const endHour = (startHour + 8).toString().padStart(2, '0');
        
        return {
          ...prev,
          bookingDetails: {
            ...prev.bookingDetails,
            startTime: value,
            endTime: `${endHour}:${startMinutes}`
          }
        };
      }
  
      // Handle transfer section
      if (section === 'transfer') {
        if (field === 'required') {
          return {
            ...prev,
            transfer: {
              ...prev.transfer,
              required: processedValue
            }
          };
        }
        return {
          ...prev,
          transfer: {
            ...prev.transfer,
            [field]: {
              ...prev.transfer[field],
              ...processedValue,
            },
          },
        };
      }

      if (section === 'tripHandling') {
        return {
          ...prev,
          tripHandling: {
            ...prev.tripHandling,
            [field]: processedValue
          }
        };
      }
  
      // Handle pricing section
      if (section === 'pricing') {
        // Special handling for payments array
        if (field === 'payments') {
          return {
            ...prev,
            pricing: {
              ...prev.pricing,
              payments: processedValue
            }
          };
        }
        // Handle other pricing fields
        const newPricing = {
          ...prev.pricing,
          [field]: processedValue
        };
        // Calculate final price when basePrice or discount changes
        if (field === 'basePrice' || field === 'discount') {
          const basePrice = field === 'basePrice' ? Number(processedValue) : Number(prev.pricing.basePrice);
          const discount = field === 'discount' ? Number(processedValue) : Number(prev.pricing.discount);
          newPricing.finalPrice = Math.max(0, basePrice - discount);
          newPricing.deposit = newPricing.finalPrice * 0.5;
          newPricing.remainingPayment = newPricing.finalPrice - newPricing.deposit;
          if (newPricing.finalPrice === 0) {
            newPricing.paymentStatus = 'No Payment';
          } else if (newPricing.deposit >= newPricing.finalPrice) {
            newPricing.paymentStatus = 'Completed';
          } else if (newPricing.deposit > 0) {
            newPricing.paymentStatus = 'Partial';
          }
        }
        return {
          ...prev,
          pricing: newPricing
        };
      }
  
      // Handle clientDetails section
      if (section === 'clientDetails') {
        return {
          ...prev,
          clientDetails: {
            ...prev.clientDetails,
            [field]: processedValue || "",
          },
        };
      }
  
      // Handle bookingDetails section
      if (section === 'bookingDetails') {
        return {
          ...prev,
          bookingDetails: {
            ...prev.bookingDetails,
            [field]: processedValue || "",
          },
        };
      }
  
      // Default case
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: processedValue || "",
        },
      };
    });
  };
  
  const handlePricingChange = useCallback(async (pricingData) => {
    // Calculate actual monetary values for first payment
    const firstPaymentAmount = pricingData.pricingType === 'standard' && !pricingData.firstPayment.useCustomAmount 
      ? parseFloat(pricingData.agreedPrice) * (parseFloat(pricingData.firstPayment.percentage) / 100)
      : parseFloat(pricingData.firstPayment.amount) || 0;
  
    // Calculate second payment based on the total and first payment
    const secondPaymentAmount = pricingData.pricingType === 'standard'
      ? parseFloat(pricingData.agreedPrice) - firstPaymentAmount
      : parseFloat(pricingData.secondPayment.amount) || 0;
  
    setFormData((prev) => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        agreedPrice: pricingData.agreedPrice,
        pricingType: pricingData.pricingType,
        firstPayment: {
          ...pricingData.firstPayment,
          amount: firstPaymentAmount.toFixed(2),
          percentage: pricingData.firstPayment.percentage // Keep the original percentage
        },
        secondPayment: {
          ...pricingData.secondPayment,
          amount: secondPaymentAmount.toFixed(2)
        },
        totalPaid: 
          (pricingData.firstPayment.received ? firstPaymentAmount : 0) +
          (pricingData.secondPayment.received ? secondPaymentAmount : 0),
        paymentStatus: pricingData.paymentStatus,
      },
    }));
  
    // Update Firestore if needed
    try {
      if (formData.id) {
        await updateDoc(doc(db, "bookings", formData.id), {
          pricing: {
            agreedPrice: parseFloat(pricingData.agreedPrice),
            pricingType: pricingData.pricingType,
            payments: [
              {
                type: 'first',
                amount: firstPaymentAmount,
                percentage: parseFloat(pricingData.firstPayment.percentage),
                method: pricingData.firstPayment.method,
                received: pricingData.firstPayment.received,
                date: pricingData.firstPayment.date,
                excludeVAT: pricingData.firstPayment.excludeVAT
              },
              {
                type: 'second',
                amount: secondPaymentAmount,
                method: pricingData.secondPayment.method,
                received: pricingData.secondPayment.received,
                date: pricingData.secondPayment.date,
                excludeVAT: pricingData.secondPayment.excludeVAT
              }
            ],
            totalPaid: 
              (pricingData.firstPayment.received ? firstPaymentAmount : 0) +
              (pricingData.secondPayment.received ? secondPaymentAmount : 0),
            paymentStatus: pricingData.paymentStatus,
          },
        });
      }
    } catch (error) {
      console.error("Error updating payment data in Firestore:", error);
    }
  }, [formData.id]);
  
  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold">Client Selection</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["Direct", "Hotel", "Collaborator"].map((type) => (
          <button
            key={type}
            className={`p-4 border rounded-lg ${
              formData.clientType === type
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200"
            }`}
            onClick={() => handleClientTypeSelect(type)}
          >
            {type} {type !== "Direct" ? "Partner" : "Client"}
          </button>
        ))}
      </div>

      {formData.clientType === "Direct" && (
        <>
          <div className="mt-4">
            <select
              className="w-full p-2 border rounded mb-4"
              value={formData.clientSource}
              onChange={(e) => setFormData(prev => ({...prev, clientSource: e.target.value}))}
              required
            >
              <option value="">Select Client Source</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Website">Website</option>
              <option value="Referral">Referral</option>
              <option value="Social Media">Social Media</option>
            </select>

            <input
              type="text"
              placeholder="Search existing clients..."
              className="w-full p-2 border rounded"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {existingClients.length > 0 && (
              <div className="mt-2 border rounded max-h-48 overflow-y-auto">
                {existingClients.map((client) => (
                  <div
                    key={client.id}
                    className="p-2 hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleExistingClientSelect(client)}
                  >
                    <div className="font-medium">{client.name}</div>
                    <div className="text-sm text-gray-600">{client.email}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {["Hotel", "Collaborator"].includes(formData.clientType) && (
        <div className="mt-4">
          <select
            className="w-full p-2 border rounded"
            value={formData.selectedPartner}
            onChange={(e) => handlePartnerSelect(e.target.value)}
          >
            <option value="">Select {formData.clientType}</option>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-6 space-y-4">
        <h4 className="font-medium">Client Details</h4>
        {["name", "phone", "email", "passportNumber", "address"].map((field) => (
          <div key={field}>
            <label className="block text-sm font-medium text-gray-700">
              {field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, " $1")}
            </label>
            {field === "address" ? (
              <textarea
                className="mt-1 w-full p-2 border rounded"
                rows="2"
                value={formData.clientDetails[field]}
                onChange={(e) =>
                  handleInputChange("clientDetails", field, e.target.value)
                }
                placeholder="Enter client's address"
              />
            ) : (
              <input
                type={field === "email" ? "email" : "text"}
                className="mt-1 w-full p-2 border rounded"
                value={formData.clientDetails[field]}
                onChange={(e) =>
                  handleInputChange("clientDetails", field, e.target.value)
                }
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // Updated renderStep2 function with multi-boat mode toggle
  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Ship className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold">Boat Details</h3>
        </div>
        
        {/* Multi-boat toggle switch */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Multiple Boats</label>
          <div className="relative inline-block w-10 mr-2 align-middle select-none">
            <input
              type="checkbox"
              name="multiBoatMode"
              id="multiBoatMode"
              checked={multiBoatMode}
              onChange={() => setMultiBoatMode(!multiBoatMode)}
              className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
              style={{ 
                top: "0", 
                right: multiBoatMode ? "0" : "auto", 
                left: multiBoatMode ? "auto" : "0",
                transition: "all 0.3s"
              }}
            />
            <label
              htmlFor="multiBoatMode"
              className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                multiBoatMode ? 'bg-blue-500' : 'bg-gray-300'
              }`}
              style={{ width: "100%" }}
            ></label>
          </div>
        </div>
      </div>
    
      {multiBoatMode ? (
        <MultiBoatBooking 
          onBoatsChange={handleBoatsChange}
          initialBoats={boats.length ? boats : [{
            boatCompany: formData.bookingDetails.boatCompany,
            boatName: formData.bookingDetails.boatName,
            passengers: formData.bookingDetails.passengers,
            date: formData.bookingDetails.date,
            startTime: formData.bookingDetails.startTime,
            endTime: formData.bookingDetails.endTime,
            pricing: {
              agreedPrice: formData.pricing.agreedPrice,
              pricingType: formData.pricing.pricingType,
              firstPayment: {...formData.pricing.firstPayment},
              secondPayment: {...formData.pricing.secondPayment},
              paymentStatus: formData.pricing.paymentStatus,
              totalPaid: formData.pricing.totalPaid
            }
          }]}
        />
      ) : (
        // Original single boat form
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Boat Company</label>
            <input
              type="text"
              className="mt-1 w-full p-2 border rounded"
              value={formData.bookingDetails.boatCompany}
              onChange={(e) =>
                handleInputChange("bookingDetails", "boatCompany", e.target.value)
              }
            />
          </div>
    
          <div>
            <label className="block text-sm font-medium text-gray-700">Boat Name</label>
            <input
              type="text"
              className="mt-1 w-full p-2 border rounded"
              value={formData.bookingDetails.boatName}
              onChange={(e) =>
                handleInputChange("bookingDetails", "boatName", e.target.value)
              }
            />
          </div>
    
          <div>
            <label className="block text-sm font-medium text-gray-700">Number of Passengers</label>
            <input
              type="number"
              className="mt-1 w-full p-2 border rounded"
              value={formData.bookingDetails.passengers}
              onChange={(e) =>
                handleInputChange("bookingDetails", "passengers", e.target.value)
              }
            />
          </div>
    
          <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input
              type="date"
              className="mt-1 w-full p-2 border rounded"
              value={formData.bookingDetails.date}
              onChange={(e) =>
                handleInputChange("bookingDetails", "date", e.target.value)
              }
            />
          </div>
    
          <div>
            <label className="block text-sm font-medium text-gray-700">Start Time</label>
            <input
              type="time"
              className="mt-1 w-full p-2 border rounded"
              value={formData.bookingDetails.startTime}
              onChange={(e) =>
                handleInputChange("bookingDetails", "startTime", e.target.value)
              }
            />
          </div>
    
          <div>
            <label className="block text-sm font-medium text-gray-700">End Time</label>
            <input
              type="time"
              className="mt-1 w-full p-2 border rounded"
              value={formData.bookingDetails.endTime}
              onChange={(e) =>
                handleInputChange("bookingDetails", "endTime", e.target.value)
              }
            />
          </div>
        </div>
      )}
    </div>
  );

  // Add multi-boat summary to step 3 when multiBoatMode is active
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Euro className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold">Pricing Details</h3>
      </div>
      
      {multiBoatMode ? (
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-800 mb-2">Multi-Boat Booking Summary</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left pb-2">Boat</th>
                  <th className="text-right pb-2">Price</th>
                </tr>
              </thead>
              <tbody>
                {boats.map((boat, index) => (
                  <tr key={index} className="border-b border-blue-100">
                    <td className="py-2">{boat.boatName || `Boat ${index + 1}`}</td>
                    <td className="text-right py-2">€{boat.pricing.agreedPrice || "0"}</td>
                  </tr>
                ))}
                <tr className="font-medium text-blue-900">
                  <td className="pt-2">Total</td>
                  <td className="text-right pt-2">
                    €{boats.reduce((sum, boat) => sum + parseFloat(boat.pricing.agreedPrice || 0), 0).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs text-blue-600 mt-3">
              * Payment details can be adjusted individually for each boat in the Boat Details section
            </p>
          </div>
        </div>
      ) : (
        <ClientPaymentForm 
          onPricingChange={handlePricingChange}
          initialData={formData.pricing}
        />
      )}
    </div>
  );
  
  const renderStep4 = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold">Transfer & Additional Details</h3>
      </div>
  
      <div className="space-y-4">
        {multiBoatMode && (
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-4">
            <h4 className="font-medium text-yellow-800 mb-2">Multi-Boat Booking</h4>
            <p className="text-sm">
              You are creating bookings for {boats.length} boats for this client. 
              All boats will share the same transfer and additional details.
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Transfer Required
          </label>
          <select
            className="mt-1 w-full p-2 border rounded"
            value={formData.transfer.required ? "true" : "false"}
            onChange={(e) =>
              handleInputChange("transfer", "required", e.target.value === "true")
            }
          >
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </div>
  
        {formData.transfer.required && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pickup Details */}
            <div>
              <h4 className="font-medium mb-2">Pickup Location</h4>
              <div className="space-y-2">
                <select
                  className="w-full p-2 border rounded"
                  value={formData.transfer.pickup.location}
                  onChange={(e) =>
                    handleInputChange("transfer", "pickup", {
                      ...formData.transfer.pickup,
                      location: e.target.value,
                      locationDetail: ''
                    })
                  }
                >
                  <option value="">Select Location Type</option>
                  <option value="Hotel">Hotel</option>
                  <option value="Airport">Ibiza Airport</option>
                  <option value="Other">Other Location</option>
                </select>

                {formData.transfer.pickup.location === 'Hotel' && (
                  <input
                    type="text"
                    placeholder="Hotel Name"
                    className="w-full p-2 border rounded"
                    value={formData.transfer.pickup.locationDetail || ''}
                    onChange={(e) =>
                      handleInputChange("transfer", "pickup", {
                        ...formData.transfer.pickup,
                        locationDetail: e.target.value,
                      })
                    }
                  />
                )}

                {formData.transfer.pickup.location === 'Other' && (
                  <input
                    type="text"
                    placeholder="Location Name"
                    className="w-full p-2 border rounded"
                    value={formData.transfer.pickup.locationDetail || ''}
                    onChange={(e) =>
                      handleInputChange("transfer", "pickup", {
                        ...formData.transfer.pickup,
                        locationDetail: e.target.value,
                      })
                    }
                  />
                )}
                <input
                  type="time"
                  className="w-full p-2 border rounded"
                  value={formData.transfer.pickup.time || ''}
                  onChange={(e) =>
                    handleInputChange("transfer", "pickup", {
                      ...formData.transfer.pickup,
                      time: e.target.value,
                    })
                  }
                  placeholder="Pickup time"
                />
              </div>
            </div>
  
            {/* Drop-off Details */}
            <div>
              <h4 className="font-medium mb-2">Drop-off Location</h4>
              <div className="space-y-2">
                <select
                  className="w-full p-2 border rounded"
                  value={formData.transfer.dropoff.location}
                  onChange={(e) =>
                    handleInputChange("transfer", "dropoff", {
                      ...formData.transfer.dropoff,
                      location: e.target.value,
                      locationDetail: ''
                    })
                  }
                >
                  <option value="">Select Location Type</option>
                  <option value="Marina">Marina</option>
                  <option value="Hotel">Hotel</option>
                  <option value="Other">Other Location</option>
                </select>

                {formData.transfer.dropoff.location === 'Hotel' && (
                  <input
                    type="text"
                    placeholder="Hotel Name"
                    className="w-full p-2 border rounded"
                    value={formData.transfer.dropoff.locationDetail || ''}
                    onChange={(e) =>
                      handleInputChange("transfer", "dropoff", {
                        ...formData.transfer.dropoff,
                        locationDetail: e.target.value,
                      })
                    }
                  />
                )}

                {formData.transfer.dropoff.location === 'Marina' && (
                  <select
                    className="w-full p-2 border rounded"
                    value={formData.transfer.dropoff.locationDetail || ''}
                    onChange={(e) =>
                      handleInputChange("transfer", "dropoff", {
                        ...formData.transfer.dropoff,
                        locationDetail: e.target.value,
                      })
                    }
                  >
                    <option value="">Select Marina</option>
                    <option value="Marina Botafoch">Marina Botafoch</option>
                    <option value="Marina Ibiza">Marina Ibiza</option>
                    <option value="Puerto Deportivo">Puerto Deportivo</option>
                  </select>
                )}

                {formData.transfer.dropoff.location === 'Other' && (
                  <input
                    type="text"
                    placeholder="Location Name"
                    className="w-full p-2 border rounded"
                    value={formData.transfer.dropoff.locationDetail || ''}
                    onChange={(e) =>
                      handleInputChange("transfer", "dropoff", {
                        ...formData.transfer.dropoff,
                        locationDetail: e.target.value,
                      })
                    }
                  />
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-2">Trip handling</h4>
            <select
              className="w-full p-2 border rounded"
              value={formData.tripHandling.type}
              onChange={(e) => handleInputChange("tripHandling", "type", e.target.value)}
            >
              <option value="internal">Nautiq Ibiza (internal)</option>
              <option value="external">External company</option>
            </select>
          </div>
          {formData.tripHandling.type === 'external' && (
            <div>
              <h4 className="font-medium mb-2">External company</h4>
              <input
                type="text"
                className="w-full p-2 border rounded"
                placeholder="Company handling this trip"
                value={formData.tripHandling.company}
                onChange={(e) => handleInputChange("tripHandling", "company", e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700">
            Additional Notes
          </label>
          <textarea
            className="mt-1 w-full p-2 border rounded"
            rows="4"
            value={formData.notes}
            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Any special requirements or notes..."
          />
        </div>
  
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700">
            Restaurant Name (if applicable)
          </label>
          <input
            type="text"
            className="mt-1 w-full p-2 border rounded"
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            placeholder="Enter the name of the restaurant"
          />
        </div>
      </div>
    </div>
  );
  
  // Update validateForm to handle multi-boat mode
  const validateForm = () => {
    switch (activeStep) {
      case 1:
        if (!formData.clientType) {
          alert("Please select a client type");
          return false;
        }
        if (formData.clientType === "Direct" && !formData.clientSource) {
          alert("Please select a client source");
          return false;
        }
        if (["Hotel", "Collaborator"].includes(formData.clientType) && !formData.selectedPartner) {
          alert("Please select a partner");
          return false;
        }
        if (!formData.clientDetails.name || !formData.clientDetails.email) {
          alert("Please fill in the required client details (name and email)");
          return false;
        }
        break;

      case 2:
        if (multiBoatMode) {
          // Validate all boats in multi-boat mode
          for (let i = 0; i < boats.length; i++) {
            const boat = boats[i];
            if (!boat.boatCompany) {
              alert(`Please enter the boat company for Boat ${i + 1}`);
              return false;
            }
            if (!boat.boatName) {
              alert(`Please enter the boat name for Boat ${i + 1}`);
              return false;
            }
            if (!boat.passengers) {
              alert(`Please enter the number of passengers for Boat ${i + 1}`);
              return false;
            }
            if (!boat.date) {
              alert(`Please select a date for Boat ${i + 1}`);
              return false;
            }
            if (!boat.pricing.agreedPrice) {
              alert(`Please enter a price for Boat ${i + 1}`);
              return false;
            }
          }
        } else {
          // Original validation for single boat
          if (!formData.bookingDetails.boatCompany) {
            alert("Please enter the boat company");
            return false;
          }
          if (!formData.bookingDetails.boatName) {
            alert("Please enter the boat name");
            return false;
          }
          if (!formData.bookingDetails.passengers) {
            alert("Please enter the number of passengers");
            return false;
          }
          if (!formData.bookingDetails.date) {
            alert("Please select a date");
            return false;
          }
        }
        break;

      case 3:
        if (!multiBoatMode) {
          // Only validate the pricing for single boat mode
          // (Multi-boat pricing is validated in step 2)
          if (formData.pricing.pricingType !== 'custom' && 
              (!formData.pricing.agreedPrice || parseFloat(formData.pricing.agreedPrice) <= 0)) {
            alert("Please enter a valid agreed price");
            return false;
          }
          // For custom type, check if at least one payment is entered
          if (formData.pricing.pricingType === 'custom') {
            const firstPayment = parseFloat(formData.pricing.firstPayment.amount) || 0;
            const secondPayment = parseFloat(formData.pricing.secondPayment.amount) || 0;
            if (firstPayment === 0 && secondPayment === 0) {
              alert("Please enter at least one payment amount");
              return false;
            }
          }
        }
        break;

      case 4:
        if (formData.transfer.required) {
          // Validate Pickup Details
          if (!formData.transfer.pickup.location) {
            alert("Please select a pickup location type");
            return false;
          }
          if (!formData.transfer.pickup.time) {
            alert("Please provide a pickup time");
            return false;
          }
          if (
            (formData.transfer.pickup.location === "Hotel" || formData.transfer.pickup.location === "Other") &&
            !formData.transfer.pickup.locationDetail
          ) {
            alert("Please provide pickup location details");
            return false;
          }

          // Validate Drop-off Details
          if (!formData.transfer.dropoff.location) {
            alert("Please select a drop-off location type");
            return false;
          }
          if (
            (formData.transfer.dropoff.location === "Hotel" ||
              formData.transfer.dropoff.location === "Other" ||
              formData.transfer.dropoff.location === "Marina") &&
            !formData.transfer.dropoff.locationDetail
          ) {
            alert("Please provide drop-off location details");
            return false;
          }
        }

        // Trip handling validation
        if (formData.tripHandling.type === 'external' && !formData.tripHandling.company) {
          alert("Please enter the external company handling this trip");
          return false;
        }
        break;

      default:
        alert("Invalid step");
        return false;
    }
    return true;
  };

  // Update handleSubmit to handle multi-boat mode
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (activeStep !== 4 || !validateForm()) return;

    const auth = getAuth();
    const user = auth.currentUser;
    const createdByInfo = user
        ? {
              uid: user.uid,
              displayName: user.displayName,
              email: user.email,
          }
        : null;

    try {
        setLoading(true);
        const invoicePrefills = [];

        // Process client information (same for both modes)
        let clientId = null;
        if (formData.clientType) {
            const clientsRef = collection(db, "clients");

            let existingClientQuery = query(
                clientsRef,
                where("email", "==", formData.clientDetails.email)
            );
            let existingClientSnapshot = await getDocs(existingClientQuery);

            if (existingClientSnapshot.empty && formData.clientDetails.phone) {
                existingClientQuery = query(
                    clientsRef,
                    where("phone", "==", formData.clientDetails.phone)
                );
                existingClientSnapshot = await getDocs(existingClientQuery);
            }

            if (!existingClientSnapshot.empty) {
                // Update existing client
                clientId = existingClientSnapshot.docs[0].id;
                await createClientUpdateNotification(
                    formData.clientDetails.name,
                    'updated'
                );
                
                // For multi-boat, calculate total spent differently
                const totalSpent = multiBoatMode 
                  ? boats.reduce((sum, boat) => sum + parseFloat(boat.pricing.agreedPrice || 0), 0)
                  : parseFloat(formData.pricing.agreedPrice) || 0;
                
                // For multi-boat, increment bookings by number of boats
                const bookingIncrement = multiBoatMode ? boats.length : 1;
                
                await updateDoc(doc(db, "clients", clientId), {
                    name: formData.clientDetails.name,
                    email: formData.clientDetails.email,
                    phone: formData.clientDetails.phone,
                    passportNumber: formData.clientDetails.passportNumber,
                    address: formData.clientDetails.address || '',
                    clientType: formData.clientType,
                    source: formData.clientType === "Direct" ? formData.clientSource : formData.clientType,
                    lastUpdated: new Date().toISOString(),
                    totalBookings: increment(bookingIncrement),
                    totalSpent: increment(totalSpent)
                });
            } else {
                // Create new client
                const clientData = {
                  name: formData.clientDetails.name || "",
                  email: formData.clientDetails.email || "",
                  phone: formData.clientDetails.phone || "",
                  passportNumber: formData.clientDetails.passportNumber || "",
                  address: formData.clientDetails.address || "",
                  clientType: formData.clientType,
                  source: formData.clientType === "Direct" ? formData.clientSource : formData.clientType,
                  createdAt: new Date().toISOString(),
                  lastUpdated: new Date().toISOString(),
                  createdBy: createdByInfo,
                  bookings: [],
                  totalBookings: multiBoatMode ? boats.length : 1,
                  totalSpent: multiBoatMode 
                    ? boats.reduce((sum, boat) => sum + parseFloat(boat.pricing.agreedPrice || 0), 0)
                    : parseFloat(formData.pricing.agreedPrice) || 0,
                  notes: formData.notes || "",
                  dob: ""
                };

                const clientDoc = await addDoc(clientsRef, clientData);
                // Fire a welcome/confirmation email but do not block booking creation
                if (formData.clientDetails.email) {
                  sendClientWelcomeEmail({
                    name: formData.clientDetails.name,
                    email: formData.clientDetails.email,
                    source: formData.clientType === "Direct" ? formData.clientSource : formData.clientType
                  }).catch((err) => console.error('Client welcome email failed (non-blocking):', err));
                }
                await createClientUpdateNotification(
                    formData.clientDetails.name,
                    'created'
                );
                clientId = clientDoc.id;
            }
        }

        // This function should replace the multiBoatMode section in your handleSubmit function
// It ensures payment data is processed correctly for each boat

if (multiBoatMode) {
  // Process multiple boats
  const bookingIds = [];
  const multiBoatGroupId = `group-${new Date().getTime()}`;
  
  // Create bookings for each boat
  for (const boat of boats) {
    // Calculate payment values to ensure accuracy
    const firstPaymentAmount = boat.pricing.pricingType === 'standard' && !boat.pricing.firstPayment.useCustomAmount 
      ? parseFloat(boat.pricing.agreedPrice) * (parseFloat(boat.pricing.firstPayment.percentage) / 100)
      : parseFloat(boat.pricing.firstPayment.amount) || 0;
    
    const secondPaymentAmount = boat.pricing.pricingType === 'standard'
      ? parseFloat(boat.pricing.agreedPrice) - firstPaymentAmount
      : parseFloat(boat.pricing.secondPayment.amount) || 0;
    
    const totalPaid = 
      (boat.pricing.firstPayment.received ? firstPaymentAmount : 0) +
      (boat.pricing.secondPayment.received ? secondPaymentAmount : 0);
    
    // Determine payment status
    let paymentStatus = "No Payment";
    if (totalPaid > 0) {
      paymentStatus = totalPaid >= parseFloat(boat.pricing.agreedPrice) ? "Completed" : "Partial";
    }
    
    const bookingData = {
      clientType: formData.clientType || "",
      selectedPartner: formData.selectedPartner || "",
      clientSource: formData.clientSource || "",
      clientDetails: {
        name: formData.clientDetails.name || "",
        phone: formData.clientDetails.phone || "",
        email: formData.clientDetails.email || "",
        passportNumber: formData.clientDetails.passportNumber || "",
        address: formData.clientDetails.address || "",
      },
      clientName: formData.clientDetails.name || "",
      clientId: clientId,
      bookingDate: boat.date || "",
      bookingDetails: {
        boatCompany: boat.boatCompany || "",
        boatName: boat.boatName || "",
        passengers: boat.passengers || "",
        date: boat.date || "",
        startTime: boat.startTime || "",
        endTime: boat.endTime || "",
        transferAddress: formData.transfer.required
          ? {
              pickup: formData.transfer.pickup || {},
              dropoff: formData.transfer.dropoff || {},
            }
          : null,
        multiBoatBooking: true
      },
      pricing: {
        agreedPrice: parseFloat(boat.pricing.agreedPrice) || 0,
        pricingType: boat.pricing.pricingType,
        totalPaid: totalPaid,
        paymentStatus: paymentStatus,
        payments: [
          {
            type: 'first',
            amount: firstPaymentAmount,
            percentage: parseFloat(boat.pricing.firstPayment.percentage) || 30,
            method: boat.pricing.firstPayment.method || 'cash',
            received: boat.pricing.firstPayment.received || false,
            date: boat.pricing.firstPayment.date || '',
            excludeVAT: boat.pricing.firstPayment.excludeVAT || false,
            recordedAt: new Date().toISOString()
          },
          {
            type: 'second',
            amount: secondPaymentAmount,
            method: boat.pricing.secondPayment.method || 'pos',
            received: boat.pricing.secondPayment.received || false,
            date: boat.pricing.secondPayment.date || '',
            excludeVAT: boat.pricing.secondPayment.excludeVAT || false,
            recordedAt: new Date().toISOString()
          }
        ]
      },
      transfer: formData.transfer || {},
      tripHandling: formData.tripHandling || { type: 'internal', company: '' },
      notes: formData.notes || "",
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      status: "active",
      createdBy: createdByInfo,
      restaurantName: restaurantName || "",
      isPartOfMultiBoatBooking: true,
      multiBoatGroupId: multiBoatGroupId
    };
    
    // Create booking document
    const bookingRef = await addDoc(collection(db, "bookings"), bookingData);
    bookingIds.push(bookingRef.id);
    
    // Set the ID in the document
    await updateDoc(doc(db, "bookings", bookingRef.id), {
      id: bookingRef.id
    });

    const invoicePrefill = buildInvoicePrefill(bookingRef.id, bookingData);
    if (invoicePrefill) {
      invoicePrefills.push(invoicePrefill);
    }
    
    // Add booking notification
    await createBookingNotification(
      formData.clientDetails.name,
      boat.boatName,
      new Date(boat.date).toLocaleDateString(),
      bookingRef.id
    );
    
    // Create payment notifications if payments are received
    if (boat.pricing.firstPayment.received) {
      await createPaymentNotification(
        firstPaymentAmount.toFixed(2),
        formData.clientDetails.name,
        bookingRef.id
      );
    }

    if (boat.pricing.secondPayment.received) {
      await createPaymentNotification(
        secondPaymentAmount.toFixed(2),
        formData.clientDetails.name,
        bookingRef.id
      );
    }
    
    // Process payments for database records
    const payments = bookingData.pricing.payments.filter(payment => payment.amount > 0);
    if (payments.length > 0) {
      const paymentRecords = payments.map(payment => ({
        ...payment,
        bookingId: bookingRef.id,
        clientId: clientId,
        createdBy: createdByInfo,
        createdAt: new Date().toISOString()
      }));

      await Promise.all(paymentRecords.map(record => 
        addDoc(collection(db, "payments"), record)
      ));
    }
    
    // Update client's bookings array
    if (clientId) {
      await updateDoc(doc(db, "clients", clientId), {
        bookings: arrayUnion(bookingRef.id),
      });
    }
  }
  
  // Send a single email for all boats
  const boatsForEmail = boats.map(boat => ({
    boatName: boat.boatName,
    date: boat.date,
    startTime: boat.startTime,
    endTime: boat.endTime,
    passengers: boat.passengers,
    pricing: {
      agreedPrice: boat.pricing.agreedPrice
    }
  }));
  
  // Send one comprehensive email for all boats
  await sendBookingConfirmationEmail(
    {
      clientDetails: {
        name: formData.clientDetails.name,
        email: formData.clientDetails.email
      }
    }, 
    true, // isMultiBoat = true
    boatsForEmail
  );
  
  // Create a single transfer notification if needed
  if (formData.transfer.required) {
    const firstBoatDate = boats[0].date || "";
    const firstBoatTime = boats[0].startTime || "";
    const pickupTime = firstBoatDate && firstBoatTime 
      ? new Date(`${firstBoatDate} ${firstBoatTime}`)
      : new Date();
    
    await createTransferNotification(
      bookingIds.join(','),  // Join all booking IDs
      formData.clientDetails.name,
      pickupTime.toLocaleTimeString()
    );
  }
  
  alert(`Successfully created ${bookingIds.length} bookings for ${formData.clientDetails.name}`);

        } else {
            // Original single boat booking flow
            const bookingData = {
                clientType: formData.clientType || "",
                selectedPartner: formData.selectedPartner || "",
                clientSource: formData.clientSource || "",
                clientDetails: {
                    name: formData.clientDetails.name || "",
                    phone: formData.clientDetails.phone || "",
                    email: formData.clientDetails.email || "",
                    passportNumber: formData.clientDetails.passportNumber || "",
                    address: formData.clientDetails.address || "",
                },
                clientName: formData.clientDetails.name || "",
                clientId: clientId,
                bookingDate: formData.bookingDetails.date || "",
                bookingDetails: {
                    boatCompany: formData.bookingDetails.boatCompany || "",
                    boatName: formData.bookingDetails.boatName || "",
                    passengers: formData.bookingDetails.passengers || "",
                    date: formData.bookingDetails.date || "",
                    startTime: formData.bookingDetails.startTime || "",
                    endTime: formData.bookingDetails.endTime || "",
                    transferAddress: formData.transfer.required
                        ? {
                              pickup: formData.transfer.pickup || {},
                              dropoff: formData.transfer.dropoff || {},
                          }
                        : null,
                },
                pricing: {
                  agreedPrice: parseFloat(formData.pricing.agreedPrice) || 0,
                  pricingType: formData.pricing.pricingType,
                  totalPaid: parseFloat(formData.pricing.totalPaid) || 0,
                  paymentStatus: formData.pricing.paymentStatus || "No Payment",
                  payments: [
                    {
                      type: 'first',
                      amount: parseFloat(formData.pricing.firstPayment.amount) || 0,
                      percentage: parseFloat(formData.pricing.firstPayment.percentage),
                      method: formData.pricing.firstPayment.method || '',
                      received: formData.pricing.firstPayment.received || false,
                      date: formData.pricing.firstPayment.date || '',
                      excludeVAT: formData.pricing.firstPayment.excludeVAT || false,
                      recordedAt: new Date().toISOString()
                    },
                    {
                      type: 'second',
                      amount: parseFloat(formData.pricing.secondPayment.amount) || 0,
                      method: formData.pricing.secondPayment.method || '',
                      received: formData.pricing.secondPayment.received || false,
                      date: formData.pricing.secondPayment.date || '',
                      excludeVAT: formData.pricing.secondPayment.excludeVAT || false,
                      recordedAt: new Date().toISOString()
                    }
                  ]
                },
                transfer: formData.transfer || {},
                tripHandling: formData.tripHandling || { type: 'internal', company: '' },
                notes: formData.notes || "",
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                status: "active",
                createdBy: createdByInfo,
                restaurantName: restaurantName || "",
            };

            // Create booking document
            const bookingRef = await addDoc(collection(db, "bookings"), bookingData);
            await sendBookingConfirmationEmail(bookingData);
            
            // Add booking notification
            await createBookingNotification(
                formData.clientDetails.name,
                formData.bookingDetails.boatName,
                new Date(formData.bookingDetails.date).toLocaleDateString(),
                bookingRef.id
            );

            if (formData.transfer.required) {
                const pickupTime = new Date(`${formData.bookingDetails.date} ${formData.bookingDetails.startTime}`);
                await createTransferNotification(
                    bookingRef.id,
                    formData.clientDetails.name,
                    pickupTime.toLocaleTimeString()
                );
            }

            if (formData.pricing.firstPayment.received) {
                await createPaymentNotification(
                    formData.pricing.firstPayment.amount,
                    formData.clientDetails.name,
                    bookingRef.id
                );
            }

            if (formData.pricing.secondPayment.received) {
                await createPaymentNotification(
                    formData.pricing.secondPayment.amount,
                    formData.clientDetails.name,
                    bookingRef.id
                );
            }

            await updateDoc(doc(db, "bookings", bookingRef.id), {
                id: bookingRef.id
            });

            const singleInvoice = buildInvoicePrefill(bookingRef.id, bookingData);
            if (singleInvoice) {
                invoicePrefills.push(singleInvoice);
            }

            const payments = bookingData.pricing.payments.filter(payment => payment.amount > 0);
            if (payments.length > 0) {
                const paymentRecords = payments.map(payment => ({
                    ...payment,
                    bookingId: bookingRef.id,
                    clientId: bookingData.clientId,
                    createdBy: createdByInfo,
                    createdAt: new Date().toISOString()
                }));

                await Promise.all(paymentRecords.map(record => 
                    addDoc(collection(db, "payments"), record)
                ));
            }

            // Update client's bookings array
            if (clientId) {
                await updateDoc(doc(db, "clients", clientId), {
                    bookings: arrayUnion(bookingRef.id),
                });
            }

            alert("Booking saved successfully");
        }

        if (invoicePrefills.length) {
            setPreparedInvoices(invoicePrefills);
            setShowInvoiceBanner(true);
        } else {
            setPreparedInvoices([]);
            setShowInvoiceBanner(false);
        }

        // Reset form and state
        setFormData({
            clientType: "",
            selectedPartner: "",
            clientSource: "",
            clientDetails: {
                name: "",
                phone: "",
                email: "",
                passportNumber: "",
                address: "",
            },
            bookingDetails: {
                boatCompany: "",
                boatName: "",
                passengers: "",
                date: "",
                startTime: "",
                endTime: "",
            },
            pricing: {
                agreedPrice: "",
                pricingType: "standard",
                firstPayment: {
                    useCustomAmount: false,
                    percentage: "30",
                    amount: "",
                    method: "cash",
                    received: false,
                    date: "",
                    excludeVAT: false
                },
                secondPayment: {
                    amount: "",
                    method: "pos",
                    received: false,
                    date: "",
                    excludeVAT: false
                },
                paymentStatus: "No Payment",
                totalPaid: 0
            },
            transfer: {
                required: false,
                pickup: { location: "", locationDetail: "", time: "" },
                dropoff: { location: "", locationDetail: "" },
            },
            tripHandling: {
                type: 'internal',
                company: ''
            },
            notes: "",
        });
        setMultiBoatMode(false);
        setBoats([]);
        setActiveStep(1);
        setRestaurantName("");
    } catch (error) {
        console.error("Error saving booking:", error);
        alert("Error saving booking. Please try again.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg">
        {/* Header Section */}
        <div className="p-4 sm:p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-xl sm:text-2xl font-bold">Add New Booking</h2>
            <button
              onClick={() => window.history.back()}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>

          {/* Mobile-friendly progress bar */}
          <div className="mt-6">
            <div className="flex mb-2 justify-between">
              {['Client', 'Boat', 'Price', 'Details'].map((label, index) => (
                <div key={label} className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center
                    ${index + 1 === activeStep ? 'bg-blue-500 text-white' :
                      index + 1 < activeStep ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
                  >
                    {index + 1 < activeStep ? '✓' : index + 1}
                  </div>
                  <span className="hidden sm:block text-xs mt-1">{label}</span>
                </div>
              ))}
            </div>
            <div className="relative">
              <div className="h-1 bg-gray-200 rounded">
                <div
                  className="h-1 bg-blue-500 rounded transition-all duration-300"
                  style={{ width: `${((activeStep - 1) / 3) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-4 sm:p-6 space-y-6">
          {showInvoiceBanner && (
            <SuccessInvoiceBanner
              invoices={preparedInvoices}
              onGenerate={handleInvoiceNavigation}
              onDismiss={() => {
                setShowInvoiceBanner(false);
                setPreparedInvoices([]);
              }}
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <SnapshotTile icon={Users} label="Client" value={bookingSnapshot.client} />
            <SnapshotTile icon={Clock} label="Schedule" value={bookingSnapshot.schedule} />
            <SnapshotTile icon={Ship} label="Boat" value={bookingSnapshot.boat} />
            <SnapshotTile
              icon={Euro}
              label="Contract value"
              value={bookingSnapshot.price}
              accent="text-emerald-600"
            />
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Add bottom margin for mobile fixed buttons */}
            <div className="mb-24 sm:mb-0">
              {activeStep === 1 && renderStep1()}
              {activeStep === 2 && renderStep2()}
              {activeStep === 3 && renderStep3()}
              {activeStep === 4 && renderStep4()}
            </div>

            {/* Fixed navigation buttons for mobile */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 sm:relative sm:border-t-0 sm:p-0 sm:mt-6">
              <div className="flex justify-between gap-2 max-w-4xl mx-auto">
                {activeStep > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveStep((prev) => prev - 1);
                    }}
                    className="flex-1 sm:flex-none px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm sm:text-base"
                  >
                    Previous
                  </button>
                )}
                {activeStep < 4 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      if (validateForm()) {
                        setActiveStep((prev) => prev + 1);
                      }
                    }}
                    className="flex-1 sm:flex-none px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm sm:text-base"
                  >
                    Next
                  </button>
                )}
                {activeStep === 4 && (
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Saving...
                      </>
                    ) : (
                      'Complete Booking'
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AddBooking;
