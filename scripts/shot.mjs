// QA visual: screenshot con waits reales y scroll opcional.
// Uso: node scripts/shot.mjs <url> <out.png> [scrollY] [width] [height] [waitMs]
import puppeteer from "puppeteer-core";

const [url, out, scrollY = "0", width = "1440", height = "900", waitMs = "2600"] = process.argv.slice(2);

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--ignore-certificate-errors", "--disable-gpu"],
});
const page = await browser.newPage();
await page.setViewport({ width: +width, height: +height });
await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

if (+scrollY > 0) {
  // Scroll progresivo para disparar animaciones scroll-driven por el camino.
  await page.evaluate(async (target) => {
    const step = 250;
    for (let y = 0; y <= target; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, target);
  }, +scrollY);
}

await new Promise((r) => setTimeout(r, +waitMs));
await page.screenshot({ path: out });
await browser.close();
console.log("ok", out);
