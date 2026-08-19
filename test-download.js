import http from 'http';

http.get('http://localhost:3000/api/torrents', (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const torrents = JSON.parse(data);
    if (torrents.length > 0) {
      const t = torrents[0];
      console.log('Progress:', t.progress);
      http.get(`http://localhost:3000/api/download/${t.infoHash}/0`, (dres) => {
        console.log('Headers:', dres.headers);
        let len = 0;
        dres.on('data', chunk => {
          len += chunk.length;
          if (len > 50000) {
            console.log('Received >50KB, stopping.');
            process.exit(0);
          }
        });
        dres.on('end', () => console.log('End. Total:', len));
      });
    } else {
      console.log('No torrents');
    }
  });
});
