const fs = require('fs');
const os = require('os');
const path = require('path');
const selfsigned = require('selfsigned');

const ROOT_DIR = path.join(__dirname, '..');
const CERT_DIR = path.join(ROOT_DIR, 'certs');
const KEY_PATH = path.join(CERT_DIR, 'server.key');
const CERT_PATH = path.join(CERT_DIR, 'server.crt');

function localIpv4Addresses() {
    const addresses = new Set(['127.0.0.1']);
    Object.values(os.networkInterfaces()).forEach((entries) => {
        (entries || []).forEach((entry) => {
            if (entry.family === 'IPv4' && !entry.internal) {
                addresses.add(entry.address);
            }
        });
    });
    return Array.from(addresses);
}

async function generateCertificate() {
    const ips = localIpv4Addresses();
    const altNames = [
        { type: 2, value: 'localhost' },
        ...ips.map((ip) => ({ type: 7, ip }))
    ];

    const pems = await selfsigned.generate(
        [{ name: 'commonName', value: ips.find((ip) => ip !== '127.0.0.1') || 'localhost' }],
        {
            keySize: 2048,
            algorithm: 'sha256',
            notBeforeDate: new Date(),
            notAfterDate: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000),
            extensions: [
                { name: 'basicConstraints', cA: false },
                {
                    name: 'keyUsage',
                    digitalSignature: true,
                    keyEncipherment: true
                },
                { name: 'extKeyUsage', serverAuth: true },
                { name: 'subjectAltName', altNames }
            ]
        }
    );

    fs.mkdirSync(CERT_DIR, { recursive: true });
    fs.writeFileSync(KEY_PATH, pems.private, 'utf8');
    fs.writeFileSync(CERT_PATH, pems.cert, 'utf8');

    console.log(`Generated HTTPS certificate: ${CERT_PATH}`);
    console.log(`Generated HTTPS private key: ${KEY_PATH}`);
    console.log(`Certificate SAN IPs: ${ips.join(', ')}`);
}

generateCertificate().catch((error) => {
    console.error('Failed to generate HTTPS certificate:', error);
    process.exit(1);
});
