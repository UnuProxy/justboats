import React, { useState, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import useGoogleMaps from '../hooks/useGoogleMaps';

const MeetingPointSelector = ({ value, onChange }) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [marker, setMarker] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [geocoder, setGeocoder] = useState(null);
  const { isLoaded } = useGoogleMaps();

  // Initialize map and geocoder
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    try {
      // Initialize geocoder
      const geocoderInstance = new window.google.maps.Geocoder();
      setGeocoder(geocoderInstance);
      console.log('Geocoder initialized successfully');

      // Initialize map
      const initialCenter = { lat: 38.9067, lng: 1.4206 }; // Ibiza center
      const newMap = new window.google.maps.Map(mapRef.current, {
        center: initialCenter,
        zoom: 13,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ],
      });

      setMap(newMap);

      // Set initial marker if value exists
      if (value?.latitude && value?.longitude) {
        const position = {
          lat: parseFloat(value.latitude),
          lng: parseFloat(value.longitude),
        };

        const newMarker = new window.google.maps.Marker({
          position,
          map: newMap,
          draggable: true,
        });

        setMarker(newMarker);
        newMap.setCenter(position);
        newMarker.addListener("dragend", handleMarkerDragEnd);
      }

      // Add click handler to map
      newMap.addListener("click", handleMapClick);
    } catch (error) {
      console.error('Error initializing map:', error);
    }

    return () => {
      if (marker) {
        window.google.maps.event.clearListeners(marker, 'dragend');
        marker.setMap(null);
      }
      if (map) {
        window.google.maps.event.clearListeners(map, 'click');
      }
    };
  }, [isLoaded, value]);

  const getAddressFromCoordinates = async (lat, lng) => {
    if (!geocoder) {
      console.warn('Geocoder not initialized');
      return null;
    }

    try {
      const response = await geocoder.geocode({
        location: { lat, lng },
        language: 'en'
      });

      if (response.results && response.results[0]) {
        console.log('Address found:', response.results[0].formatted_address);
        return response.results[0].formatted_address;
      }
      console.warn('No results found for coordinates:', { lat, lng });
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  const formatLocationData = (location, address = null) => {
    if (!location) return null;

    const lat = parseFloat(location.latitude);
    const lng = parseFloat(location.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      console.error('Invalid coordinates:', location);
      return null;
    }

    const coordsString = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
    const locationAddress = address || location.address || 'Address pending...';
    const displayString = `${locationAddress} (Coordinates: ${coordsString})`;

    return {
      address: locationAddress,
      description: locationAddress,
      latitude: lat,
      longitude: lng,
      placeId: location.placeId || '',
      coordinates: coordsString,
      mapsLink: mapsLink,
      displayString: displayString
    };
  };

  const handleLocationSelect = async (location) => {
    if (!location?.latitude || !location?.longitude) {
      console.error('Invalid location data:', location);
      return;
    }

    const lat = parseFloat(location.latitude);
    const lng = parseFloat(location.longitude);

    const address = await getAddressFromCoordinates(lat, lng);
    const formattedLocation = formatLocationData(location, address);

    if (!formattedLocation) {
      console.error('Failed to format location data');
      return;
    }

    console.log('Formatted location data:', formattedLocation);
    setSelectedPlace(formattedLocation);
    onChange(formattedLocation);

    // Update map and marker
    const position = { lat, lng };
    if (marker) {
      marker.setPosition(position);
    } else if (map) {
      const newMarker = new window.google.maps.Marker({
        position,
        map,
        draggable: true
      });
      setMarker(newMarker);
      newMarker.addListener('dragend', handleMarkerDragEnd);
    }

    map?.panTo(position);
  };

  const handleMarkerDragEnd = async (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    const address = await getAddressFromCoordinates(lat, lng);

    handleLocationSelect({
      latitude: lat,
      longitude: lng,
      address: address || 'Address not available',
      placeId: ''
    });
  };

  const handleMapClick = async (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    const address = await getAddressFromCoordinates(lat, lng);

    handleLocationSelect({
      latitude: lat,
      longitude: lng,
      address: address || 'Address not available',
      placeId: ''
    });
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-gray-100 rounded-lg">
        <div className="text-gray-500">Loading map...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MapPin className="w-5 h-5 text-gray-500" />
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Meeting Point
          </label>
          <input
            type="text"
            className="w-full p-2 border rounded-lg"
            placeholder="Search or click on map to drop pin"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div
        ref={mapRef}
        className="w-full h-[400px] rounded-lg border border-gray-200 shadow-sm"
      />

      {selectedPlace && (
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="font-medium">{selectedPlace.description}</div>
          <div className="text-sm text-gray-600">{selectedPlace.address}</div>
          <div className="text-xs text-gray-500 mt-1">
            Coordinates: {selectedPlace.coordinates}
          </div>
          <a 
            href={selectedPlace.mapsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700 text-sm mt-2 inline-block"
          >
            View on Google Maps
          </a>
        </div>
      )}
    </div>
  );
};

export default MeetingPointSelector;
