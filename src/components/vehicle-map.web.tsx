import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapConfig, Vehicle, VehicleRoute } from '../types/vehicle';
import { availability } from '../lib/format';

export function VehicleMap({ config, vehicles, selectedVehicleId, route, onVehiclePress }: {
  config: MapConfig; vehicles: Vehicle[]; selectedVehicleId: string; route: VehicleRoute | null;
  onVehiclePress: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markers = useRef<Marker[]>([]);
  const routeFitted = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const selected = vehicles.find((vehicle) => vehicle.id === selectedVehicleId);
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const selectedLatitude = selected?.latitude;
  const selectedLongitude = selected?.longitude;
  const canDisplayMap = selected?.latitude !== null && selected?.latitude !== undefined && selected?.longitude !== null && selected?.longitude !== undefined;

  useEffect(() => {
    const initial = selectedRef.current;
    if (!container.current || !initial || initial.latitude === null || initial.longitude === null) return;
    const map = new maplibregl.Map({
      container: container.current, style: config.styleUrl,
      center: [initial.longitude, initial.latitude], zoom: 9,
      attributionControl: { compact: true }
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => setLoaded(true));
    mapRef.current = map;
    routeFitted.current = false;
    return () => { markers.current.forEach((marker) => marker.remove()); markers.current = []; map.remove(); mapRef.current = null; setLoaded(false); };
  }, [canDisplayMap, config.styleUrl, selectedVehicleId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    markers.current.forEach((marker) => marker.remove());
    markers.current = vehicles.filter(hasCoordinates).map((vehicle) => {
      const isSelected = vehicle.id === selectedVehicleId;
      const stale = !vehicle.positionAt || Date.now() - new Date(vehicle.positionAt).getTime() > 15 * 60_000;
      const element = document.createElement('button');
      element.type = 'button';
      element.title = vehicle.registrationNumber;
      element.setAttribute('aria-label', `Mașina ${vehicle.registrationNumber}`);
      Object.assign(element.style, {
        width: isSelected ? '26px' : '20px', height: isSelected ? '26px' : '20px', borderRadius: '50%',
        border: '3px solid white', background: isSelected ? '#ef4444' : '#8b5cf6',
        boxShadow: '0 2px 10px rgba(0,0,0,.65)', cursor: 'pointer', opacity: stale ? '.55' : '1'
      });
      const popupContent = document.createElement('div');
      Object.assign(popupContent.style, { color: '#111827', minWidth: '180px', fontFamily: 'system-ui, sans-serif' });
      const title = document.createElement('strong'); title.textContent = vehicle.registrationNumber; popupContent.appendChild(title);
      const details = document.createElement('div');
      details.textContent = `${vehicle.driverName || 'Șofer nespecificat'} · ${availability(vehicle.availability)} · ${location(vehicle)}`;
      Object.assign(details.style, { marginTop: '6px', lineHeight: '1.35' }); popupContent.appendChild(details);
      const updated = document.createElement('div'); updated.textContent = `${stale ? 'Poziție veche' : 'Poziție recentă'}${vehicle.positionAt ? ` · ${positionTime(vehicle.positionAt)}` : ''}`;
      Object.assign(updated.style, { marginTop: '5px', color: stale ? '#b45309' : '#047857', fontWeight: '700' }); popupContent.appendChild(updated);
      if (!isSelected) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Vezi mașina';
        Object.assign(button.style, { marginTop: '9px', border: '0', borderRadius: '6px', background: '#2563eb', color: 'white', padding: '7px 10px', cursor: 'pointer', fontWeight: '700' });
        button.addEventListener('click', () => onVehiclePress(vehicle.id)); popupContent.appendChild(button);
      }
      return new maplibregl.Marker({ element }).setLngLat([vehicle.longitude!, vehicle.latitude!])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setDOMContent(popupContent)).addTo(map);
    });
  }, [loaded, onVehiclePress, selectedVehicleId, vehicles]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || selectedLatitude === null || selectedLatitude === undefined || selectedLongitude === null || selectedLongitude === undefined) return;
    map.easeTo({ center: [selectedLongitude, selectedLatitude], duration: 700 });
  }, [loaded, selectedLatitude, selectedLongitude]);

  useEffect(() => { routeFitted.current = false; }, [route?.destination?.latitude, route?.destination?.longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const source = map.getSource('vehicle-route') as GeoJSONSource | undefined;
    if (route?.status !== 'ready' || !route.feature) {
      if (source) source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    if (source) source.setData(route.feature);
    else {
      map.addSource('vehicle-route', { type: 'geojson', data: route.feature });
      map.addLayer({ id: 'vehicle-route-line', type: 'line', source: 'vehicle-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#3b82f6', 'line-width': 6, 'line-opacity': .9 } });
    }
    if (!routeFitted.current && selected && route.destination) {
      const bounds = new maplibregl.LngLatBounds();
      bounds.extend([selected.longitude!, selected.latitude!]);
      bounds.extend([route.destination.longitude, route.destination.latitude]);
      map.fitBounds(bounds, { padding: 70, maxZoom: 13, duration: 800 });
      routeFitted.current = true;
    }
  }, [loaded, route, selected]);

  if (!selected || selected.latitude === null || selected.longitude === null) {
    return <div style={fallbackStyle}>Poziția GPS nu este disponibilă pentru această mașină.</div>;
  }
  return <div ref={container} style={{ width: '100%', height: 440, borderRadius: 12, overflow: 'hidden', background: '#0b1018' }} />;
}

function hasCoordinates(vehicle: Vehicle): vehicle is Vehicle & { latitude: number; longitude: number } {
  return vehicle.latitude !== null && vehicle.longitude !== null && Number.isFinite(vehicle.latitude) && Number.isFinite(vehicle.longitude);
}
function location(vehicle: Vehicle) { return [vehicle.city, vehicle.country].filter(Boolean).join(', ') || 'Locație nespecificată'; }
function positionTime(value: string) {
  return new Intl.DateTimeFormat('ro-RO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Bucharest' }).format(new Date(value));
}
const fallbackStyle = { height: 300, borderRadius: 12, background: '#0b1018', color: '#99a8bc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center' as const };
