const logger = require('../utils/logger');

class AuthManager {
    constructor(config = {}) {
        this.config = config;
        this.isAuthenticated = false;
    }

    async login(page, credentials) {
        if (!this.config.enabled) {
            logger.info('🔓 Authentication disabled');
            return true;
        }

        if (this.isAuthenticated) {
            logger.info('✅ Already authenticated');
            return true;
        }

        try {
            logger.info('🔐 Starting authentication process...');
            
            // Navigate to login page if needed
            if (this.config.loginUrl && !page.url().includes(this.config.loginUrl)) {
                await page.goto(this.config.loginUrl);
            }

            // Wait for login form
            await page.waitForSelector(this.config.loginSelectors.username || 'input[type="text"]', {
                timeout: 10000
            });

            // Fill username
            const usernameSelector = this.config.loginSelectors.username || 'input[type="text"]';
            await page.fill(usernameSelector, credentials.username);
            await page.waitForTimeout(500);

            // Fill password
            const passwordSelector = this.config.loginSelectors.password || 'input[type="password"]';
            await page.fill(passwordSelector, credentials.password);
            await page.waitForTimeout(500);

            // Click submit button
            const submitSelector = this.config.loginSelectors.submit || 'button[type="submit"]';
            await page.click(submitSelector);

            // Wait for authentication to complete
            await this.waitForAuthComplete(page);
            
            this.isAuthenticated = true;
            logger.info('✅ Authentication successful');
            return true;

        } catch (error) {
            logger.error('❌ Authentication failed:', error);
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    async waitForAuthComplete(page) {
        // Convert string indicators to functions
        const createIndicatorFunction = (indicator) => {
            if (typeof indicator === 'function') {
                return indicator;
            }
            if (typeof indicator === 'string') {
                return () => page.evaluate(indicator);
            }
            return null;
        };

        const defaultIndicators = [
            () => page.url().includes('#/dashboard'),
            () => page.url().includes('/dashboard'),
            () => !page.url().includes('/login')
        ];

        const configIndicators = (this.config.successIndicators || [])
            .map(createIndicatorFunction)
            .filter(Boolean);

        const successIndicators = configIndicators.length > 0 ? configIndicators : defaultIndicators;

        const maxWaitTime = 10000;
        const checkInterval = 500;
        const maxChecks = maxWaitTime / checkInterval;
        
        for (let i = 0; i < maxChecks; i++) {
            for (const indicator of successIndicators) {
                try {
                    if (await indicator()) {
                        logger.info('✅ Login redirect detected');
                        await page.waitForTimeout(2000); // Wait for page to stabilize
                        return;
                    }
                } catch (e) {
                    // Indicator failed, try next one
                }
            }
            await page.waitForTimeout(checkInterval);
        }

        logger.warn('⚠️  Login success indicators not detected, continuing anyway');
    }

    async logout(page) {
        // Implement logout logic if needed
        this.isAuthenticated = false;
        logger.info('🔒 Logged out');
    }

    reset() {
        this.isAuthenticated = false;
    }
}

module.exports = AuthManager;