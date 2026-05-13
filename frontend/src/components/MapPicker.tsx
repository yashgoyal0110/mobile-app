/**
 * Cross-platform map-based location picker (works in Expo Go, Web preview, APK).
 *
 * Uses a WebView with Leaflet + OpenStreetMap tiles. Communication is via
 * window.ReactNativeWebView.postMessage. On web we render the same HTML in an
 * iframe-equivalent (WebView falls back to a regular browser frame).
 *
 * Free provider: tiles from openstreetmap.org, search/routing proxied through
 * the backend (/api/geo/*). Easy to swap to Google in the backend later.
 */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { View, StyleSheet, ActivityIndicator, Platform, TextInput, TouchableOpacity, FlatList, Alert } from "react-native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { Feather } from "@expo/vector-icons";
import { TText } from "./TText";
import { api } from "../api";
import { colors, radius, spacing, shadows } from "../theme";

export interface LatLng {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
}

export interface MapPickerProps {
  pickup: LatLng | null;
  drop: LatLng | null;
  mode: "pickup" | "drop";
  onChange: (mode: "pickup" | "drop", coord: LatLng) => void;
  bbox?: { south: number; north: number; west: number; east: number };
  center?: { lat: number; lng: number };
  polyline?: [number, number][] | null;
  height?: number;
}

const DEFAULT_BBOX = { south: 27.40, north: 27.60, west: 77.38, east: 77.58 };
const DEFAULT_CENTER = { lat: 27.4985, lng: 77.4615 };

