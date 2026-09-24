export type Mp3Bitrate = 128 | 192 | 256 | 320;

export type Mp3BitrateOption = {
  value: Mp3Bitrate;
  label: string;
  description: string;
};

export const DEFAULT_MP3_BITRATE: Mp3Bitrate = 192;

export const MP3_BITRATE_OPTIONS: readonly Mp3BitrateOption[] = [
  { value: 128, label: "128 kbps", description: "Small" },
  { value: 192, label: "192 kbps", description: "Balanced" },
  { value: 256, label: "256 kbps", description: "Larger" },
  { value: 320, label: "320 kbps", description: "High" },
];
