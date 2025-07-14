const fs = require('fs-extra');
const path = require('path');
const Joi = require('joi');
const logger = require('./logger');

class ConfigLoader {
    constructor() {
        this.configSchema = this.createConfigSchema();
    }

    createConfigSchema() {
        return Joi.object({
            project: Joi.object({
                name: Joi.string().required(),
                version: Joi.string(),
                baseUrl: Joi.string().uri().required(),
                description: Joi.string()
            }).required(),

            auth: Joi.object({
                enabled: Joi.boolean().default(false),
                credentials: Joi.object({
                    username: Joi.string().required(),
                    password: Joi.string().required()
                }),
                loginUrl: Joi.string(),
                loginSelectors: Joi.object({
                    username: Joi.string(),
                    password: Joi.string(),
                    submit: Joi.string()
                }),
                successIndicators: Joi.array().items(Joi.string())
            }),

            routing: Joi.object({
                mode: Joi.string().valid('hash', 'history').default('history')
            }),

            browser: Joi.object({
                headless: Joi.boolean().default(true),
                slowMo: Joi.number().min(0),
                viewport: Joi.object({
                    width: Joi.number().min(320).default(1920),
                    height: Joi.number().min(240).default(1080)
                }),
                timeout: Joi.number().min(1000).default(30000),
                locale: Joi.string(),
                timezoneId: Joi.string()
            }),

            screenshots: Joi.array().items(
                Joi.object({
                    name: Joi.string().required(),
                    url: Joi.string().required(),
                    description: Joi.string(),
                    waitFor: Joi.string(),
                    waitTime: Joi.number().min(0),
                    folder: Joi.string(),
                    requireAuth: Joi.boolean().default(false),
                    fullPage: Joi.boolean().default(true),
                    clip: Joi.object({
                        x: Joi.number().required(),
                        y: Joi.number().required(),
                        width: Joi.number().required(),
                        height: Joi.number().required()
                    }),
                    styles: Joi.string(),
                    script: Joi.string()
                })
            ).required(),

            manual: Joi.object({
                template: Joi.string().default('default'),
                output: Joi.string().default('./manual.md'),
                includeTimestamp: Joi.boolean().default(true),
                metadata: Joi.object()
            }),

            outputDir: Joi.string().default('./screenshots'),
            delayBetweenScreenshots: Joi.number().min(0).default(2000),
            failOnError: Joi.boolean().default(false)
        });
    }

    async load(configPath) {
        logger.info(`Loading configuration from: ${configPath}`);

        if (!await fs.pathExists(configPath)) {
            throw new Error(`Configuration file not found: ${configPath}`);
        }

        const ext = path.extname(configPath).toLowerCase();
        let config;

        try {
            const content = await fs.readFile(configPath, 'utf8');
            
            if (ext === '.json') {
                config = JSON.parse(content);
            } else if (ext === '.js') {
                // Clear require cache for dynamic reload
                delete require.cache[path.resolve(configPath)];
                config = require(path.resolve(configPath));
            } else {
                throw new Error(`Unsupported configuration format: ${ext}`);
            }

            // Process environment variables
            config = this.processEnvironmentVariables(config);

            // Validate configuration
            const validation = await this.validate(config);
            if (!validation.valid) {
                throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
            }

            logger.info('✅ Configuration loaded successfully');
            return config;

        } catch (error) {
            logger.error('Failed to load configuration:', error);
            throw error;
        }
    }

    processEnvironmentVariables(config) {
        const processValue = (value) => {
            if (typeof value === 'string') {
                // Replace ${VAR_NAME} with environment variable
                return value.replace(/\${([^}]+)}/g, (match, varName) => {
                    return process.env[varName] || match;
                });
            } else if (Array.isArray(value)) {
                return value.map(item => processValue(item));
            } else if (value && typeof value === 'object') {
                const processed = {};
                for (const [key, val] of Object.entries(value)) {
                    processed[key] = processValue(val);
                }
                return processed;
            }
            return value;
        };

        return processValue(config);
    }

    async validate(config) {
        try {
            const validated = await this.configSchema.validateAsync(config, {
                abortEarly: false
            });

            return {
                valid: true,
                value: validated,
                errors: []
            };
        } catch (error) {
            const errors = error.details.map(detail => detail.message);
            return {
                valid: false,
                value: null,
                errors
            };
        }
    }

    async loadFromDirectory(dir) {
        const configFiles = ['config.json', 'config.js', 'mcp-manual.config.json', 'mcp-manual.config.js'];
        
        for (const file of configFiles) {
            const configPath = path.join(dir, file);
            if (await fs.pathExists(configPath)) {
                return await this.load(configPath);
            }
        }

        throw new Error(`No configuration file found in: ${dir}`);
    }

    async saveExample(outputPath) {
        const exampleConfig = {
            project: {
                name: "My Application",
                version: "1.0.0",
                baseUrl: "http://localhost:3000",
                description: "Application user manual"
            },
            auth: {
                enabled: true,
                credentials: {
                    username: "${TEST_USERNAME}",
                    password: "${TEST_PASSWORD}"
                },
                loginUrl: "/",
                loginSelectors: {
                    username: "input[type=\"text\"]",
                    password: "input[type=\"password\"]",
                    submit: "button[type=\"submit\"]"
                }
            },
            routing: {
                mode: "hash"
            },
            browser: {
                headless: false,
                viewport: {
                    width: 1920,
                    height: 1080
                }
            },
            screenshots: [
                {
                    name: "login",
                    url: "/",
                    description: "Login page",
                    waitFor: "input",
                    folder: "01_login"
                },
                {
                    name: "dashboard",
                    url: "/#/dashboard",
                    description: "Main dashboard",
                    waitFor: ".main-content",
                    folder: "02_main",
                    requireAuth: true
                }
            ],
            manual: {
                template: "default",
                output: "./USER_MANUAL.md",
                metadata: {
                    author: "Your Name"
                }
            },
            outputDir: "./screenshots"
        };

        await fs.writeJson(outputPath, exampleConfig, { spaces: 2 });
        logger.info(`Example configuration saved to: ${outputPath}`);
    }
}

module.exports = ConfigLoader;