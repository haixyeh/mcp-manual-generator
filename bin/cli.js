#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const ScreenshotTool = require('../src/tools/screenshot');
const ManualGenerator = require('../src/tools/manual');
const ConfigLoader = require('../src/utils/config-loader');
const package = require('../package.json');

// Version
program.version(package.version);

// Init command
program
    .command('init')
    .description('Initialize a new configuration file')
    .option('-o, --output <path>', 'Output path for config file', './mcp-manual.config.json')
    .action(async (options) => {
        try {
            console.log(chalk.blue('🚀 Initializing configuration...'));
            
            const configLoader = new ConfigLoader();
            await configLoader.saveExample(options.output);
            
            console.log(chalk.green(`✅ Configuration file created: ${options.output}`));
            console.log(chalk.gray('Edit this file to customize your screenshot workflow'));
        } catch (error) {
            console.error(chalk.red('❌ Failed to initialize:'), error.message);
            process.exit(1);
        }
    });

// Capture command
program
    .command('capture')
    .description('Capture screenshots based on configuration')
    .option('-c, --config <path>', 'Configuration file path', './mcp-manual.config.json')
    .option('-o, --output <dir>', 'Output directory for screenshots')
    .option('--headless', 'Run in headless mode')
    .option('--no-headless', 'Run with browser visible')
    .action(async (options) => {
        try {
            console.log(chalk.blue('📸 Starting screenshot capture...'));
            
            // Load configuration
            const configLoader = new ConfigLoader();
            const config = await configLoader.load(options.config);
            
            // Override options
            if (options.output) {
                config.outputDir = options.output;
            }
            if (options.headless !== undefined) {
                config.browser = config.browser || {};
                config.browser.headless = options.headless;
            }
            
            // Load environment variables from .env file if exists
            const envPath = path.join(process.cwd(), '.env');
            if (await fs.pathExists(envPath)) {
                require('dotenv').config({ path: envPath });
            }
            
            // Create screenshot tool
            const screenshotTool = new ScreenshotTool(config);
            await screenshotTool.initialize();
            
            try {
                // Capture screenshots
                const results = await screenshotTool.captureAll(config.screenshots);
                
                // Generate report
                const report = await screenshotTool.generateReport();
                
                // Display summary
                console.log(chalk.green('\n✅ Screenshot capture complete!'));
                console.log(chalk.gray(`Total: ${report.summary.total}`));
                console.log(chalk.green(`Successful: ${report.summary.successful}`));
                if (report.summary.failed > 0) {
                    console.log(chalk.red(`Failed: ${report.summary.failed}`));
                }
                console.log(chalk.gray(`\nScreenshots saved to: ${config.outputDir}`));
                console.log(chalk.gray(`Report: ${config.outputDir}/screenshot_report.json`));
                
            } finally {
                await screenshotTool.cleanup();
            }
            
        } catch (error) {
            console.error(chalk.red('❌ Capture failed:'), error.message);
            process.exit(1);
        }
    });

// Generate command
program
    .command('generate')
    .description('Generate user manual from screenshots')
    .option('-s, --screenshots <dir>', 'Screenshots directory', './screenshots')
    .option('-o, --output <path>', 'Output file path', './manual.md')
    .option('-t, --template <name>', 'Template name or path', 'default')
    .option('-m, --metadata <json>', 'Additional metadata (JSON string)')
    .action(async (options) => {
        try {
            console.log(chalk.blue('📝 Generating user manual...'));
            
            // Parse metadata if provided
            let metadata = {};
            if (options.metadata) {
                try {
                    metadata = JSON.parse(options.metadata);
                } catch (e) {
                    console.warn(chalk.yellow('⚠️  Invalid metadata JSON, ignoring'));
                }
            }
            
            // Create manual generator
            const generator = new ManualGenerator({
                screenshotDir: options.screenshots,
                outputPath: options.output,
                template: options.template,
                metadata
            });
            
            // Generate manual
            const result = await generator.generate();
            
            console.log(chalk.green('\n✅ Manual generated successfully!'));
            console.log(chalk.gray(`Output: ${result.outputPath}`));
            console.log(chalk.gray(`Screenshots: ${result.screenshotCount}`));
            console.log(chalk.gray(`Size: ${result.size}`));
            
        } catch (error) {
            console.error(chalk.red('❌ Generation failed:'), error.message);
            process.exit(1);
        }
    });

// Run command (capture + generate)
program
    .command('run')
    .description('Run complete workflow (capture screenshots + generate manual)')
    .option('-c, --config <path>', 'Configuration file path', './mcp-manual.config.json')
    .option('--headless', 'Run in headless mode')
    .option('--no-headless', 'Run with browser visible')
    .action(async (options) => {
        try {
            console.log(chalk.blue('🚀 Running complete workflow...'));
            
            // Step 1: Capture screenshots
            console.log(chalk.blue('\n📸 Step 1: Capturing screenshots...'));
            
            const configLoader = new ConfigLoader();
            const config = await configLoader.load(options.config);
            
            if (options.headless !== undefined) {
                config.browser = config.browser || {};
                config.browser.headless = options.headless;
            }
            
            // Load environment variables
            const envPath = path.join(process.cwd(), '.env');
            if (await fs.pathExists(envPath)) {
                require('dotenv').config({ path: envPath });
            }
            
            const screenshotTool = new ScreenshotTool(config);
            await screenshotTool.initialize();
            
            try {
                await screenshotTool.captureAll(config.screenshots);
                await screenshotTool.generateReport();
            } finally {
                await screenshotTool.cleanup();
            }
            
            // Step 2: Generate manual
            console.log(chalk.blue('\n📝 Step 2: Generating manual...'));
            
            const generator = new ManualGenerator({
                screenshotDir: config.outputDir,
                outputPath: config.manual?.output || './manual.md',
                template: config.manual?.template || 'default',
                metadata: config.manual?.metadata || {}
            });
            
            const result = await generator.generate();
            
            console.log(chalk.green('\n✅ Workflow complete!'));
            console.log(chalk.gray(`Manual: ${result.outputPath}`));
            
        } catch (error) {
            console.error(chalk.red('❌ Workflow failed:'), error.message);
            process.exit(1);
        }
    });

// Serve command
program
    .command('serve')
    .description('Start MCP server')
    .action(() => {
        console.log(chalk.blue('🚀 Starting MCP server...'));
        console.log(chalk.gray('Configure your MCP client to connect to this server'));
        console.log(chalk.gray('Press Ctrl+C to stop the server'));
        
        // Start the server
        require('../src/server');
    });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command specified
if (!process.argv.slice(2).length) {
    program.outputHelp();
}