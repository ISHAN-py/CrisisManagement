import { Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { useMemo } from 'react';

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
      <Popup>
        <div style={{ maxWidth: 300 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
          <div style={{ opacity: 0.8, marginBottom: 6 }}>{source} • {new Date(pubDate).toLocaleString()}</div>
          {country && <div style={{ marginTop: 2, marginBottom: 6 }}>Country: {country}</div>}
          <div style={{ marginBottom: 8, opacity: 0.9 }}>{description}</div>
          <a href={link} target="_blank" rel="noreferrer" style={{ color: '#93c5fd', textDecoration: 'underline' }}>Open article</a>
        </div>
      </Popup>
    </Marker>
  );
}
