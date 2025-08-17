#!/bin/bash

# Havruta Platform Backup Script
# This script creates backups of the database and uploads them to S3

set -e

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_BACKUP_FILE="havruta_backup_${TIMESTAMP}.sql"
REDIS_BACKUP_FILE="redis_backup_${TIMESTAMP}.rdb"

# Load environment variables
source .env.prod

echo "Starting backup process at $(date)"

# Create backup directory if it doesn't exist
mkdir -p ${BACKUP_DIR}

# Database backup
echo "Creating database backup..."
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump \
  -U ${POSTGRES_USER} \
  -d ${POSTGRES_DB} \
  --no-password \
  --verbose \
  --clean \
  --if-exists \
  --create > ${BACKUP_DIR}/${DB_BACKUP_FILE}

# Compress database backup
gzip ${BACKUP_DIR}/${DB_BACKUP_FILE}
DB_BACKUP_FILE="${DB_BACKUP_FILE}.gz"

echo "Database backup created: ${DB_BACKUP_FILE}"

# Redis backup
echo "Creating Redis backup..."
docker-compose -f docker-compose.prod.yml exec -T redis redis-cli \
  --rdb /data/dump.rdb BGSAVE

# Wait for Redis backup to complete
sleep 10

# Copy Redis backup
docker cp $(docker-compose -f docker-compose.prod.yml ps -q redis):/data/dump.rdb ${BACKUP_DIR}/${REDIS_BACKUP_FILE}

echo "Redis backup created: ${REDIS_BACKUP_FILE}"

# Upload to S3 if configured
if [ ! -z "${BACKUP_S3_BUCKET}" ]; then
    echo "Uploading backups to S3..."
    
    aws s3 cp ${BACKUP_DIR}/${DB_BACKUP_FILE} s3://${BACKUP_S3_BUCKET}/database/
    aws s3 cp ${BACKUP_DIR}/${REDIS_BACKUP_FILE} s3://${BACKUP_S3_BUCKET}/redis/
    
    echo "Backups uploaded to S3"
fi

# Clean up old local backups (keep last 7 days)
find ${BACKUP_DIR} -name "havruta_backup_*.sql.gz" -mtime +7 -delete
find ${BACKUP_DIR} -name "redis_backup_*.rdb" -mtime +7 -delete

# Clean up old S3 backups if configured
if [ ! -z "${BACKUP_S3_BUCKET}" ] && [ ! -z "${BACKUP_RETENTION_DAYS}" ]; then
    CUTOFF_DATE=$(date -d "${BACKUP_RETENTION_DAYS} days ago" +%Y%m%d)
    
    aws s3 ls s3://${BACKUP_S3_BUCKET}/database/ | while read -r line; do
        FILE_DATE=$(echo $line | awk '{print $4}' | grep -o '[0-9]\{8\}' | head -1)
        if [ "${FILE_DATE}" -lt "${CUTOFF_DATE}" ]; then
            FILE_NAME=$(echo $line | awk '{print $4}')
            aws s3 rm s3://${BACKUP_S3_BUCKET}/database/${FILE_NAME}
            echo "Deleted old backup: ${FILE_NAME}"
        fi
    done
fi

echo "Backup process completed at $(date)"

# Send notification if webhook is configured
if [ ! -z "${MONITORING_ENDPOINT}" ]; then
    curl -X POST ${MONITORING_ENDPOINT} \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"Backup completed successfully\", \"timestamp\": \"$(date -Iseconds)\"}"
fi