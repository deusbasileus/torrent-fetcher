import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';

const mkvPath = '/tmp/downloads/That.Time.I.Got.Reincarnated.as.a.Slime.S04E18.1080p.NF.WEB-DL.AAC2.0.H.264-VARYG.mkv';
const mp4Path = mkvPath + '.faststart.mp4';

console.time('remux');
ffmpeg(mkvPath)
  .outputOptions(['-c:v copy', '-c:a copy', '-sn', '-movflags', 'faststart'])
  .save(mp4Path)
  .on('end', () => {
    console.timeEnd('remux');
    console.log('Size:', fs.statSync(mp4Path).size);
    process.exit(0);
  })
  .on('error', err => {
    console.error(err);
    process.exit(1);
  });
