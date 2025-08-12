#!/usr/bin/env node
/**
 * Production Deployment Script for Toilet Map Bulgaria (toaletna.com)
 * 
 * This script handles:
 * - Environment validation
 * - Build optimization
 * - Asset optimization
 * - Deployment preparation
 * - SEO validation
 * - Performance checks
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const COLORS = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
}

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`)
}

function logSection(title) {
  console.log('\n' + '='.repeat(60))
  log(`🚀 ${title}`, 'blue')
  console.log('='.repeat(60))
}

function checkPrerequisites() {
  logSection('Checking Prerequisites')
  
  // Check Node.js version
  const nodeVersion = process.version
  log(`Node.js version: ${nodeVersion}`, 'green')
  
  // Check if we're in the right directory
  if (!fs.existsSync('package.json')) {
    log('❌ Error: package.json not found. Run this script from the project root.', 'red')
    process.exit(1)
  }
  
  // Check if client directory exists
  if (!fs.existsSync('client')) {
    log('❌ Error: client directory not found.', 'red')
    process.exit(1)
  }
  
  log('✅ All prerequisites met', 'green')
}

function validateEnvironment() {
  logSection('Validating Environment')
  
  // Set production environment
  process.env.NODE_ENV = 'production'
  
  // Check required files
  const requiredFiles = [
    'client/index.html',
    'client/src/main.tsx',
    'client/vite.config.ts',
    'client/public/manifest.json',
    'client/public/robots.txt',
    'client/public/sitemap.xml'
  ]
  
  for (const file of requiredFiles) {
    if (fs.existsSync(file)) {
      log(`✅ ${file}`, 'green')
    } else {
      log(`❌ Missing: ${file}`, 'red')
    }
  }
}

function optimizeAssets() {
  logSection('Optimizing Assets')
  
  try {
    // Clean previous build
    log('🧹 Cleaning previous build...', 'yellow')
    if (fs.existsSync('client/dist')) {
      execSync('rm -rf client/dist', { stdio: 'inherit' })
    }
    
    // Install dependencies
    log('📦 Installing dependencies...', 'yellow')
    execSync('cd client && npm ci --production=false', { stdio: 'inherit' })
    
    // Build project
    log('🔨 Building project for production...', 'yellow')
    execSync('cd client && npm run build', { stdio: 'inherit' })
    
    // Check build output
    if (fs.existsSync('client/dist/index.html')) {
      log('✅ Build completed successfully', 'green')
      
      // Get build stats
      const stats = fs.statSync('client/dist')
      log(`📊 Build directory created: ${stats.birthtime}`, 'blue')
      
      // Check critical files
      const criticalFiles = [
        'client/dist/index.html',
        'client/dist/manifest.json',
        'client/dist/robots.txt',
        'client/dist/sitemap.xml'
      ]
      
      criticalFiles.forEach(file => {
        if (fs.existsSync(file)) {
          const size = fs.statSync(file).size
          log(`✅ ${file} (${(size / 1024).toFixed(2)} KB)`, 'green')
        } else {
          log(`❌ Missing: ${file}`, 'red')
        }
      })
    } else {
      log('❌ Build failed - index.html not found', 'red')
      process.exit(1)
    }
  } catch (error) {
    log(`❌ Build failed: ${error.message}`, 'red')
    process.exit(1)
  }
}

function validateSEO() {
  logSection('Validating SEO')
  
  try {
    // Check index.html for required meta tags
    const indexPath = 'client/dist/index.html'
    if (!fs.existsSync(indexPath)) {
      log('❌ index.html not found', 'red')
      return
    }
    
    const indexContent = fs.readFileSync(indexPath, 'utf8')
    
    const seoChecks = [
      { name: 'Title tag', pattern: /<title[^>]*>.*toaletna\.com.*<\/title>/i },
      { name: 'Meta description', pattern: /<meta[^>]*name="description"[^>]*content="[^"]*тоалетни[^"]*"/i },
      { name: 'Open Graph title', pattern: /<meta[^>]*property="og:title"[^>]*>/i },
      { name: 'Open Graph description', pattern: /<meta[^>]*property="og:description"[^>]*>/i },
      { name: 'Canonical URL', pattern: /<link[^>]*rel="canonical"[^>]*href="https:\/\/toaletna\.com\/"/i },
      { name: 'Google Analytics', pattern: /gtag.*G-FPF6DRB75R/i },
      { name: 'Structured data', pattern: /@type.*WebApplication/i }
    ]
    
    seoChecks.forEach(check => {
      if (check.pattern.test(indexContent)) {
        log(`✅ ${check.name}`, 'green')
      } else {
        log(`❌ Missing: ${check.name}`, 'red')
      }
    })
    
    // Check manifest.json
    const manifestPath = 'client/dist/manifest.json'
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      if (manifest.name && manifest.name.includes('Toilet Map')) {
        log('✅ PWA manifest valid', 'green')
      } else {
        log('❌ PWA manifest invalid', 'red')
      }
    }
    
  } catch (error) {
    log(`❌ SEO validation error: ${error.message}`, 'red')
  }
}

function generateDeploymentSummary() {
  logSection('Deployment Summary')
  
  const summary = {
    domain: 'toaletna.com',
    buildDate: new Date().toISOString(),
    nodeVersion: process.version,
    environment: 'production'
  }
  
  log('🌐 Production Deployment Ready!', 'green')
  log(`📅 Build Date: ${summary.buildDate}`, 'blue')
  log(`🔗 Domain: https://${summary.domain}`, 'blue')
  log(`⚡ Node.js: ${summary.nodeVersion}`, 'blue')
  
  // Deployment instructions
  console.log('\n📋 Next Steps:')
  log('1. Upload client/dist/ folder to your web server', 'yellow')
  log('2. Configure web server with _headers file for caching', 'yellow')
  log('3. Set up domain SSL certificate (Let\'s Encrypt recommended)', 'yellow')
  log('4. Configure DNS records to point to your server', 'yellow')
  log('5. Test the deployment at https://toaletna.com', 'yellow')
  log('6. Submit sitemap to Google Search Console', 'yellow')
  log('7. Verify Google Analytics is tracking', 'yellow')
  
  // Performance tips
  console.log('\n🚀 Performance Tips:')
  log('• Enable gzip/brotli compression on web server', 'blue')
  log('• Set up CDN for static assets (Cloudflare recommended)', 'blue')
  log('• Configure HTTP/2 for better performance', 'blue')
  log('• Monitor Core Web Vitals with PageSpeed Insights', 'blue')
  
  // Save deployment info
  const deploymentInfo = {
    ...summary,
    files: {
      html: fs.existsSync('client/dist/index.html'),
      manifest: fs.existsSync('client/dist/manifest.json'),
      serviceWorker: fs.existsSync('client/dist/sw.js'),
      robots: fs.existsSync('client/dist/robots.txt'),
      sitemap: fs.existsSync('client/dist/sitemap.xml')
    }
  }
  
  fs.writeFileSync(
    'client/dist/deployment-info.json',
    JSON.stringify(deploymentInfo, null, 2)
  )
  
  log('\n✅ Deployment preparation complete!', 'green')
  log('📄 Deployment info saved to client/dist/deployment-info.json', 'blue')
}

function main() {
  try {
    console.log('🚀 Toilet Map Bulgaria - Production Deployment Script')
    console.log('🌐 Preparing toaletna.com for production...\n')
    
    checkPrerequisites()
    validateEnvironment()
    optimizeAssets()
    validateSEO()
    generateDeploymentSummary()
    
  } catch (error) {
    log(`❌ Deployment script failed: ${error.message}`, 'red')
    process.exit(1)
  }
}

// Run the script
if (require.main === module) {
  main()
}

module.exports = { main }