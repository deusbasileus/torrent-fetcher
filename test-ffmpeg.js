import ffmpeg from 'fluent-ffmpeg';

ffmpeg.ffprobe('/tmp/downloads/That.Time.I.Got.Reincarnated.as.a.Slime.S04E18.1080p.NF.WEB-DL.AAC2.0.H.264-VARYG.mkv', (err, metadata) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(JSON.stringify(metadata.streams.map(s => ({
    index: s.index,
    codec_type: s.codec_type,
    codec_name: s.codec_name,
    tags: s.tags
  })), null, 2));
});
