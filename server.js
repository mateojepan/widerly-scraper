const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 1) SEARCH route
// Volání: GET /search?q=... 
// Vrátí JSON s metadaty (title, videoId, thumbnail, atd.)
app.get('/search', (req, res) => {
  let q = req.query.q || "";
  if(!q) {
    return res.json([]);
  }
  // Příklad: použijeme yt-dlp s 'ytsearch10:'
  // a cookies soubor if exist
  let cookiesArg = fs.existsSync('youtube_cookies.txt') ? '--cookies youtube_cookies.txt' : '';
  let cmd = `yt-dlp ${cookiesArg} --dump-json --skip-download "ytsearch10:${q}"`;
  exec(cmd, (error, stdout, stderr) => {
    if(error){
      console.error("Exec error:", error);
      return res.status(500).json({error: stderr});
    }
    let lines = stdout.trim().split('\n');
    let results = lines.map(line => {
      try { return JSON.parse(line); }
      catch(e){ return null; }
    }).filter(Boolean);

    // Minimal transform => pole {videoId, title, thumbnail, duration}
    let final = results.map(r => ({
      videoId: r.id,
      title: r.title,
      thumbnail: (r.thumbnails && r.thumbnails.length>0) ? r.thumbnails[0].url : null,
      duration: r.duration,
      uploader: r.uploader
    }));
    res.json(final);
  });
});

// 2) DOWNLOAD route
// GET /download?vid=VIDEO_ID
// spustí stahování audio do response, popř. uloží na server
app.get('/download', (req, res) => {
  let vid = req.query.vid || "";
  if(!vid){
    return res.status(400).send("Missing vid param");
  }
  let cookiesArg = fs.existsSync('youtube_cookies.txt') ? '--cookies youtube_cookies.txt' : '';
  // stahovat audio do dočasného souboru:
  let cmd = `yt-dlp ${cookiesArg} -f bestaudio --extract-audio --audio-format mp3 -o - "https://www.youtube.com/watch?v=${vid}"`;
  // `-o -` => pošle mp3 do stdout
  let child = exec(cmd,{maxBuffer:1024*1024*50}); // bigger buffer

  // stream out
  res.setHeader('Content-Type','audio/mpeg');
  child.stdout.pipe(res); 
  child.stderr.on('data',(data)=>{ console.log("ERR", data.toString()); });
  child.on('exit',(code)=>{
    console.log("Download exit code", code);
  });
});

// spustíme server
app.listen(PORT, ()=>{
  console.log("Scraper running on port", PORT);
});
