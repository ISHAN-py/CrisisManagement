import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

type Crisis = {
  _id: string;
  title: string;
  description: string;
  link: string;
  source: string;
  pubDate: string;
  country?: string;
  lat?: number;
  lng?: number;
  created_at?: string;
  severity?: Severity;
};

function FitBounds({ points }: { points: Crisis[] }) {
  const map = useMap();
  const lastPointsRef = useRef<Crisis[]>([]);
  
  useEffect(() => {
    if (!points.length) return;
    if (JSON.stringify(points.map(p => p._id).sort()) === JSON.stringify(lastPointsRef.current.map(p => p._id).sort())) {
      return;
    }
    lastPointsRef.current = points;
    const coords = points
      .filter((d) => typeof d.lat === 'number' && typeof d.lng === 'number')
      .map((d) => [d.lat as number, d.lng as number]) as [number, number][];
    if (coords.length === 0) return;
    try {
      const bounds = (window as any).L.latLngBounds(coords);
      const paddedBounds = bounds.pad(0.1);
      map.fitBounds(paddedBounds, { padding: [50, 50], maxZoom: 8, animate: true, duration: 1.5 });
    } catch (e) { console.warn('Error fitting bounds:', e); }
  }, [points, map]);
  return null;
}

function inferSeverity(t: string, d: string): Severity {
  const text = `${t} ${d}`.toLowerCase();
  const critical = ['massive', 'catastrophic', 'tsunami', 'hurricane', 'category 4', 'major earthquake', 'hundreds dead', 'state of emergency'];
  const high = ['earthquake', 'flood', 'wildfire', 'cyclone', 'tornado', 'landslide', 'explosion', 'outbreak'];
  const medium = ['storm', 'heavy rain', 'evacuation', 'accident', 'conflict'];
  if (critical.some((k) => text.includes(k))) return 'Critical';
  if (high.some((k) => text.includes(k))) return 'High';
  if (medium.some((k) => text.includes(k))) return 'Medium';
  return 'Low';
}

