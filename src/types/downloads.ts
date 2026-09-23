export type DownloadStatus =
  | 'idle'
  | 'sniffing'     // WebView has not yet detected the .m3u8 URL
  | 'preparing'    // Fetching & parsing manifests
  | 'downloading'  // Downloading .ts segments
  | 'done'         // All done — local file ready
  | 'error';

export interface DownloadedEpisode {
  episodeId: string;
  title: string;
  animeName: string;
  thumbnailUrl: string;
  localManifestUri: string;  // file:// path to local .m3u8
  downloadedAt: number;      // timestamp ms
  totalSegments: number;
  sizeBytes: number;         // approx total size
}

export interface ActiveDownloadInfo {
  episodeId: string;
  title: string;
  animeName: string;
  thumbnailUrl: string;
  status: DownloadStatus;
  progress: number;
  error: string | null;
}
