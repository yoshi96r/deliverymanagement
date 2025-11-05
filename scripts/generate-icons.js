import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Buffer } from 'buffer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

// Create a simple placeholder icon with text
async function generateIcon(size, text) {
  const fontSize = Math.round(size * 0.15);
  
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#000000"/>
      <text 
        x="50%" 
        y="50%" 
        font-family="Arial" 
        font-size="${fontSize}px" 
        fill="white" 
        text-anchor="middle" 
        dominant-baseline="middle"
      >
        ${text}
      </text>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

async function generateIcons() {
  try {
    // Create icons directory if it doesn't exist
    if (!fs.existsSync(PUBLIC_DIR)) {
      fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    }

    // Generate different sized icons
    const sizes = {
      'apple-touch-icon.png': 180,
      'icon-192x192.png': 192,
      'icon-512x512.png': 512
    };

    for (const [filename, size] of Object.entries(sizes)) {
      const buffer = await generateIcon(size, 'B44');
      await sharp(buffer)
        .toFile(path.join(PUBLIC_DIR, filename));
      
      console.log(`Generated ${filename}`);
    }

    console.log('Icon generation complete!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();