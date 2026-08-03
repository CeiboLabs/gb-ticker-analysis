import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new", args: ["--ignore-certificate-errors", "--disable-gpu"],
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
await page.goto("https://localhost:3000/dev-chart-tmp", { waitUntil: "networkidle2", timeout: 45000 });
await page.waitForSelector(".az-figure--chart canvas", { timeout: 20000 });
// Cambiar a 1D (el slider de período)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button,[role=radio],[role=tab]")].find((b) => b.textContent.trim() === "1D");
  btn?.click();
});
await new Promise((r) => setTimeout(r, 3500));
const box = await page.evaluate(() => {
  const r = document.querySelector(".az-figure--chart").getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, sx: scrollX, sy: scrollY };
});
const y = box.y + box.h * 0.55;
const [xa, xb] = [box.x + box.w * 0.30, box.x + box.w * 0.70];
await page.mouse.move(xa, y); await page.mouse.down();
for (let i = 1; i <= 10; i++) { await page.mouse.move(xa + ((xb - xa) * i) / 10, y - i); await new Promise((r) => setTimeout(r, 40)); }
await new Promise((r) => setTimeout(r, 400));
const card = await page.evaluate(() => {
  const el = document.querySelector(".drag-read"); const r = el.getBoundingClientRect();
  return { vis: getComputedStyle(el).visibility, y: Math.round(r.y), w: Math.round(r.width),
           scrollW: el.scrollWidth > el.clientWidth + 1, texto: el.innerText.replace(/\n/g, " ") };
});
console.log("1D →", JSON.stringify(card), "| caja a", card.y - Math.round(box.y), "px del techo (alto", Math.round(box.h) + ")");
await page.screenshot({ path: process.argv[2], clip: { x: box.x + box.sx - 8, y: box.y + box.sy - 8, width: box.w + 16, height: box.h + 16 } });
await browser.close();
