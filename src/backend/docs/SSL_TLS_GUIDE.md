# LSM Project - SSL/TLS Configuration Guide

**Version**: 1.0.0  
**Last Updated**: 2026-03-13  
**Status**: Production Ready

---

## 📋 Overview

This guide covers SSL/TLS configuration for the LSM Project production deployment, including certificate generation, renewal, and best practices.

---

## 🔐 SSL Certificate Options

### Option 1: Let's Encrypt (Recommended)

Free, automated, and trusted by all major browsers.

#### Prerequisites

```bash
# Install Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Or for standalone mode
sudo apt install certbot
```

#### Obtain Certificate

```bash
# Standalone mode (stops nginx temporarily)
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Or nginx plugin mode (automatic configuration)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

#### Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Add to crontab (renews twice daily)
sudo crontab -e

# Add this line:
0 0,12 * * * certbot renew --quiet --deploy-hook "systemctl reload nginx"
```

### Option 2: Commercial Certificate

For enterprise deployments requiring warranty or extended validation.

#### Popular Providers

- **DigiCert**: Premium certificates, EV support
- **Comodo**: Affordable options
- **GlobalSign**: Enterprise solutions
- **Sectigo**: Business certificates

#### Installation

```bash
# Create certificate directory
sudo mkdir -p /etc/ssl/certs/lsm
sudo mkdir -p /etc/ssl/private/lsm

# Copy certificate files
sudo cp your_domain.crt /etc/ssl/certs/lsm/fullchain.pem
sudo cp your_domain.key /etc/ssl/private/lsm/privkey.pem
sudo cp ca-bundle.crt /etc/ssl/certs/lsm/ca-bundle.pem

# Set permissions
sudo chmod 644 /etc/ssl/certs/lsm/fullchain.pem
sudo chmod 600 /etc/ssl/private/lsm/privkey.pem
sudo chown root:root /etc/ssl/private/lsm/privkey.pem
```

### Option 3: Self-Signed (Development Only)

⚠️ **Never use in production** - for testing only.

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/lsm/selfsigned.key \
  -out /etc/ssl/certs/lsm/selfsigned.crt \
  -subj "/C=CN/ST=State/L=City/O=Organization/CN=localhost"

# Generate DH parameters (optional, for perfect forward secrecy)
openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048
```

---

## 🔧 Nginx SSL Configuration

### Modern Configuration (TLS 1.2 + 1.3)

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # Certificate paths
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL session settings
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # Modern TLS configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

### HTTP to HTTPS Redirect

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # ACME challenge for Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}
```

---

## 🚀 Deployment with Docker

### Docker Compose SSL Setup

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    container_name: lsm-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./config/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - /var/www/certbot:/var/www/certbot:ro
    depends_on:
      - backend
      - frontend
    restart: unless-stopped
```

### Certbot in Docker

```bash
# Create directories
mkdir -p /etc/letsencrypt
mkdir -p /var/www/certbot

# Obtain certificate
docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/www/certbot:/var/www/certbot \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email admin@yourdomain.com \
  --agree-tos \
  --no-eff-email \
  -d yourdomain.com \
  -d www.yourdomain.com
```

---

## 🔒 Security Best Practices

### 1. TLS Configuration

✅ **Do:**
- Use TLS 1.2 and 1.3 only
- Enable perfect forward secrecy (ECDHE)
- Use strong cipher suites
- Enable OCSP stapling
- Set HSTS header

❌ **Don't:**
- Use SSLv3, TLS 1.0, or TLS 1.1
- Use weak ciphers (RC4, DES, 3DES)
- Disable certificate verification

### 2. Certificate Management

✅ **Do:**
- Use 2048-bit or higher RSA keys
- Use ECDSA certificates for better performance
- Set up auto-renewal
- Monitor certificate expiration

❌ **Don't:**
- Use self-signed certificates in production
- Let certificates expire
- Store private keys in version control

### 3. Security Headers

```nginx
# HSTS (HTTP Strict Transport Security)
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

# Prevent clickjacking
add_header X-Frame-Options "SAMEORIGIN" always;

# Prevent MIME type sniffing
add_header X-Content-Type-Options "nosniff" always;

# XSS Protection
add_header X-XSS-Protection "1; mode=block" always;

# Referrer Policy
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# Content Security Policy
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-ancestors 'self';" always;

# Permissions Policy
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

---

## 📊 Testing & Validation

### SSL Labs Test

```bash
# Test your SSL configuration
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=yourdomain.com

# Target: A+ rating
```

### Command Line Tests

```bash
# Check certificate expiration
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com | openssl x509 -noout -dates

# Check certificate chain
openssl s_client -connect yourdomain.com:443 -showcerts

# Test TLS versions
nmap --script ssl-enum-ciphers -p 443 yourdomain.com

# Check HSTS header
curl -I https://yourdomain.com | grep Strict-Transport-Security
```

### Automated Monitoring

```bash
#!/bin/bash
# check-cert-expiry.sh

DOMAIN="yourdomain.com"
EXPIRY=$(echo | openssl s_client -connect $DOMAIN:443 -servername $DOMAIN 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))

if [ $DAYS_LEFT -lt 30 ]; then
    echo "⚠️  WARNING: Certificate expires in $DAYS_LEFT days"
    # Send alert (email, Slack, etc.)
    exit 1
else
    echo "✅ Certificate valid for $DAYS_LEFT days"
    exit 0
fi
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Certificate Not Trusted

```bash
# Ensure certificate chain is complete
openssl s_client -connect yourdomain.com:443 -showcerts

# Solution: Include intermediate certificates in fullchain.pem
```

#### 2. Mixed Content Warnings

```bash
# Check for HTTP resources in your application
grep -r "http://" frontend/src/

# Solution: Use protocol-relative URLs or HTTPS
```

#### 3. HSTS Issues

```bash
# Clear HSTS cache in browser
# Chrome: chrome://net-internals/#hsts
# Firefox: about:config -> network.stricttransportsecurity.preloadlist

# Solution: Test without HSTS first, then enable
```

#### 4. OCSP Stapling Not Working

```bash
# Test OCSP stapling
openssl s_client -connect yourdomain.com:443 -status

# Solution: Ensure resolver is configured in nginx
```

---

## 📚 References

- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Nginx SSL Module](https://nginx.org/en/docs/http/ngx_http_ssl_module.html)
- [OWASP TLS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html)

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-03-13  
**Maintained By**: DevOps Team
