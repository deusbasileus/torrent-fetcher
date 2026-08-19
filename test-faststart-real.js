import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';

// create a dummy mkv
ffmpeg()
  .input('color=c=black:s=128x128')
  .inputFormat('lavfi')
  .duration(5)
  .outputOptions(['-c:v libx264', '-f matroska'])
  .save('/tmp/dummy.mkv')
  .on('end', () => {
    console.log('MKV created. Remuxing to MP4...');
    ffmpeg('/tmp/dummy.mkv')
      .outputOptions(['-c:v copy', '-c:a copy', '-sn', '-movflags', '+faststart'])
      .save('/tmp/dummy.mp4')
      .on('end', () => {
        console.log('Remuxed. Checking if valid mp4...');
        const stats = fs.statSync('/tmp/dummy.mp4');
        console.log('Size:', stats.size);
      })
      .on('error', console.error);
  });
