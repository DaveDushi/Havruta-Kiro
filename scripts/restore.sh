#!/bin/bash

# Havruta Platform Restore Script
# This script restores database and Redis from backup files

set -e

# Check if backup file is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup_timestamp> [--from-s3]"
    echo "Example: $0 20240101_120000"
    echo "Example: $0 20240101_120000 --from-s3"
    exit 1
fi

TIMESTAMP=$1
FROM_S3=$2
BACKUP_DIR="/backups"
DB_BACKUP_FILE="havruta_backup_${TIMESTAMP}.sql.gz"
REDIS_BACKUP_FILE="redis_backup_${TIMESTAMP}.rdb"

# Load environment variables
source .env.prod

echo "Starting restore process for backup: ${TIMESTAMP}"

# Download from S3 if specified
if [ "$FROM_S3" = "--from-s3" ]; then
    if [ -z "${BACKUP_S3_BUCKET}" ]; then
        echo "Error: BACKUP_S3_BUCKET not configured"
        exit 1
    fi
    
    echo "Downloading backups from S3..."
    aws s3 cp s3://${BACKUP_S3_BUCKET}/database/${DB_BACKUP_FILE} ${BACKUP_DIR}/
    aws s3 cp s3://${BACKUP_S3_BUCKET}/redis/${REDIS_BACKUP_FILE} ${BACKUP_DIR}/
fi

# Check if backup files exist
if [ ! -f "${BACKUP_DIR}/${DB_BACKUP_FILE}" ]; then
    echo "Error: Database backup file not found: ${DB_BACKUP_FILE}"
    exit 1
fi

if [ ! -f "${BACKUP_DIR}/${REDIS_BACKUP_FILE}" ]; then
    echo "Error: Redis backup file not found: ${REDIS_BACKUP_FILE}"
    exit 1
fi

# Confirmation prompt
echo "WARNING: This will overwrite the current database and Redis data!"
echo "Database backup: ${DB_BACKUP_FILE}"
echo "Redis backup: ${REDIS_BACKUP_FILE}"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

# Stop application to prevent data corruption
echo "Stopping application..."
docker-compose -f docker-compose.prod.yml stop app

# Restore database
echo "Restoring database..."
gunzip -c ${BACKUP_DIR}/${DB_BACKUP_FILE} | \
docker-compose -f docker-compose.prod.yml exec -T postgres psql \
    -U ${POSTGRES_USER} \
    -d postgres

echo "Database restored successfully"

# Restore Redis
echo "Restoring Redis..."
docker-compose -f docker-compose.prod.yml stop redis

# Copy backup file to Redis container
docker cp ${BACKUP_DIR}/${REDIS_BACKUP_FILE} \
    $(docker-compose -f docker-compose.prod.yml ps -q redis):/data/dump.rdb

# Start Redis
docker-compose -f docker-compose.prod.yml start redis

echo "Redis restored successfully"

# Start application
echo "Starting application..."
docker-compose -f docker-compose.prod.yml start app

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 30

# Health check
echo "Performing health check..."
if curl -f http://localhost/health; then
    echo "Restore completed successfully!"
else
    echo "Warning: Health check failed. Please check the application logs."
    exit 1
fi

# Send notification
if [ ! -z "${MONITORING_ENDPOINT}" ]; then
    curl -X POST ${MONITORING_ENDPOINT} \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"Database restore completed\", \"timestamp\": \"$(date -Iseconds)\", \"backup\": \"${TIMESTAMP}\"}"
fi