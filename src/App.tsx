import { File, HardDrive, Download, Trash2, Link as LinkIcon, RefreshCw, XCircle, Eye } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { TorrentInfo, TorrentFile } from './types';
import PreviewModal from './PreviewModal';

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function App() {
  const [magnetURI, setMagnetURI] = useState('');
  const [torrents, setTorrents] = useState<TorrentInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{torrent: TorrentInfo, file: TorrentFile} | null>(null);

  const fetchTorrents = async () => {
    try {
      const res = await fetch('/api/torrents');
      if (!res.ok) {
         const text = await res.text();
         console.error('Error text:', text);
         throw new Error('Failed to fetch torrents');
      }
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse JSON, received text:', text.substring(0, 200));
        throw e;
      }
      setTorrents(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTorrents();
    const interval = setInterval(fetchTorrents, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAddTorrent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!magnetURI.trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/torrent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ magnetURI }),
      });
      if (!res.ok) {
        const text = await res.text();
        let data = {};
        try { data = JSON.parse(text); } catch (e) {}
        throw new Error(data.error || 'Failed to add torrent');
      }
      setMagnetURI('');
      fetchTorrents();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const [torrentToDelete, setTorrentToDelete] = useState<string | null>(null);

  const handleDeleteTorrent = async (infoHash: string) => {
    try {
      await fetch(`/api/torrents/${infoHash}`, {
        method: 'DELETE',
      });
      fetchTorrents();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center space-x-3">
          <Download className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Torrent Fetcher</h1>
        </header>

        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <form onSubmit={handleAddTorrent} className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LinkIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Paste magnet link here..."
                className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                value={magnetURI}
                onChange={(e) => setMagnetURI(e.target.value)}
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !magnetURI.trim()}
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Download'}
            </button>
          </form>
          {error && (
            <div className="mt-3 text-red-600 text-sm flex items-center gap-1.5">
              <XCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-slate-500" />
            Active Downloads
          </h2>

          {torrents.length === 0 ? (
            <div className="bg-slate-100 rounded-2xl border border-slate-200 border-dashed p-12 text-center text-slate-500">
              No active downloads. Paste a magnet link above to start.
            </div>
          ) : (
            <div className="space-y-4">
              {torrents.map((torrent) => (
                <div key={torrent.infoHash} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-5 border-b border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-medium text-slate-900 truncate pr-4" title={torrent.name}>
                        {torrent.name}
                      </h3>
                      <button
                        onClick={() => setTorrentToDelete(torrent.infoHash)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Torrent"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm font-medium text-slate-600">
                        <span>{formatBytes(torrent.downloaded)} / {formatBytes(torrent.length)}</span>
                        <span>{Math.round(torrent.progress * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full transition-all duration-300 ${
                            torrent.done ? 'bg-emerald-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${Math.max(0, Math.min(100, torrent.progress * 100))}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <span className={torrent.done ? "text-emerald-600 font-medium" : "text-blue-600"}>
                            {torrent.done ? 'Completed' : 'Downloading'}
                          </span>
                          {!torrent.done && `â ${formatBytes(torrent.downloadSpeed)}/s`}
                        </span>
                        <span>{torrent.numPeers} peers</span>
                      </div>
                    </div>
                  </div>

                  {torrent.files && torrent.files.length > 0 && (
                    <div className="bg-slate-50/50 p-5 space-y-3">
                      <h4 className="text-sm font-medium text-slate-700 uppercase tracking-wider mb-3">Files</h4>
                      <ul className="space-y-2">
                        {torrent.files.map((file) => (
                          <li key={file.path} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <File className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              <span className="text-sm text-slate-700 truncate" title={file.name}>
                                {file.name}
                              </span>
                              <span className="text-xs text-slate-400 flex-shrink-0">
                                ({formatBytes(file.length)})
                              </span>
                            </div>
                            <div className="flex items-center gap-3 pl-4">
                              {!torrent.done && file.progress < 1 && (
                                <span className="text-xs text-slate-400 font-medium">
                                  {Math.round(file.progress * 100)}%
                                </span>
                              )}
                              <div className="flex items-center gap-2">
                                {file.name.match(/\.(mp4|mkv|webm|avi|mov|jpg|jpeg|png|gif|webp)$/i) && (
                                  <button
                                    onClick={() => setPreviewData({ torrent, file })}
                                    disabled={file.progress !== 1}
                                    className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                                      file.progress === 1
                                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        : 'bg-slate-50 text-slate-300 pointer-events-none'
                                    }`}
                                  >
                                    <Eye className="w-4 h-4" />
                                    Preview
                                  </button>
                                )}
                                <a
                                  href={`/api/download/${torrent.infoHash}/${file.index}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                                    file.progress === 1
                                      ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                      : 'bg-slate-100 text-slate-400 pointer-events-none'
                                  }`}
                                >
                                  <Download className="w-4 h-4" />
                                  Download
                                </a>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      {previewData && (
        <PreviewModal
          torrent={previewData.torrent}
          file={previewData.file}
          onClose={() => setPreviewData(null)}
        />
      )}

      {torrentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Torrent?</h3>
            <p className="text-slate-500 mb-6 text-sm">
              Are you sure you want to delete this torrent? The downloaded files will be permanently removed from the server.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setTorrentToDelete(null)}
                className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDeleteTorrent(torrentToDelete);
                  setTorrentToDelete(null);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
