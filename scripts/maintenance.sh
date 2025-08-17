#!/bin/bash

# Havruta Platform Maintenance Script
# This script performs routine maintenance tasks

set -e

# Load environment variables
source .env.prod

echo "Starting maintenance tasks at $(date)"

# Database maintenance
echo "Running database maintenance..."

# Analyze and vacuum database
docker-compose -f docker-compose.prod.yml exec -T postgres psql \
    -U ${POSTGRES_USER} \
    -d ${POSTGRES_DB} \
    -c "ANALYZE; VACUUM;"

# Update database statistics
docker-compose -f docker-compose.prod.yml exec -T postgres psql \
    -U ${POSTGRES_USER} \
    -d ${POSTGRES_DB} \
    -c "UPDATE pg_stat_user_tables SET n_tup_ins = 0, n_tup_upd = 0, n_tup_del = 0;"

echo "Database maintenance completed"

# Redis maintenance
echo "Running Redis maintenance..."

# Clean up expired keys
docker-compose -f docker-compose.prod.yml exec -T redis redis-cli FLUSHEXPIRED

# Get Redis memory usage
REDIS_MEMORY=$(docker-compose -f docker-compose.prod.yml exec -T redis redis-cli INFO memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')
echo "Redis memory usage: ${REDIS_MEMORY}"

echo "Redis maintenance completed"

# Clean up old logs
echo "Cleaning up old logs..."
find ./logs -name "*.log" -mtime +30 -delete 2>/dev/null || true
docker system prune -f --volumes --filter "until=720h"

echo "Log cleanup completed"

# Application-specific maintenance
echo "Running application maintenance..."

# Clean up expired sessions
docker-compose -f docker-compose.prod.yml exec -T app node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
    // Clean up expired invitations
    const expiredInvitations = await prisma.invitation.deleteMany({
        where: {
            expiresAt: {
                lt: new Date()
            },
            status: 'pending'
        }
    });
    console.log(\`Cleaned up \${expiredInvitations.count} expired invitations\`);

    // Clean up old sessions (older than 30 days)
    const oldSessions = await prisma.session.deleteMany({
        where: {
            endTime: {
                lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
        }
    });
    console.log(\`Cleaned up \${oldSessions.count} old sessions\`);

    await prisma.\$disconnect();
}

cleanup().catch(console.error);
"

echo "Application maintenance completed"

# Generate maintenance report
REPORT_FILE="/tmp/maintenance_report_$(date +%Y%m%d_%H%M%S).txt"

cat > ${REPORT_FILE} << EOF
Havruta Platform Maintenance Report
Generated: $(date)

Database Status:
$(docker-compose -f docker-compose.prod.yml exec -T postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c "SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del FROM pg_stat_user_tables;" | head -20)

Redis Status:
Memory Usage: ${REDIS_MEMORY}
$(docker-compose -f docker-compose.prod.yml exec -T redis redis-cli INFO stats | grep -E "(total_commands_processed|total_connections_received|expired_keys)")

Disk Usage:
$(df -h)

Container Status:
$(docker-compose -f docker-compose.prod.yml ps)

Recent Errors (last 100 lines):
$(docker-compose -f docker-compose.prod.yml logs --tail=100 app | grep -i error || echo "No recent errors found")
EOF

echo "Maintenance report generated: ${REPORT_FILE}"

# Send maintenance report if configured
if [ ! -z "${MONITORING_ENDPOINT}" ]; then
    curl -X POST ${MONITORING_ENDPOINT} \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"Maintenance completed\", \"timestamp\": \"$(date -Iseconds)\", \"report\": \"$(cat ${REPORT_FILE} | base64 -w 0)\"}"
fi

echo "Maintenance tasks completed at $(date)"