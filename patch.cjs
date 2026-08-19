const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /const sendOptions = \{[\s\S]*?return res\.sendFile\(absolutePath, sendOptions\);/;
if (regex.test(code)) {
  const replacement = `      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
      res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Encoding, Content-Length, Content-Range');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', mime.lookup(file.name) || 'video/mp4');

      if (file.name.match(/\\.mkv$/i)) {
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
        res.setHeader('Content-Range', \`bytes \${start}-\${end}/\${file.length}\`);
        res.setHeader('Content-Length', chunksize);
        
        const stream = file.createReadStream({ start, end });
        stream.pipe(res);
      } else {
        res.setHeader('Content-Length', file.length);
        const stream = file.createReadStream();
        stream.pipe(res);
      }`;
  code = code.replace(regex, replacement);
  fs.writeFileSync('server.ts', code);
  console.log('Patched');
} else {
  console.log('Target not found');
}
