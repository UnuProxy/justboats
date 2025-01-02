// AddExpense.js
import React, { useState, useRef, useEffect } from "react";
import { db, storage, auth } from "../firebase/firebaseConfig";
import { collection, addDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { X } from 'lucide-react';

const AddExpense = () => {
 const [imageSrc, setImageSrc] = useState(null);
 const [imageFile, setImageFile] = useState(null);
 const fileInputRef = useRef(null);
 const [expenseType, setExpenseType] = useState("");
 const [bookings, setBookings] = useState([]);
 const [searchQuery, setSearchQuery] = useState("");
 const [selectedBookingId, setSelectedBookingId] = useState("");

 const [expenseData, setExpenseData] = useState({
   date: new Date().toISOString().slice(0, 10),
   category: "",
   description: "",
   amount: "",
   imageURL: null,
   paymentStatus: "pending",
   paymentMethod: "",
   bookingId: "",
   invoiceNumber: "",
   dueDate: "",
 });

 useEffect(() => {
   const fetchBookings = async () => {
     try {
       const bookingsRef = collection(db, 'bookings');
       const snapshot = await getDocs(bookingsRef);
       const bookingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
       setBookings(bookingsData);
     } catch (error) {
       console.error("Error fetching bookings:", error);
     }
   };
   fetchBookings();
 }, []);

 const handleInputChange = (event) => {
   const { name, value } = event.target;
   setExpenseData((prev) => ({ ...prev, [name]: value }));
 };

 const handleImageChange = (event) => {
   const file = event.target.files[0];
   if (file) {
     setImageFile(file);
     const reader = new FileReader();
     reader.onloadend = () => {
       setImageSrc(reader.result);
     };
     reader.readAsDataURL(file);
   } else {
     setImageFile(null);
     setImageSrc(null);
   }
 };

 const handleSubmit = async (event) => {
   event.preventDefault();

   try {
     let imageURL = null;
     if (imageFile) {
       const storageRef = ref(storage, `expenses/${Date.now()}-${imageFile.name}`);
       const uploadResult = await uploadBytes(storageRef, imageFile);
       imageURL = await getDownloadURL(uploadResult.ref);
     }

     const docRef = await addDoc(collection(db, "expenses"), {
       ...expenseData,
       bookingId: selectedBookingId,
       imageURL: imageURL,
       type: expenseType,
       addedBy: auth.currentUser.uid,
       timestamp: serverTimestamp(),
     });
     console.log("Expense added with ID: ", docRef.id);

     // Reset form
     setExpenseData({
       date: new Date().toISOString().slice(0, 10),
       category: "",
       description: "",
       amount: "",
       imageURL: null,
       paymentStatus: "pending",
       paymentMethod: "",
       bookingId: "",
       invoiceNumber: "",
       dueDate: "",
     });
     setSelectedBookingId("");
     setImageSrc(null);
     setImageFile(null);
     if (fileInputRef.current) {
       fileInputRef.current.value = "";
     }
   } catch (error) {
     console.error("Error adding expense: ", error);
     alert("Error adding expense. Please try again.");
   }
 };

 const filteredBookings = bookings.filter(booking => {
   const searchTerm = searchQuery.toLowerCase();
   return (
     booking.clientDetails?.name?.toLowerCase().includes(searchTerm) ||
     booking.bookingDetails?.boatName?.toLowerCase().includes(searchTerm) ||
     booking.bookingDetails?.date?.includes(searchTerm) ||
     booking.transfer?.pickup?.location?.toLowerCase().includes(searchTerm)
   );
 });

 const handleBookingSelect = (bookingId) => {
   setSelectedBookingId(bookingId);
 };

 const handleClearSelection = () => {
   setSelectedBookingId("");
 };

 return (
   <div className="p-4 max-w-md mx-auto bg-white shadow-md rounded-lg">
     <div className="mb-6">
       <h2 className="text-xl font-semibold mb-4">Expense Type</h2>
       <div className="grid grid-cols-3 gap-2">
         <button
           onClick={() => setExpenseType("company")}
           className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
             expenseType === "company"
               ? "bg-blue-500 text-white"
               : "bg-gray-100 text-gray-600 hover:bg-gray-200"
           }`}
         >
           Company
         </button>
         <button
           onClick={() => setExpenseType("client")}
           className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
             expenseType === "client"
               ? "bg-green-500 text-white"
               : "bg-gray-100 text-gray-600 hover:bg-gray-200"
           }`}
         >
           Client
         </button>
         <button
           onClick={() => setExpenseType("invoice")}
           className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
             expenseType === "invoice"
               ? "bg-purple-500 text-white"
               : "bg-gray-100 text-gray-600 hover:bg-gray-200"
           }`}
         >
           Invoice
         </button>
       </div>
     </div>

     {expenseType && (
       <form onSubmit={handleSubmit} className="space-y-4">
         {/* Date Input */}
         <div className="mb-4">
           <label htmlFor="date" className="block text-gray-700 text-sm font-bold mb-2">
             Date:
           </label>
           <input
             type="date"
             id="date"
             name="date"
             value={expenseData.date}
             onChange={handleInputChange}
             className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
             required
           />
         </div>

         {/* Category Input */}
         <div className="mb-4">
           <label htmlFor="category" className="block text-gray-700 text-sm font-bold mb-2">
             Category:
           </label>
           <select
             id="category"
             name="category"
             value={expenseData.category}
             onChange={handleInputChange}
             className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
             required
           >
             <option value="">Select Category</option>
             {expenseType === 'company' && (
               <>
                 <option value="Fuel">Fuel</option>
                 <option value="Maintenance">Maintenance</option>
                 <option value="Marketing">Marketing</option>
                 <option value="Office Supplies">Office Supplies</option>
                 <option value="Travel">Travel</option>
                 <option value="Boat">Boat</option>
                 <option value="Other">Other</option>
               </>
             )}
             {expenseType === 'client' && (
               <>
                 <option value="Shopping">Shopping</option>
                 <option value="Delivery">Delivery</option>
                 <option value="Other">Other</option>
               </>
             )}
             {expenseType === 'invoice' && (
               <option value="Boat">Boat</option>
             )}
           </select>
         </div>

         {/* Invoice-specific fields */}
         {expenseType === "invoice" && (
           <>
             <div className="mb-4">
               <label className="block text-gray-700 text-sm font-bold mb-2">
                 Search Booking:
               </label>
               <input
                 type="text"
                 placeholder="Search by client, boat, date, or hotel"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mb-2"
               />
               <ul className="border rounded overflow-y-auto h-40">
                 {filteredBookings.length > 0 ? (
                   filteredBookings.map(booking => (
                     <li
                       key={booking.id}
                       onClick={() => handleBookingSelect(booking.id)}
                       className={`px-4 py-2 hover:bg-gray-100 cursor-pointer ${
                         selectedBookingId === booking.id ? 'bg-blue-100' : ''
                       }`}
                     >
                       {booking.clientDetails?.name} - {booking.bookingDetails?.boatName} ({booking.bookingDetails?.date})
                     </li>
                   ))
                 ) : (
                   <li className="px-4 py-2 text-gray-500">No matching bookings</li>
                 )}
               </ul>
               
               {selectedBookingId && (
                 <div className="mt-2 p-2 bg-gray-50 border rounded flex justify-between items-center">
                   <div>
                     <p className="text-gray-800 font-medium">
                       {bookings.find(booking => booking.id === selectedBookingId)?.clientDetails?.name} -{' '}
                       {bookings.find(booking => booking.id === selectedBookingId)?.bookingDetails?.boatName} ({bookings.find(booking => booking.id === selectedBookingId)?.bookingDetails?.date})
                     </p>
                   </div>
                   <button 
                     type="button" 
                     onClick={handleClearSelection} 
                     className="text-gray-500 hover:text-gray-700 focus:outline-none"
                   >
                     <X className="h-4 w-4" />
                   </button>
                 </div>
               )}
             </div>

             <div className="mb-4">
               <label htmlFor="invoiceNumber" className="block text-gray-700 text-sm font-bold mb-2">
                 Invoice Number:
               </label>
               <input
                 type="text"
                 id="invoiceNumber"
                 name="invoiceNumber"
                 value={expenseData.invoiceNumber}
                 onChange={handleInputChange}
                 className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                 required
               />
             </div>

             <div className="mb-4">
               <label htmlFor="dueDate" className="block text-gray-700 text-sm font-bold mb-2">
                 Due Date:
               </label>
               <input
                 type="date"
                 id="dueDate"
                 name="dueDate"
                 value={expenseData.dueDate}
                 onChange={handleInputChange}
                 className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                 required
               />
             </div>

             <div className="mb-4">
               <label htmlFor="paymentStatus" className="block text-gray-700 text-sm font-bold mb-2">
                 Payment Status:
               </label>
               <select
                 id="paymentStatus"
                 name="paymentStatus"
                 value={expenseData.paymentStatus}
                 onChange={handleInputChange}
                 className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                 required
               >
                 <option value="pending">Pending</option>
                 <option value="paid">Paid</option>
               </select>
             </div>

             <div className="mb-4">
               <label htmlFor="paymentMethod" className="block text-gray-700 text-sm font-bold mb-2">
                 Payment Method:
               </label>
               <select
                 id="paymentMethod"
                 name="paymentMethod"
                 value={expenseData.paymentMethod}
                 onChange={handleInputChange}
                 className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                 required={expenseData.paymentStatus === "paid"}
               >
                 <option value="">Select Payment Method</option>
                 <option value="cash">Cash</option>
                 <option value="bank">Bank Transfer</option>
                 <option value="card">Card</option>
               </select>
             </div>
           </>
         )}

         {/* Description Input */}
         <div className="mb-4">
           <label htmlFor="description" className="block text-gray-700 text-sm font-bold mb-2">
             Description:
           </label>
           <input
             type="text"
             id="description"
             name="description"
             value={expenseData.description}
             onChange={handleInputChange}
             className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
             required
           />
         </div>

         {/* Amount Input */}
         <div className="mb-4">
           <label htmlFor="amount" className="block text-gray-700 text-sm font-bold mb-2">
             Amount:
           </label>
           <input
             type="number"
             id="amount"
             name="amount"
             value={expenseData.amount}
             onChange={handleInputChange}
             className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
             required
           />
         </div>

         {/* Image Upload Input */}
         <div className="mb-4">
           <label htmlFor="image" className="block text-gray-700 text-sm font-bold mb-2">
             Upload Receipt/Invoice (Optional):
           </label>
           <input
             type="file"
             id="image"
             name="image"
             accept="image/*"
             onChange={handleImageChange}
             ref={fileInputRef}
             className="w-full"
           />
         </div>

         {imageSrc && (
           <div className="mb-4">
             <img src={imageSrc} alt="Uploaded Receipt" className="w-full rounded-lg" />
           </div>
         )}

         <button
           type="submit"
           className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded"
         >
           Submit
         </button>
       </form>
     )}
   </div>
 );
};

export default AddExpense;