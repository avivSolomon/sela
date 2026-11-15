# Sela - minimal static server (no Node.js, no installs, no downloads)
# Usage:  powershell -ExecutionPolicy Bypass -File .\scripts\serve-static.ps1 -Root <folder> [-NoBrowser]
# Serves a prebuilt Sela (the packages\desktop-client\build folder) on http://localhost:3001
# with the COOP/COEP headers that SharedWorker / SharedArrayBuffer / OPFS need.
# Stop with Ctrl+C.
param(
  [Parameter(Mandatory = $true)][string]$Root,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$Port = 3001
$Url  = "http://localhost:$Port/"
$Root = (Resolve-Path -LiteralPath $Root -ErrorAction SilentlyContinue).Path

if (-not $Root -or -not (Test-Path (Join-Path $Root 'index.html'))) {
  Write-Host "ERROR: the app folder (with index.html) was not found. Build Sela first." -ForegroundColor Red
  exit 1
}

# Port check with a clear message
$busy = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($busy) {
  $p = Get-Process -Id $busy.OwningProcess -ErrorAction SilentlyContinue
  if ($busy.OwningProcess -eq 4) {
    # Windows HTTP.sys listeners (another Sela window, IIS, etc.) are reported as the System process
    $name = "a Windows HTTP service (often another Sela window already running, or IIS)"
  } else {
    $name = if ($p) { "$($p.ProcessName) (PID $($busy.OwningProcess))" } else { "PID $($busy.OwningProcess)" }
  }
  Write-Host "ERROR: port $Port is already in use by $name." -ForegroundColor Red
  Write-Host "If Sela is already running, open $Url. Otherwise close that program (or stop the process) and run this script again."
  Write-Host "The port is fixed on purpose: the browser stores your data per address (origin), so changing it would hide your budget."
  exit 1
}

$source = @'
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Threading;

public class SelaServer {
  private readonly HttpListener listener = new HttpListener();
  private readonly string root;
  private static readonly Dictionary<string, string> Mime = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
    {".html","text/html; charset=utf-8"}, {".js","text/javascript; charset=utf-8"}, {".mjs","text/javascript; charset=utf-8"},
    {".css","text/css; charset=utf-8"}, {".json","application/json; charset=utf-8"}, {".wasm","application/wasm"},
    {".png","image/png"}, {".jpg","image/jpeg"}, {".svg","image/svg+xml"}, {".ico","image/x-icon"},
    {".woff2","font/woff2"}, {".woff","font/woff"}, {".txt","text/plain; charset=utf-8"}, {".xml","application/xml"},
    {".webmanifest","application/manifest+json"}, {".sqlite","application/octet-stream"}, {".sql","text/plain; charset=utf-8"},
    {".map","application/json; charset=utf-8"}
  };

  public SelaServer(string rootDir, int port) {
    root = Path.GetFullPath(rootDir).TrimEnd('\\') + "\\";
    listener.Prefixes.Add("http://localhost:" + port + "/");
  }

  public void Start() {
    listener.Start();
    for (int i = 0; i < 8; i++) {
      Thread t = new Thread(Loop);
      t.IsBackground = true;
      t.Start();
    }
  }

  public void Stop() {
    try { listener.Stop(); listener.Close(); } catch (Exception) { }
  }

  private void Loop() {
    while (listener.IsListening) {
      HttpListenerContext c;
      try { c = listener.GetContext(); } catch (Exception) { break; }
      try { Handle(c); } catch (Exception) { try { c.Response.Abort(); } catch (Exception) { } }
    }
  }

  private void Handle(HttpListenerContext c) {
    HttpListenerResponse res = c.Response;
    res.Headers["Cross-Origin-Opener-Policy"] = "same-origin";
    res.Headers["Cross-Origin-Embedder-Policy"] = "require-corp";
    res.Headers["X-Content-Type-Options"] = "nosniff";
    string method = c.Request.HttpMethod;
    if (method != "GET" && method != "HEAD") { res.StatusCode = 405; res.Close(); return; }

    string rel = Uri.UnescapeDataString(c.Request.Url.AbsolutePath).Replace('/', '\\').TrimStart('\\');
    string full;
    try { full = Path.GetFullPath(Path.Combine(root, rel)); } catch (Exception) { res.StatusCode = 400; res.Close(); return; }
    if (!full.StartsWith(root, StringComparison.OrdinalIgnoreCase)) { res.StatusCode = 403; res.Close(); return; }

    if (!File.Exists(full)) {
      // client-side routes (no file extension) fall back to index.html; missing assets are real 404s
      if (Path.GetExtension(full).Length == 0) { full = Path.Combine(root, "index.html"); }
      else { res.StatusCode = 404; res.Close(); return; }
    }

    FileInfo fi = new FileInfo(full);
    string ext = fi.Extension;
    string ct;
    res.ContentType = Mime.TryGetValue(ext, out ct) ? ct : "application/octet-stream";
    bool hashed = c.Request.Url.AbsolutePath.StartsWith("/static/", StringComparison.Ordinal);
    res.Headers["Cache-Control"] = hashed ? "public, max-age=31536000, immutable" : "no-cache";
    DateTime lm = fi.LastWriteTimeUtc;
    lm = new DateTime(lm.Ticks - (lm.Ticks % TimeSpan.TicksPerSecond), DateTimeKind.Utc);
    res.Headers["Last-Modified"] = lm.ToString("R");
    string ims = c.Request.Headers["If-Modified-Since"];
    DateTime since;
    if (ims != null && DateTime.TryParse(ims, out since) && since.ToUniversalTime() >= lm) { res.StatusCode = 304; res.Close(); return; }

    res.StatusCode = 200;
    res.ContentLength64 = fi.Length;
    if (method == "HEAD") { res.Close(); return; }
    using (FileStream fs = new FileStream(full, FileMode.Open, FileAccess.Read, FileShare.ReadWrite)) {
      byte[] buf = new byte[65536];
      int n;
      while ((n = fs.Read(buf, 0, buf.Length)) > 0) { res.OutputStream.Write(buf, 0, n); }
    }
    res.OutputStream.Close();
  }
}
'@

try {
  Add-Type -TypeDefinition $source -Language CSharp
} catch {
  Write-Host "ERROR: could not compile the built-in server component: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

$server = New-Object SelaServer($Root, $Port)
try {
  $server.Start()
} catch {
  Write-Host "ERROR: could not listen on $Url - $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Another program may be using port $Port, or a security product blocked the listener."
  exit 1
}

Write-Host "Sela is running at $Url" -ForegroundColor Green
Write-Host "Use the same browser profile every time (your data is stored in the browser). Press Ctrl+C to stop."
if (-not $NoBrowser) { Start-Process $Url }

try {
  while ($true) { Start-Sleep -Seconds 1 }
} finally {
  $server.Stop()
  Write-Host "Sela stopped."
}
