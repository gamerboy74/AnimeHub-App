export const APP_CONFIG = {
  appName: 'AnimeHub',
  version: 'v1.0.2',
  versionCode: 3,
  releaseDate: 'September 2026',
  apkFilename: 'AnimeHub.apk',
  apkSize: '101.9 MB',
  minAndroid: 'Android 7.0+ (Nougat through Android 15)',
  targetQuality: 'Highest Quality Possible (1080p FHD)',

  /**
   * Official EAS Cloud Build:
   * Dashboard: https://expo.dev/accounts/omkayuja/projects/Animehub-Mobile/builds/4972be70-4ff1-48b8-a189-981dce6c8f7c
   * Direct CDN Download: https://expo.dev/artifacts/eas/1kn6dxumbIM6mphYRl9zvXgSRvGqYDuLr08M27TjS8g.apk
   */
  expoBuildDashboardUrl:
    'https://expo.dev/accounts/omkayuja/projects/Animehub-Mobile/builds/4972be70-4ff1-48b8-a189-981dce6c8f7c',
  expoDirectCdnUrl:
    'https://expo.dev/artifacts/eas/1kn6dxumbIM6mphYRl9zvXgSRvGqYDuLr08M27TjS8g.apk',

  /**
   * APK Download URL:
   * Defaults to the official Expo CDN direct download link.
   */
  apkDownloadUrl:
    import.meta.env.VITE_APK_DOWNLOAD_URL ||
    'https://expo.dev/artifacts/eas/1kn6dxumbIM6mphYRl9zvXgSRvGqYDuLr08M27TjS8g.apk',

  // Computed SHA-256 Checksum of the actual production AnimeHub.apk (106,816,886 bytes)
  sha256: '9e5f2f824d7bca9603cd477ee2e6465a5af3792b7a3572737bc1c0e095926e79',
}

