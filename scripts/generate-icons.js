#!/usr/bin/env node
/**
 * Icon Generation Script for Toilet Map Bulgaria
 * Generates all required favicon and PWA icon sizes from the main logo
 */

const fs = require('fs')
const path = require('path')

// Required icon sizes for comprehensive favicon and PWA support
const iconSizes = [
  // Favicon sizes
  { size: 16, name: 'favicon-16x16.png', description: 'Favicon 16x16' },
  { size: 32, name: 'favicon-32x32.png', description: 'Favicon 32x32' },
  { size: 48, name: 'favicon-48x48.png', description: 'Favicon 48x48' },
  
  // Apple Touch Icons
  { size: 57, name: 'apple-touch-icon-57x57.png', description: 'Apple Touch Icon 57x57' },
  { size: 60, name: 'apple-touch-icon-60x60.png', description: 'Apple Touch Icon 60x60' },
  { size: 72, name: 'apple-touch-icon-72x72.png', description: 'Apple Touch Icon 72x72' },
  { size: 76, name: 'apple-touch-icon-76x76.png', description: 'Apple Touch Icon 76x76' },
  { size: 114, name: 'apple-touch-icon-114x114.png', description: 'Apple Touch Icon 114x114' },
  { size: 120, name: 'apple-touch-icon-120x120.png', description: 'Apple Touch Icon 120x120' },
  { size: 144, name: 'apple-touch-icon-144x144.png', description: 'Apple Touch Icon 144x144' },
  { size: 152, name: 'apple-touch-icon-152x152.png', description: 'Apple Touch Icon 152x152' },
  { size: 180, name: 'apple-touch-icon.png', description: 'Apple Touch Icon 180x180 (default)' },
  
  // PWA Icons
  { size: 72, name: 'icon-72x72.png', description: 'PWA Icon 72x72' },
  { size: 96, name: 'icon-96x96.png', description: 'PWA Icon 96x96' },
  { size: 128, name: 'icon-128x128.png', description: 'PWA Icon 128x128' },
  { size: 144, name: 'icon-144x144.png', description: 'PWA Icon 144x144' },
  { size: 152, name: 'icon-152x152.png', description: 'PWA Icon 152x152' },
  { size: 192, name: 'icon-192x192.png', description: 'PWA Icon 192x192' },
  { size: 384, name: 'icon-384x384.png', description: 'PWA Icon 384x384' },
  { size: 512, name: 'icon-512x512.png', description: 'PWA Icon 512x512' },
  
  // Microsoft Tiles
  { size: 70, name: 'ms-icon-70x70.png', description: 'Microsoft Tile 70x70' },
  { size: 144, name: 'ms-icon-144x144.png', description: 'Microsoft Tile 144x144' },
  { size: 150, name: 'ms-icon-150x150.png', description: 'Microsoft Tile 150x150' },
  { size: 310, name: 'ms-icon-310x310.png', description: 'Microsoft Tile 310x310' },
  
  // Social sharing (Open Graph)
  { size: 1200, name: 'og-image.png', description: 'Open Graph Image 1200x630', width: 1200, height: 630 },
  { size: 512, name: 'logo-512.png', description: 'Large Logo 512x512' }
]

function generateIconInstructions() {
  console.log('🎨 Toilet Map Bulgaria - Icon Generation Instructions')
  console.log('=' .repeat(60))
  console.log('')
  
  console.log('Since we don\'t have a Node.js image processing library installed,')
  console.log('here are the manual steps to create all required icons:')
  console.log('')
  
  console.log('📋 OPTION 1: Online Tool (Recommended)')
  console.log('1. Visit: https://realfavicongenerator.net/')
  console.log('2. Upload: client/public/logo.png')
  console.log('3. Configure settings:')
  console.log('   - iOS: Enable, use original image')
  console.log('   - Android: Enable, use original image')
  console.log('   - Windows: Enable, use original image')
  console.log('   - Safari: Enable, use original image')
  console.log('4. Download and extract to client/public/')
  console.log('')
  
  console.log('📋 OPTION 2: Manual Creation')
  console.log('Create these files in client/public/ using image editor:')
  console.log('')
  
  iconSizes.forEach((icon, index) => {
    const dimensions = icon.width && icon.height 
      ? `${icon.width}x${icon.height}` 
      : `${icon.size}x${icon.size}`
    console.log(`${(index + 1).toString().padStart(2)}. ${icon.name.padEnd(30)} - ${dimensions.padEnd(10)} - ${icon.description}`)
  })
  
  console.log('')
  console.log('🎯 Critical Files (Create these first):')
  console.log('• favicon.ico - 16x16, 32x32, 48x48 (multi-size ICO file)')
  console.log('• apple-touch-icon.png - 180x180')
  console.log('• icon-192x192.png - 192x192 (PWA main icon)')
  console.log('• icon-512x512.png - 512x512 (PWA large icon)')
  console.log('• og-image.png - 1200x630 (Social sharing)')
  console.log('')
  
  console.log('📱 PWA App Icon Requirements:')
  console.log('• Use maskable safe zone (20% padding from edges)')
  console.log('• Ensure icon works on light and dark backgrounds')
  console.log('• Test icon readability at small sizes')
  console.log('')
  
  console.log('💡 Quick Fix (if you don\'t have image editor):')
  console.log('Run this in the terminal to rename your logo for immediate use:')
  console.log('copy client\\public\\logo.png client\\public\\icon-192x192.png')
  console.log('copy client\\public\\logo.png client\\public\\apple-touch-icon.png')
  console.log('copy client\\public\\logo.png client\\public\\favicon-32x32.png')
  
  return iconSizes
}

function createBasicIcons() {
  const logoPath = 'client/public/logo.png'
  if (!fs.existsSync(logoPath)) {
    console.error('❌ Logo not found at:', logoPath)
    return false
  }
  
  console.log('📦 Creating basic icon copies...')
  
  // Create basic copies for immediate functionality
  const basicIcons = [
    'icon-192x192.png',
    'apple-touch-icon.png', 
    'favicon-32x32.png',
    'favicon-16x16.png'
  ]
  
  basicIcons.forEach(iconName => {
    const targetPath = `client/public/${iconName}`
    try {
      fs.copyFileSync(logoPath, targetPath)
      console.log(`✅ Created: ${iconName}`)
    } catch (error) {
      console.error(`❌ Failed to create ${iconName}:`, error.message)
    }
  })
  
  console.log('')
  console.log('⚠️  Note: These are temporary copies at original size.')
  console.log('   For production, resize each icon to proper dimensions.')
  
  return true
}

function main() {
  console.log('🚀 Starting icon generation for Toilet Map Bulgaria...')
  console.log('')
  
  // Check if logo exists
  if (!fs.existsSync('client/public/logo.png')) {
    console.error('❌ Error: client/public/logo.png not found!')
    console.log('Make sure the logo is in the correct location.')
    return
  }
  
  // Generate instructions
  const icons = generateIconInstructions()
  
  // Create basic icons for immediate use
  createBasicIcons()
  
  console.log('')
  console.log('✅ Icon setup initiated!')
  console.log('📄 For production, follow the instructions above to create properly sized icons.')
}

if (require.main === module) {
  main()
}

module.exports = { main, iconSizes }