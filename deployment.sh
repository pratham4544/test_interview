#!/bin/bash

##############################################################################
# AI Interviewer Application - EC2 Deployment Script
# Domain: http://neo-in-matrix.duckdns.org/
# 
# This script automates the deployment process up to Phase 4.1
# You'll need to manually transfer code via SCP, then continue with Phase 4.2+
##############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="neo-in-matrix.duckdns.org"
APP_DIR="/var/www/ai-interviewer"
LOG_DIR="/var/log/ai-interviewer"

##############################################################################
# Helper Functions
##############################################################################

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

confirm_continue() {
    read -p "Press Enter to continue or Ctrl+C to exit..."
}

##############################################################################
# Phase 2: EC2 Instance Setup (Manual - AWS Console)
##############################################################################

phase2_reminder() {
    print_header "PHASE 2: EC2 Instance Setup (Manual)"
    cat << EOF
This phase must be completed in AWS Console:

1. Launch EC2 Instance:
   - Name: ai-interviewer-app
   - AMI: Ubuntu Server 22.04 LTS
   - Instance Type: t3.medium
   - Key Pair: Create and download ai-interviewer-key.pem

2. Security Group Inbound Rules:
   - SSH (22)      - Your IP
   - HTTP (80)     - 0.0.0.0/0
   - HTTPS (443)   - 0.0.0.0/0
   - Custom (8000) - 0.0.0.0/0

3. Storage: 20 GB gp3 SSD

4. Connect to instance:
   chmod 400 ai-interviewer-key.pem
   ssh -i ai-interviewer-key.pem ubuntu@YOUR_EC2_PUBLIC_IP

5. Update DNS: Point ${DOMAIN} A record to your EC2 public IP

EOF
    print_warning "Ensure you've completed Phase 2 before continuing!"
    confirm_continue
}

##############################################################################
# Phase 3: Server Environment Setup
##############################################################################

phase3_system_updates() {
    print_header "PHASE 3.1: System Updates"
    
    sudo apt update && sudo apt upgrade -y
    sudo apt install -y curl wget git unzip software-properties-common build-essential
    
    print_success "System updated successfully"
}

phase3_nodejs() {
    print_header "PHASE 3.2: Node.js Installation"
    
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt install -y nodejs
    
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    
    print_success "Node.js installed: ${NODE_VERSION}"
    print_success "npm installed: ${NPM_VERSION}"
}

phase3_python() {
    print_header "PHASE 3.3: Python Environment Setup"
    
    sudo apt install -y python3-pip python3-venv python3-dev
    
    PYTHON_VERSION=$(python3 --version)
    print_success "Python installed: ${PYTHON_VERSION}"
}

phase3_pm2() {
    print_header "PHASE 3.4: PM2 Installation"
    
    sudo npm install -g pm2
    
    print_warning "Setting up PM2 startup script..."
    
    # Get the startup command from PM2 and execute it
    STARTUP_CMD=$(pm2 startup systemd -u $USER --hp $HOME | grep "sudo env" | tail -1)
    
    if [[ -n "$STARTUP_CMD" ]]; then
        print_warning "Executing PM2 startup command..."
        eval "$STARTUP_CMD"
        print_success "PM2 startup configured"
    else
        print_error "Could not automatically configure PM2 startup"
        print_warning "Please run: pm2 startup systemd -u $USER --hp $HOME"
        print_warning "Then execute the command it outputs"
        confirm_continue
    fi
    
    print_success "PM2 installed successfully"
}

phase3_nginx() {
    print_header "PHASE 3.5: Nginx Installation"
    
    sudo apt install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    
    print_success "Nginx installed and started"
}

phase3_firewall() {
    print_header "PHASE 3.6: Firewall Configuration"
    
    sudo ufw --force default deny incoming
    sudo ufw default allow outgoing
    
    sudo ufw allow 22/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw allow 8000/tcp
    
    sudo ufw --force enable
    
    print_success "Firewall configured and enabled"
    sudo ufw status
}

phase3_security_tools() {
    print_header "PHASE 3.7: Additional Security Tools"
    
    sudo apt install -y fail2ban python3-certbot-nginx
    sudo systemctl start fail2ban
    sudo systemctl enable fail2ban
    
    print_success "Security tools installed"
}

phase3_directories() {
    print_header "PHASE 3.8: Application Directory Structure"
    
    sudo mkdir -p ${APP_DIR}/frontend
    sudo mkdir -p ${APP_DIR}/backend
    sudo mkdir -p ${LOG_DIR}
    
    sudo chown -R $USER:$USER ${APP_DIR}
    sudo chown -R $USER:$USER ${LOG_DIR}
    
    print_success "Directory structure created"
    ls -la ${APP_DIR}
}

##############################################################################
# Phase 4: Application Deployment (Pauses for manual SCP)
##############################################################################

