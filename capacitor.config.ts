import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vitalcenter.app',
  appName: 'VitalCenter',
  webDir: 'dist',
  server: { androidScheme: 'https' },
};

export default config;
