
const https = require('https');

const apiKey = "evolution_api_key_2026_secure";
const options = {
    hostname: 'evo.memudecore.com.br',
    port: 443,
    path: '/instance/fetchInstances',
    method: 'GET',
    headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
    }
};

console.log(`Fetching from: https://${options.hostname}${options.path}`);

const req = https.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('BODY:');
        try {
            const json = JSON.parse(data);
            console.log(JSON.stringify(json, null, 2));
        } catch (e) {
            console.log(data);
        }
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.end();
