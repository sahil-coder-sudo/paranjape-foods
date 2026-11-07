import { useEffect, useRef, useState } from 'react';

export default function DeliveryMapPicker({
  apiKey,
  onAddressSelect,
  currentAddress = {},
  initialCoords = { lat: 18.5204, lng: 73.8567 }, // Pune, Maharashtra
}) {
  const mapContainerRef = useRef(null);
  const searchInputRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [mapError, setMapError] = useState('');
  const [locating, setLocating] = useState(false);
  const [formattedAddressText, setFormattedAddressText] = useState('');

  // 1. Dynamically Load Google Maps JS Script
  useEffect(() => {
    if (!apiKey) {
      setMapError('Google Maps API key not found. You can still type your address manually below.');
      return;
    }

    if (window.google?.maps?.places) {
      setScriptLoaded(true);
      return;
    }

    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => setScriptLoaded(true));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setScriptLoaded(true);
    };

    script.onerror = () => {
      setMapError('Unable to load Google Maps. Please check your API key restrictions or enter your address below.');
    };

    document.head.appendChild(script);
  }, [apiKey]);

  // 2. Initialize Map, Marker, and Autocomplete once script is ready
  useEffect(() => {
    if (!scriptLoaded || !mapContainerRef.current || !window.google?.maps) return;

    try {
      const center = (currentAddress.latitude && currentAddress.longitude)
        ? { lat: Number(currentAddress.latitude), lng: Number(currentAddress.longitude) }
        : initialCoords;

      const map = new window.google.maps.Map(mapContainerRef.current, {
        center,
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }],
          },
        ],
      });
      mapInstanceRef.current = map;

      // Draggable Delivery Pin Marker
      const marker = new window.google.maps.Marker({
        position: center,
        map,
        draggable: true,
        title: 'Delivery Location - Drag to fine-tune',
        animation: window.google.maps.Animation.DROP,
      });
      markerRef.current = marker;

      // Reverse geocode when marker is dragged
      marker.addListener('dragend', () => {
        const pos = marker.getPosition();
        if (pos) {
          reverseGeocode(pos.lat(), pos.lng());
        }
      });

      // Move marker on map click
      map.addListener('click', (e) => {
        if (e.latLng) {
          marker.setPosition(e.latLng);
          reverseGeocode(e.latLng.lat(), e.latLng.lng());
        }
      });

      // Init Places Autocomplete
      if (searchInputRef.current && window.google.maps.places?.Autocomplete) {
        const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
          componentRestrictions: { country: 'in' },
          fields: ['address_components', 'geometry', 'formatted_address', 'name'],
        });

        autocomplete.bindTo('bounds', map);

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (!place.geometry || !place.geometry.location) return;

          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();

          map.setCenter({ lat, lng });
          map.setZoom(16);
          marker.setPosition({ lat, lng });

          parseAndApplyPlace(place, lat, lng);
        });
      }
    } catch (err) {
      console.warn('Map initialization issue:', err);
      setMapError('Google Maps preview unavailable. You can enter your address in the form below.');
    }
  }, [scriptLoaded]);

  // 3. Helper: Parse Place from Autocomplete
  const parseAndApplyPlace = (place, lat, lng) => {
    let buildingName = place.name || '';
    let street = '';
    let city = 'Pune';
    let state = 'Maharashtra';
    let zipCode = '';

    if (place.address_components) {
      place.address_components.forEach((comp) => {
        const types = comp.types;
        if (types.includes('premise') || types.includes('point_of_interest') || types.includes('establishment')) {
          buildingName = comp.long_name;
        }
        if (types.includes('sublocality_level_1') || types.includes('sublocality') || types.includes('route')) {
          street = street ? `${street}, ${comp.long_name}` : comp.long_name;
        }
        if (types.includes('locality')) {
          city = comp.long_name;
        }
        if (types.includes('administrative_area_level_1')) {
          state = comp.long_name;
        }
        if (types.includes('postal_code')) {
          zipCode = comp.long_name;
        }
      });
    }

    if (!street && place.formatted_address) {
      const parts = place.formatted_address.split(',');
      street = parts.slice(1, 3).join(',').trim() || parts[0];
    }

    setFormattedAddressText(place.formatted_address || `${buildingName ? buildingName + ', ' : ''}${street}, ${city}`);

    if (onAddressSelect) {
      onAddressSelect({
        buildingName: buildingName.trim(),
        street: street.trim(),
        city: city.trim(),
        state: state.trim(),
        zipCode: zipCode.trim(),
        latitude: lat,
        longitude: lng,
      });
    }
  };

  // 4. Helper: Reverse Geocode dragged pin coordinates
  const reverseGeocode = (lat, lng) => {
    if (!window.google?.maps?.Geocoder) return;

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        parseAndApplyPlace(results[0], lat, lng);
      }
    });
  };

  // 5. GPS Geolocation: "Use My Current Location"
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Location is not supported by your browser.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setCenter({ lat, lng });
          mapInstanceRef.current.setZoom(16);
          markerRef.current.setPosition({ lat, lng });
        }

        reverseGeocode(lat, lng);
      },
      (err) => {
        setLocating(false);
        alert('Could not access current location. Please ensure location permissions are enabled.');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="delivery-map-picker-card">
      <div className="map-picker-header">
        <label className="map-picker-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span>Select Delivery Location on Map</span>
        </label>

        <button
          type="button"
          className="locate-me-btn"
          onClick={handleUseCurrentLocation}
          disabled={locating}
          title="Use GPS to pinpoint your current location"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="22" y1="12" x2="18" y2="12" />
            <line x1="6" y1="12" x2="2" y2="12" />
            <line x1="12" y1="6" x2="12" y2="2" />
            <line x1="12" y1="22" x2="12" y2="18" />
          </svg>
          <span>{locating ? 'Locating...' : 'Use Current Location'}</span>
        </button>
      </div>

      {/* Google Places Autocomplete Search Box */}
      <div className="map-search-row">
        <svg className="map-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={searchInputRef}
          type="text"
          className="map-search-input"
          placeholder="Search building, street, or area in Pune..."
          aria-label="Search delivery location"
        />
      </div>

      {/* Interactive Map Canvas */}
      <div className="map-canvas-wrapper">
        <div ref={mapContainerRef} className="map-canvas" />
        {!scriptLoaded && !mapError && (
          <div className="map-loading-overlay">
            <div className="map-spinner" />
            <span>Loading Google Maps...</span>
          </div>
        )}
      </div>

      {/* Pin Drag Notice & Detected Address */}
      <div className="map-picker-status-row">
        <span className="map-pin-tip">
          📍 <strong>Tip:</strong> Drag the red pin or tap the map to fine-tune your exact doorstep.
        </span>
        {formattedAddressText && (
          <span className="detected-address-pill" title={formattedAddressText}>
            Selected: {formattedAddressText}
          </span>
        )}
      </div>

      {mapError && (
        <div className="map-notice-banner">
          <span>ℹ️ {mapError}</span>
        </div>
      )}
    </div>
  );
}
