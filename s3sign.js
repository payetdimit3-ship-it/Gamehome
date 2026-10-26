/* AWS Signature V4 (query-string presign) — bila dependencies. Inafanya kazi na Cloudflare R2, Backblaze B2, AWS S3, Wasabi, Supabase S3.
   Inatumika na server.js kutengeneza presigned URL za upload (PUT) moja kwa moja kutoka kwenye browser na download (GET) za muda mfupi. */
const crypto = require('crypto');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data, 'utf8').digest();
const sha256hex = data => crypto.createHash('sha256').update(data, 'utf8').digest('hex');
// RFC 3986 (AWS): herufi zisizo salama zinakuwa %XX; '/' inabaki kwenye path
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const encPath = p => p.split('/').map(enc).join('/');
const amzDate = d => d.toISOString().replace(/[:-]|\.\d{3}/g, '');

function signingKey(secret, dateStamp, region, service) {
  return hmac(hmac(hmac(hmac('AWS4' + secret, dateStamp), region), service), 'aws4_request');
}

// opts: { method, host, path ('/bucket/key' au '/key'), region, service='s3', accessKey, secretKey, expires=3600, query={}, date=new Date() }
function presign(opts) {
  const service = opts.service || 's3', date = opts.date || new Date(), stamp = amzDate(date), day = stamp.slice(0, 8);
  const scope = day + '/' + opts.region + '/' + service + '/aws4_request';
  const q = Object.assign({}, opts.query || {}, {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': opts.accessKey + '/' + scope,
    'X-Amz-Date': stamp,
    'X-Amz-Expires': String(Math.max(1, Math.min(604800, opts.expires || 3600))),
    'X-Amz-SignedHeaders': 'host'
  });
  const canonQuery = Object.keys(q).sort().map(k => enc(k) + '=' + enc(q[k])).join('&');
  const canonPath = encPath(opts.path);
  const canonical = [opts.method.toUpperCase(), canonPath, canonQuery, 'host:' + opts.host + '\n', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256hex(canonical)].join('\n');
  const signature = crypto.createHmac('sha256', signingKey(opts.secretKey, day, opts.region, service)).update(toSign, 'utf8').digest('hex');
  return 'https://' + opts.host + canonPath + '?' + canonQuery + '&X-Amz-Signature=' + signature;
}
module.exports = { presign, signingKey, sha256hex, enc, encPath, amzDate };
