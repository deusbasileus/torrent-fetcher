import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { TorrentInfo, TorrentFile } from './types';

interface PreviewModalProps {
  torrent: TorrentInfo;
  file: TorrentFile;
  onClose: () => void;
}

interface Stream {
  index: number;
  codec_type: string;
  tags?: {
    language?: string;
    title?: string;
  };
}

export default function PreviewModal({ torrent, file, onClose }: PreviewModalProps) {
  const [subtitles, setSubtitles] = useState<Stream[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isVideo = Boolean(file.name.match(/\.(mp4|mkv|webm|avi|mov)$/i));
  const isHEVC = Boolean(file.name.match(/x265|hevc/i));
  const isImage = Boolean(file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i));

  useEffect(() => {
    if (isVideo && file.progress === 1) {
      setLoadingMeta(true);
      fetch(`/api/metadata/${torrent.infoHash}/${file.index}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to load metadata');
          return res.json();
        })
        .then(data => {
          const subs = data.streams?.filter((s: Stream) => s.codec_type === 'subtitle') || [];
          setSubtitles(subs);
        })
        .catch(err => {
          console.error(err);
          // don't block playback if metadata fails
        })
        .finally(() => setLoadingMeta(false));
    }
  }, [isVideo, torrent.infoHash, file.index, file.progress]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 w-full max-w-6xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-screen">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
          <h3 className="text-lg font-medium text-white truncate pr-4" title={file.name}>
            {file.name}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[50vh]">
          {isImage ? (
            <img
              src={`/api/download/${torrent.infoHash}/${file.index}`}
              alt={file.name}
              className="max-w-full max-h-[80vh] object-contain"
            />
          ) : isVideo ? (
            <div className="relative w-full h-full flex flex-col items-center justify-center bg-black">
              {isHEVC && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-yellow-500/90 text-yellow-50 text-xs px-4 py-2 rounded-lg font-medium shadow-lg backdrop-blur text-center max-w-md">
                  This video uses the HEVC (x265) codec, which is not natively supported by most browsers (like Chrome/Firefox). The player may fail to load. Please download the file to play it locally.
                </div>
              )}
              {loadingMeta ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              ) : null}
              
              <video
                controls
                autoPlay
                className="w-full h-full max-h-[80vh] outline-none"
                crossOrigin="anonymous"
              >
                <source src={`/api/stream/${torrent.infoHash}/${file.index}`} />
                {subtitles.map(sub => (
                  <track
                    key={sub.index}
                    src={`/api/subtitles/${torrent.infoHash}/${file.index}/${sub.index}`}
                    kind="subtitles"
                    srcLang={sub.tags?.language || `sub-${sub.index}`}
                    label={sub.tags?.title || sub.tags?.language || `Subtitle ${sub.index}`}
                    default={sub.tags?.language === 'eng' || sub.tags?.language === 'en'}
                  />
                ))}
                Your browser does not support HTML video.
              </video>
            </div>
          ) : (
            <div className="text-slate-400 text-center p-8">
              <p>Preview is not available for this file type.</p>
              <p className="text-sm mt-2">Please download it to view.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
