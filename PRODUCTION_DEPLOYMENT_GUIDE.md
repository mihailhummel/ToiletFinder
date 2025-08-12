# 🚀 Production Deployment Guide for Toilet Map Bulgaria (toaletna.com)

## Overview
This guide covers the complete production deployment of Toilet Map Bulgaria, optimized for performance, SEO, and user experience.

## 📋 Pre-Deployment Checklist

### ✅ Code & Build
- [ ] All features tested and working
- [ ] No console errors in production build
- [ ] Service worker configured for offline functionality
- [ ] PWA manifest optimized
- [ ] Bundle size optimized (<1MB initial load)
- [ ] Images optimized (WebP format recommended)
- [ ] Critical CSS inlined
- [ ] Lazy loading implemented

### ✅ SEO & Analytics
- [ ] Google Analytics (G-FPF6DRB75R) integrated
- [ ] Meta tags optimized for Bulgarian market
- [ ] Open Graph tags for social sharing
- [ ] Twitter Cards configured
- [ ] Structured data (JSON-LD) implemented
- [ ] Sitemap.xml generated
- [ ] Robots.txt configured
- [ ] Canonical URLs set

### ✅ Performance
- [ ] Core Web Vitals optimized
- [ ] First Contentful Paint < 1.5s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Cumulative Layout Shift < 0.1
- [ ] First Input Delay < 100ms
- [ ] Images compressed and properly sized
- [ ] Critical resources preloaded
- [ ] Fonts optimized and preloaded

### ✅ Security
- [ ] HTTPS enabled (SSL certificate)
- [ ] Security headers configured
- [ ] Content Security Policy implemented
- [ ] No sensitive data exposed
- [ ] API endpoints secured
- [ ] XSS protection enabled

### ✅ Accessibility
- [ ] Screen reader compatible
- [ ] Keyboard navigation working
- [ ] Color contrast ratios compliant
- [ ] ARIA labels implemented
- [ ] Focus management proper
- [ ] Alt texts for images

## 🌐 Domain Configuration (toaletna.com)

### DNS Settings
```
Type: A
Name: @
Value: [Your server IP]
TTL: 3600

Type: CNAME
Name: www
Value: toaletna.com
TTL: 3600
```

### SSL Certificate
- Recommended: Let's Encrypt (free)
- Alternative: Cloudflare SSL
- Ensure HTTPS redirect is configured

## 📦 Build Process

### 1. Install Dependencies
```bash
cd client
npm ci --production=false
```

### 2. Run Production Build
```bash
npm run build
```

### 3. Validate Build
```bash
# Check critical files exist
ls -la dist/
# Should contain: index.html, manifest.json, robots.txt, sitemap.xml, sw.js
```

### 4. Test Build Locally
```bash
npm run preview
# Test at http://localhost:4173
```

## 🚀 Deployment Options

### Option 1: Traditional Web Server (Recommended)

#### Nginx Configuration
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name toaletna.com www.toaletna.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name toaletna.com www.toaletna.com;

    # SSL Configuration
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000";

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Brotli Compression (if available)
    brotli on;
    brotli_comp_level 6;
    brotli_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    root /var/www/toaletna.com/dist;
    index index.html;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|webp|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # No cache for HTML
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Service Worker - no cache
    location /sw.js {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # API proxy (if backend on same server)
    location /api/ {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Fallback to index.html for SPA
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Option 2: Vercel (Easy Deployment)

#### vercel.json
```json
{
  "version": 2,
  "builds": [
    {
      "src": "client/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/client/dist/$1"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

### Option 3: Netlify

#### netlify.toml
```toml
[build]
  base = "client"
  publish = "dist"
  command = "npm run build"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"

[[headers]]
  for = "*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## 📊 Performance Monitoring

### Core Web Vitals Targets
- **First Contentful Paint**: < 1.5 seconds
- **Largest Contentful Paint**: < 2.5 seconds
- **Cumulative Layout Shift**: < 0.1
- **First Input Delay**: < 100 milliseconds

### Monitoring Tools
1. **Google PageSpeed Insights**
   - Test: https://pagespeed.web.dev/
   - Target: 90+ score for mobile and desktop

2. **Google Search Console**
   - Monitor Core Web Vitals
   - Track indexing status
   - Monitor search performance

3. **Google Analytics**
   - Already integrated (G-FPF6DRB75R)
   - Monitor user behavior
   - Track conversion rates

4. **Lighthouse CI**
   - Automated performance testing
   - Integration with CI/CD pipeline

## 🔍 SEO Optimization

### Google Search Console Setup
1. Add property: https://toaletna.com
2. Verify ownership via HTML file or DNS
3. Submit sitemap: https://toaletna.com/sitemap.xml
4. Monitor indexing and performance

### Local SEO (Bulgaria)
- Google My Business (if applicable)
- Local directory submissions
- Bulgarian-language content optimization
- Local keyword targeting

### Content Strategy
- Regular updates to toilet locations
- User-generated content (reviews)
- Blog posts about IBS and public health
- Multilingual content (Bulgarian/English)

## 🛡️ Security Best Practices

### Server Security
- Keep server and dependencies updated
- Use fail2ban for intrusion prevention
- Regular security audits
- Monitor logs for suspicious activity

### Application Security
- Input validation on all forms
- CSRF protection
- Rate limiting on API endpoints
- Secure session management

## 📱 Progressive Web App (PWA)

### Installation Prompts
- Configure install prompt timing
- Custom install UI
- Track installation metrics

### Offline Functionality
- Cache critical resources
- Offline fallback pages
- Background sync for data

### Push Notifications
- User permission handling
- Relevant notification content
- Unsubscribe options

## 🚀 Launch Checklist

### Pre-Launch (1 week before)
- [ ] Complete penetration testing
- [ ] Load testing with expected traffic
- [ ] Backup and recovery procedures tested
- [ ] Monitoring and alerting configured
- [ ] Team trained on deployment process

### Launch Day
- [ ] Deploy during low-traffic hours
- [ ] Monitor server resources
- [ ] Check all critical functionality
- [ ] Verify analytics tracking
- [ ] Test on multiple devices/browsers
- [ ] Social media announcement ready

### Post-Launch (1 week after)
- [ ] Monitor Core Web Vitals daily
- [ ] Check Google Search Console for issues
- [ ] Analyze user behavior patterns
- [ ] Collect user feedback
- [ ] Plan first optimization iteration

## 📞 Support & Maintenance

### Regular Tasks
- Daily: Monitor analytics and performance
- Weekly: Review user feedback and bug reports
- Monthly: Security updates and dependency updates
- Quarterly: Performance optimization review

### Emergency Contacts
- Hosting provider support
- Domain registrar support
- CDN support (if applicable)
- Development team contacts

## 📈 Success Metrics

### Technical Metrics
- Page load time < 3 seconds
- 99.9% uptime
- Core Web Vitals in green
- Mobile-friendly test passing

### Business Metrics
- Toilet locations added per week
- User engagement rate
- Geographic coverage expansion
- User satisfaction scores

---

**🎯 Goal**: Make toaletna.com the #1 resource for finding public toilets in Bulgaria, providing exceptional user experience and helping people with IBS and other conditions find accessible facilities quickly and reliably.

**📧 Contact**: For deployment support, contact the development team.

**🔗 Resources**:
- [Google PageSpeed Insights](https://pagespeed.web.dev/)
- [Google Search Console](https://search.google.com/search-console)
- [Web.dev Performance](https://web.dev/performance/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)