// Generates a VAPID key pair for Web Push. Run: npm run vapid:generate
import * as webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log("Add these to .env.local (and to Vercel → Settings → Environment Variables):\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_SUBJECT=mailto:you@example.com");
