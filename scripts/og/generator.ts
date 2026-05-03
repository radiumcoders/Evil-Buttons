import { mkdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { chromium, Browser, Page } from "playwright";
import { ogConfig, type OgComponent } from "./config";

async function getFileMtime(filePath: string): Promise<number | null> {
  try {
    const stats = await stat(filePath);
    return stats.mtimeMs;
  } catch {
    return null;
  }
}

async function needsRegeneration(component: OgComponent): Promise<boolean> {
  const ogFilePath = `${ogConfig.outputDir}/${component.slug}.png`;
  
  if (!existsSync(ogFilePath)) {
    return true;
  }

  const ogMtime = await getFileMtime(ogFilePath);
  const sourceMtime = await getFileMtime(component.sourceFile);

  if (!sourceMtime) {
    console.warn(`  Source file not found: ${component.sourceFile}`);
    return false;
  }

  return !ogMtime || sourceMtime > ogMtime;
}

export async function generateOgImage(
  page: Page,
  component: OgComponent
): Promise<boolean> {
  const needsGen = await needsRegeneration(component);
  
  if (!needsGen) {
    console.log(`  Skipping ${component.slug} (up to date)`);
    return false;
  }

  const url = `${ogConfig.baseUrl}/docs/${component.slug}`;
  
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    
    const element = page.locator("article").first();
    await element.waitFor({ timeout: 10000 });

    const outputPath = `${ogConfig.outputDir}/${component.slug}.png`;
    await mkdir(dirname(outputPath), { recursive: true });

    await element.screenshot({
      path: outputPath,
      type: "png",
    });

    console.log(`  Generated: ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`  Failed: ${component.slug} - ${error}`);
    return false;
  }
}

export async function generateAllOgImages(): Promise<void> {
  console.log("Starting OG image generation...\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: ogConfig.viewport,
  });
  const page = await context.newPage();

  let generated = 0;
  let skipped = 0;

  for (const component of ogConfig.components) {
    const result = await generateOgImage(page, component);
    if (result) {
      generated++;
    } else {
      skipped++;
    }
  }

  await browser.close();

  console.log(`\nDone! Generated: ${generated}, Skipped: ${skipped}`);
}