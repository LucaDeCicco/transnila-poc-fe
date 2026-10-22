import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapConfig } from '../types/vehicle';

export function LocationPreviewMap({ config, latitude, longitude, approximate, height = 250 }: {
  config: MapConfig; latitude: number; longitude: number; approximate: boolean; height?: number;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<Marker | null>(null);

  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current, style: config.styleUrl, center: [longitude, latitude], zoom: approximate ? 11 : 15,
      attributionControl: { compact: true }
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    const element = document.createElement('div');
    Object.assign(element.style, {
      width: '24px', height: '24px', borderRadius: '50%', background: approximate ? '#f59e0b' : '#34d399',
      border: '4px solid white', boxShadow: '0 2px 12px rgba(0,0,0,.7)'
    });
    markerRef.current = new maplibregl.Marker({ element }).setLngLat([longitude, latitude]).addTo(map);
    mapRef.current = map;
    return () => { markerRef.current?.remove(); markerRef.current = null; map.remove(); mapRef.current = null; };
  }, [approximate, config.styleUrl, latitude, longitude]);

  return <div ref={container} style={{ width: '100%', height, borderRadius: 12, overflow: 'hidden', background: '#0b1018' }} />;
}
