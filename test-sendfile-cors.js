import express from 'express';
import fs from 'fs';

fs.writeFileSync('/tmp/test-cors.mp4', Buffer.alloc(1000));

const app = express();
app.get('/stream', (req, res) => {
  const sendOptions = {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Range',
      'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Encoding, Content-Length, Content-Range'
    }
  };
  res.sendFile('/tmp/test-cors.mp4', sendOptions);
});
app.listen(3002, () => console.log('Test on 3002'));
