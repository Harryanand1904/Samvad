export const colors = {
  bg:           '#FDF6EC',
  surface:      '#FFFBF4',
  border:       '#E8D5B0',
  accent:       '#C17A2E',
  accentDeep:   '#8B5319',
  accentLight:  '#F5E4C8',
  textPrimary:  '#2D1F0A',
  textSecondary:'#6B4E26',
  textMuted:    '#A0845C',
  red:          '#C0392B',
  redBg:        '#FADBD8',
  green:        '#1D6B3C',
  greenBg:      '#D5F0E2',
  yellow:       '#7A5110',
  yellowBg:     '#FFF9EC',
  yellowBorder: '#F0C96C',
  white:        '#FFFFFF',
} as const;

export const fontSizes = {
  small:  14,
  body:   16,
  medium: 18,
  large:  20,
  xl:     24,
} as const;

export const DEFAULT_FONT_SIZE = 22;
export const MIN_FONT_SIZE = 14;
export const MAX_FONT_SIZE = 48;

export const FONT_PRESETS = [
  { label: 'अ–', size: 18 },
  { label: 'अ',  size: 22 },
  { label: 'अ+', size: 28 },
  { label: 'अ++', size: 36 },
] as const;