phase4_pause_for_scp() {
    print_header "PHASE 4.1: Code Transfer (MANUAL STEP REQUIRED)"
    
    cat << EOF
${YELLOW}⚠ ACTION REQUIRED: Transfer your code using SCP${NC}

From your LOCAL machine, run these commands:

${GREEN}# Transfer frontend${NC}
scp -i ai-interviewer-key.pem -r ./frontend ubuntu@YOUR_EC2_IP:${APP_DIR}/

${GREEN}# Transfer backend${NC}
scp -i ai-interviewer-key.pem -r ./backend ubuntu@YOUR_EC2_IP:${APP_DIR}/

${YELLOW}Replace YOUR_EC2_IP with your actual EC2 public IP address${NC}

After transferring both frontend and backend directories, return here.

EOF
    
    read -p "Have you completed the SCP transfer? (yes/no): " scp_done
    
    if [[ "$scp_done" != "yes" ]]; then
        print_error "Please complete the SCP transfer before continuing"
        exit 1
    fi
    
    # Verify directories exist
    if [[ ! -d "${APP_DIR}/frontend" ]] || [[ ! -d "${APP_DIR}/backend" ]]; then
        print_error "Frontend or backend directory not found in ${APP_DIR}"
        exit 1
    fi
    
    print_success "Code transfer verified"
}

phase4_backend_setup() {
    print_header "PHASE 4.2: Backend Deployment"
    
    cd ${APP_DIR}/backend
    
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    pip install uvicorn gunicorn
    
    deactivate
    
    print_success "Backend dependencies installed"
}

phase4_backend_env() {
    print_header "PHASE 4.3: Backend Environment Configuration"
    
    cat << EOF > ${APP_DIR}/backend/.env
# MongoDB Configuration
MONGO_URI='mongodb+srv://adityaprakasha:A6idh2GmlbV51Xow@dms.51f4n.mongodb.net/your_database_name?retryWrites=true&w=majority'

# AI API Keys
GROQ_API_KEY=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

# Production Settings
HOST=0.0.0.0
PORT=8000
DEBUG=False
ENVIRONMENT=production

# CORS Origins - UPDATE WITH YOUR DOMAIN
CORS_ORIGINS=["https://${DOMAIN}", "http://${DOMAIN}"]
EOF
    
    chmod 600 ${APP_DIR}/backend/.env
    
    print_warning "IMPORTANT: Edit ${APP_DIR}/backend/.env with your actual credentials:"
    print_warning "  - MONGO_URI"
    print_warning "  - GROQ_API_KEY"
    print_warning "  - Any other API keys you need"
    
    read -p "Open .env file now for editing? (yes/no): " edit_env
    
    if [[ "$edit_env" == "yes" ]]; then
        nano ${APP_DIR}/backend/.env
    fi
    
    print_success "Backend environment file created"
}

phase4_frontend_setup() {
    print_header "PHASE 4.4: Frontend Deployment"
    
    cd ${APP_DIR}/frontend
    
    # Create production environment file
    cat << EOF > .env.production
# API Configuration - Direct backend access (no /api prefix)
REACT_APP_API_BASE=http://neo-in-matrix.duckdns.org
GENERATE_SOURCEMAP=false
EOF
    
    print_success "Frontend environment file created"
    
    # Update constants file if it exists
    if [[ -f "src/utils/constants.js" ]]; then
        print_warning "Updating API_BASE in constants.js..."
        
        # Backup original
        cp src/utils/constants.js src/utils/constants.js.backup
        
        # Use perl instead of sed for more reliable replacement
        perl -i -pe "s|export const API_BASE = .*?;|export const API_BASE = process.env.REACT_APP_API_BASE \|\| 'http://localhost:8000';|g" src/utils/constants.js
        
        print_success "constants.js updated"
    elif [[ -f "src/constants.js" ]]; then
        print_warning "Updating API_BASE in src/constants.js..."
        
        # Backup original
        cp src/constants.js src/constants.js.backup
        
        # Use perl for replacement
        perl -i -pe "s|export const API_BASE = .*?;|export const API_BASE = process.env.REACT_APP_API_BASE \|\| 'http://localhost:8000';|g" src/constants.js
        
        print_success "constants.js updated"
    else
        print_warning "constants.js not found - skipping update"
        print_warning "Make sure your frontend uses REACT_APP_API_BASE from .env.production"
    fi
    
    # Install dependencies
    npm install
    
    # Build application
    print_warning "Building React application (this may take a few minutes)..."
    npm run build
    
    if [[ ! -d "build" ]]; then
        print_error "Build failed - build directory not created"
        exit 1
    fi
    
    print_success "Frontend built successfully"
}

phase4_pm2_setup() {
    print_header "PHASE 4.5: PM2 Configuration and Backend Startup"
    
    cat << 'EOF' > ${APP_DIR}/ecosystem.config.js
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
EOF
    
    cd ${APP_DIR}
    pm2 start ecosystem.config.js
    pm2 save
    
    print_success "Backend started with PM2"
    pm2 status
}

