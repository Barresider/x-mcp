import { Page } from "playwright";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";

async function downloadImage(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  
  // Create temp file with appropriate extension
  const ext = path.extname(new URL(url).pathname) || '.jpg';
  const tempFile = path.join(os.tmpdir(), `upload-${Date.now()}${ext}`);
  
  // Download to temp file
  const fileStream = createWriteStream(tempFile);
  await pipeline(response.body as any, fileStream);
  
  return tempFile;
}

export async function uploadMedia(page: Page, mediaPaths: string[]) {
  if (!mediaPaths || mediaPaths.length === 0) {
    return;
  }

  console.log(`Uploading ${mediaPaths.length} media file(s)...`);

  const tempFiles: string[] = [];
  
  try {
    // Convert to absolute paths, download remote images, and verify files exist
    const absolutePaths = await Promise.all(mediaPaths.map(async (mediaPath) => {
      // Check if it's a URL
      if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) {
        console.log(`Downloading remote image: ${mediaPath}`);
        const tempFile = await downloadImage(mediaPath);
        tempFiles.push(tempFile);
        return tempFile;
      }
      
      // Handle local files
      const absPath = path.isAbsolute(mediaPath) ? mediaPath : path.resolve(process.cwd(), mediaPath);
      if (!fs.existsSync(absPath)) {
        throw new Error(`File not found: ${absPath}`);
      }
      return absPath;
    }));

    // Find and click media button
    const mediaButton = await page.locator('button[aria-label="Add photos or video"]').first();
    
    if (!await mediaButton.isVisible()) {
      throw new Error("Media upload button not found");
    }

    // Set up file chooser handler before clicking
    const fileChooserPromise = page.waitForEvent('filechooser');
    
    // Click to trigger file dialog
    await mediaButton.click();
    
    // Handle file chooser dialog
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(absolutePaths);
    
    // Wait for upload to complete
    await page.waitForTimeout(2000);
    
    console.log("Media uploaded successfully");
    
  } finally {
    // Clean up temp files
    for (const tempFile of tempFiles) {
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
} 