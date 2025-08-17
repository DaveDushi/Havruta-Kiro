# Production Deployment Setup Checklist

## Pre-Deployment Checklist

### Infrastructure Setup
- [ ] Production server provisioned (4GB+ RAM, 2+ CPU cores, 50GB+ storage)
- [ ] Domain name registered and DNS configured
- [ ] SSL certificate obtained (Let's Encrypt or commercial)
- [ ] Docker and Docker Compose installed on server
- [ ] Firewall configured (ports 80, 443, 22 open)

### GitHub Repository Setup
- [ ] Repository secrets configured:
  - [ ] `PRODUCTION_HOST`
  - [ ] `PRODUCTION_USER` 
  - [ ] `PRODUCTION_SSH_KEY`
  - [ ] `DATABASE_URL`
  - [ ] `REDIS_URL`
  - [ ] `JWT_SECRET`
  - [ ] `GOOGLE_CLIENT_ID`
  - [ ] `GOOGLE_CLIENT_SECRET`
  - [ ] `EMAIL_SERVICE_API_KEY`
  - [ ] All database credentials
- [ ] GitHub Actions enabled

### Environment Configuration
- [ ] `.env.prod` file created and configured
- [ ] SSL certificates placed in `ssl/` directory
- [ ] Nginx configuration updated with correct domain
- [ ] Database and Redis passwords set

### External Services
- [ ] Google OAuth application configured
- [ ] Email service provider configured
- [ ] Monitoring endpoints configured (optional)
- [ ] S3 bucket for backups created (optional)
- [ ] Slack webhook for notifications (optional)

## Deployment Steps

### Initial Deployment
- [ ] Clone repository to production server
- [ ] Make scripts executable (`chmod +x scripts/*.sh`)
- [ ] Configure environment variables
- [ ] Deploy with Docker Compose
- [ ] Run database migrations
- [ ] Verify health checks pass

### Monitoring Setup (Optional)
- [ ] Deploy monitoring stack
- [ ] Configure Grafana dashboards
- [ ] Set up alert rules
- [ ] Test notification channels

### Backup Configuration
- [ ] Set up automated backup cron job
- [ ] Test backup and restore procedures
- [ ] Configure S3 backup storage (if using)

### Maintenance Setup
- [ ] Set up maintenance cron job
- [ ] Configure log rotation
- [ ] Set up security update schedule

## Post-Deployment Verification

### Functionality Tests
- [ ] Application loads correctly
- [ ] User registration/login works
- [ ] Google OAuth authentication works
- [ ] Email notifications are sent
- [ ] WebSocket connections work
- [ ] Database operations function
- [ ] Redis caching works

### Performance Tests
- [ ] Load testing completed
- [ ] Response times acceptable
- [ ] Memory usage within limits
- [ ] Database performance optimized

### Security Tests
- [ ] SSL certificate valid
- [ ] Security headers present
- [ ] Rate limiting functional
- [ ] Authentication/authorization working
- [ ] No sensitive data exposed

### Monitoring Tests
- [ ] Metrics collection working
- [ ] Alerts trigger correctly
- [ ] Dashboards display data
- [ ] Log aggregation functional

## Ongoing Maintenance

### Daily
- [ ] Check application health
- [ ] Review error logs
- [ ] Verify backup completion

### Weekly
- [ ] Run maintenance script
- [ ] Review performance metrics
- [ ] Check disk space usage

### Monthly
- [ ] Update dependencies
- [ ] Review security patches
- [ ] Optimize database performance
- [ ] Test backup restoration

### Quarterly
- [ ] Security audit
- [ ] Performance optimization review
- [ ] Disaster recovery testing
- [ ] Documentation updates