import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';

ffmpeg()
  .input('color=c=black:s=128x128')
  .inputFormat('lavfi')
  .duration(5)
  .outputOptions(['-c:v libx264', '-f mkv'])
  .save('/tmp/sample.mkv')
  .on('end', () => {
    console.log('MKV created. Remuxing to MP4...');
    ffmpeg('/tmp/sample.mkv')
      .outputOptions(['-c:v copy', '-c:a copy', '-sn', '-movflags', 'faststart'])
      .save('/tmp/sample.mp4')
      .on('end', () => {
        console.log('Remuxed. Checking if valid mp4...');
      })
      .on('error', console.error);
  });
