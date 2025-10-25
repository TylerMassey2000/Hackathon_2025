import { fetchAndScanEula } from "./fetchEula.js";


// List of companies and their EULA URLs (all lowercase) exactly as should be included in the company name
const companies = [
  { name: "threads", url: "https://help.instagram.com/769983657850450" },
  { name: "facebook", url: "https://www.facebook.com/terms/" },
  { name: "kick", url: "https://kick.com/terms-of-service" },
  { name: "rumble", url: "https://rumble.com/s/terms" },
  { name: "prime", url: "https://www.primevideo.com/help?nodeId=202095490" },
  { name: "netflix", url: "https://help.netflix.com/legal/termsofuse?locale=en-US" },
  { name: "disney", url: "https://www.disneyplus.com/legal/subscriber-agreement" },
  { name: "roomba", url: "https://about.irobot.com/legal/terms-of-service" },
  { name: "ring", url: "https://ring.com/terms" },
  { name: "nest", url: "https://nest.com/legal/terms-of-service/" },
  { name: "alexa", url: "https://www.amazon.com/gp/help/customer/display.html?nodeId=201809740" },
  { name: "nanit", url: "https://www.nanit.com/pages/terms-of-service" },
  { name: "tesla", url: "https://www.tesla.com/legal/terms" },
  { name: "gmc", url: "https://www.gmc.com/terms-of-service" },
  { name: "honda", url: "https://www.honda.com/terms-and-conditions" },
  { name: "paypal", url: "https://www.paypal.com/us/legalhub/paypal/useragreement-full?.com" },
  { name: "snapchat", url: "https://www.snap.com/terms?utm_source=chatgpt.com" },
  { name: "kik", url: "https://kik.com/terms-of-service/?utm_source=chatgpt.com" },
  { name: "messenger", url: "https://www.facebook.com/terms/?utm_source=chatgpt.com" },
  { name: "whatsapp", url: "https://www.whatsapp.com/legal/terms-of-service?lang=en" },
  { name: "canva", url: "https://www.canva.com/policies/terms-of-use/?utm_source=chatgpt.com" },
  { name: "figma", url: "https://www.figma.com/legal/tos/" },
  { name: "sketch", url: "https://www.sketch.com/tos/" },
  { name: "corel", url: "https://www.corel.com/en/terms-of-use/" },
  { name: "progressive", url: "https://www.progressive.com/privacy/?utm_source=chatgpt.com" },
  { name: "allstate", url: "https://www.allstate.com/privacy-center/online/terms-of-use" },
  { name: "farmers", url: "https://www.farmers.com/terms-of-use/" },
  { name: "chrome", url: "https://chromeenterprise.google/terms/chrome-service-license-agreement/in/" },
  { name: "firefox", url: "https://www.mozilla.org/en-US/about/legal/eula/firefox-3/" },
  { name: "edge", url: "https://www.microsoft.com/en-us/legal/terms-of-use" },
  { name: "safari", url: "https://images.apple.com/legal/sla/docs/Safari.pdf" },
  { name: "nordvpn", url: "https://my.nordaccount.com/legal/terms-of-service/" },
  { name: "expressvpn", url: "https://www.expressvpn.com/tos?srsltid=AfmBOopmP8RCz3mL1hu7lFI2S5R8XWOpiFFH006i05c_gzOm7zCstvtf" },
  { name: "protonvpn", url: "https://proton.me/legal/terms" },
  { name: "surfshark", url: "https://surfshark.com/terms-of-service" },
  { name: "cyberghostvpn", url: "https://www.cyberghostvpn.com/terms" },
  { name: "gearbox", url: "https://www.gearboxsoftware.com/eula/" },
  { name: "bungie", url: "https://www.bungie.net/7/en/legal/sla" },
  { name: "steam", url: "https://store.steampowered.com/eula/39140_eula" },
  { name: "android", url: "https://developer.android.com/studio/terms" },
  { name: "playstation", url: "https://www.playstation.com/en-us/legal/terms-of-service/" },  
  { name: "xbox", url: "https://support.xbox.com/en-US/help/hardware-network/warranty-service/xbox-software-license-agreement" },
  { name: "windows", url: "https://www.microsoft.com/content/dam/microsoft/usetm/documents/windows/11/oem-%28pre-installed%29/UseTerms_OEM_Windows_11_English.pdf" },
  { name: "ios", url: "https://www.apple.com/legal/sla/docs/iOS26_iPadOS26.pdf"}
]
// === Run scans sequentially ===
for (const company of companies) {
  console.log(`\n🚀 Starting scan for ${company.name}`);
  try {
    await fetchAndScanEula(company.name, company.url);
  } catch (err) {
    console.error(`❌ Failed ${company.name}: ${err.message}`);
  }
}