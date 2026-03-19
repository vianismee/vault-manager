/**
 * Generate PNG icons from SVG for PWA
 * Run: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../public/icon.svg');
const publicDir = path.join(__dirname, '../public');

const sizes = [192, 512, 180];

// Check if sharp is installed
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('❌ sharp is not installed. Run: npm install -D sharp');
  process.exit(1);
}

async function generateIcons() {
  const svgBuffer = fs.readFileSync(svgPath);

  for (const size of sizes) {
    const outputPath = path.join(publicDir, `icon-${size}.png`);

    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`✅ Generated icon-${size}.png`);
  }

  console.log('\n🎉 All icons generated successfully!');
}

generateIcons().catch(console.error);
