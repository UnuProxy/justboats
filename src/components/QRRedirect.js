import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, increment, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from "../firebase/firebaseConfig";

const QRRedirect = () => {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [debugInfo, setDebugInfo] = useState({
        step: 'initializing',
        placeId: id,
        placeData: null,
        whatsappUrl: null,
        errorDetails: null
    });

    useEffect(() => {
        console.log("QRRedirect mounted with ID:", id);
        const redirectToWhatsApp = async () => {
            try {
                // Step 1: Update debug info
                setDebugInfo(prev => ({...prev, step: 'fetching_place_data'}));
                console.log("Fetching place data for ID:", id);

                // Step 2: Get the place data from Firestore
                const placeDocRef = doc(db, "places", id);
                const placeDoc = await getDoc(placeDocRef);

                if (!placeDoc.exists()) {
                    console.error("Place document not found");
                    setError("QR code not found");
                    setDebugInfo(prev => ({
                        ...prev, 
                        step: 'error',
                        errorDetails: 'Document not found'
                    }));
                    setLoading(false);
                    return;
                }

                const placeData = placeDoc.data();
                console.log("Place data retrieved:", placeData);
                setDebugInfo(prev => ({...prev, step: 'place_data_found', placeData}));
                
                // Step 3: Log the scan in the database
                try {
                    setDebugInfo(prev => ({...prev, step: 'logging_scan'}));
                    await addDoc(collection(db, "placeScanEvents"), {
                        placeId: id,
                        placeName: placeData.name,
                        placeType: placeData.type,
                        timestamp: serverTimestamp(),
                        userAgent: navigator.userAgent,
                        referrer: document.referrer || "direct"
                    });
                    console.log("Scan logged successfully");
                } catch (logError) {
                    // Continue even if logging fails
                    console.error("Error logging scan:", logError);
                    setDebugInfo(prev => ({
                        ...prev, 
                        step: 'logging_error',
                        errorDetails: logError.message
                    }));
                }

                // Step 4: Increment the scan count
                try {
                    setDebugInfo(prev => ({...prev, step: 'incrementing_counter'}));
                    await updateDoc(placeDocRef, {
                        scanCount: increment(1)
                    });
                    console.log("Scan count incremented");
                } catch (updateError) {
                    // Continue even if update fails
                    console.error("Error incrementing scan count:", updateError);
                    setDebugInfo(prev => ({
                        ...prev, 
                        step: 'increment_error',
                        errorDetails: updateError.message
                    }));
                }

                // Step 5: Get WhatsApp number and message from place data
                setDebugInfo(prev => ({...prev, step: 'preparing_whatsapp_url'}));
                const whatsappNumber = placeData.whatsappNumber;
                
                // Log the phone number to check format
                console.log("WhatsApp Number (raw):", whatsappNumber);
                
                // Clean the phone number
                const cleanNumber = whatsappNumber.replace(/\D/g, '');
                console.log("WhatsApp Number (cleaned):", cleanNumber);
                
                // Personalize message with place name
                let message = placeData.whatsappMessage || "Hello! I just scanned your QR code.";
                if (message.includes('${placeName}')) {
                    message = message.replace('${placeName}', placeData.name);
                }
                
                const encodedMessage = encodeURIComponent(message);
                console.log("Encoded Message:", encodedMessage);
                
                // Construct WhatsApp URL
                const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
                console.log("WhatsApp URL:", whatsappUrl);
                
                setDebugInfo(prev => ({...prev, step: 'redirecting', whatsappUrl}));

                // Step 6: Redirect to WhatsApp after a short delay (for debugging)
                setTimeout(() => {
                    console.log("Executing redirect to:", whatsappUrl);
                    window.location.href = whatsappUrl;
                }, 500);
            } catch (error) {
                console.error("Error in redirectToWhatsApp:", error);
                setError("An error occurred. Please try again.");
                setDebugInfo(prev => ({
                    ...prev, 
                    step: 'fatal_error',
                    errorDetails: error.message
                }));
                setLoading(false);
            }
        };

        redirectToWhatsApp();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-blue-500 to-cyan-500 flex flex-col items-center justify-center text-white p-6">
                <div className="w-32 h-32 mb-6">
                    <img 
                        src="/WhiteLogo-Just-Enjoy.png" 
                        alt="Just Enjoy Ibiza" 
                        className="w-full h-auto"
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect fill='white' width='100' height='100'/><text fill='gray' font-family='Arial' font-size='14' x='10' y='50'>Logo</text></svg>";
                        }}
                    />
                </div>
                
                <h1 className="text-2xl font-bold mb-4">Connecting you with Just Enjoy Ibiza</h1>
                
                <div className="flex space-x-2 mt-2">
                    <div className="w-3 h-3 bg-white rounded-full animate-bounce"
                        style={{ animationDelay: '-0.32s' }}
                    />
                    <div className="w-3 h-3 bg-white rounded-full animate-bounce"
                        style={{ animationDelay: '-0.16s' }}
                    />
                    <div className="w-3 h-3 bg-white rounded-full animate-bounce" />
                </div>
                
                <p className="mt-6 text-center opacity-80">
                    Youll be connected on WhatsApp momentarily...
                </p>
                
                {/* Debug information (remove in production) */}
                <div className="mt-8 p-4 bg-blue-600 rounded-md text-sm text-left w-full max-w-lg opacity-70">
                    <p className="font-bold mb-1">Debug Information:</p>
                    <ul className="space-y-1">
                        <li>Step: {debugInfo.step}</li>
                        <li>Place ID: {debugInfo.placeId}</li>
                        {debugInfo.errorDetails && (
                            <li>Error: {debugInfo.errorDetails}</li>
                        )}
                        {debugInfo.whatsappUrl && (
                            <li>URL: {debugInfo.whatsappUrl}</li>
                        )}
                    </ul>
                    
                    {/* Manual redirect button */}
                    {debugInfo.whatsappUrl && (
                        <a
                            href={debugInfo.whatsappUrl}
                            className="block w-full mt-4 py-2 bg-white text-blue-700 text-center rounded-md font-medium"
                        >
                            Open WhatsApp Manually
                        </a>
                    )}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6">
                <div className="w-32 h-32 mb-6">
                    <img 
                        src="/WhiteLogo-Just-Enjoy.png" 
                        alt="Just Enjoy Ibiza" 
                        className="w-full h-auto"
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect fill='white' width='100' height='100'/><text fill='gray' font-family='Arial' font-size='14' x='10' y='50'>Logo</text></svg>";
                        }}
                    />
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
                    <p className="text-gray-700 mb-6">{error}</p>
                    <a 
                        href="https://justenjoy.com" 
                        className="block w-full py-2 px-4 bg-blue-600 text-white text-center rounded-md hover:bg-blue-700"
                    >
                        Go to Website
                    </a>
                </div>
                
                {/* Debug information */}
                <div className="mt-6 p-4 bg-gray-200 rounded-md text-sm text-left w-full max-w-lg">
                    <p className="font-bold mb-1">Debug Information:</p>
                    <pre className="whitespace-pre-wrap overflow-auto max-h-60">
                        {JSON.stringify(debugInfo, null, 2)}
                    </pre>
                </div>
            </div>
        );
    }

    return null;
};

export default QRRedirect;