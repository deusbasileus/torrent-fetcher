import express from 'express';
import fs from 'fs';

const app = express();
app.get('/stream', (req, res) => {
  res.setHeader('X-Accel-Buffering', 'no');
  res.sendFile('/tmp/downloads/That.Time.I.Got.Reincarnated.as.a.Slime.S04E18.1080p.NF.WEB-DL.AAC2.0.H.264-VARYG.mkv.faststart.mp4');
});
app.listen(3002, () => console.log('Test on 3002'));
