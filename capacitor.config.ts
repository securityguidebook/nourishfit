import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nourishfit.app',
  appName: 'NourishFit',
  webDir: 'dist',
  server: { androidScheme: 'https' },
};

export default config;
