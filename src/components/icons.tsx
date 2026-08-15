import React from 'react';
import Svg, { Circle, ClipPath, Defs, G, Line, Path, Rect } from 'react-native-svg';

import { colors } from '../theme/tokens';

const S = 24;

export function ScanIcon({ size = S, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 8V6a3 3 0 0 1 3-3h2M16 3h2a3 3 0 0 1 3 3v2M21 16v2a3 3 0 0 1-3 3h-2M8 21H6a3 3 0 0 1-3-3v-2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path d="M7 12h10" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function CameraIcon({ size = S, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.2c.7 0 1.4-.35 1.8-.93l.55-.8A2 2 0 0 1 10.7 3.5h2.6a2 2 0 0 1 1.65.87l.55.8c.4.58 1.1.93 1.8.93h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
        stroke={color}
        strokeWidth="1.8"
      />
      <Circle cx="12" cy="12.5" r="3.4" stroke={color} strokeWidth="1.8" />
    </Svg>
  );
}

export function HistoryIcon({ size = S, color = colors.textSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 12a8.5 8.5 0 1 0 2.6-6.13M3.5 4.5V8.5H7.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 8v4.5l3 1.8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function ChatIcon({ size = S, color = colors.textSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 11.8c0 4.3-4 7.8-9 7.8-1 0-2-.14-2.9-.4L4 21l1.2-3.4A7.4 7.4 0 0 1 3 11.8C3 7.5 7 4 12 4s9 3.5 9 7.8Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <Circle cx="8.6" cy="11.8" r="1" fill={color} />
      <Circle cx="12" cy="11.8" r="1" fill={color} />
      <Circle cx="15.4" cy="11.8" r="1" fill={color} />
    </Svg>
  );
}

export function SettingsIcon({ size = S, color = colors.textSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.8" />
      <Path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SparkIcon({ size = S, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.5 13.9 9l6.5 1.9-6.5 1.9-1.9 6.5-1.9-6.5L3.6 11 10.1 9 12 2.5Z"
        fill={color}
      />
      <Path d="M19 2.5 19.7 4.6 21.8 5.3 19.7 6 19 8.1 18.3 6 16.2 5.3 18.3 4.6 19 2.5Z" fill={color} opacity="0.7" />
    </Svg>
  );
}

export function CheckIcon({ size = S, color = colors.mint }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m5 13 4.5 4.5L19 6.5" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronRight({ size = S, color = colors.textTertiary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m9 5 7 7-7 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function BackArrow({ size = S, color = colors.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5m0 0 6-6m-6 6 6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ImageIcon({ size = S, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="14" rx="2.5" stroke={color} strokeWidth="1.8" />
      <Circle cx="8.6" cy="10" r="1.4" fill={color} />
      <Path d="m4 17 4.5-4.2c.7-.6 1.7-.6 2.4 0L15 16.4m0 0 1.8-1.6c.7-.6 1.7-.6 2.4 0l1 1" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function TorchIcon({ size = S, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2 4.5 13H11l-1 9L18.5 11H12l1-9Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CopyIcon({ size = S, color = colors.textSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="8.5" y="8.5" width="12" height="12" rx="2.5" stroke={color} strokeWidth="1.8" />
      <Path d="M15.5 5.5v-1a2 2 0 0 0-2-2h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h1" stroke={color} strokeWidth="1.8" />
    </Svg>
  );
}

export function GraphIcon({ size = S, color = colors.textSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <ClipPath id="graphclip">
          <Rect x="3" y="3" width="18" height="18" rx="2.5" />
        </ClipPath>
      </Defs>
      <Rect x="3" y="3" width="18" height="18" rx="2.5" stroke={color} strokeWidth="1.8" />
      <G clipPath="url(#graphclip)">
        <Path d="M3 15c4-1 6-10 9-10s4 7 9 8.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      </G>
    </Svg>
  );
}

export function SendIcon({ size = S, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 19V5m0 0-6 6m6-6 6 6"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CrownIcon({ size = S, color = colors.amber }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 8.5 6.5 12 12 5l5.5 7L21 8.5l-1.6 9.2a1.5 1.5 0 0 1-1.48 1.3H6.08a1.5 1.5 0 0 1-1.48-1.3L3 8.5Z"
        stroke={color}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function BookIcon({ size = S, color = colors.textSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21V5.5Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <Path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20" stroke={color} strokeWidth="1.8" />
    </Svg>
  );
}

export function TrashIcon({ size = S, color = colors.textSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7h16M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1="10.5" y1="11" x2="10.5" y2="16.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <Line x1="13.5" y1="11" x2="13.5" y2="16.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}
