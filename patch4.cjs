const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target1 = `        const stream = file.createReadStream({ start, end });
        stream.pipe(res);`;
const replacement1 = `        const stream = file.createReadStream({ start, end });
        stream.on('error', (err) => {
           console.error('Stream range error:', err);
           if (!res.headersSent) res.status(500).send('Stream error');
           else res.end();
        });
        stream.pipe(res);`;

const target2 = `        const stream = file.createReadStream();
        stream.pipe(res);`;
const replacement2 = `        const stream = file.createReadStream();
        stream.on('error', (err) => {
           console.error('Stream error:', err);
           if (!res.headersSent) res.status(500).send('Stream error');
           else res.end();
        });
        stream.pipe(res);`;

code = code.replace(target1, replacement1);
code = code.replace(target1, replacement1); // Do it twice for download and stream routes!
code = code.replace(target1, replacement1);
code = code.replace(target2, replacement2);
code = code.replace(target2, replacement2);
code = code.replace(target2, replacement2);

fs.writeFileSync('server.ts', code);
console.log('patched stream errors');
