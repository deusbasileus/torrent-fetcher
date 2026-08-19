import express from 'express';
import cors from 'cors';
import path from 'path';
import os from 'os';
import { createServer as createViteServer } from 'vite';
import WebTorrent from 'webtorrent';
import fs from 'fs';
import mime from 'mime-types';
import ffmpeg from 'fluent-ffmpeg';

const client = new WebTorrent();

// CRITICAL: WebTorrent emits 'error' on the client when a torrent has no error
// listener. Without this handler, a single bad/duplicate magnet or network error
// throws an uncaught exception and crashes the entire server process.
client.on('error', (err: any) => {
  console.error('WebTorrent client error:', err && err.message ? err.message : err);
});

// Extra public trackers appended to every torrent to dramatically improve peer
// discovery (many magnets ship with dead or too-few trackers).
const DEFAULT_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.tracker.cl:1337/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://tracker.dler.org:6969/announce',
  'udp://open.stealth.si:80/announce',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
];

// Use the OS temp dir so this works on Windows and Linux alike (resolves to
// /tmp on Cloud Run, %TEMP% locally).
const DOWNLOAD_DIR = path.join(os.tmpdir(), 'torrent-downloads');
const activeRemuxes = new Map<string, Promise<void>>();

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// Clean up old files (e.g. older than 24 hours) every hour
setInterval(() => {
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  fs.readdir(DOWNLOAD_DIR, (err, files) => {
    if (err) return;
    files.forEach((file) => {
      const filePath = path.join(DOWNLOAD_DIR, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        if (now - stats.mtimeMs > ONE_DAY) {
          fs.rm(filePath, { recursive: true, force: true }, () => {
            console.log(`Deleted old file: ${filePath}`);
          });
        }
      });
    });
  });
}, 60 * 60 * 1000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API endpoints
  app.post('/api/torrent', async (req, res) => {
    const { magnetURI } = req.body;
    const torrentId = typeof magnetURI === 'string' ? magnetURI.trim() : '';
    if (!torrentId) {
      return res.status(400).json({ error: 'A magnet link or info hash is required' });
    }

    // Accept magnet URIs, bare info hashes (40-char hex / 32-char base32), or
    // http(s) links to a .torrent file. Reject anything else up front so a stray
    // search phrase or page URL never reaches WebTorrent.
    const isMagnet = /^magnet:\?/i.test(torrentId);
    const isInfoHash = /^[a-fA-F0-9]{40}$/.test(torrentId) || /^[a-zA-Z2-7]{32}$/.test(torrentId);
    const isTorrentUrl = /^https?:\/\/.+/i.test(torrentId);
    if (!isMagnet && !isInfoHash && !isTorrentUrl) {
      return res.status(400).json({ error: 'That does not look like a magnet link, info hash, or .torrent URL.' });
    }

    try {
      // Check if torrent already exists (avoids the "duplicate torrent" error)
      const existingTorrent = await client.get(torrentId);
      if (existingTorrent) {
        return res.json({ message: 'Torrent already downloading', infoHash: existingTorrent.infoHash });
      }

      // add() returns the Torrent synchronously so we can attach an error
      // listener immediately — otherwise a torrent error bubbles to the client
      // and (with no listener) crashes the process.
      const torrent = client.add(torrentId, { path: DOWNLOAD_DIR, announce: DEFAULT_TRACKERS });

      torrent.on('error', (err: any) => {
        console.error(`Torrent error (${torrent.infoHash || 'unknown'}):`, err && err.message ? err.message : err);
      });
      torrent.on('warning', () => { /* swallow tracker warnings, they are noisy and non-fatal */ });
      torrent.on('metadata', () => console.log(`Metadata received: ${torrent.name}`));
      torrent.on('ready', () => console.log(`Torrent ready: ${torrent.name} (${torrent.files.length} files)`));

      console.log(`Torrent added: ${torrent.infoHash}`);
      res.json({ message: 'Torrent added', infoHash: torrent.infoHash });
    } catch (error) {
      console.error('Failed to add torrent:', error);
      res.status(500).json({ error: 'Failed to add torrent. Check that the magnet link is valid.' });
    }
  });

  app.get('/api/torrents', (req, res) => {
    const torrentsInfo = client.torrents.map((torrent) => {
      return {
        infoHash: torrent.infoHash,
        name: torrent.name || 'Fetching metadata...',
        progress: torrent.progress,
        downloaded: torrent.downloaded,
        length: torrent.length,
        downloadSpeed: torrent.downloadSpeed,
        uploadSpeed: torrent.uploadSpeed,
        numPeers: torrent.numPeers,
        timeRemaining: torrent.timeRemaining,
        done: torrent.done,
        files: (torrent.files || []).map((file, index) => ({
          index,
          name: file.name,
          path: file.path,
          length: file.length,
          downloaded: file.downloaded,
          progress: file.progress,
        })),
      };
    });
    res.json(torrentsInfo);
  });

  app.delete('/api/torrents/:infoHash', async (req, res) => {
    const { infoHash } = req.params;
    try {
      const torrent = await client.get(infoHash);
      if (!torrent) {
        return res.status(404).json({ error: 'Torrent not found' });
      }

      // Keep track of files to check for .mp4 caches
      const filesToCheck = torrent.files.map(f => path.join(DOWNLOAD_DIR, f.path));

      await new Promise<void>((resolve, reject) => {
        torrent.destroy({ destroyStore: true }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Clean up any .mp4 cache files created for seeking support
      filesToCheck.forEach(absolutePath => {
        const mp4Path = absolutePath + '.mp4';
        if (fs.existsSync(mp4Path)) {
          fs.unlink(mp4Path, (err) => {
            if (err) console.error('Failed to clean up cache file:', err);
          });
        }
      });

      res.json({ message: 'Torrent deleted' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete torrent' });
    }
  });

  app.get('/api/download/:infoHash/:fileIndex', async (req, res) => {
    const { infoHash, fileIndex } = req.params;
    try {
      const torrent = await client.get(infoHash);
      if (!torrent) {
        return res.status(404).send('Torrent not found');
      }
      
      const index = parseInt(fileIndex, 10);
      const file = torrent.files[index];
      if (!file) {
        return res.status(404).send('File not found');
      }

      const absolutePath = path.join(DOWNLOAD_DIR, file.path);

      res.setHeader('X-Accel-Buffering', 'no');

      const safeFilename = file.name.replace(/[^a-zA-Z0-9.\- ]/g, "").replace(/\s+/g, "_");

      const contentType = mime.lookup(file.name) || 'application/octet-stream';

      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', contentType);

      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : file.length - 1;
        const chunksize = (end - start) + 1;
        
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${file.length}`);
        res.setHeader('Content-Length', chunksize);
        
        const stream = file.createReadStream({ start, end });
        stream.on('error', (err) => {
           console.error('Stream range error:', err);
           if (!res.headersSent) res.status(500).send('Stream error');
           else res.end();
        });
        stream.pipe(res);
      } else {
        res.setHeader('Content-Length', file.length);
        const stream = file.createReadStream();
        stream.on('error', (err) => {
           console.error('Stream error:', err);
           if (!res.headersSent) res.status(500).send('Stream error');
           else res.end();
        });
        stream.pipe(res);
      }
    } catch (err) {
      console.error('Download error:', err);
      res.status(500).send('Internal Server Error');
    }
  });

  app.get('/api/stream/:infoHash/:fileIndex', async (req, res) => {
    const { infoHash, fileIndex } = req.params;
    try {
      const torrent = await client.get(infoHash);
      if (!torrent) return res.status(404).send('Torrent not found');
      const index = parseInt(fileIndex, 10);
      const file = torrent.files[index];
      if (!file) return res.status(404).send('File not found');

      const absolutePath = path.join(DOWNLOAD_DIR, file.path);
      if (!fs.existsSync(absolutePath)) {
        return res.status(404).send('File not fully downloaded yet');
      }

            res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
      res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Encoding, Content-Length, Content-Range');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', mime.lookup(file.name) || 'video/mp4');

      if (file.name.match(/\.mkv$/i)) {
        if (file.progress !== 1) { 
           return res.status(400).send('MKV files must be fully downloaded before previewing');
        }
      }

      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : file.length - 1;
        const chunksize = (end - start) + 1;
        
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${file.length}`);
        res.setHeader('Content-Length', chunksize);
        
        const stream = file.createReadStream({ start, end });
        stream.on('error', (err) => {
           console.error('Stream range error:', err);
           if (!res.headersSent) res.status(500).send('Stream error');
           else res.end();
        });
        stream.pipe(res);
      } else {
        res.setHeader('Content-Length', file.length);
        const stream = file.createReadStream();
        stream.on('error', (err) => {
           console.error('Stream error:', err);
           if (!res.headersSent) res.status(500).send('Stream error');
           else res.end();
        });
        stream.pipe(res);
      }
    } catch (err) {
      console.error('Stream error:', err);
      res.status(500).send('Internal Server Error');
    }
  });

  app.get('/api/metadata/:infoHash/:fileIndex', async (req, res) => {
    const { infoHash, fileIndex } = req.params;
    try {
      const torrent = await client.get(infoHash);
      if (!torrent) return res.status(404).json({ error: 'Torrent not found' });
      const index = parseInt(fileIndex, 10);
      const file = torrent.files[index];
      if (!file) return res.status(404).json({ error: 'File not found' });

      const absolutePath = path.join(DOWNLOAD_DIR, file.path);
      if (!fs.existsSync(absolutePath)) {
        return res.status(404).json({ error: 'File not fully downloaded yet to disk for probing' });
      }

      ffmpeg.ffprobe(absolutePath, (err, metadata) => {
        if (err) {
          console.error('ffprobe error:', err);
          return res.status(500).json({ error: 'Failed to probe file' });
        }
        res.json(metadata);
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/subtitles/:infoHash/:fileIndex/:streamIndex', async (req, res) => {
    const { infoHash, fileIndex, streamIndex } = req.params;
    try {
      const torrent = await client.get(infoHash);
      if (!torrent) return res.status(404).send('Torrent not found');
      const index = parseInt(fileIndex, 10);
      const file = torrent.files[index];
      if (!file) return res.status(404).send('File not found');

      const absolutePath = path.join(DOWNLOAD_DIR, file.path);
      if (!fs.existsSync(absolutePath)) {
        return res.status(404).send('File not fully downloaded yet');
      }

      res.setHeader('Content-Type', 'text/vtt');
      
      ffmpeg(absolutePath)
        .outputOptions([
          `-map 0:${streamIndex}`,
          '-f webvtt'
        ])
        .on('error', (err) => {
          // ignore EPIPE from early close
          if (!err.message.includes('EPIPE')) {
            console.error('ffmpeg subtitle extract error:', err);
          }
        })
        .pipe(res);
    } catch (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
