const fs = require('fs-extra');
const path = require('path');
const BrowserManager = require('../core/browser');
const AuthManager = require('../core/auth');
const logger = require('../utils/logger');

class ScreenshotTool {
    constructor(config = {}) {
        this.config = config;
        this.browserManager = new BrowserManager(config.browser || {});
        this.authManager = new AuthManager(config.auth || {});
        this.results = [];
    }

    async initialize() {
        await this.browserManager.init();
        return this.browserManager.page;
    }

    async captureScreenshot(screenshotConfig) {
        const page = this.browserManager.page;
        
        try {
            logger.info(`📸 Capturing: ${screenshotConfig.description || screenshotConfig.name}`);

            // Handle authentication if required
            if (screenshotConfig.requireAuth && this.config.auth?.enabled) {
                const credentials = this.resolveCredentials();
                await this.authManager.login(page, credentials);
            }

            // Build full URL
            const url = this.buildUrl(screenshotConfig.url);
            
            // Navigate to page
            await this.browserManager.navigate(url, screenshotConfig.waitFor);

            // Apply any custom styles
            if (screenshotConfig.styles) {
                await this.browserManager.addStyleOverrides(screenshotConfig.styles);
            }

            // Execute any custom scripts
            if (screenshotConfig.script) {
                await this.browserManager.executeScript(screenshotConfig.script);
            }

            // Additional wait if specified
            if (screenshotConfig.waitTime) {
                await page.waitForTimeout(screenshotConfig.waitTime);
            }

            // Ensure output directory exists
            const outputPath = this.buildOutputPath(screenshotConfig);
            await fs.ensureDir(path.dirname(outputPath));

            // Take screenshot
            await this.browserManager.screenshot(outputPath, {
                fullPage: screenshotConfig.fullPage !== false,
                clip: screenshotConfig.clip
            });

            // Record success
            this.results.push({
                name: screenshotConfig.name,
                description: screenshotConfig.description,
                path: outputPath,
                url: url,
                success: true,
                timestamp: new Date().toISOString()
            });

            return outputPath;

        } catch (error) {
            logger.error(`Failed to capture ${screenshotConfig.name}:`, error);
            
            // Record failure
            this.results.push({
                name: screenshotConfig.name,
                description: screenshotConfig.description,
                error: error.message,
                url: this.buildUrl(screenshotConfig.url),
                success: false,
                timestamp: new Date().toISOString()
            });

            if (this.config.failOnError) {
                throw error;
            }
            
            return null;
        }
    }

    async captureAll(screenshots) {
        logger.info(`🎬 Starting batch screenshot capture (${screenshots.length} items)`);
        
        const startTime = Date.now();
        
        for (const config of screenshots) {
            await this.captureScreenshot(config);
            
            // Delay between screenshots
            if (this.config.delayBetweenScreenshots) {
                await this.browserManager.page.waitForTimeout(this.config.delayBetweenScreenshots);
            }
        }

        const duration = (Date.now() - startTime) / 1000;
        const successful = this.results.filter(r => r.success).length;
        
        logger.info(`✅ Batch capture complete: ${successful}/${screenshots.length} successful (${duration}s)`);
        
        return this.results;
    }

    buildUrl(path) {
        const baseUrl = this.config.project?.baseUrl || 'http://localhost:3000';
        
        // If path is already a full URL, return as is
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }
        
        // Handle hash routing
        if (this.config.routing?.mode === 'hash') {
            // Remove leading slash if present for hash routing
            if (path.startsWith('/')) {
                path = path.substring(1);
            }
            // Add hash if not present
            if (!path.startsWith('#')) {
                path = '#/' + path;
            }
        } else {
            // Ensure path starts with / for history mode
            if (!path.startsWith('/')) {
                path = '/' + path;
            }
        }
        
        return baseUrl + path;
    }

    buildOutputPath(screenshotConfig) {
        const outputDir = this.config.outputDir || './screenshots';
        const folder = screenshotConfig.folder || '';
        const filename = `${screenshotConfig.name}.png`;
        
        return path.join(outputDir, folder, filename);
    }

    resolveCredentials() {
        const credentials = this.config.auth?.credentials || {};
        
        // Replace environment variable placeholders
        return {
            username: this.resolveEnvVar(credentials.username),
            password: this.resolveEnvVar(credentials.password)
        };
    }

    resolveEnvVar(value) {
        if (typeof value !== 'string') return value;
        
        // Check if value is an environment variable reference
        const match = value.match(/^\${(.+)}$/);
        if (match) {
            return process.env[match[1]] || '';
        }
        
        return value;
    }

    async generateReport() {
        const reportPath = path.join(
            this.config.outputDir || './screenshots',
            'screenshot_report.json'
        );

        const report = {
            timestamp: new Date().toISOString(),
            project: this.config.project,
            summary: {
                total: this.results.length,
                successful: this.results.filter(r => r.success).length,
                failed: this.results.filter(r => !r.success).length
            },
            results: this.results
        };

        await fs.writeJson(reportPath, report, { spaces: 2 });
        logger.info(`📊 Report saved: ${reportPath}`);
        
        return report;
    }

    async cleanup() {
        await this.browserManager.close();
        this.authManager.reset();
    }

    getResults() {
        return this.results;
    }
}

module.exports = ScreenshotTool;