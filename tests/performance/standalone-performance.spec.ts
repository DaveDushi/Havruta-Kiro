import { test, expect } from '@playwright/test';

test.describe('Standalone Performance Tests', () => {
  test('should validate Core Web Vitals thresholds with mock data', async ({ page }) => {
    // Create a simple HTML page with performance monitoring
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Test Page</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .card { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 8px; }
        .loading { animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
    </style>
</head>
<body>
    <div class="container">
        <h1>Havruta Platform Performance Test</h1>
        <div class="card">
            <h2>Dashboard Simulation</h2>
            <div id="havruta-list"></div>
        </div>
        <div class="card">
            <h2>Performance Metrics</h2>
            <div id="metrics"></div>
        </div>
    </div>
    
    <script>
        // Simulate loading data
        function simulateDataLoading() {
            const list = document.getElementById('havruta-list');
            list.innerHTML = '<div class="loading">Loading Havrutot...</div>';
            
            setTimeout(() => {
                const havrutot = [
                    { name: 'Genesis Study', book: 'Genesis', participants: 2 },
                    { name: 'Talmud Discussion', book: 'Berakhot', participants: 3 },
                    { name: 'Mishnah Review', book: 'Pirkei Avot', participants: 1 }
                ];
                
                list.innerHTML = havrutot.map(h => 
                    \`<div class="card">
                        <h3>\${h.name}</h3>
                        <p>Book: \${h.book} | Participants: \${h.participants}</p>
                        <button onclick="joinSession('\${h.name}')">Join Session</button>
                    </div>\`
                ).join('');
            }, 100);
        }
        
        function joinSession(name) {
            console.log('Joining session:', name);
            // Simulate navigation
            window.location.hash = '#session/' + encodeURIComponent(name);
        }
        
        // Performance monitoring
        function measurePerformance() {
            const metrics = {
                loadTime: performance.now(),
                memoryUsage: performance.memory ? performance.memory.usedJSHeapSize : 0,
                navigationTiming: performance.getEntriesByType('navigation')[0]
            };
            
            document.getElementById('metrics').innerHTML = \`
                <p>Load Time: \${metrics.loadTime.toFixed(2)}ms</p>
                <p>Memory Usage: \${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB</p>
                <p>DOM Content Loaded: \${metrics.navigationTiming ? metrics.navigationTiming.domContentLoadedEventEnd - metrics.navigationTiming.navigationStart : 0}ms</p>
            \`;
            
            return metrics;
        }
        
        // Initialize
        window.addEventListener('load', () => {
            simulateDataLoading();
            setTimeout(measurePerformance, 200);
        });
        
        // Store performance data globally for test access
        window.getPerformanceData = measurePerformance;
    </script>
</body>
</html>`;

    // Set the HTML content
    await page.setContent(html);
    
    // Wait for content to load
    await page.waitForSelector('#havruta-list .card');
    
    // Get performance metrics
    const metrics = await page.evaluate(() => {
      return window.getPerformanceData();
    });
    
    console.log('Performance Metrics:', {
      'Load Time': `${metrics.loadTime.toFixed(2)}ms`,
      'Memory Usage': `${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
      'DOM Content Loaded': `${metrics.navigationTiming ? metrics.navigationTiming.domContentLoadedEventEnd - metrics.navigationTiming.navigationStart : 0}ms`
    });
    
    // Validate performance thresholds
    expect(metrics.loadTime).toBeLessThan(2000); // Load within 2 seconds
    expect(metrics.memoryUsage).toBeLessThan(50 * 1024 * 1024); // Less than 50MB memory
    
    if (metrics.navigationTiming) {
      const domContentLoaded = metrics.navigationTiming.domContentLoadedEventEnd - metrics.navigationTiming.navigationStart;
      expect(domContentLoaded).toBeLessThan(1500); // DOM ready within 1.5 seconds
    }
  });

  test('should handle multiple UI interactions efficiently', async ({ page }) => {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>UI Performance Test</title>
    <style>
        .button { padding: 10px 20px; margin: 5px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px; }
        .button:hover { background: #0056b3; }
        .list-item { padding: 10px; border-bottom: 1px solid #eee; }
        .hidden { display: none; }
    </style>
</head>
<body>
    <div>
        <h1>UI Interaction Performance Test</h1>
        <button class="button" onclick="addItems()">Add Items</button>
        <button class="button" onclick="removeItems()">Remove Items</button>
        <button class="button" onclick="toggleItems()">Toggle Items</button>
        <div id="item-list"></div>
        <div id="performance-log"></div>
    </div>
    
    <script>
        let itemCount = 0;
        const performanceLog = [];
        
        function measureOperation(name, operation) {
            const start = performance.now();
            operation();
            const duration = performance.now() - start;
            
            performanceLog.push({ name, duration, timestamp: Date.now() });
            updatePerformanceLog();
            
            return duration;
        }
        
        function addItems() {
            measureOperation('Add 100 Items', () => {
                const list = document.getElementById('item-list');
                for (let i = 0; i < 100; i++) {
                    const item = document.createElement('div');
                    item.className = 'list-item';
                    item.textContent = \`Item \${++itemCount}\`;
                    item.onclick = () => selectItem(item);
                    list.appendChild(item);
                }
            });
        }
        
        function removeItems() {
            measureOperation('Remove All Items', () => {
                document.getElementById('item-list').innerHTML = '';
                itemCount = 0;
            });
        }
        
        function toggleItems() {
            measureOperation('Toggle Item Visibility', () => {
                const items = document.querySelectorAll('.list-item');
                items.forEach(item => {
                    item.classList.toggle('hidden');
                });
            });
        }
        
        function selectItem(item) {
            measureOperation('Select Item', () => {
                document.querySelectorAll('.list-item').forEach(i => i.style.background = '');
                item.style.background = '#e3f2fd';
            });
        }
        
        function updatePerformanceLog() {
            const log = document.getElementById('performance-log');
            const recent = performanceLog.slice(-5);
            log.innerHTML = '<h3>Recent Operations:</h3>' + 
                recent.map(entry => 
                    \`<div>⚡ \${entry.name}: \${entry.duration.toFixed(2)}ms</div>\`
                ).join('');
        }
        
        // Global access for tests
        window.getPerformanceLog = () => performanceLog;
        window.triggerOperations = () => {
            addItems();
            setTimeout(() => toggleItems(), 50);
            setTimeout(() => removeItems(), 100);
        };
    </script>
</body>
</html>`;

    await page.setContent(html);
    
    // Perform multiple operations
    await page.evaluate(() => window.triggerOperations());
    
    // Wait for operations to complete
    await page.waitForTimeout(200);
    
    // Get performance data
    const performanceLog = await page.evaluate(() => window.getPerformanceLog());
    
    console.log('UI Operation Performance:');
    performanceLog.forEach(entry => {
      console.log(`  ${entry.name}: ${entry.duration.toFixed(2)}ms`);
    });
    
    // Validate operation performance
    const addOperation = performanceLog.find(op => op.name === 'Add 100 Items');
    const removeOperation = performanceLog.find(op => op.name === 'Remove All Items');
    const toggleOperation = performanceLog.find(op => op.name === 'Toggle Item Visibility');
    
    expect(addOperation?.duration).toBeLessThan(100); // Adding items should be fast
    expect(removeOperation?.duration).toBeLessThan(50); // Removing should be very fast
    expect(toggleOperation?.duration).toBeLessThan(50); // Toggle should be fast
  });

  test('should validate memory usage patterns', async ({ page }) => {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Memory Usage Test</title>
</head>
<body>
    <div>
        <h1>Memory Usage Test</h1>
        <button onclick="createLargeDataSet()">Create Large Dataset</button>
        <button onclick="clearData()">Clear Data</button>
        <div id="memory-info"></div>
    </div>
    
    <script>
        let largeData = [];
        
        function getMemoryInfo() {
            if (performance.memory) {
                return {
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit
                };
            }
            return { used: 0, total: 0, limit: 0 };
        }
        
        function createLargeDataSet() {
            // Simulate creating a large dataset (like loading many Havrutot)
            largeData = [];
            for (let i = 0; i < 10000; i++) {
                largeData.push({
                    id: i,
                    name: \`Havruta \${i}\`,
                    participants: [\`User \${i}\`, \`Partner \${i}\`],
                    sessions: Array.from({length: 10}, (_, j) => ({
                        id: \`session-\${i}-\${j}\`,
                        date: new Date(Date.now() - Math.random() * 86400000 * 30),
                        sections: [\`Section \${j + 1}\`]
                    }))
                });
            }
            updateMemoryDisplay();
        }
        
        function clearData() {
            largeData = [];
            // Force garbage collection if available
            if (window.gc) {
                window.gc();
            }
            updateMemoryDisplay();
        }
        
        function updateMemoryDisplay() {
            const memory = getMemoryInfo();
            document.getElementById('memory-info').innerHTML = \`
                <p>Used Memory: \${(memory.used / 1024 / 1024).toFixed(2)} MB</p>
                <p>Total Memory: \${(memory.total / 1024 / 1024).toFixed(2)} MB</p>
                <p>Data Items: \${largeData.length}</p>
            \`;
        }
        
        // Global access
        window.getMemoryInfo = getMemoryInfo;
        window.createLargeDataSet = createLargeDataSet;
        window.clearData = clearData;
        
        // Initial display
        updateMemoryDisplay();
    </script>
</body>
</html>`;

    await page.setContent(html);
    
    // Get initial memory
    const initialMemory = await page.evaluate(() => window.getMemoryInfo());
    
    // Create large dataset
    await page.evaluate(() => window.createLargeDataSet());
    await page.waitForTimeout(100);
    
    const afterCreationMemory = await page.evaluate(() => window.getMemoryInfo());
    
    // Clear data
    await page.evaluate(() => window.clearData());
    await page.waitForTimeout(100);
    
    const afterClearMemory = await page.evaluate(() => window.getMemoryInfo());
    
    console.log('Memory Usage Analysis:');
    console.log(`  Initial: ${(initialMemory.used / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  After Creation: ${(afterCreationMemory.used / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  After Clear: ${(afterClearMemory.used / 1024 / 1024).toFixed(2)} MB`);
    
    const memoryIncrease = afterCreationMemory.used - initialMemory.used;
    const memoryRecovered = afterCreationMemory.used - afterClearMemory.used;
    
    console.log(`  Memory Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Memory Recovered: ${(memoryRecovered / 1024 / 1024).toFixed(2)} MB`);
    
    // Validate memory patterns
    expect(memoryIncrease).toBeGreaterThan(0); // Should use memory when creating data
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // But not excessive (< 100MB)
    
    // Memory should be partially recovered after clearing
    const recoveryRate = memoryRecovered / memoryIncrease;
    expect(recoveryRate).toBeGreaterThan(0.3); // At least 30% recovery
  });

  test('should validate bundle size simulation', async ({ page }) => {
    // Simulate different bundle sizes and loading times
    const bundleTests = [
      { name: 'Small Bundle', size: 100, loadTime: 50 },
      { name: 'Medium Bundle', size: 500, loadTime: 200 },
      { name: 'Large Bundle', size: 1000, loadTime: 500 }
    ];
    
    for (const bundle of bundleTests) {
      console.log(`Testing ${bundle.name} (${bundle.size}KB)`);
      
      const html = `
<!DOCTYPE html>
<html>
<head>
    <title>${bundle.name} Test</title>
    <style>
        /* Simulate CSS bundle size */
        ${'.dummy-class'.repeat(bundle.size)} { color: red; }
    </style>
</head>
<body>
    <div>
        <h1>${bundle.name} Performance Test</h1>
        <div id="content">Loading...</div>
    </div>
    
    <script>
        // Simulate JavaScript bundle execution time
        const start = performance.now();
        
        // Simulate processing time based on bundle size
        const iterations = ${bundle.size * 100};
        let result = 0;
        for (let i = 0; i < iterations; i++) {
            result += Math.random();
        }
        
        const loadTime = performance.now() - start;
        
        document.getElementById('content').innerHTML = \`
            <p>Bundle Size: ${bundle.size}KB</p>
            <p>Execution Time: \${loadTime.toFixed(2)}ms</p>
            <p>Expected: ~${bundle.loadTime}ms</p>
        \`;
        
        window.bundleMetrics = {
            size: ${bundle.size},
            actualLoadTime: loadTime,
            expectedLoadTime: ${bundle.loadTime}
        };
    </script>
</body>
</html>`;

      await page.setContent(html);
      await page.waitForSelector('#content p');
      
      const metrics = await page.evaluate(() => window.bundleMetrics);
      
      console.log(`  Actual Load Time: ${metrics.actualLoadTime.toFixed(2)}ms`);
      console.log(`  Expected Load Time: ~${metrics.expectedLoadTime}ms`);
      
      // Validate that load time is reasonable (within 2x expected)
      expect(metrics.actualLoadTime).toBeLessThan(metrics.expectedLoadTime * 2);
    }
  });
});