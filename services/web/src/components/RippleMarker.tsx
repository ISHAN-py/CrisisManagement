import { Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { useMemo } from 'react';

// Helper function to sanitize HTML content
function sanitizeText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&amp;/g, '&') // Replace &amp; with &
    .replace(/&lt;/g, '<') // Replace &lt; with <
    .replace(/&gt;/g, '>') // Replace &gt; with >
    .replace(/&quot;/g, '"') // Replace &quot; with "
    .replace(/&#39;/g, "'"); // Replace &#39; with '
}

type Props = {
  position: [number, number];
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  title: string;
  description: string;
  source: string;
  pubDate: string;
  country?: string;
  link: string;
  isNew?: boolean;
};

function colorFor(sev: Props['severity']): string {
  switch (sev) {
    case 'Critical': return '#ef4444';
    case 'High': return '#fb923c';
    case 'Medium': return '#f59e0b';
    default: return '#22c55e';
  }
}

export default function RippleMarker(props: Props) {
  const { position, severity, title, description, source, pubDate, country, link, isNew } = props;

  const icon = useMemo(() => {
    const c = colorFor(severity);
    const extra = isNew ? ' bounce' : '';
    const html = `
      <div class="ripple-dot ripple-${severity.toLowerCase()}${extra}" style="--dot-color:${c}"></div>
    `;
    return L.divIcon({
      className: 'ripple-wrapper',
      html,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }, [severity, isNew]);

  return (
    <Marker
      position={position}
      icon={icon}
      zIndexOffset={500}
      eventHandlers={{
        mouseover: (e) => {
          try { (e as any).target.openPopup(); } catch {}
        },
        mouseout: (e) => {
          try { (e as any).target.closePopup(); } catch {}
        },
      }}
    >
      <Tooltip direction="top" offset={[0, -8]} opacity={0.95} sticky>
        <div style={{ maxWidth: 280 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{title}</div>
          <div style={{ opacity: 0.8, fontSize: 12 }}>{source} • {new Date(pubDate).toLocaleString()}</div>
        </div>
      </Tooltip>
      <Popup className="crisis-popup">
        <div className="crisis-popup-content">
          <h3 className="crisis-popup-title">{sanitizeText(title)}</h3>
          <a href={link} target="_blank" rel="noreferrer" className="crisis-popup-link">
            <span>Open Article</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        </div>
      </Popup>
    </Marker>
  );
}
