
const apiKey = "evolution_api_key_2026_secure";
const apiUrl = "https://evo.memudecore.com.br/instance/fetchInstances";

console.log("Fetching from:", apiUrl);

try {
    const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
            "apikey": apiKey,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        console.error("Error:", response.status, response.statusText);
        const text = await response.text();
        console.error("Body:", text);
    } else {
        const data = await response.json();
        console.log("Success!");
        console.log(JSON.stringify(data, null, 2));
    }
} catch (error) {
    console.error("Fetch error:", error);
}
