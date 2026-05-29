const apiKey = "evolution_api_key_2026_secure";
const baseUrl = "https://evo.memudecore.com.br";

async function run() {
    console.log("=== Evolution V2 API Live Diagnosis ===");
    
    // 1. Test GET /instance
    try {
        console.log("\n📡 Testing GET /instance (List Instances)...");
        const response = await fetch(`${baseUrl}/instance`, {
            method: "GET",
            headers: {
                "apikey": apiKey,
                "Content-Type": "application/json"
            }
        });
        
        console.log(`Status: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.log(`Response: ${text}`);
    } catch (e: any) {
        console.error("Error in GET /instance:", e.message);
    }

    // 2. Test POST /instance/create
    try {
        console.log("\n📡 Testing POST /instance/create (Create Instance 'memudeavisos')...");
        const response = await fetch(`${baseUrl}/instance/create`, {
            method: "POST",
            headers: {
                "apikey": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                instanceName: "memudeavisos",
                token: "token123",
                qrcode: true,
                integration: "WHATSAPP-BAILEYS"
            })
        });
        
        console.log(`Status: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.log(`Response: ${text}`);
    } catch (e: any) {
        console.error("Error in POST /instance/create:", e.message);
    }
}

run();
