// in loadGoogleMaps.js
export default async function loadGoogleMaps() {
  if (window.google && window.google.maps) return Promise.resolve();

  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geocoding`;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', resolve);
    script.addEventListener('error', reject);
    document.head.appendChild(script);
  });
}
