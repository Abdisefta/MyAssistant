import { Platform, useWindowDimensions } from 'react-native';

import { DESKTOP_BREAKPOINT } from '@/constants/desktop-layout';

export const isWeb = Platform.OS === 'web';

export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_BREAKPOINT;
}