function buildHtml(center: { lat: number; lng: number }, bbox: { south: number; north: number; west: number; east: number }) {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#f4ede1;}
  .pkmark{filter:hue-rotate(120deg) saturate(2);} 
  .drmark{filter:hue-rotate(-50deg) saturate(2);} 
  .leaflet-control-attribution{font-size:9px;}
  .recenter-btn{position:absolute;right:10px;bottom:60px;z-index:1000;background:#fff;border:none;border-radius:50%;width:44px;height:44px;box-shadow:0 2px 6px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;}
</style>
</head><body>
<div id="map"></div>
<button class="recenter-btn" id="recenter" title="Recenter">⊙</button>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const bbox = ${JSON.stringify(bbox)};
  const center = ${JSON.stringify(center)};
  const map = L.map('map', { zoomControl:false, attributionControl:true }).setView([center.lat, center.lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution:'© OSM'
  }).addTo(map);
  L.control.zoom({position:'topleft'}).addTo(map);
  const sw = L.latLng(bbox.south, bbox.west), ne = L.latLng(bbox.north, bbox.east);
  map.setMaxBounds(L.latLngBounds(sw, ne));
  map.setMinZoom(12);

  let pickupMarker = null, dropMarker = null, routeLine = null;
  let currentMode = 'pickup';
  function send(msg){
    if(window.ReactNativeWebView && window.ReactNativeWebView.postMessage){
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    } else {
      window.parent && window.parent.postMessage(JSON.stringify(msg),'*');
    }
  }
  function makeIcon(emoji, bg){
    return L.divIcon({
      className:'',
      html:'<div style="background:'+bg+';width:34px;height:34px;border-radius:18px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:16px;">'+emoji+'</div>',
      iconSize:[34,34], iconAnchor:[17,17]
    });
  }
  const ICON_PICKUP = makeIcon('🟢','#2A8F47');
  const ICON_DROP = makeIcon('🔴','#D64545');
  function setPickup(latlng){
    if(pickupMarker){ pickupMarker.setLatLng(latlng); } else { pickupMarker = L.marker(latlng,{icon:ICON_PICKUP, draggable:true}).addTo(map);
      pickupMarker.on('dragend', e=>{ const ll = e.target.getLatLng(); send({type:'pick',mode:'pickup',lat:ll.lat,lng:ll.lng});});
    }
  }
  function setDrop(latlng){
    if(dropMarker){ dropMarker.setLatLng(latlng); } else { dropMarker = L.marker(latlng,{icon:ICON_DROP, draggable:true}).addTo(map);
      dropMarker.on('dragend', e=>{ const ll = e.target.getLatLng(); send({type:'pick',mode:'drop',lat:ll.lat,lng:ll.lng});});
    }
  }
  map.on('click', e=>{
    if(currentMode==='pickup'){ setPickup(e.latlng); }
    else { setDrop(e.latlng); }
    send({type:'pick', mode:currentMode, lat:e.latlng.lat, lng:e.latlng.lng});
  });
  document.getElementById('recenter').onclick = ()=>{ map.setView([center.lat, center.lng], 14); send({type:'recenter'}); };

  window.handleHostMsg = function(raw){
    try {
      const msg = (typeof raw === 'string') ? JSON.parse(raw) : raw;
      if(msg.type==='setMode'){ currentMode = msg.mode; send({type:'modeChanged',mode:currentMode}); }
      else if(msg.type==='setPickup'){ setPickup({lat:msg.lat,lng:msg.lng}); }
      else if(msg.type==='setDrop'){ setDrop({lat:msg.lat,lng:msg.lng}); }
      else if(msg.type==='clearPickup'){ if(pickupMarker){ map.removeLayer(pickupMarker); pickupMarker=null; } }
      else if(msg.type==='clearDrop'){ if(dropMarker){ map.removeLayer(dropMarker); dropMarker=null; } }
      else if(msg.type==='fly'){ map.flyTo([msg.lat,msg.lng], msg.zoom||16); }
      else if(msg.type==='polyline'){
        if(routeLine){ map.removeLayer(routeLine); routeLine=null; }
        if(msg.points && msg.points.length){
          routeLine = L.polyline(msg.points, { color:'#E5944D', weight:5, opacity:0.85 }).addTo(map);
          map.fitBounds(routeLine.getBounds(), { padding:[40,40] });
        }
      }
    } catch(e){ send({type:'err',msg:String(e)}); }
  };
  // Web iframe: parent posts via window.postMessage
  window.addEventListener('message', function(e){
    try {
      var d = e.data;
      if (typeof d === 'string') window.handleHostMsg(d);
    } catch(err){}
  });
  send({type:'ready'});
</script>
</body></html>`;
}

const MapPicker = forwardRef<any, MapPickerProps>(function MapPicker(props, ref) {
  const { pickup, drop, mode, onChange, bbox = DEFAULT_BBOX, center = DEFAULT_CENTER, polyline, height = 320 } = props;
  const webRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<LatLng[]>([]);
  const html = useMemo(() => buildHtml(center, bbox), [center.lat, center.lng, bbox.south, bbox.north, bbox.west, bbox.east]);

  const post = useCallback((msg: any) => {
    const code = `window.handleHostMsg && window.handleHostMsg(${JSON.stringify(msg)}); true;`;
    if (Platform.OS === "web") {
      const iframe = iframeRef.current;
      if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage(JSON.stringify(msg), "*");
    } else if (webRef.current) {
      webRef.current.injectJavaScript(code);
    }
  }, []);

  // Push state into the map when ready or values change
  useEffect(() => { if (ready) post({ type: "setMode", mode }); }, [mode, ready, post]);
  useEffect(() => { if (ready && pickup) post({ type: "setPickup", lat: pickup.lat, lng: pickup.lng }); }, [pickup?.lat, pickup?.lng, ready, post]);
  useEffect(() => { if (ready && drop) post({ type: "setDrop", lat: drop.lat, lng: drop.lng }); }, [drop?.lat, drop?.lng, ready, post]);
  useEffect(() => {
    if (!ready) return;
    if (polyline && polyline.length) post({ type: "polyline", points: polyline });
    else post({ type: "polyline", points: [] });
  }, [polyline, ready, post]);

  // Web: listen to iframe messages
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (ev: MessageEvent) => {
      if (typeof ev.data !== "string") return;
      try { handleMsg(JSON.parse(ev.data)); } catch {}
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  });

  const handleMsg = async (msg: any) => {
    if (msg.type === "ready") setReady(true);
    if (msg.type === "pick") {
      const lat = msg.lat, lng = msg.lng;
      // Reverse-geocode in background
      try {
        const r = await api<any>(`/geo/reverse?lat=${lat}&lng=${lng}`, { auth: false });
        onChange(msg.mode, { lat, lng, name: r.name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`, address: r.address });
      } catch {
        onChange(msg.mode, { lat, lng, name: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
      }
    }
  };

  useImperativeHandle(ref, () => ({
    setMode: (m: "pickup" | "drop") => post({ type: "setMode", mode: m }),
    flyTo: (lat: number, lng: number, zoom = 16) => post({ type: "fly", lat, lng, zoom }),
  }));

  const doSearch = async () => {
    if (search.trim().length < 2) return;
    setSearching(true);
    try {
      const r = await api<{ results: LatLng[] }>(`/geo/search?q=${encodeURIComponent(search.trim())}`, { auth: false });
      setResults(r.results || []);
    } catch (e: any) {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (r: LatLng) => {
    setResults([]);
    setSearch(r.name || "");
    onChange(mode, r);
    post({ type: "fly", lat: r.lat, lng: r.lng, zoom: 16 });
    if (mode === "pickup") post({ type: "setPickup", lat: r.lat, lng: r.lng });
    else post({ type: "setDrop", lat: r.lat, lng: r.lng });
  };

  const useCurrent = async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission needed", "We need location permission to use your current location.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      // Even if outside region, send it; reverse-geocode will tell user
      try {
        const r = await api<any>(`/geo/reverse?lat=${lat}&lng=${lng}`, { auth: false });
        onChange(mode, { lat, lng, name: r.name, address: r.address });
      } catch {
        onChange(mode, { lat, lng, name: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
      }
      post({ type: "fly", lat, lng, zoom: 16 });
      if (mode === "pickup") post({ type: "setPickup", lat, lng });
      else post({ type: "setDrop", lat, lng });
    } catch (e: any) {
      Alert.alert("Could not get location", e.message || "Try again");
    }
  };

  return (
    <View style={{ height, borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#eee" }}>
      {/* Map */}
      {Platform.OS === "web" ? (
        // @ts-ignore
        <iframe
          ref={iframeRef as any}
          srcDoc={html}
          style={{ border: "none", width: "100%", height: "100%" } as any}
          onLoad={() => setReady(true)}
        />
      ) : (
        <WebView
          ref={webRef}
          source={{ html }}
          style={{ flex: 1, backgroundColor: "transparent" }}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          onMessage={(e) => {
            try { handleMsg(JSON.parse(e.nativeEvent.data)); } catch {}
          }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
          )}
        />
      )}

      {/* Top overlay: search + mode + use current */}
      <View style={styles.topOverlay} pointerEvents="box-none">
        <View style={styles.searchRow}>
          <Feather name="search" size={16} color={colors.textMuted} style={{ marginLeft: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${mode} location`}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={doSearch}
            returnKeyType="search"
            placeholderTextColor={colors.textMuted}
            testID="map-search-input"
          />
          {search ? (
            <TouchableOpacity onPress={() => { setSearch(""); setResults([]); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={16} color={colors.textMuted} style={{ marginRight: 10 }} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={useCurrent} style={styles.gpsBtn} testID="map-gps-btn">
            <Feather name="crosshair" size={16} color={colors.primaryDark} />
          </TouchableOpacity>
        </View>
        {results.length > 0 && (
          <View style={styles.results}>
            <FlatList
              data={results}
              keyExtractor={(_, i) => String(i)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.resultRow} onPress={() => pickResult(item)} testID={`map-result-${item.lat}`}>
                  <Feather name="map-pin" size={14} color={colors.primaryDark} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <TText variant="body" weight="600" numberOfLines={1}>{item.name}</TText>
                    {item.address ? <TText variant="caption" muted numberOfLines={1}>{item.address}</TText> : null}
                  </View>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 24 }} />}
              style={{ maxHeight: 200 }}
            />
          </View>
        )}
      </View>

      {searching && (
        <View style={styles.searchingPill}>
          <ActivityIndicator size="small" color={colors.primary} />
          <TText variant="caption" muted style={{ marginLeft: 6 }}>Searching…</TText>
        </View>
      )}

      {/* Mode hint */}
      <View style={styles.modeHint}>
        <View style={[styles.modeDot, { backgroundColor: mode === "pickup" ? "#2A8F47" : "#D64545" }]} />
        <TText variant="caption" weight="600">
          Tap map to set {mode === "pickup" ? "PICKUP" : "DROP"}
        </TText>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#eee" },
  topOverlay: { position: "absolute", left: 10, right: 10, top: 10 },
  searchRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: radius.pill, ...shadows.sm,
  },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14, color: colors.text },
  gpsBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: 4 },
  results: { marginTop: 6, backgroundColor: "#fff", borderRadius: radius.md, ...shadows.sm },
  resultRow: { flexDirection: "row", alignItems: "center", padding: 10 },
  searchingPill: { position: "absolute", top: 60, alignSelf: "center", flexDirection: "row", alignItems: "center", backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, ...shadows.sm },
  modeHint: { position: "absolute", bottom: 10, left: 10, flexDirection: "row", alignItems: "center", backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, ...shadows.sm },
  modeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
});

export default MapPicker;
