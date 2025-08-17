# Havruta Platform Production Deployment Guide

## Overview

This guide covers the complete production deployment setup for the Havruta Platform, including infrastructure, CI/CD, monitoring, and maintenance procedures.

## Prerequisites

### Server Requirements
- Ubuntu 20.04+ or similar Linux distribution
- Minimum 4GB RAM, 2 CPU cores
- 50GB+ storage space
- Docker and Docker Compose installed
- SSL certificate for your domain

### Required Accounts & Services
- GitHub repository with Actions enabled
- Domain name with DNS control
- Email service provider (for notifications)
- Optional: AWS S3 for backups
- Optional: Slack for alerts

## Initial Setup

### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install AWS CLI (for backups)
sudo apt install awscli -y
```

### 2. Repository Setup

```bash
# Clone repository
git clone https://github.com/your-username/havruta-platform.git
cd havruta-platform

# Make scripts executable
chmod +x scripts/*.sh
```

### 3. Environment Configuration

Copy and configure the production environment file:

```bash
cp .env.production .env.prod
```

Edit `.env.prod` with your actual values:
- Database credentials
- Redis password
- JWT secret (generate a strong random string)
- OAuth credentials
- Email service API key
- Domain name

### 4. SSL Certificate Setup

Place your SSL certificate files in the `ssl/` directory:
- `ssl/cert.pem` - Your SSL certificate
- `ssl/key.pem` - Your private key

Or use Let's Encrypt:
```bash
sudo apt install certbot -y
sudo certbot certonly --standalone -d your-domain.com
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/key.pem
```

## GitHub Actions Setup

### Required Secrets

Configure these secrets in your GitHub repository settings:

**Production Server Access:**
- `PRODUCTION_HOST` - Your server IP address
- `PRODUCTION_USER` - SSH username
- `PRODUCTION_SSH_KEY` - Private SSH key for server access

**Application Secrets:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `EMAIL_SERVICE_API_KEY` - Email service API key
- `SEFARIA_API_BASE_URL` - Sefaria API endpoint

**Database Configuration:**
- `POSTGRES_DB` - Database name
- `POSTGRES_USER` - Database username
- `POSTGRES_PASSWORD` - Database password
- `REDIS_PASSWORD` - Redis password

**Optional (for notifications):**
- `SLACK_WEBHOOK` - Slack webhook URL for deployment notifications

## Deployment Process

### Manual Deployment

1. **Initial deployment:**
```bash
# Start the production stack
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Run database migrations
docker-compose -f docker-compose.prod.yml exec app npx prisma migrate deploy

# Verify deployment
curl -f http://localhost/health
```

2. **Start monitoring (optional):**
```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

### Automated Deployment

Push to the `main` branch to trigger automatic deployment via GitHub Actions.

The CI/CD pipeline will:
1. Run all tests
2. Build Docker image
3. Deploy to production server
4. Run health checks
5. Send notifications

## Monitoring Setup

### Accessing Monitoring Tools

- **Grafana Dashboard:** `https://your-domain.com:3001`
  - Default login: admin/admin (change immediately)
- **Prometheus:** `https://your-domain.com:9090`
- **Alertmanager:** `https://your-domain.com:9093`

### Configure Alerts

Edit `monitoring/alertmanager.yml` to set up:
- Email notifications
- Slack integration
- Alert routing rules

## Backup & Maintenance

### Automated Backups

Set up a cron job for regular backups:

```bash
# Edit crontab
crontab -e

# Add backup job (daily at 2 AM)
0 2 * * * /path/to/havruta-platform/scripts/backup.sh >> /var/log/havruta-backup.log 2>&1
```

### Manual Backup

```bash
./scripts/backup.sh
```

### Restore from Backup

```bash
# List available backups
ls -la /backups/

# Restore from local backup
./scripts/restore.sh 20240101_120000

# Restore from S3
./scripts/restore.sh 20240101_120000 --from-s3
```

### Maintenance Tasks

Run weekly maintenance:

```bash
# Set up maintenance cron job
0 3 * * 0 /path/to/havruta-platform/scripts/maintenance.sh >> /var/log/havruta-maintenance.log 2>&1
```

## Security Considerations

### Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Regular Updates

- Keep Docker images updated
- Apply security patches regularly
- Rotate secrets periodically
- Monitor security advisories

## Troubleshooting

### Common Issues

1. **Container won't start:**
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs app

# Check resource usage
docker stats
```

2. **Database connection issues:**
```bash
# Test database connectivity
docker-compose -f docker-compose.prod.yml exec postgres pg_isready
```

3. **SSL certificate issues:**
```bash
# Verify certificate
openssl x509 -in ssl/cert.pem -text -noout
```

### Health Checks

```bash
# Application health
curl -f https://your-domain.com/health

# Database health
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Redis health
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping
```

## Scaling Considerations

### Horizontal Scaling

To scale the application:

1. Set up a load balancer
2. Deploy multiple app instances
3. Use external database and Redis
4. Implement session affinity for WebSocket connections

### Performance Optimization

- Enable Redis clustering for high availability
- Use database read replicas
- Implement CDN for static assets
- Monitor and optimize database queries

## Support

For deployment issues:
1. Check application logs
2. Review monitoring dashboards
3. Consult troubleshooting section
4. Contact development team

## Maintenance Schedule

- **Daily:** Automated backups
- **Weekly:** Maintenance script execution
- **Monthly:** Security updates and dependency updates
- **Quarterly:** Performance review and optimization