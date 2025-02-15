import React, { useState, useEffect, useCallback } from "react";
import { collection, query, where, addDoc, getDocs } from "firebase/firestore";
import { db } from '../firebase/firebaseConfig.js';
import { Users, Ship, Euro, MapPin } from "lucide-react";
import { getAuth } from 'firebase/auth';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import ClientPaymentForm from './ClientPaymentForm';
import { 
  createBookingNotification, 
  createPaymentNotification,
  createClientUpdateNotification,
  createTransferNotification 
} from '../utils/notification-utils';

function AddBooking() {
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
        excludeVAT: false  // Add this
      },
      secondPayment: {
        amount: "",
        method: "pos",
        received: false,
        date: "",
        excludeVAT: false  // Add this
      },
      paymentStatus: "No Payment",
      totalPaid: 0,
    },
    transfer: {
      required: false,
      pickup: {
        location: '',
        locationDetail: ''
      },
      dropoff: {
        location: '',
        locationDetail: ''
      }
    },
    notes: "",
  });

  const [partners, setPartners] = useState([]);
  const [existingClients, setExistingClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [restaurantName, setRestaurantName] = useState('');

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
  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Ship className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold">Boat Details</h3>
      </div>
  
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
    </div>
  );
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Euro className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold">Pricing Details</h3>
      </div>
      
      <ClientPaymentForm 
        onPricingChange={handlePricingChange}
        initialData={formData.pricing}
      />
    </div>
  );
  const renderStep4 = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold">Transfer & Additional Details</h3>
      </div>
  
      <div className="space-y-4">
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
        break;

        case 3:
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
      break;

      case 4:
  if (formData.transfer.required) {
    // Validate Pickup Details
    if (!formData.transfer.pickup.location) {
      alert("Please select a pickup location type");
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
  break;


      default:
        alert("Invalid step");
        return false;
    }
    return true;
  };

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
          notes: formData.notes || "",
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          status: "active",
          createdBy: createdByInfo,
          restaurantName: restaurantName || "",
        };

        let clientId = null;
        if (
            formData.clientType === "Direct" ||
            ["Hotel", "Collaborator"].includes(formData.clientType)
        ) {
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
                clientId = existingClientSnapshot.docs[0].id;
                await createClientUpdateNotification(
                  formData.clientDetails.name,
                  'updated'
                );
                await updateDoc(doc(db, "clients", clientId), {
                    name: formData.clientDetails.name,
                    email: formData.clientDetails.email,
                    phone: formData.clientDetails.phone,
                    passportNumber: formData.clientDetails.passportNumber,
                    lastUpdated: new Date().toISOString(),
                });

                console.log("Updated existing client with ID:", clientId);
            } else {
                const clientData = {
                    name: formData.clientDetails.name,
                    email: formData.clientDetails.email,
                    phone: formData.clientDetails.phone,
                    passportNumber: formData.clientDetails.passportNumber,
                    source:
                        formData.clientType === "Direct"
                            ? formData.clientSource
                            : formData.clientType,
                    createdAt: new Date().toISOString(),
                    createdBy: createdByInfo,
                    bookings: [],
                    totalBookings: 1,
                    totalSpent: bookingData.pricing.agreedPrice,
                };

                const clientDoc = await addDoc(clientsRef, clientData);
                await createClientUpdateNotification(
                  formData.clientDetails.name,
                  'created'
                );
                clientId = clientDoc.id;
                
            }
            bookingData.clientId = clientId;
        }

        // Create booking document
        const bookingRef = await addDoc(collection(db, "bookings"), bookingData);
        // Add booking notification
await createBookingNotification(
  formData.clientDetails.name,
  formData.bookingDetails.boatName,
  new Date(formData.bookingDetails.date).toLocaleDateString(),
  bookingRef.id
);

// Add transfer notification if transfer is required
if (formData.transfer.required) {
  const pickupTime = new Date(`${formData.bookingDetails.date} ${formData.bookingDetails.startTime}`);
  await createTransferNotification(
    bookingRef.id,
    formData.clientDetails.name,
    pickupTime.toLocaleTimeString()
  );
}

// Add payment notifications if payments are received
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
        // Add the ID to the booking document
        await updateDoc(doc(db, "bookings", bookingRef.id), {
            id: bookingRef.id
        });

        // Create separate payment records
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
        if (formData.clientType === "Direct") {
            await updateDoc(doc(db, "clients", bookingData.clientId), {
                bookings: arrayUnion(bookingRef.id),
            });
        }

        alert("Booking saved successfully");
        setFormData({
            clientType: "",
            selectedPartner: "",
            clientSource: "",
            clientDetails: {
                name: "",
                phone: "",
                email: "",
                passportNumber: "",
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
                pickup: { location: "", locationDetail: "" },
                dropoff: { location: "", locationDetail: "" },
            },
            notes: "",
        });
        setActiveStep(1);
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
        <div className="p-4 sm:p-6">
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

      {/* Mobile optimizations for inputs */}

    </div>
  );
}

export default AddBooking;