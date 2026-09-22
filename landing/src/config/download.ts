export const APP_CONFIG = {
  appName: 'AnimeHub',
  version: 'v1.0.2',
  versionCode: 3,
  releaseDate: 'September 2026',
  apkFilename: 'AnimeHub.apk',
  apkSize: '100.6 MB',
  minAndroid: 'Android 7.0+ (Nougat through Android 15)',
  targetQuality: 'Highest Quality Possible (1080p FHD)',

  /**
   * Official EAS Cloud Build:
   * Dashboard: https://expo.dev/accounts/omkayuja/projects/Animehub-Mobile/builds/7c852e71-4dbf-47bd-8e82-b45cc2ab5994
   * Direct CDN Download: https://expo.dev/artifacts/eas/xJ3OtK24G-adezxpHdoZHFelTi9GLr6MszbGTsRLruk.apk
   */
  expoBuildDashboardUrl:
    'https://expo.dev/accounts/omkayuja/projects/Animehub-Mobile/builds/7c852e71-4dbf-47bd-8e82-b45cc2ab5994',
  expoDirectCdnUrl:
    'https://expo.dev/artifacts/eas/xJ3OtK24G-adezxpHdoZHFelTi9GLr6MszbGTsRLruk.apk',

  /**
   * APK Download URL:
   * Defaults to the official Expo CDN direct download link.
   */
  apkDownloadUrl:
    import.meta.env.VITE_APK_DOWNLOAD_URL ||
    'https://expo.dev/artifacts/eas/xJ3OtK24G-adezxpHdoZHFelTi9GLr6MszbGTsRLruk.apk',

  // Computed SHA-256 Checksum of the actual production AnimeHub.apk (105,532,630 bytes)
  sha256: '9cd890375b8e6268c8d23ae1379a3e836c065e4382e5beb625c05b88aee8f2d4',
}

