# AI Interviewer Application - EC2 Deployment Guide

Complete step-by-step guide to deploy the AI Interviewer application on Amazon EC2.

## Prerequisites

- AWS Account with EC2 access
- Domain name (we'll use DuckDNS as free option)
- Local development machine with SSH client

## Architecture Overview

- **Frontend**: React application served by Nginx
- **Backend**: FastAPI application with Python
- **Database**: MongoDB Atlas (cloud)
- **Web Server**: Nginx with SSL/TLS
- **Process Manager**: PM2 for backend
- **SSL**: Let's Encrypt (free)

---

## Phase 1: Prerequisites & Planning

### 1.1 AWS Account Setup
- Ensure you have an active AWS account
- Verify IAM permissions for EC2 operations

### 1.2 Domain Configuration
**Option A: DuckDNS (Free)**
1. Go to https://duckdns.org
2. Sign in with your preferred account
3. Create a subdomain (e.g., `your-app.duckdns.org`)
4. Note your DuckDNS token for later updates

**Option B: Custom Domain**
- Ensure you have DNS control over your domain
- You'll point A records to your EC2 IP later

### 1.3 Environment Variables Planning
Prepare these values:
- MongoDB connection string
- API keys (Groq, OpenAI, etc.)
- Domain name

---

## Phase 2: EC2 Instance Setup

### 2.1 Launch EC2 Instance

1. **Access AWS Console**
   - Navigate to EC2 Dashboard
   - Click "Launch Instance"

2. **Instance Configuration**
   ```
   Name: ai-interviewer-app
   AMI: Ubuntu Server 22.04 LTS (Free Tier)
   Instance Type: t3.medium (recommended)
   ```

3. **Key Pair Setup**
   - Create new key pair: `ai-interviewer-key`
   - Download `.pem` file and store securely

4. **Security Group Configuration**
   Create security group with these inbound rules:
   ```
   SSH (22)      - Your IP
   HTTP (80)     - 0.0.0.0/0
   HTTPS (443)   - 0.0.0.0/0
   Custom (8000) - 0.0.0.0/0  [For FastAPI backend]
   ```

5. **Storage**: 20 GB gp3 SSD (sufficient for most use cases)

6. **Launch instance** and wait for it to reach "running" state

### 2.2 Initial Server Access

```bash
# Make key file secure (Linux/Mac)
chmod 400 ai-interviewer-key.pem

# Connect to instance (replace IP with your instance IP)
ssh -i ai-interviewer-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

### 2.3 Update DNS Records
Update your domain's DNS A record to point to your EC2 public IP:
```
Type: A
Name: @ (or subdomain)
Value: YOUR_EC2_PUBLIC_IP
TTL: 300
```

---

## Phase 3: Server Environment Setup

### 3.1 System Updates
```bash
# Update package lists and system
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl wget git unzip software-properties-common build-essential
```

### 3.2 Node.js Installation
```bash
# Install NodeSource repository for latest Node.js LTS
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -

# Install Node.js and npm
sudo apt install -y nodejs

# Verify installation
node --version  # Should be v18.x or v20.x
npm --version
```

### 3.3 Python Environment Setup
```bash
# Python 3.10+ is pre-installed on Ubuntu 22.04
python3 --version

# Install pip and virtual environment tools
sudo apt install -y python3-pip python3-venv python3-dev
```

### 3.4 Process Manager Installation (PM2)
```bash
# Install PM2 globally
sudo npm install -g pm2

# Configure PM2 for system startup
pm2 startup
# Run the command it outputs (starts with: sudo env PATH=...)

# Save PM2 configuration
pm2 save
```

### 3.5 Nginx Installation
```bash
# Install Nginx
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Verify installation
curl http://localhost  # Should show Nginx welcome page
```

### 3.6 Firewall Configuration
```bash
# Configure UFW firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow required ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 8000/tcp # FastAPI backend

# Enable firewall
sudo ufw enable

# Verify configuration
sudo ufw status
```

### 3.7 Additional Security Tools
```bash
# Install fail2ban for intrusion prevention
sudo apt install -y fail2ban
sudo systemctl start fail2ban
sudo systemctl enable fail2ban

# Install certbot for SSL certificates
sudo apt install -y certbot python3-certbot-nginx
```

### 3.8 Create Application Directory Structure
```bash
# Create application directories
sudo mkdir -p /var/www/ai-interviewer
sudo mkdir -p /var/www/ai-interviewer/frontend
sudo mkdir -p /var/www/ai-interviewer/backend
sudo mkdir -p /var/log/ai-interviewer

# Set ownership (adjust username as needed)
sudo chown -R ubuntu:ubuntu /var/www/ai-interviewer
sudo chown -R ubuntu:ubuntu /var/log/ai-interviewer
```

---

## Phase 4: Application Deployment

### 4.1 Code Transfer

**Option A: Git Clone (Recommended)**
```bash
# Navigate to application directory
cd /var/www/ai-interviewer

# Clone your repository
git clone https://github.com/yourusername/your-repo.git .

# Or clone frontend and backend separately if needed
# git clone https://github.com/yourusername/frontend.git frontend
# git clone https://github.com/yourusername/backend.git backend
```

**Option B: SCP Upload**
```bash
# From local machine
scp -i ai-interviewer-key.pem -r ./frontend ubuntu@YOUR_EC2_IP:/var/www/ai-interviewer/
scp -i ai-interviewer-key.pem -r ./backend ubuntu@YOUR_EC2_IP:/var/www/ai-interviewer/
```

### 4.2 Backend Deployment

```bash
# Navigate to backend directory
cd /var/www/ai-interviewer/backend

# Create Python virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install production dependencies
pip install uvicorn gunicorn
```

### 4.3 Backend Environment Configuration
```bash
# Create production environment file
nano /var/www/ai-interviewer/backend/.env
```

Add the following content (adjust values for your setup):
```env
# MongoDB Configuration
MONGO_URI=your_mongodb_connection_string

# AI API Keys
GROQ_API_KEY=your_groq_api_key

# Production Settings
HOST=0.0.0.0
PORT=8000
DEBUG=False
ENVIRONMENT=production

# CORS Origins (update with your domain)
CORS_ORIGINS=["https://yourdomain.com", "https://www.yourdomain.com"]
```

### 4.4 Frontend Deployment

```bash
# Navigate to frontend directory
cd /var/www/ai-interviewer/frontend

# Install dependencies
npm install

# Create production environment file
nano .env.production
```

Add the following content:
```env
# API Configuration
REACT_APP_API_BASE=http://yourdomain.com:8000
GENERATE_SOURCEMAP=false
```

Update API constants for production:
```bash
# Edit constants file
nano src/utils/constants.js
```

Update the API_BASE line:
```javascript
export const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';
```

Build the application:
```bash
# Build React application
npm run build

# Verify build was created
ls -la build/
```

### 4.5 Start Backend with PM2

Create PM2 ecosystem configuration:
```bash
# Create ecosystem file
nano /var/www/ai-interviewer/ecosystem.config.js
```

Add this content:
```javascript
module.exports = {
  apps: [
    {
      name: 'ai-interviewer-backend',
      cwd: '/var/www/ai-interviewer/backend',
      script: 'venv/bin/python',
      args: '-m uvicorn main:app --host 0.0.0.0 --port 8000',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      log_file: '/var/log/ai-interviewer/backend.log',
      out_file: '/var/log/ai-interviewer/backend-out.log',
      error_file: '/var/log/ai-interviewer/backend-error.log'
    }
  ]
};
```

Start the backend:
```bash
# Start with PM2
cd /var/www/ai-interviewer
pm2 start ecosystem.config.js

# Check status
pm2 status

# Save configuration
pm2 save
```

### 4.6 Set Proper Permissions
```bash
# Set ownership and permissions
sudo chown -R ubuntu:www-data /var/www/ai-interviewer
sudo chmod -R 755 /var/www/ai-interviewer
sudo chmod 600 /var/www/ai-interviewer/backend/.env
```

---

## Phase 5: Web Server Configuration (Nginx + SSL)

### 5.1 Nginx Configuration

Create Nginx site configuration:
```bash
# Create configuration file
sudo nano /etc/nginx/sites-available/ai-interviewer
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (Let's Encrypt will add these)
    # ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Serve React frontend
    location / {
        root /var/www/ai-interviewer/frontend/build;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to FastAPI backend
    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Handle static files with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        root /var/www/ai-interviewer/frontend/build;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/ai-interviewer /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 5.2 SSL Certificate Installation

```bash
# Install SSL certificate with Let's Encrypt
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow prompts:
# 1. Enter email address
# 2. Agree to terms (Y)
# 3. Choose redirect option: 2 (redirect HTTP to HTTPS)

# Test automatic renewal
sudo certbot renew --dry-run
```

---

## Phase 6: Final Testing and Verification

### 6.1 Test All Services
```bash
# Test backend directly
curl http://localhost:8000/health

# Test through Nginx proxy
curl https://yourdomain.com/api/health

# Test frontend
curl https://yourdomain.com
```

### 6.2 Verify in Browser
1. Visit `https://yourdomain.com`
2. Check that SSL certificate is valid
3. Test application functionality
4. Verify API calls work properly

### 6.3 Monitor Services
```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs ai-interviewer-backend

# Check Nginx status
sudo systemctl status nginx

# Monitor system resources
htop
```

---

## Maintenance and Updates

### Regular Tasks

**Update Application:**
```bash
# Pull latest code
cd /var/www/ai-interviewer
git pull origin main

# Update backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
pm2 restart ai-interviewer-backend

# Update frontend
cd ../frontend
npm install
npm run build
```

**Monitor SSL Certificate:**
```bash
# Check certificate expiration
sudo certbot certificates

# Manual renewal (if needed)
sudo certbot renew
```

**System Updates:**
```bash
# Regular system updates
sudo apt update && sudo apt upgrade -y

# Reboot if kernel updates
sudo reboot
```

### Backup Strategy
- Database: Regular MongoDB backups
- Application: Keep code in version control
- Configuration: Backup `/etc/nginx/sites-available/`
- SSL certificates: Automated with Let's Encrypt

---

## Troubleshooting

### Common Issues

**Backend not starting:**
```bash
# Check PM2 logs
pm2 logs ai-interviewer-backend

# Test manual start
cd /var/www/ai-interviewer/backend
source venv/bin/activate
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

**Frontend not loading:**
```bash
# Check Nginx logs
sudo tail -f /var/log/nginx/error.log

# Verify build exists
ls -la /var/www/ai-interviewer/frontend/build/
```

**SSL issues:**
```bash
# Check certificate status
sudo certbot certificates

# Test SSL configuration
sudo nginx -t
```

### Performance Optimization
- Enable Gzip compression in Nginx
- Configure proper caching headers
- Monitor resource usage with `htop`
- Consider upgrading instance type for high traffic

---

## Security Checklist

- [ ] SSH key-based authentication only
- [ ] UFW firewall properly configured
- [ ] Fail2ban installed and running
- [ ] SSL/TLS certificates installed
- [ ] Security headers configured
- [ ] Regular system updates scheduled
- [ ] Environment variables secured
- [ ] Database access restricted

---

## Cost Estimation

**Monthly AWS costs (approximate):**
- t3.medium instance: $30-35
- 20 GB EBS storage: $2
- Data transfer: Usually free for small apps
- **Total: ~$35-40/month**

This guide provides a complete production-ready deployment of the AI Interviewer application on EC2 with proper security, SSL, and monitoring in place.
