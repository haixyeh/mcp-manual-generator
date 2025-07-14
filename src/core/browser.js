const { chromium } = require('playwright');
const logger = require('../utils/logger');

class BrowserManager {
    constructor(options = {}) {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.options = {
            headless: options.headless !== false,
            slowMo: options.slowMo || 0,
            viewport: options.viewport || { width: 1920, height: 1080 },
            timeout: options.timeout || 30000,
            ...options
        };
    }

    async init() {
        try {
            logger.info('🚀 Launching browser...');
            this.browser = await chromium.launch({
                headless: this.options.headless,
                slowMo: this.options.slowMo
            });

            this.context = await this.browser.newContext({
                viewport: this.options.viewport,
                locale: this.options.locale || 'zh-TW',
                timezoneId: this.options.timezoneId || 'Asia/Taipei'
            });

            this.page = await this.context.newPage();
            this.page.setDefaultTimeout(this.options.timeout);

            logger.info('✅ Browser initialized successfully');
            return this.page;
        } catch (error) {
            logger.error('Failed to initialize browser:', error);
            throw error;
        }
    }

    async navigate(url, waitFor) {
        try {
            logger.info(`📍 Navigating to: ${url}`);
            await this.page.goto(url, {
                waitUntil: 'networkidle',
                timeout: this.options.timeout
            });

            if (waitFor) {
                await this.waitForElement(waitFor);
            }

            logger.info('✅ Navigation successful');
        } catch (error) {
            logger.error(`Navigation failed for ${url}:`, error);
            throw error;
        }
    }

    async waitForElement(selector, options = {}) {
        const timeout = options.timeout || 10000;
        const selectors = Array.isArray(selector) ? selector : selector.split(', ');
        
        logger.debug(`⏳ Waiting for elements: ${selectors.join(', ')}`);
        
        for (const sel of selectors) {
            try {
                await this.page.waitForSelector(sel.trim(), { 
                    timeout: timeout / selectors.length,
                    state: options.state || 'visible'
                });
                logger.debug(`✅ Found element: ${sel}`);
                return sel;
            } catch (e) {
                logger.debug(`⚠️  Element not found: ${sel}`);
            }
        }
        
        logger.warn(`⚠️  None of the selectors found, using fallback wait`);
        await this.page.waitForTimeout(2000);
    }

    async screenshot(path, options = {}) {
        try {
            const screenshotOptions = {
                path,
                fullPage: options.fullPage !== false,
                ...options
            };

            await this.page.screenshot(screenshotOptions);
            logger.info(`📸 Screenshot saved: ${path}`);
            return path;
        } catch (error) {
            logger.error(`Screenshot failed for ${path}:`, error);
            throw error;
        }
    }

    async addStyleOverrides(styles) {
        if (!styles) return;
        
        try {
            await this.page.addStyleTag({
                content: styles
            });
            logger.debug('Style overrides applied');
        } catch (error) {
            logger.warn('Failed to apply style overrides:', error);
        }
    }

    async executeScript(script) {
        if (!script) return;
        
        try {
            const result = await this.page.evaluate(script);
            logger.debug('Script executed successfully');
            return result;
        } catch (error) {
            logger.warn('Failed to execute script:', error);
        }
    }

    async getPageInfo() {
        return {
            url: this.page.url(),
            title: await this.page.title()
        };
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            logger.info('🔚 Browser closed');
            this.browser = null;
            this.context = null;
            this.page = null;
        }
    }

    isInitialized() {
        return !!this.browser && !!this.page;
    }
}

module.exports = BrowserManager;