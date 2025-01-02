import React, { useState, useEffect } from "react";
import { collection, query, where, addDoc, getDocs } from "firebase/firestore";
import { db } from '../firebase/firebaseConfig.js';
import { Users, Ship, Euro, MapPin } from "lucide-react";
import { getAuth } from 'firebase/auth';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { sendBookingEmail } from '../services/emailService';

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
      basePrice: "",
      discount: "",
      finalPrice: "",
      deposit: "",
      remainingPayment: "",
      paymentStatus: "No Payment",
    },
    transfer: {
      required: false,
      pickup: {
        location: "",
        address: "",
      },
      dropoff: {
        location: "",
        address: "",
      },
    },
    notes: "",
  });

  const [partners, setPartners] = useState([]);
  const [existingClients, setExistingClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

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

  // Calculate pricing
  useEffect(() => {
    const { basePrice, discount } = formData.pricing;
    const finalPrice = Math.max(0, parseFloat(basePrice || 0) - parseFloat(discount || 0));
    const deposit = finalPrice * 0.5;

    if (finalPrice !== formData.pricing.finalPrice) {
      setFormData(prev => ({
        ...prev,
        pricing: {
          ...prev.pricing,
          finalPrice,
          deposit,
          remainingPayment: finalPrice - deposit,
        },
      }));
    }
  }, [formData.pricing.basePrice, formData.pricing.discount]);

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
      if (section === 'clientDetails') {
        return {
          ...prev,
          clientDetails: {
            ...prev.clientDetails,
            [field]: value === "" ? "" : value,
          },
        };
      }
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value === "" ? "" : value,
        },
      };
    });
  };

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
        {["name", "phone", "email", "passportNumber"].map((field) => (
          <div key={field}>
            <label className="block text-sm font-medium text-gray-700">
              {field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, " $1")}
            </label>
            <input
              type={field === "email" ? "email" : "text"}
              className="mt-1 w-full p-2 border rounded"
              value={formData.clientDetails[field]}
              onChange={(e) =>
                handleInputChange("clientDetails", field, e.target.value)
              }
            />
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep2 = () => (
    // ... (rest of your renderStep2 function - no changes needed)
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Ship className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold">Boat Details</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Boat Company
          </label>
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
          <label className="block text-sm font-medium text-gray-700">
            Boat Name
          </label>
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
          <label className="block text-sm font-medium text-gray-700">
            Number of Passengers
          </label>
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
          <label className="block text-sm font-medium text-gray-700">
            Start Time
          </label>
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
          <label className="block text-sm font-medium text-gray-700">
            End Time
          </label>
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
    // ... (rest of your renderStep3 function - no changes needed)
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Euro className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold">Pricing Details</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Base Price (€)
          </label>
          <input
            type="number"
            className="mt-1 w-full p-2 border rounded"
            value={formData.pricing.basePrice}
            onChange={(e) =>
              handleInputChange("pricing", "basePrice", e.target.value)
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Discount (€)
          </label>
          <input
            type="number"
            className="mt-1 w-full p-2 border rounded"
            value={formData.pricing.discount}
            onChange={(e) =>
              handleInputChange("pricing", "discount", e.target.value)
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Final Price (€)
          </label>
          <input
            type="number"
            className="mt-1 w-full p-2 border rounded bg-gray-50"
            value={formData.pricing.finalPrice}
            readOnly
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Deposit (€)
          </label>
          <input
            type="number"
            className="mt-1 w-full p-2 border rounded bg-gray-50"
            value={formData.pricing.deposit}
            readOnly
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Remaining Payment (€)
          </label>
          <input
            type="number"
            className="mt-1 w-full p-2 border rounded bg-gray-50"
            value={formData.pricing.remainingPayment}
            readOnly
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Payment Status
          </label>
          <select
            className="mt-1 w-full p-2 border rounded"
            value={formData.pricing.paymentStatus}
            onChange={(e) =>
              handleInputChange("pricing", "paymentStatus", e.target.value)
            }
          >
            <option value="No Payment">No Payment</option>
            <option value="Partial">Partial Payment</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    // ... (rest of your renderStep4 function - no changes needed)
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
            value={formData.transfer.required}
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
            <div>
              <h4 className="font-medium mb-2">Pickup Details</h4>
              <div className="space-y-2">
                <select
                  className="w-full p-2 border rounded"
                  value={formData.transfer.pickup.location}
                  onChange={(e) =>
                    handleInputChange("transfer", "pickup", {
                      ...formData.transfer.pickup,
                      location: e.target.value,
                    })
                  }
                >
                  <option value="">Select Pickup Location</option>
                  <option value="Hotel">Hotel</option>
                  <option value="Airport">Airport</option>
                  <option value="Other">Other</option>
                </select>
                <input
                  type="text"
                  placeholder="Address details"
                  className="w-full p-2 border rounded"
                  value={formData.transfer.pickup.address}
                  onChange={(e) =>
                    handleInputChange("transfer", "pickup", {
                      ...formData.transfer.pickup,
                      address: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Drop-off Details</h4>
              <div className="space-y-2">
                <select
                  className="w-full p-2 border rounded"
                  value={formData.transfer.dropoff.location}
                  onChange={(e) =>
                    handleInputChange("transfer", "dropoff", {
                      ...formData.transfer.dropoff,
                      location: e.target.value,
                    })
                  }
                >
                  <option value="">Select Drop-off Location</option>
                  <option value="Marina">Marina</option>
                  <option value="Hotel">Hotel</option>
                  <option value="Other">Other</option>
                </select>
                <input
                  type="text"
                  placeholder="Address details"
                  className="w-full p-2 border rounded"
                  value={formData.transfer.dropoff.address}
                  onChange={(e) =>
                    handleInputChange("transfer", "dropoff", {
                      ...formData.transfer.dropoff,
                      address: e.target.value,
                    })
                  }
                />
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
        if (!formData.pricing.basePrice || formData.pricing.basePrice <= 0) {
          alert("Please enter a valid base price");
          return false;
        }
        break;

      case 4:
        if (formData.transfer.required) {
          if (!formData.transfer.pickup.location || !formData.transfer.pickup.address) {
            alert("Please complete the pickup details");
            return false;
          }
          if (!formData.transfer.dropoff.location || !formData.transfer.dropoff.address) {
            alert("Please complete the drop-off details");
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
    const createdByInfo = user ? {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
    } : null;

    try {
      setLoading(true);
      const bookingData = {
        ...formData,
        clientSource: formData.clientSource || "",
        clientType: formData.clientType || "",
        selectedPartner: formData.selectedPartner || "",
        clientDetails: {
          name: formData.clientDetails.name || "",
          phone: formData.clientDetails.phone || "",
          email: formData.clientDetails.email || "",
          passportNumber: formData.clientDetails.passportNumber || "",
        },
        bookingDetails: {
          boatCompany: formData.bookingDetails.boatCompany || "",
          boatName: formData.bookingDetails.boatName || "",
          passengers: parseInt(formData.bookingDetails.passengers || 0, 10),
          date: formData.bookingDetails.date || "",
          startTime: formData.bookingDetails.startTime || "",
          endTime: formData.bookingDetails.endTime || "",
        },
        pricing: {
          basePrice: parseFloat(formData.pricing.basePrice || 0),
          discount: parseFloat(formData.pricing.discount || 0),
          finalPrice: parseFloat(formData.pricing.finalPrice || 0),
          deposit: parseFloat(formData.pricing.deposit || 0),
          remainingPayment: parseFloat(formData.pricing.remainingPayment || 0),
          paymentStatus: formData.pricing.paymentStatus || "No Payment",
        },
        transfer: {
          required: formData.transfer.required || false,
          pickup: {
            location: formData.transfer.pickup.location || "",
            address: formData.transfer.pickup.address || "",
          },
          dropoff: {
            location: formData.transfer.dropoff.location || "",
            address: formData.transfer.dropoff.address || "",
          },
        },
        notes: formData.notes || "",
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        status: "active",
        createdBy: createdByInfo,
      };

      if (formData.clientType === "Direct" || ["Hotel", "Collaborator"].includes(formData.clientType)) {
        const clientsRef = collection(db, "clients");

        // Get the hotel/collaborator name from the selected partner
        let partnerDetails = null;
        if (["Hotel", "Collaborator"].includes(formData.clientType) && formData.selectedPartner) {
          // Find the selected partner from our partners array
          const selectedPartner = partners.find(p => p.id === formData.selectedPartner);
          if (selectedPartner) {
            partnerDetails = {
              id: selectedPartner.id,
              name: selectedPartner.name, // This will be the actual hotel/collaborator name
            };
          }
        }

        const clientData = {
          name: formData.clientDetails.name,
          email: formData.clientDetails.email,
          phone: formData.clientDetails.phone,
          passportNumber: formData.clientDetails.passportNumber,
          source: formData.clientType === "Direct" ? formData.clientSource : formData.clientType,
          clientType: formData.clientType,
          // Store hotel/collaborator specific details
          hotelName: formData.clientType === "Hotel" ? partnerDetails?.name : null,     // Add hotel name
          collaboratorName: formData.clientType === "Collaborator" ? partnerDetails?.name : null,  // Add collaborator name
          partnerName: partnerDetails?.name || null,
          partnerId: partnerDetails?.id || null,
          createdAt: new Date().toISOString(),
          createdBy: createdByInfo,
          bookings: [],
          totalBookings: 1,
          totalSpent: bookingData.pricing.finalPrice
        };

        const clientDoc = await addDoc(clientsRef, clientData);
        bookingData.clientId = clientDoc.id;
      }

      const bookingRef = await addDoc(collection(db, "bookings"), bookingData);

      try {
        await sendBookingEmail(bookingData);
        console.log('Confirmation email sent successfully');
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError);
        // Continue with the booking process even if email fails
      }
      if (formData.clientType === "Direct") {
        await updateDoc(doc(db, "clients", bookingData.clientId), {
          bookings: arrayUnion(bookingRef.id)
        });
      }

      alert("Booking saved successfully and confirmation email queued!");
      setFormData({
        clientType: "",
        selectedPartner: "",
        clientSource: "",
        clientDetails: { name: "", phone: "", email: "", passportNumber: "" },
        bookingDetails: { boatCompany: "", boatName: "", passengers: "", date: "", startTime: "", endTime: "" },
        pricing: { basePrice: 0, discount: 0, finalPrice: 0, deposit: 0, remainingPayment: 0, paymentStatus: "No Payment" },
        transfer: { required: false, pickup: { location: "", address: "" }, dropoff: { location: "", address: "" } },
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