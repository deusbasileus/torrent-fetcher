const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `    } catch (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
    }`;
const replacement = `    } catch (err) {
      console.error('Stream error:', err);
      fs.writeFileSync('/tmp/stream-error.txt', String(err && err.stack ? err.stack : err));
      res.status(500).send('Internal Server Error');
    }`;
if(code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('server.ts', code);
  console.log('patched');
} else {
  console.log('not found');
}
