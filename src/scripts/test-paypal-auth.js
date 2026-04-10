import dotenv from "dotenv";
dotenv.config();

const PAYPAL_BASE_URL =
  (process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com").trim();

const PAYPAL_CLIENT_ID = (process.env.PAYPAL_CLIENT_ID || "").trim();
const PAYPAL_CLIENT_SECRET = (process.env.PAYPAL_CLIENT_SECRET || "").trim();

async function main() {
  console.log("=======================================");
  console.log("TEST PAYPAL AUTH");
  console.log("=======================================");
  console.log("BASE URL:", PAYPAL_BASE_URL);
  console.log(
    "CLIENT ID:",
    PAYPAL_CLIENT_ID
      ? `${PAYPAL_CLIENT_ID.slice(0, 8)}...${PAYPAL_CLIENT_ID.slice(-8)}`
      : "VACIO"
  );
  console.log(
    "CLIENT SECRET:",
    PAYPAL_CLIENT_SECRET
      ? `${PAYPAL_CLIENT_SECRET.slice(0, 6)}...${PAYPAL_CLIENT_SECRET.slice(-6)}`
      : "VACIO"
  );
  console.log("CLIENT ID LEN:", PAYPAL_CLIENT_ID.length);
  console.log("CLIENT SECRET LEN:", PAYPAL_CLIENT_SECRET.length);
  console.log("=======================================");

  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error("Faltan PAYPAL_CLIENT_ID o PAYPAL_CLIENT_SECRET en .env");
  }

  const auth = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const raw = await response.text();

  console.log("STATUS:", response.status);
  console.log("RAW RESPONSE:");
  console.log(raw);
  console.log("=======================================");

  if (!response.ok) {
    throw new Error("PayPal rechazó las credenciales.");
  }

  const data = JSON.parse(raw);

  if (!data.access_token) {
    throw new Error("PayPal no devolvió access_token.");
  }

  console.log("✅ AUTH OK");
  console.log("ACCESS TOKEN LEN:", data.access_token.length);
}

main().catch((error) => {
  console.error("❌ AUTH FAIL");
  console.error(error.message);
  process.exit(1);
});