#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const imagesDir = join(projectRoot, 'docs', 'images');

const svgFiles = [
  'code-mode-sequence.svg',
  'count-files-flow.svg',
  'traditional-tool-calling-sequence.svg'
];

async function convertSvgToPng(svgFile) {
  const svgPath = join(imagesDir, svgFile);
  const pngPath = join(imagesDir, svgFile.replace('.svg', '.png'));
  
  try {
    console.log(`Converting ${svgFile} to PNG...`);
    
    // Read SVG file
    const svgBuffer = readFileSync(svgPath);
    
    // Convert to PNG using sharp at 2x density for better quality
    // SVG files are vector graphics, so we use density to render at higher resolution
    // Default is 72 DPI, so 144 DPI gives us 2x resolution
    await sharp(svgBuffer, { density: 144 })
      .png()
      .toFile(pngPath);
    
    console.log(`✓ Created ${svgFile.replace('.svg', '.png')}`);
  } catch (error) {
    console.error(`✗ Failed to convert ${svgFile}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('Converting SVG files to PNG...\n');
  
  for (const svgFile of svgFiles) {
    await convertSvgToPng(svgFile);
  }
  
  console.log('\n✓ All conversions complete!');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
