import { Router } from 'express';
import { performanceService } from '../services/performanceService.js';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Middleware to check admin access (you may want to implement proper admin auth)
const requireAdmin = (req: any, res: any, next: any) => {
  // For now, just check if user exists - in production, implement proper admin check
  if (!req.user) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Get performance metrics summary
router.get('/metrics', authenticateToken, requireAdmin, (req, res) => {
  try {
    const timeWindow = req.query.timeWindow ? parseInt(req.query.timeWindow as string) : undefined;
    
    const summary = performanceService.getMetricsSummary(timeWindow);
    const apiSummary = performanceService.getAPIMetricsSummary(timeWindow);
    const dbSummary = performanceService.getDatabaseMetricsSummary(timeWindow);
    
    res.json({
      general: summary,
      api: apiSummary,
      database: dbSummary,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error getting performance metrics:', error);
    res.status(500).json({ error: 'Failed to get performance metrics' });
  }
});

// Get system health metrics
router.get('/health', authenticateToken, requireAdmin, (req, res) => {
  try {
    const health = performanceService.getHealthMetrics();
    
    // Add additional system info
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      ...health
    };
    
    res.json(systemInfo);
  } catch (error) {
    logger.error('Error getting health metrics:', error);
    res.status(500).json({ error: 'Failed to get health metrics' });
  }
});

// Get detailed API metrics
router.get('/api-metrics', authenticateToken, requireAdmin, (req, res) => {
  try {
    const timeWindow = req.query.timeWindow ? parseInt(req.query.timeWindow as string) : 300000; // 5 minutes default
    const summary = performanceService.getAPIMetricsSummary(timeWindow);
    
    res.json(summary);
  } catch (error) {
    logger.error('Error getting API metrics:', error);
    res.status(500).json({ error: 'Failed to get API metrics' });
  }
});

// Get detailed database metrics
router.get('/database-metrics', authenticateToken, requireAdmin, (req, res) => {
  try {
    const timeWindow = req.query.timeWindow ? parseInt(req.query.timeWindow as string) : 300000; // 5 minutes default
    const summary = performanceService.getDatabaseMetricsSummary(timeWindow);
    
    res.json(summary);
  } catch (error) {
    logger.error('Error getting database metrics:', error);
    res.status(500).json({ error: 'Failed to get database metrics' });
  }
});

// Export metrics for external monitoring systems
router.get('/export', authenticateToken, requireAdmin, (req, res) => {
  try {
    const metrics = performanceService.exportMetrics();
    
    // Set appropriate headers for download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="performance-metrics-${Date.now()}.json"`);
    
    res.json(metrics);
  } catch (error) {
    logger.error('Error exporting metrics:', error);
    res.status(500).json({ error: 'Failed to export metrics' });
  }
});

// Clear old metrics (admin only)
router.delete('/metrics', authenticateToken, requireAdmin, (req, res) => {
  try {
    const olderThan = req.query.olderThan ? parseInt(req.query.olderThan as string) : 3600000; // 1 hour default
    
    performanceService.clearOldMetrics(olderThan);
    
    res.json({ 
      message: 'Old metrics cleared successfully',
      olderThan,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error clearing metrics:', error);
    res.status(500).json({ error: 'Failed to clear metrics' });
  }
});

// Performance dashboard endpoint (returns HTML for simple monitoring)
router.get('/dashboard', authenticateToken, requireAdmin, (req, res) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Havruta Performance Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric-card { 
            border: 1px solid #ddd; 
            border-radius: 8px; 
            padding: 15px; 
            margin: 10px 0; 
            background: #f9f9f9; 
        }
        .metric-title { font-weight: bold; color: #333; }
        .metric-value { font-size: 1.2em; color: #007bff; }
        .error { color: #dc3545; }
        .warning { color: #ffc107; }
        .success { color: #28a745; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
    </style>
    <script>
        async function loadMetrics() {
            try {
                const response = await fetch('/api/performance/metrics');
                const data = await response.json();
                
                document.getElementById('general-metrics').innerHTML = \`
                    <div class="metric-card">
                        <div class="metric-title">General Performance</div>
                        <div>Total Operations: <span class="metric-value">\${data.general.totalMetrics}</span></div>
                        <div>Average Duration: <span class="metric-value">\${data.general.averageDuration.toFixed(2)}ms</span></div>
                        <div>Error Rate: <span class="metric-value \${data.general.errorRate > 5 ? 'error' : 'success'}">\${data.general.errorRate.toFixed(2)}%</span></div>
                    </div>
                \`;
                
                document.getElementById('api-metrics').innerHTML = \`
                    <div class="metric-card">
                        <div class="metric-title">API Performance</div>
                        <div>Total Requests: <span class="metric-value">\${data.api.totalRequests}</span></div>
                        <div>Average Response Time: <span class="metric-value \${data.api.averageResponseTime > 200 ? 'warning' : 'success'}">\${data.api.averageResponseTime.toFixed(2)}ms</span></div>
                        <div>Error Rate: <span class="metric-value \${data.api.errorRate > 5 ? 'error' : 'success'}">\${data.api.errorRate.toFixed(2)}%</span></div>
                    </div>
                \`;
                
                document.getElementById('db-metrics').innerHTML = \`
                    <div class="metric-card">
                        <div class="metric-title">Database Performance</div>
                        <div>Total Queries: <span class="metric-value">\${data.database.totalQueries}</span></div>
                        <div>Average Query Time: <span class="metric-value \${data.database.averageQueryTime > 100 ? 'warning' : 'success'}">\${data.database.averageQueryTime.toFixed(2)}ms</span></div>
                        <div>Error Rate: <span class="metric-value \${data.database.errorRate > 1 ? 'error' : 'success'}">\${data.database.errorRate.toFixed(2)}%</span></div>
                    </div>
                \`;
                
            } catch (error) {
                console.error('Failed to load metrics:', error);
            }
        }
        
        // Load metrics on page load and refresh every 30 seconds
        window.onload = () => {
            loadMetrics();
            setInterval(loadMetrics, 30000);
        };
    </script>
</head>
<body>
    <h1>Havruta Performance Dashboard</h1>
    <p>Real-time performance metrics (auto-refreshes every 30 seconds)</p>
    
    <div class="grid">
        <div id="general-metrics">Loading...</div>
        <div id="api-metrics">Loading...</div>
        <div id="db-metrics">Loading...</div>
    </div>
    
    <div class="metric-card">
        <div class="metric-title">Actions</div>
        <button onclick="loadMetrics()">Refresh Metrics</button>
        <button onclick="window.open('/api/performance/export', '_blank')">Export Metrics</button>
    </div>
</body>
</html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

export default router;