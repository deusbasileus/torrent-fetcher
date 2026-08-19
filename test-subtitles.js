import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';

const stream = ffmpeg('/tmp/downloads/That.Time.I.Got.Reincarnated.as.a.Slime.S04E18.1080p.NF.WEB-DL.AAC2.0.H.264-VARYG.mkv')
  .outputOptions([
    '-map 0:2',
    '-f webvtt'
  ])
  .on('error', (err) => console.error('Error:', err.message))
  .pipe(process.stdout);
