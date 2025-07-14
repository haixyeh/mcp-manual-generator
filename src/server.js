#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const fs = require('fs-extra');
const path = require('path');
const ScreenshotTool = require('./tools/screenshot');
const ManualGenerator = require('./tools/manual');
const ConfigLoader = require('./utils/config-loader');
const logger = require('./utils/logger');

class MCPManualServer {
    constructor() {
        this.server = new Server(
            {
                name: 'mcp-manual-generator',
                version: '1.0.0',
                description: 'Automated screenshot capture and user manual generation MCP server'
            },
            {
                capabilities: {
                    tools: {},
                    resources: {}
                }
            }
        );

        this.screenshotTool = null;
        this.configLoader = new ConfigLoader();
        this.setupHandlers();
    }

    setupHandlers() {
        this.server.setRequestHandler('tools/list', async () => {
            return {
                tools: [
                    {
                        name: 'capture_screenshots',
                        description: 'Capture screenshots based on configuration',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                configPath: {
                                    type: 'string',
                                    description: 'Path to configuration file'
                                },
                                outputDir: {
                                    type: 'string',
                                    description: 'Output directory for screenshots'
                                },
                                screenshots: {
                                    type: 'array',
                                    description: 'Array of screenshot configurations (overrides config file)',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string' },
                                            url: { type: 'string' },
                                            description: { type: 'string' },
                                            waitFor: { type: 'string' },
                                            folder: { type: 'string' },
                                            requireAuth: { type: 'boolean' }
                                        },
                                        required: ['name', 'url']
                                    }
                                },
                                options: {
                                    type: 'object',
                                    description: 'Runtime options',
                                    properties: {
                                        headless: { type: 'boolean' },
                                        viewport: {
                                            type: 'object',
                                            properties: {
                                                width: { type: 'number' },
                                                height: { type: 'number' }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    {
                        name: 'generate_manual',
                        description: 'Generate user manual from screenshots',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                screenshotDir: {
                                    type: 'string',
                                    description: 'Directory containing screenshots'
                                },
                                template: {
                                    type: 'string',
                                    description: 'Template name or path'
                                },
                                outputPath: {
                                    type: 'string',
                                    description: 'Output file path for the manual'
                                },
                                metadata: {
                                    type: 'object',
                                    description: 'Additional metadata for manual generation',
                                    properties: {
                                        projectName: { type: 'string' },
                                        version: { type: 'string' },
                                        author: { type: 'string' }
                                    }
                                }
                            },
                            required: ['screenshotDir']
                        }
                    },
                    {
                        name: 'load_config',
                        description: 'Load and validate configuration file',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                configPath: {
                                    type: 'string',
                                    description: 'Path to configuration file'
                                }
                            },
                            required: ['configPath']
                        }
                    },
                    {
                        name: 'capture_single',
                        description: 'Capture a single screenshot',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                url: {
                                    type: 'string',
                                    description: 'URL to capture'
                                },
                                outputPath: {
                                    type: 'string',
                                    description: 'Output file path'
                                },
                                waitFor: {
                                    type: 'string',
                                    description: 'Selector to wait for'
                                },
                                fullPage: {
                                    type: 'boolean',
                                    description: 'Capture full page',
                                    default: true
                                }
                            },
                            required: ['url', 'outputPath']
                        }
                    }
                ]
            };
        });

        this.server.setRequestHandler('tools/execute', async (request) => {
            const { name, arguments: args } = request.params;

            try {
                logger.info(`Executing tool: ${name}`);
                
                switch (name) {
                    case 'capture_screenshots':
                        return await this.handleCaptureScreenshots(args);
                    case 'generate_manual':
                        return await this.handleGenerateManual(args);
                    case 'load_config':
                        return await this.handleLoadConfig(args);
                    case 'capture_single':
                        return await this.handleCaptureSingle(args);
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            } catch (error) {
                logger.error(`Tool execution failed: ${name}`, error);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${error.message}`
                        }
                    ],
                    isError: true
                };
            }
        });
    }

    async handleCaptureScreenshots(args) {
        let config = {};

        // Load configuration if path provided
        if (args.configPath) {
            config = await this.configLoader.load(args.configPath);
        }

        // Override with runtime arguments
        if (args.outputDir) {
            config.outputDir = args.outputDir;
        }

        if (args.screenshots) {
            config.screenshots = args.screenshots;
        }

        if (args.options) {
            config.browser = { ...config.browser, ...args.options };
        }

        // Validate we have screenshots to capture
        if (!config.screenshots || config.screenshots.length === 0) {
            throw new Error('No screenshots configured');
        }

        // Initialize screenshot tool
        this.screenshotTool = new ScreenshotTool(config);
        await this.screenshotTool.initialize();

        try {
            // Capture all screenshots
            const results = await this.screenshotTool.captureAll(config.screenshots);
            
            // Generate report
            const report = await this.screenshotTool.generateReport();

            return {
                content: [
                    {
                        type: 'text',
                        text: `Screenshots captured successfully!\n\nSummary:\n- Total: ${report.summary.total}\n- Successful: ${report.summary.successful}\n- Failed: ${report.summary.failed}\n\nReport saved to: ${config.outputDir}/screenshot_report.json`
                    }
                ]
            };
        } finally {
            await this.screenshotTool.cleanup();
        }
    }

    async handleGenerateManual(args) {
        const generator = new ManualGenerator({
            screenshotDir: args.screenshotDir,
            template: args.template,
            outputPath: args.outputPath,
            metadata: args.metadata
        });

        const result = await generator.generate();

        return {
            content: [
                {
                    type: 'text',
                    text: `Manual generated successfully!\n\nOutput: ${result.outputPath}\nScreenshots: ${result.screenshotCount}\nSize: ${result.size}`
                }
            ]
        };
    }

    async handleLoadConfig(args) {
        const config = await this.configLoader.load(args.configPath);
        const validation = await this.configLoader.validate(config);

        return {
            content: [
                {
                    type: 'text',
                    text: `Configuration loaded successfully!\n\nProject: ${config.project?.name || 'Unknown'}\nScreenshots: ${config.screenshots?.length || 0}\nValidation: ${validation.valid ? 'Passed' : 'Failed'}\n${validation.errors ? `Errors: ${validation.errors.join(', ')}` : ''}`
                }
            ]
        };
    }

    async handleCaptureSingle(args) {
        const tool = new ScreenshotTool({
            browser: { headless: true }
        });

        await tool.initialize();

        try {
            const screenshotConfig = {
                name: path.basename(args.outputPath, path.extname(args.outputPath)),
                url: args.url,
                waitFor: args.waitFor,
                fullPage: args.fullPage
            };

            await tool.captureScreenshot(screenshotConfig);

            // Ensure output directory exists
            await fs.ensureDir(path.dirname(args.outputPath));
            
            // Move screenshot to desired location
            const tempPath = tool.getResults()[0]?.path;
            if (tempPath && tempPath !== args.outputPath) {
                await fs.move(tempPath, args.outputPath, { overwrite: true });
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: `Screenshot captured successfully!\nOutput: ${args.outputPath}`
                    }
                ]
            };
        } finally {
            await tool.cleanup();
        }
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        
        logger.info('MCP Manual Generator Server started');

        // Cleanup on exit
        process.on('SIGINT', async () => {
            logger.info('Shutting down server...');
            if (this.screenshotTool) {
                await this.screenshotTool.cleanup();
            }
            process.exit(0);
        });
    }
}

// Run server if executed directly
if (require.main === module) {
    const server = new MCPManualServer();
    server.run().catch(error => {
        logger.error('Server failed to start:', error);
        process.exit(1);
    });
}

module.exports = MCPManualServer;