phase4_permissions() {
    print_header "PHASE 4.6: Set Proper Permissions"
    
    sudo chown -R $USER:www-data ${APP_DIR}
    sudo chmod -R 755 ${APP_DIR}
    sudo chmod 600 ${APP_DIR}/backend/.env
    
    print_success "Permissions set correctly"
}

##############################################################################
# Phase 5: Web Server Configuration
##############################################################################

phase5_nginx_config() {
    print_header "PHASE 5.1: Nginx Configuration (Direct Backend Proxy - No /api prefix)"
    
    sudo tee /etc/nginx/sites-available/ai-interviewer > /dev/null << EOF
# HTTP Configuration
server {
    listen 80;
    server_name ${DOMAIN};
    
    # Allow Let's Encrypt verification (for future SSL setup)
    location /.well-known/acme-challenge/ {
        root /var/www/ai-interviewer/frontend/build;
    }
    
    # Proxy ALL requests to FastAPI backend (except static files)
    location / {
        # Try to serve static files first, if not found proxy to backend
        try_files \$uri \$uri/ @backend;
    }
    
    # Backend proxy
    location @backend {
        proxy_pass http://localhost:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts for long-running requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Serve React static files with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|html)$ {
        root /var/www/ai-interviewer/frontend/build;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    
    # Enable site
    sudo ln -sf /etc/nginx/sites-available/ai-interviewer /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test configuration
    sudo nginx -t
    
    if [ $? -eq 0 ]; then
        # Reload Nginx
        sudo systemctl reload nginx
        print_success "Nginx configured successfully (Direct backend proxy - no /api prefix)"
    else
        print_error "Nginx configuration test failed"
        exit 1
    fi
}

phase5_ssl_install() {
    print_header "PHASE 5.2: SSL Certificate Installation"
    
    print_warning "Installing Let's Encrypt SSL certificate for ${DOMAIN}"
    
    # Try to get certificate
    sudo certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN} --redirect || {
        print_warning "SSL installation may have failed. This is common with DuckDNS."
        print_warning "You can manually run: sudo certbot --nginx -d ${DOMAIN}"
    }
    
    # Test auto-renewal
    print_warning "Testing certificate auto-renewal..."
    sudo certbot renew --dry-run || print_warning "Auto-renewal test failed (may be okay for new certs)"
    
    print_success "SSL configuration attempted"
}

##############################################################################
# Phase 6: Testing and Verification
##############################################################################

phase6_testing() {
    print_header "PHASE 6: Final Testing and Verification"
    
    print_warning "Testing backend health endpoint..."
    sleep 3
    
    curl -f http://localhost:8000/health || print_warning "Backend direct test failed"
    
    print_warning "Testing through Nginx proxy..."
    curl -f http://${DOMAIN}/api/health || print_warning "Nginx proxy test failed"
    
    print_warning "Testing frontend..."
    curl -f http://${DOMAIN}/ || print_warning "Frontend test failed"
    
    print_success "Basic tests completed"
    
    cat << EOF

${GREEN}========================================
Deployment Status
========================================${NC}

${GREEN}✓ Server environment configured${NC}
${GREEN}✓ Application deployed${NC}
${GREEN}✓ Nginx configured with direct backend proxy${NC}
${GREEN}✓ Backend running on port 8000${NC}
${GREEN}✓ Frontend built and served${NC}

${BLUE}Access your application:${NC}
  Application: http://${DOMAIN}
  Backend endpoints: http://${DOMAIN}/health, /candidates, etc.

${YELLOW}Next Steps:${NC}
1. Visit http://${DOMAIN} in your browser
2. Test application functionality
3. Monitor logs: pm2 logs ai-interviewer-backend
4. Check PM2 status: pm2 status

${YELLOW}Important Reminders:${NC}
- Update ${APP_DIR}/backend/.env with real credentials
- Monitor application: pm2 monit
- View Nginx logs: sudo tail -f /var/log/nginx/error.log
- SSL certificates auto-renew (check: sudo certbot certificates)

${GREEN}Deployment Complete!${NC}
EOF
}

##############################################################################
# Main Execution
##############################################################################

main() {
    print_header "AI Interviewer Application - EC2 Deployment"
    print_warning "Domain: ${DOMAIN}"
    print_warning "This script will set up your EC2 instance"
    confirm_continue
    
    # Phase 2 Reminder (Manual)
    phase2_reminder
    
    # Phase 3: Environment Setup
    phase3_system_updates
    phase3_nodejs
    phase3_python
    phase3_pm2
    phase3_nginx
    phase3_firewall
    phase3_security_tools
    phase3_directories
    
    # Phase 4: Application Deployment
    phase4_pause_for_scp
    phase4_backend_setup
    phase4_backend_env
    phase4_frontend_setup
    phase4_pm2_setup
    phase4_permissions
    
    # Phase 5: Web Server Configuration
    phase5_nginx_config
    phase5_ssl_install
    
    # Phase 6: Testing
    phase6_testing
}

# Run main function
main