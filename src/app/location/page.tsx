import React, { useState } from 'react';
import { GoogleMap, InfoWindow, Marker } from '@react-google-maps/api';

const LocationPage: React.FC = () => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null);
  const [showInfoWindow, setShowInfoWindow] = useState(false);
  const [center, setCenter] = useState({ lat: 0, lng: 0 });
  const [mapStyles, setMapStyles] = useState([]);

  const handleMarkerClick = (marker: Marker) => {
    setSelectedMarker(marker);
    setShowInfoWindow(true);
  };

  const renderMarkers = () => {
    if (!map || !markers.length) return null;

    return markers.map((marker) => {
      const isSelected = selectedMarker?.id === marker.id;
      const markerColor = isSelected ? '#FF0000' : '#0000FF';
      const markerSize = isSelected ? 40 : 30;

      return (
        <Marker
          key={marker.id}
          position={{ lat: marker.latitude, lng: marker.longitude }}
          onClick={() => handleMarkerClick(marker)}
          icon={{
            url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${markerSize}" height="${markerSize}" viewBox="0 0 24 24" fill="${markerColor}"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
            scaledSize: new google.maps.Size(markerSize, markerSize),
            anchor: new google.maps.Point(markerSize / 2, markerSize),
          }}
        />
      );
    });
  };

  const onMapLoad = (map: google.maps.Map) => {
    setMap(map);
    setCenter({ lat: map.getCenter()?.lat() || 0, lng: map.getCenter()?.lng() || 0 });
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 relative">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={center}
          zoom={15}
          onLoad={onMapLoad}
          options={{
            styles: mapStyles,
            disableDefaultUI: true,
            zoomControl: true,
          }}
        >
          {renderMarkers()}
          {showInfoWindow && selectedMarker && (
            <InfoWindow
              position={{
                lat: selectedMarker.latitude,
                lng: selectedMarker.longitude,
              }}
              onCloseClick={() => setShowInfoWindow(false)}
            >
              <div className="p-2">
                <h3 className="font-bold">{selectedMarker.name}</h3>
                <p>{selectedMarker.address}</p>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>
    </div>
  );
};

export default LocationPage; 