export default function App() {
  const [items, setItems] = useState<Crisis[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ total: number; topCountries: { _id: string; count: number }[] } | null>(null);
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState<'All' | Severity>('All');
  const [focusedCrisis, setFocusedCrisis] = useState<string | null>(null);
  const eventRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/crises?limit=1500`).then((r) => r.json()).then((d) => { setItems(d); setLoading(false); }).catch(() => setLoading(false)),
      fetch(`${API_BASE}/stats`).then((r) => r.json()).then(setStats).catch(() => {}),
    ]).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      fetch(`${API_BASE}/stats`).then((r) => r.json()).then(setStats).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function connect() {
      const es = new EventSource(`${API_BASE}/events`);
      eventRef.current = es;
      es.addEventListener('update', (ev) => {
        try {
          const data: Crisis[] = JSON.parse((ev as MessageEvent).data);
          if (Array.isArray(data) && data.length > 0) {
            setItems((prev) => [...data, ...prev].slice(0, 1500));
          }
        } catch {}
      });
      es.onerror = () => {
        es.close();
        eventRef.current = null;
        const attempt = Math.min(6, (retryRef.current || 0) + 1);
        retryRef.current = attempt;
        const delayMs = Math.round(1000 * Math.pow(2, attempt));
        setTimeout(connect, delayMs);
      };
      es.onopen = () => { retryRef.current = 0; };
    }
    connect();
    return () => { eventRef.current?.close(); eventRef.current = null; };
  }, []);

  const enriched = useMemo<Crisis[]>(() => items.map((it) => ({ ...it, severity: inferSeverity(it.title || '', it.description || '') })), [items]);
  const displayItems = enriched;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return displayItems.filter((it) => {
      const matchesQ = !q || `${it.title} ${it.description} ${it.source} ${it.country}`.toLowerCase().includes(q);
      const matchesS = severity === 'All' || it.severity === severity;
      return matchesQ && matchesS;
    });
  }, [displayItems, query, severity]);

  // Deduplication function to handle overlapping crises
  const deduplicateOverlappingCrises = (crises: Crisis[]): (Crisis & { groupedCount?: number; hiddenCrises?: Crisis[] })[] => {
    const severityPriority: Record<Severity, number> = {
      'Critical': 4,
      'High': 3,
      'Medium': 2,
      'Low': 1
    };

    // Define proximity threshold (in degrees) - roughly 25km at equator
    const PROXIMITY_THRESHOLD = 0.225;

    const deduplicatedCrises: (Crisis & { groupedCount?: number; hiddenCrises?: Crisis[] })[] = [];
    const processed = new Set<string>();

    // Sort by severity (highest first) and then by date (newest first)
    const sortedCrises = [...crises].sort((a, b) => {
      const severityDiff = (severityPriority[b.severity as Severity] || 1) - (severityPriority[a.severity as Severity] || 1);
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
    });

    for (const crisis of sortedCrises) {
      if (processed.has(crisis._id)) continue;

      // Check for overlapping crises within proximity threshold
      const overlappingCrises = sortedCrises.filter(other => 
        !processed.has(other._id) &&
        typeof other.lat === 'number' && 
        typeof other.lng === 'number' &&
        typeof crisis.lat === 'number' && 
        typeof crisis.lng === 'number' &&
        Math.abs(crisis.lat - other.lat) <= PROXIMITY_THRESHOLD &&
        Math.abs(crisis.lng - other.lng) <= PROXIMITY_THRESHOLD &&
        // Calculate actual distance
        Math.sqrt(
          Math.pow(crisis.lat - other.lat, 2) + 
          Math.pow(crisis.lng - other.lng, 2)
        ) <= PROXIMITY_THRESHOLD
      );

      // Add the highest priority crisis with grouping info
      const primaryCrisis = crisis;
      const hiddenCrises = overlappingCrises.filter(c => c._id !== crisis._id);
      
      deduplicatedCrises.push({
        ...primaryCrisis,
        groupedCount: overlappingCrises.length > 1 ? overlappingCrises.length : undefined,
        hiddenCrises: hiddenCrises.length > 0 ? hiddenCrises : undefined
      });
      
      // Mark all overlapping crises as processed
      overlappingCrises.forEach(overlapping => {
        processed.add(overlapping._id);
      });
    }

    // Log deduplication results for debugging
    const originalCount = crises.length;
    const deduplicatedCount = deduplicatedCrises.length;
    const groupedCrises = deduplicatedCrises.filter(c => c.groupedCount && c.groupedCount > 1);
    
    if (originalCount !== deduplicatedCount || groupedCrises.length > 0) {
      console.log(`🔗 Crisis deduplication: ${originalCount} → ${deduplicatedCount} markers`, {
        removed: originalCount - deduplicatedCount,
        grouped: groupedCrises.length,
        groupedLocations: groupedCrises.map(c => ({ 
          title: c.title, 
          severity: c.severity, 
          count: c.groupedCount 
        }))
      });
    }

    return deduplicatedCrises;
  };

  const points = useMemo(() => {
    let pointsToShow = filtered;
    if (focusedCrisis) {
      pointsToShow = filtered.filter(crisis => crisis._id === focusedCrisis);
    }
    
    // Filter out points with coordinates (0,0) and ensure valid coordinates
    const validPoints = pointsToShow.filter((d) => 
      typeof d.lat === 'number' && 
      typeof d.lng === 'number' && 
      !(d.lat === 0 && d.lng === 0)
    );
    
    // Apply deduplication only when not focusing on a specific crisis
    if (!focusedCrisis) {
      return deduplicateOverlappingCrises(validPoints);
    }
    
    return validPoints;
  }, [filtered, focusedCrisis]);

  const sortedList = useMemo(() => [...filtered].sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()).slice(0, 50), [filtered]);
  const counts = useMemo(() => { const c = { Critical: 0, High: 0, Medium: 0, Low: 0 } as Record<Severity, number>; for (const it of displayItems) if (it.severity) c[it.severity]++; return c; }, [displayItems]);

  const mapCardStyle: React.CSSProperties = { position: 'absolute', left: 16, top: 180, bottom: 16, right: 412, borderRadius: 16, overflow: 'visible', boxShadow: '0 10px 30px rgba(0,0,0,0.35)', zIndex: 900 };

  // Calculate current crisis category based on highest severity
  const currentCrisisCategory = useMemo(() => {
    if (counts.Critical > 0) return { level: 'Critical', color: '#ef4444', description: 'Multiple critical incidents detected' };
    if (counts.High > 0) return { level: 'High', color: '#fb923c', description: 'High priority incidents active' };
    if (counts.Medium > 0) return { level: 'Medium', color: '#f59e0b', description: 'Moderate incidents ongoing' };
    if (counts.Low > 0) return { level: 'Low', color: '#22c55e', description: 'Low priority incidents' };
    return { level: 'None', color: '#64748b', description: 'No active incidents' };
  }, [counts]);

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <header className="header">
        <div>
          <div className="title-xl">Global Crisis Monitor</div>
          <div className="sub">Real-time monitoring of global incidents and emergencies</div>
        </div>
        <div className="active">{stats?.total ?? displayItems.length}<span> Active Crises</span></div>
      </header>

      {/* Crisis Category Banner */}
      <div className="crisis-banner" style={{ 
        position: 'absolute', 
        top: '100px', 
        left: '16px', 
        right: '16px', 
        zIndex: 1100,
        background: `linear-gradient(135deg, ${currentCrisisCategory.color}15 0%, ${currentCrisisCategory.color}08 100%)`,
        border: `1px solid ${currentCrisisCategory.color}40`,
        borderRadius: '16px',
        padding: '12px 20px',
        backdropFilter: 'blur(20px)',
        boxShadow: `0 8px 32px rgba(0,0,0,0.3), 0 0 20px ${currentCrisisCategory.color}30`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div 
            className={`crisis-indicator ${currentCrisisCategory.level.toLowerCase()}`}
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: currentCrisisCategory.color,
              boxShadow: `0 0 15px ${currentCrisisCategory.color}80`,
              animation: currentCrisisCategory.level === 'Critical' ? 'criticalPulse 1.5s ease-in-out infinite' : 'none'
            }}
          />
          <div>
            <div style={{ 
              fontWeight: '700', 
              fontSize: '14px', 
              color: currentCrisisCategory.color,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {currentCrisisCategory.level} Alert
            </div>
            <div style={{ 
              fontSize: '12px', 
              opacity: '0.8', 
              marginTop: '2px' 
            }}>
              {currentCrisisCategory.description}
            </div>
          </div>
        </div>
        <div style={{ 
          fontSize: '12px', 
          opacity: '0.7',
          display: 'flex',
          gap: '16px',
          alignItems: 'center'
        }}>
          <span>Critical: {counts.Critical}</span>
          <span>High: {counts.High}</span>
          <span>Medium: {counts.Medium}</span>
          <span>Low: {counts.Low}</span>
        </div>
      </div>

      <div className={'map-card'} style={mapCardStyle}>
        <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <FitBounds points={points} />
          {points.map((p) => {
            const isFocused = focusedCrisis === p._id;
            const isGrouped = (p as any).groupedCount && (p as any).groupedCount > 1;
            const severityColors = {
              Critical: '#ef4444',
              High: '#fb923c', 
              Medium: '#f59e0b',
              Low: '#22c55e'
            };
            const color = severityColors[p.severity as keyof typeof severityColors] || '#22c55e';
            
            return (
              <CircleMarker
                key={p._id + String(p.pubDate)}
                center={[p.lat as number, p.lng as number]}
                radius={isFocused ? 12 : (isGrouped ? 10 : 8)}
                pathOptions={{ 
                  color: isFocused ? '#ffffff' : (isGrouped ? '#ffffff' : color), 
                  fillColor: color, 
                  fillOpacity: isFocused ? 0.9 : (isGrouped ? 0.85 : 0.7),
                  weight: isFocused ? 3 : (isGrouped ? 3 : 2)
                }}
                eventHandlers={{
                  mouseover: (e) => { try { (e as any).target.openTooltip(); } catch {} },
                  mouseout: (e) => { try { (e as any).target.closeTooltip(); } catch {} },
                  click: (e) => { 
                    try { 
                      (e as any).target.openPopup(); 
                      setFocusedCrisis(isFocused ? null : p._id);
                    } catch {} 
                  },
                }}
              >
              <Tooltip direction="top" offset={[0, -8]} opacity={0.95} sticky>
                <div style={{ maxWidth: 280 }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>
                    {isGrouped && `📍 `}{p.title}
                  </div>
                  <div style={{ opacity: 0.8, fontSize: 12 }}>
                    {p.source} • {new Date(p.pubDate).toLocaleString()}
                  </div>
                  {isGrouped && (
                    <div style={{ marginTop: 4, fontSize: 11, padding: '2px 6px', background: 'rgba(59,130,246,0.2)', borderRadius: '4px', color: '#93c5fd' }}>
                      Groups {(p as any).groupedCount} crises (showing highest priority)
                    </div>
                  )}
                </div>
              </Tooltip>
              <Popup>
                <div style={{ maxWidth: 320 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    {isGrouped && `📍 `}{p.title}
                  </div>
                  <div style={{ opacity: 0.8, marginBottom: 6 }}>{p.source} • {new Date(p.pubDate).toLocaleString()}</div>
                  {p.country && <div style={{ marginTop: 2, marginBottom: 6 }}>Country: {p.country}</div>}
                  {isGrouped && (
                    <div style={{ marginBottom: 8, padding: '8px', background: 'rgba(59,130,246,0.1)', borderRadius: '6px', border: '1px solid rgba(59,130,246,0.3)' }}>
                      <div style={{ fontWeight: 600, marginBottom: 4, color: '#93c5fd' }}>
                        📍 This location groups {(p as any).groupedCount} crises
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.9 }}>
                        Showing highest priority: <strong>{p.severity}</strong> severity
                      </div>
                      {(p as any).hiddenCrises && (p as any).hiddenCrises.length > 0 && (
                        <div style={{ marginTop: 4, fontSize: 11, opacity: 0.8 }}>
                          Other crises: {(p as any).hiddenCrises.map((crisis: Crisis) => crisis.severity).join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ marginBottom: 8, opacity: 0.9 }}>{p.description}</div>
                  <a href={p.link} target="_blank" rel="noreferrer" style={{ color: '#93c5fd', textDecoration: 'underline' }}>Open article</a>
                </div>
              </Popup>
            </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      <aside className="sidebar" style={{ zIndex: 1200, top: '180px' }}>
        <div className="counter-row">
          <div className="pill pill-critical"><span>{counts.Critical}</span><small>Critical</small></div>
          <div className="pill pill-high"><span>{counts.High}</span><small>High</small></div>
          <div className="pill pill-medium"><span>{counts.Medium}</span><small>Medium</small></div>
        </div>
        <div className="search"><input placeholder="Search crises..." value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        <div className="chips">{(['All','Critical','High','Medium','Low'] as const).map((s) => (<button key={s} className={severity===s? 'chip active': 'chip'} onClick={() => setSeverity(s as any)}>{s}</button>))}</div>
        {focusedCrisis && (<div style={{ padding: '8px 12px' }}><button onClick={() => setFocusedCrisis(null)} style={{ width: '100%', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', color: '#93c5fd', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', backdropFilter: 'blur(8px)' }}>🌍 Show All Crises</button></div>)}
        {loading ? (
          <div className="empty">Loading…</div>
        ) : sortedList.length === 0 ? (
          <div className="empty">No data yet. Try widening filters…</div>
        ) : (
          <ul className="list">
            {sortedList.map((it) => {
              const isFocused = focusedCrisis === it._id;
              const handleClick = (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                setFocusedCrisis(isFocused ? null : it._id);
              };
              
              return (
                <li 
                  key={it._id} 
                  className={`list-item ${isFocused ? 'focused' : ''}`} 
                  onClick={handleClick}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="list-title" title={it.title}>
                    {isFocused && '🎯 '}{it.title}
                  </div>
                  <div className="list-meta">
                    <span className={`sev sev-${(it.severity||'Low').toLowerCase()}`}>{it.severity || 'Low'}</span>
                    <span>•</span>
                    <span>{it.source || 'Unknown'}</span>
                    <span>•</span>
                    <span>{new Date(it.pubDate).toLocaleString()}</span>
                  </div>
                  <a 
                    className="list-link" 
                    href={it.link} 
                    target="_blank" 
                    rel="noreferrer" 
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open
                  </a>
                </li>
              );
            })}
          </ul>
        )}
        <div className="legend"><span className="dot dot-critical"></span> Critical <span className="dot dot-high"></span> High <span className="dot dot-medium"></span> Medium <span className="dot dot-low"></span> Low</div>
      </aside>
    </div>
  );
}
