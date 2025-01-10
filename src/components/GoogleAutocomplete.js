import React, { useRef, useEffect } from "react";

const GoogleAutocomplete = ({ placeholder, onPlaceSelected }) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!window.google) return;

    // Define the geographical bounds for Ibiza
    const ibizaBounds = new window.google.maps.LatLngBounds(
      { lat: 38.8, lng: 1.2 }, 
      { lat: 39.1, lng: 1.6 }  
    );

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "ES" }, 
      bounds: ibizaBounds, // Prioritise Ibiza
      strictBounds: false, 
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        onPlaceSelected({
          address: place.formatted_address,
          latitude: place.geometry.location.lat(),
          longitude: place.geometry.location.lng(),
          name: place.name || null, // Include establishment name if available
          placeId: place.place_id || null, // Include Google Place ID
        });
      }
    });
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder={placeholder}
      className="w-full p-2 border rounded"
    />
  );
};
export default GoogleAutocomplete;

