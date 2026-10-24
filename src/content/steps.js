// String.raw preserves PowerShell backslashes and the supplied command blocks.
export const TOOL = {
  slug: 'fps-unlocker', name: 'FPS Unlocker', vendor: 'SEVEN Corporation',
  status: 'working', desc: 'Local auth server + forged session token. No key, no expiry.',
  tested: '2026-10-23', version: 'v1.0.0',
  disclaimer: 'Compatibility and test date are supplied by the guide author, not independently verified. Use only where you have permission. Commands modify local certificate trust and name resolution.'
};
export const REQUIREMENTS = ['Windows 10 / 11', 'Python 3 → winget install Python.Python.3.12', 'Administrator rights (only to edit the hosts file in step 5)'];
export const STEPS = [
  { n: 1, title: 'Create the folder and install the dependency', body: 'One package: cryptography. Nothing else.',
    cmd: String.raw`mkdir C:\seven -Force; cd C:\seven
python -m pip install cryptography`, note: 'Use a fresh folder. The Add-Content blocks append: running them twice duplicates the script.' },
  { n: 2, title: 'Build the certificate generator', body: 'Paste the whole block — it writes makecert.py line by line.',
    cmd: String.raw`Add-Content .\makecert.py 'from cryptography import x509'
Add-Content .\makecert.py 'from cryptography.x509.oid import NameOID'
Add-Content .\makecert.py 'from cryptography.hazmat.primitives import hashes, serialization'
Add-Content .\makecert.py 'from cryptography.hazmat.primitives.asymmetric import rsa'
Add-Content .\makecert.py 'import datetime'
Add-Content .\makecert.py ''
Add-Content .\makecert.py 'k = rsa.generate_private_key(public_exponent=65537, key_size=2048)'
Add-Content .\makecert.py 'n = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "sevenauthapi.com")])'
Add-Content .\makecert.py 'now = datetime.datetime.now(datetime.timezone.utc)'
Add-Content .\makecert.py ''
Add-Content .\makecert.py 'c = (x509.CertificateBuilder().subject_name(n).issuer_name(n)'
Add-Content .\makecert.py '     .public_key(k.public_key()).serial_number(x509.random_serial_number())'
Add-Content .\makecert.py '     .not_valid_before(now - datetime.timedelta(days=1))'
Add-Content .\makecert.py '     .not_valid_after(now + datetime.timedelta(days=3650))'
Add-Content .\makecert.py '     .add_extension(x509.SubjectAlternativeName(['
Add-Content .\makecert.py '         x509.DNSName("sevenauthapi.com"), x509.DNSName("*.sevenauthapi.com")]), False)'
Add-Content .\makecert.py '     .add_extension(x509.BasicConstraints(ca=True, path_length=None), True)'
Add-Content .\makecert.py '     .sign(k, hashes.SHA256()))'
Add-Content .\makecert.py ''
Add-Content .\makecert.py 'open("cert.pem","wb").write('
Add-Content .\makecert.py '    k.private_bytes(serialization.Encoding.PEM,'
Add-Content .\makecert.py '        serialization.PrivateFormat.TraditionalOpenSSL,'
Add-Content .\makecert.py '        serialization.NoEncryption()) + c.public_bytes(serialization.Encoding.PEM))'
Add-Content .\makecert.py 'open("seven.cer","wb").write(c.public_bytes(serialization.Encoding.DER))'
Add-Content .\makecert.py 'print("OK")'`, note: 'Then run the next block to generate and trust it. Keep cert.pem private: it contains the private key.' },
  { n: 3, title: 'Generate and trust the certificate', body: 'Trusting a root certificate changes your local security boundary. Review this before continuing.',
    cmd: String.raw`python makecert.py
Import-Certificate -FilePath .\seven.cer -CertStoreLocation "Cert:\CurrentUser\Root"`,
    note: 'CurrentUser\\Root needs no admin. Trust behavior depends on the app and Windows account; service accounts may use a different trust store.' },
  { n: 4, title: 'Build the fake auth server', body: 'This writes fake.py — an HTTPS server that answers the app.',
    cmd: String.raw`Add-Content .\fake.py 'import ssl, json, base64, hashlib, time, uuid, secrets'
Add-Content .\fake.py 'from http.server import HTTPServer, BaseHTTPRequestHandler'
Add-Content .\fake.py ''
Add-Content .\fake.py 'YEAR = 365 * 24 * 3600 * 1000'
Add-Content .\fake.py ''
Add-Content .\fake.py 'def token(hwid):'
Add-Content .\fake.py '    now = int(time.time() * 1000)'
Add-Content .\fake.py '    p = {"k": secrets.token_hex(12),'
Add-Content .\fake.py '         "h": hashlib.sha256(hwid.encode()).hexdigest()[:24],'
Add-Content .\fake.py '         "c": secrets.token_hex(8),'
Add-Content .\fake.py '         "e": now + 10 * YEAR}'
Add-Content .\fake.py '    b = base64.urlsafe_b64encode(json.dumps(p, separators=(",", ":")).encode()).decode().rstrip("=")'
Add-Content .\fake.py '    sig = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("=")'
Add-Content .\fake.py '    return b + "." + sig'
Add-Content .\fake.py ''
Add-Content .\fake.py 'class H(BaseHTTPRequestHandler):'
Add-Content .\fake.py '    def do_GET(self): self.x()'
Add-Content .\fake.py '    def do_POST(self): self.x()'
Add-Content .\fake.py '    def x(self):'
Add-Content .\fake.py '        n = int(self.headers.get("Content-Length") or 0)'
Add-Content .\fake.py '        raw = self.rfile.read(n)'
Add-Content .\fake.py '        print(">>>", self.path, raw)'
Add-Content .\fake.py '        try: req = json.loads(raw or b"{}")'
Add-Content .\fake.py '        except: req = {}'
Add-Content .\fake.py '        now = int(time.time() * 1000)'
Add-Content .\fake.py '        body = {"success": True, "message": "Authorized", "data": {'
Add-Content .\fake.py '            "product": {"id": "6ac401b8ca0d96ab19f8c388", "name": "FPS Unlocker",'
Add-Content .\fake.py '                        "hash": req.get("productHash", "")},'
Add-Content .\fake.py '            "username": req.get("username", "user"),'
Add-Content .\fake.py '            "sessionToken": token(req.get("hwid", "")),'
Add-Content .\fake.py '            "expiresAt": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime((now + 10 * YEAR) / 1000)),'
Add-Content .\fake.py '            "expiresAtUnix": now + 10 * YEAR,'
Add-Content .\fake.py '            "daysLeft": 3650,'
Add-Content .\fake.py '            "serverTimeUnix": now,'
Add-Content .\fake.py '            "secondsLeft": 10 * YEAR // 1000,'
Add-Content .\fake.py '            "config": None},'
Add-Content .\fake.py '            "requestId": str(uuid.uuid4()),'
Add-Content .\fake.py '            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(now / 1000))}'
Add-Content .\fake.py '        b = json.dumps(body).encode()'
Add-Content .\fake.py '        self.send_response(200)'
Add-Content .\fake.py '        self.send_header("Content-Type", "application/json; charset=utf-8")'
Add-Content .\fake.py '        self.send_header("x-censor-enabled", "1")'
Add-Content .\fake.py '        self.send_header("Content-Length", str(len(b)))'
Add-Content .\fake.py '        self.end_headers()'
Add-Content .\fake.py '        self.wfile.write(b)'
Add-Content .\fake.py ''
Add-Content .\fake.py 'ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)'
Add-Content .\fake.py 'ctx.load_cert_chain("cert.pem")'
Add-Content .\fake.py 's = HTTPServer(("0.0.0.0", 443), H)'
Add-Content .\fake.py 's.socket = ctx.wrap_socket(s.socket, server_side=True)'
Add-Content .\fake.py 'print("fake :443")'
Add-Content .\fake.py 's.serve_forever()'`,
    note: 'The supplied server binds all network interfaces and prints request data. Do not expose port 443 publicly or enter real account passwords. For local-only use, change 0.0.0.0 to 127.0.0.1 before running.' },
  { n: 5, title: 'Redirect the domain', body: 'Open PowerShell as Administrator for this one, then close it. Back up your hosts file first.',
    cmd: String.raw`Add-Content -Path "$env:windir\System32\drivers\etc\hosts" -Value "127.0.0.1 sevenauthapi.com"
ping sevenauthapi.com`, note: 'Must return 127.0.0.1. If not: ipconfig /flushdns. Do not add the entry more than once.' },
  { n: 6, title: 'Run it', body: 'Keep this window open, then open FPS Unlocker and use non-sensitive test credentials.',
    cmd: String.raw`cd C:\seven
python fake.py`, note: 'Works only while the server is running. The expiry is ten years, not literally unlimited.' },
  { n: 7, title: 'Verify', body: 'Open https://sevenauthapi.com/v1/test in your browser — JSON, no SSL error confirms the local server. App compatibility must be checked separately.', cmd: '', note: '' }
];
export const VERIFY = 'Invoke-RestMethod https://sevenauthapi.com/v1/test';
export const REVERT = String.raw`# PowerShell as Administrator
(Get-Content "$env:windir\System32\drivers\etc\hosts") -notmatch 'sevenauthapi' | Set-Content "$env:windir\System32\drivers\etc\hosts"
Get-ChildItem Cert:\CurrentUser\Root | Where-Object { $_.Subject -like "*sevenauthapi*" } | Remove-Item`;
export const REFERENCE = {
  endpoint: 'POST /v1/auth/login-credentials', transport: 'HTTPS / 443 (WinHTTP)',
  token: 'base64url(payload) + "." + base64url(hmac)',
  payload: '{"k":licenseId,"h":sha256(hwid)[:24],"c":sessionId,"e":expiryMs}',
  request: '{"username":"test","password":"test","hwid":"machine-id","productHash":"app-hash"}',
  why: 'The supplied guide claims the app does not verify the HMAC signature or match h to its HWID. This is not independently verified. A securely implemented client rejects forged tokens.',
  anonymity: 'A local hosts redirect keeps these authentication requests on your computer, but does not guarantee anonymity or prevent other app telemetry. This website records download IP/user-agent and Discord profile information.'
};
export const TROUBLE = [
  ['App shows "route not found"', "fake.py isn't running — start it and keep the window open."],
  ['SSL / certificate error', 'Review step 3 and the certificate store for the Windows account running the app.'],
  ['Access denied editing hosts', "PowerShell isn't elevated — run as Administrator."],
  ['ping returns a real IP', 'Hosts not applied — run ipconfig /flushdns.'],
  ['Port 443 already in use', 'netstat -ano | findstr :443 — identify the process before stopping anything.'],
  ['App on a different PC than the server', "Use the server PC's LAN IP in that PC's hosts, trust the certificate there, and restrict firewall access to your private LAN."],
  ['openssl not found', 'Steps 2–4 use only Python — no openssl needed.']
];
