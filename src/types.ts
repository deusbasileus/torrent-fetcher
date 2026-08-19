export interface TorrentFile {
  index: number;
  name: string;
  path: string;
  length: number;
  downloaded: number;
  progress: number;
}

export interface TorrentInfo {
  infoHash: string;
  name: string;
  progress: number;
  downloaded: number;
  length: number;
  downloadSpeed: number;
  uploadSpeed: number;
  numPeers: number;
  timeRemaining: number;
  done: boolean;
  files: TorrentFile[];
}
