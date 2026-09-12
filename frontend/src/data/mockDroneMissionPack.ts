import { DroneImage, Detection, Priority } from '../types';

/**
 * Generates an authentic technical drone aerial image as a self-contained SVG Data URI.
 * Renders diverse disaster environments: flooded neighborhoods, rooftops, debris zones,
 * riverbanks, and open terrain, complete with flight telemetry HUD markings.
 */
function createDroneFrameSvg(
  frameNumber: number,
  theme: 'flood_roof' | 'flood_street' | 'debris' | 'riverbank' | 'overwatch',
  detections: { x: number; y: number; priority: Priority }[]
): string {
  const padIndex = String(frameNumber).padStart(2, '0');
  const altitude = 45 + ((frameNumber * 7) % 65);
  const heading = (frameNumber * 23) % 360;
  const time = `14:${String(12 + Math.floor(frameNumber / 5)).padStart(2, '0')}:${String((frameNumber * 13) % 60).padStart(2, '0')} UTC`;
  
  // Base terrain colors based on disaster theme
  let bgGradient = '';
  let terrainElements = '';

  if (theme === 'flood_roof') {
    bgGradient = `
      <radialGradient id="water-${frameNumber}" cx="50%" cy="50%" r="60%">
        <stop offset="0%" stop-color="#15242b" />
        <stop offset="60%" stop-color="#0e181c" />
        <stop offset="100%" stop-color="#080e10" />
      </radialGradient>
    `;
    terrainElements = `
      <!-- Submerged rooftops & buildings -->
      <rect x="180" y="120" width="220" height="150" fill="#2d2822" stroke="#4a3e35" stroke-width="2" rx="4" transform="rotate(-12 290 195)" />
      <polygon points="170,110 280,70 390,120 280,160" fill="#3b322a" opacity="0.9" />
      <line x1="280" y1="70" x2="280" y2="160" stroke="#5c4d3d" stroke-width="2" />
      <rect x="420" y="240" width="160" height="180" fill="#22272a" stroke="#373d42" stroke-width="2" transform="rotate(8 500 330)" />
      <!-- Water ripple ripples -->
      <ellipse cx="300" cy="380" rx="140" ry="24" fill="none" stroke="#253840" stroke-width="1.5" opacity="0.6" />
      <ellipse cx="340" cy="400" rx="180" ry="30" fill="none" stroke="#1d2e35" stroke-width="1.5" opacity="0.4" />
      <path d="M 60,320 Q 250,290 440,340 T 740,310" fill="none" stroke="#2a414b" stroke-width="3" opacity="0.5" />
    `;
  } else if (theme === 'flood_street') {
    bgGradient = `
      <linearGradient id="street-${frameNumber}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#11191d" />
        <stop offset="50%" stop-color="#162329" />
        <stop offset="100%" stop-color="#0d1417" />
      </linearGradient>
    `;
    terrainElements = `
      <!-- Submerged road intersection -->
      <rect x="340" y="0" width="120" height="600" fill="#1b2528" opacity="0.8" />
      <rect x="0" y="260" width="800" height="110" fill="#1b2528" opacity="0.8" />
      <!-- Submerged vehicles -->
      <rect x="370" y="210" width="55" height="95" fill="#4d5358" stroke="#687278" stroke-width="1.5" rx="5" transform="rotate(15 397 257)" />
      <rect x="230" y="290" width="50" height="90" fill="#283238" stroke="#3a4850" stroke-width="1.5" rx="5" transform="rotate(-35 255 335)" />
      <!-- Debris drift lines -->
      <line x1="120" y1="180" x2="220" y2="190" stroke="#3d3326" stroke-width="4" stroke-linecap="round" />
      <line x1="490" y1="380" x2="560" y2="395" stroke="#3d3326" stroke-width="3" stroke-linecap="round" />
    `;
  } else if (theme === 'debris') {
    bgGradient = `
      <radialGradient id="debris-${frameNumber}" cx="45%" cy="55%" r="65%">
        <stop offset="0%" stop-color="#24211e" />
        <stop offset="50%" stop-color="#171513" />
        <stop offset="100%" stop-color="#0a0a0a" />
      </radialGradient>
    `;
    terrainElements = `
      <!-- Structural rubble piles -->
      <polygon points="200,320 280,210 390,240 450,330 360,420 240,400" fill="#2b2622" stroke="#473f38" stroke-width="2" />
      <polygon points="410,180 480,130 560,160 540,240 440,230" fill="#201c19" stroke="#36302a" stroke-width="1.5" />
      <!-- Steel beams & concrete slabs -->
      <line x1="230" y1="260" x2="380" y2="340" stroke="#717a80" stroke-width="3" />
      <line x1="280" y1="360" x2="430" y2="280" stroke="#5a6369" stroke-width="2.5" />
      <rect x="260" y="240" width="70" height="40" fill="#3a342f" stroke="#544c45" stroke-width="1" transform="rotate(25 295 260)" />
    `;
  } else if (theme === 'riverbank') {
    bgGradient = `
      <linearGradient id="river-${frameNumber}" x1="0%" y1="30%" x2="100%" y2="70%">
        <stop offset="0%" stop-color="#192019" />
        <stop offset="45%" stop-color="#25241e" />
        <stop offset="55%" stop-color="#142229" />
        <stop offset="100%" stop-color="#0b171c" />
      </linearGradient>
    `;
    terrainElements = `
      <!-- Winding river shoreline -->
      <path d="M 0,220 Q 260,180 420,310 T 800,280 L 800,600 L 0,600 Z" fill="#101d24" />
      <path d="M 0,220 Q 260,180 420,310 T 800,280" fill="none" stroke="#304854" stroke-width="3" />
      <!-- Sandbar & vegetation clusters -->
      <ellipse cx="440" cy="340" rx="90" ry="40" fill="#2c2a22" stroke="#484437" stroke-width="1.5" />
      <circle cx="160" cy="140" r="35" fill="#1d261a" opacity="0.8" />
      <circle cx="210" cy="160" r="45" fill="#182116" opacity="0.9" />
    `;
  } else {
    bgGradient = `
      <radialGradient id="overwatch-${frameNumber}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#1a1c1e" />
        <stop offset="100%" stop-color="#0c0d0e" />
      </radialGradient>
    `;
    terrainElements = `
      <!-- Open perimeter search grid -->
      <path d="M 100,100 L 700,100 L 700,500 L 100,500 Z" fill="none" stroke="#25282c" stroke-width="1" stroke-dasharray="8 8" />
      <circle cx="400" cy="300" r="140" fill="none" stroke="#2a2e33" stroke-width="1" opacity="0.5" />
      <line x1="400" y1="80" x2="400" y2="520" stroke="#1f2226" stroke-width="1" stroke-dasharray="4 4" />
      <line x1="80" y1="300" x2="720" y2="300" stroke="#1f2226" stroke-width="1" stroke-dasharray="4 4" />
    `;
  }

  // Draw subject representations if detections exist
  let subjectMarks = '';
  detections.forEach((d, i) => {
    const px = Math.round(d.x * 800);
    const py = Math.round(d.y * 600);
    const color = d.priority === 'CRITICAL' ? '#ff3b30' : d.priority === 'HIGH' ? '#ff9500' : '#30d158';
    
    subjectMarks += `
      <!-- Subject ${i + 1} Visual Indicator on Terrain -->
      <g opacity="0.9">
        <circle cx="${px + 20}" cy="${py + 15}" r="8" fill="#e57342" stroke="#ffffff" stroke-width="1" />
        <ellipse cx="${px + 20}" cy="${py + 32}" rx="11" ry="15" fill="#3a4d5c" />
        <circle cx="${px + 20}" cy="${py + 15}" r="16" fill="none" stroke="${color}" stroke-width="1" stroke-dasharray="3 3" />
      </g>
    `;
  });

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <defs>
    ${bgGradient}
    <linearGradient id="hud-grad-${frameNumber}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.4)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0.1)" />
    </linearGradient>
  </defs>

  <!-- Terrain Backdrop -->
  <rect width="800" height="600" fill="url(#${theme === 'flood_roof' ? 'water' : theme === 'flood_street' ? 'street' : theme === 'debris' ? 'debris' : theme === 'riverbank' ? 'river' : 'overwatch'}-${frameNumber})" />

  <!-- Environmental Structures -->
  ${terrainElements}

  <!-- Actual Subjects in Frame -->
  ${subjectMarks}

  <!-- Drone Sensor Grid Overlay -->
  <g opacity="0.15" stroke="#ffffff" stroke-width="0.5">
    <line x1="0" y1="200" x2="800" y2="200" />
    <line x1="0" y1="400" x2="800" y2="400" />
    <line x1="266" y1="0" x2="266" y2="600" />
    <line x1="533" y1="0" x2="533" y2="600" />
  </g>

  <!-- Center Crosshair Gimbal Markings -->
  <g opacity="0.45" stroke="#ffffff" stroke-width="1.2">
    <line x1="380" y1="300" x2="395" y2="300" />
    <line x1="405" y1="300" x2="420" y2="300" />
    <line x1="400" y1="280" x2="400" y2="295" />
    <line x1="400" y1="305" x2="400" y2="320" />
    <circle cx="400" cy="300" r="32" fill="none" stroke="#ffffff" stroke-width="0.8" stroke-dasharray="4 6" />
  </g>

  <!-- Flight HUD Telemetry Header -->
  <rect x="0" y="0" width="800" height="38" fill="rgba(0,0,0,0.65)" />
  <text x="24" y="24" fill="#ffffff" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="600" letter-spacing="1">
    RESCUE-EYE // DRONE-07 // FRAME-${padIndex}
  </text>
  <text x="440" y="24" fill="#a0a0a0" font-family="'JetBrains Mono', monospace" font-size="11">
    ALT: ${altitude}M  HDG: ${heading}°  ${time}
  </text>
  <text x="730" y="24" fill="#ffffff" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="600">
    4K RAW
  </text>

  <!-- HUD Corner Brackets -->
  <path d="M 20,60 L 20,40 L 40,40" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" />
  <path d="M 780,60 L 780,40 L 760,40" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" />
  <path d="M 20,540 L 20,560 L 40,560" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" />
  <path d="M 780,540 L 780,560 L 760,560" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" />

  <!-- Bottom Telemetry Bar -->
  <rect x="0" y="566" width="800" height="34" fill="rgba(0,0,0,0.7)" />
  <text x="24" y="588" fill="#888888" font-family="'JetBrains Mono', monospace" font-size="11">
    LAT: 34.0522° N   LNG: -118.2437° W   SECTOR: A-FLOOD
  </text>
  <text x="630" y="588" fill="#888888" font-family="'JetBrains Mono', monospace" font-size="11">
    BAT: 84% // LINK: 99%
  </text>
</svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Creates the complete 100-frame drone mission pack.
 * Each frame features realistic coordinates, flight altitude, and timestamp,
 * with diverse disaster scenarios (flooded roofs, submerged cars, rubble debris, open water).
 */
export function generateDroneMissionPack(totalFrames = 100): DroneImage[] {
  const frames: DroneImage[] = [];
  const baseLat = 34.0522;
  const baseLng = -118.2437;

  // Curated scenarios with simulated human detections for key frames
  const knownDetectionsMap: Record<number, { x: number; y: number; width: number; height: number; confidence: number; priority: Priority; hazard: string }[]> = {
    1: [
      {
        x: 0.32,
        y: 0.28,
        width: 0.12,
        height: 0.16,
        confidence: 0.96,
        priority: 'CRITICAL',
        hazard: 'Stranded on partially collapsed roof; water level within 0.8m of crest.',
      },
      {
        x: 0.46,
        y: 0.30,
        width: 0.10,
        height: 0.14,
        confidence: 0.91,
        priority: 'CRITICAL',
        hazard: 'Second victim signaling distress flag; mobility impaired.',
      },
    ],
    2: [
      {
        x: 0.48,
        y: 0.42,
        width: 0.11,
        height: 0.15,
        confidence: 0.94,
        priority: 'HIGH',
        hazard: 'Survivor atop submerged sport-utility vehicle in fast current.',
      },
    ],
    4: [
      {
        x: 0.38,
        y: 0.52,
        width: 0.09,
        height: 0.13,
        confidence: 0.89,
        priority: 'HIGH',
        hazard: 'Individual stranded on riverbank sandbar, signaling flashlight/flare.',
      },
    ],
    7: [
      {
        x: 0.58,
        y: 0.34,
        width: 0.10,
        height: 0.14,
        confidence: 0.93,
        priority: 'CRITICAL',
        hazard: 'Trapped in industrial warehouse roof rupture near live transformer.',
      },
    ],
    11: [
      {
        x: 0.26,
        y: 0.62,
        width: 0.08,
        height: 0.12,
        confidence: 0.86,
        priority: 'MEDIUM',
        hazard: 'Subject observed taking shelter under elevated concrete bridge pier.',
      },
    ],
    16: [
      {
        x: 0.62,
        y: 0.48,
        width: 0.09,
        height: 0.13,
        confidence: 0.92,
        priority: 'HIGH',
        hazard: 'Two adults stranded on balcony perimeter over surging floodwaters.',
      },
      {
        x: 0.72,
        y: 0.50,
        width: 0.08,
        height: 0.12,
        confidence: 0.88,
        priority: 'HIGH',
        hazard: 'Accompanied victim in bright thermal jacket.',
      },
    ],
    23: [
      {
        x: 0.41,
        y: 0.39,
        width: 0.11,
        height: 0.15,
        confidence: 0.95,
        priority: 'CRITICAL',
        hazard: 'Elderly survivor on attic vent louvers, high hypothermia risk.',
      },
    ],
    32: [
      {
        x: 0.53,
        y: 0.57,
        width: 0.09,
        height: 0.13,
        confidence: 0.87,
        priority: 'MEDIUM',
        hazard: 'Individual walking through knee-deep wash toward higher ground.',
      },
    ],
    47: [
      {
        x: 0.35,
        y: 0.44,
        width: 0.10,
        height: 0.14,
        confidence: 0.90,
        priority: 'HIGH',
        hazard: 'Stranded family member waving yellow life preserver.',
      },
    ],
    68: [
      {
        x: 0.64,
        y: 0.31,
        width: 0.08,
        height: 0.12,
        confidence: 0.85,
        priority: 'LOW',
        hazard: 'Observer at dry evacuation perimeter boundary.',
      },
    ],
    85: [
      {
        x: 0.29,
        y: 0.38,
        width: 0.11,
        height: 0.16,
        confidence: 0.94,
        priority: 'CRITICAL',
        hazard: 'Child clinging to floating debris container in swift current eddy.',
      },
    ],
  };

  const themes: ('flood_roof' | 'flood_street' | 'debris' | 'riverbank' | 'overwatch')[] = [
    'flood_roof',
    'flood_street',
    'riverbank',
    'debris',
    'overwatch',
  ];

  for (let i = 1; i <= totalFrames; i++) {
    const theme = themes[(i - 1) % themes.length];
    const knownDets = knownDetectionsMap[i] || [];
    
    const detections: Detection[] = knownDets.map((d, detIdx) => ({
      id: `det-frame-${i}-${detIdx + 1}`,
      class: 'human',
      confidence: d.confidence,
      x: d.x,
      y: d.y,
      width: d.width,
      height: d.height,
      priority: d.priority,
      simulated: true,
      hazardNotes: d.hazard,
      thermalSignature: `${(36.1 + (i % 7) * 0.1).toFixed(1)}°C Core Temp`,
    }));

    // Generate visual SVG data URL
    const svgUrl = createDroneFrameSvg(
      i,
      theme,
      detections.map((d) => ({ x: d.x, y: d.y, priority: d.priority }))
    );

    const latOffset = (Math.floor((i - 1) / 10) * 0.0015) - 0.007;
    const lngOffset = (((i - 1) % 10) * 0.0018) - 0.009;

    frames.push({
      id: `frame-${String(i).padStart(3, '0')}`,
      frameNumber: i,
      filename: `DJI_DRONE07_SEC_A_${String(i).padStart(4, '0')}.RAW`,
      url: svgUrl,
      status: 'WAITING',
      timestamp: `2026-09-12T14:${String(10 + Math.floor(i / 6)).padStart(2, '0')}:${String((i * 17) % 60).padStart(2, '0')}Z`,
      altitudeMeters: 45 + ((i * 7) % 65),
      sector: `Sector A — Grid ${(i % 8) + 1}`,
      gpsCoords: {
        lat: Number((baseLat + latOffset).toFixed(5)),
        lng: Number((baseLng + lngOffset).toFixed(5)),
      },
      detections: detections, // pre-configured detections ready for on-device inference trigger
      simulated: true,
    });
  }

  return frames;
}
