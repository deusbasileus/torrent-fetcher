const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `      const res = await fetch('/api/torrents');
      if (!res.ok) throw new Error('Failed to fetch torrents');
      const data = await res.json();`;
const replacement = `      const res = await fetch('/api/torrents');
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
      }`;
code = code.replace(target, replacement);

const target2 = `        files: torrent.files.map((file, index) => ({`;
const replacement2 = `        files: (torrent.files || []).map((file, index) => ({`;
let serverCode = fs.readFileSync('server.ts', 'utf8');
serverCode = serverCode.replace(target2, replacement2);
fs.writeFileSync('server.ts', serverCode);

const target3 = `      if (!res.ok) {
        const data = await res.json();`;
const replacement3 = `      if (!res.ok) {
        const text = await res.text();
        let data = {};
        try { data = JSON.parse(text); } catch (e) {}`;
code = code.replace(target3, replacement3);

fs.writeFileSync('src/App.tsx', code);
