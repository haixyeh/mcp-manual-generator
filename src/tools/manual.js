const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');

class ManualGenerator {
    constructor(options = {}) {
        this.screenshotDir = options.screenshotDir || './screenshots';
        this.outputPath = options.outputPath || './manual.md';
        this.template = options.template || 'default';
        this.metadata = options.metadata || {};
        this.screenshots = {};
    }

    async generate() {
        logger.info('📝 Starting manual generation...');

        // Scan screenshots directory
        this.screenshots = await this.scanScreenshots();
        
        // Load template
        const templateContent = await this.loadTemplate();
        
        // Process template
        const manual = await this.processTemplate(templateContent);
        
        // Save manual
        await fs.writeFile(this.outputPath, manual, 'utf8');
        
        const stats = await fs.stat(this.outputPath);
        const result = {
            outputPath: this.outputPath,
            screenshotCount: this.countScreenshots(),
            size: `${(stats.size / 1024).toFixed(2)} KB`
        };

        logger.info(`✅ Manual generated: ${result.outputPath} (${result.size})`);
        
        return result;
    }

    async scanScreenshots() {
        if (!await fs.pathExists(this.screenshotDir)) {
            logger.warn(`Screenshot directory not found: ${this.screenshotDir}`);
            return {};
        }

        const screenshots = {};
        
        const scanDir = async (dir) => {
            const items = await fs.readdir(dir);
            
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = await fs.stat(fullPath);
                
                if (stat.isDirectory()) {
                    const dirName = item;
                    screenshots[dirName] = {};
                    
                    const subItems = await fs.readdir(fullPath);
                    for (const subItem of subItems) {
                        const subFullPath = path.join(fullPath, subItem);
                        const subStat = await fs.stat(subFullPath);
                        
                        if (subStat.isFile() && this.isImageFile(subItem)) {
                            const name = path.basename(subItem, path.extname(subItem));
                            const relativePath = path.relative(
                                process.cwd(),
                                subFullPath
                            ).replace(/\\/g, '/');
                            screenshots[dirName][name] = './' + relativePath;
                        }
                    }
                }
            }
        };

        await scanDir(this.screenshotDir);
        
        logger.info(`Found ${this.countScreenshots()} screenshots in ${Object.keys(screenshots).length} folders`);
        
        return screenshots;
    }

    isImageFile(filename) {
        const ext = path.extname(filename).toLowerCase();
        return ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext);
    }

    countScreenshots() {
        let count = 0;
        for (const folder of Object.values(this.screenshots)) {
            count += Object.keys(folder).length;
        }
        return count;
    }

    async loadTemplate() {
        // Check if template is a file path
        if (this.template.endsWith('.md')) {
            const templatePath = path.isAbsolute(this.template) 
                ? this.template 
                : path.resolve(process.cwd(), this.template);
                
            if (await fs.pathExists(templatePath)) {
                logger.info(`Loading template from: ${templatePath}`);
                return await fs.readFile(templatePath, 'utf8');
            }
        }

        // Load built-in template
        const builtInTemplate = await this.getBuiltInTemplate(this.template);
        if (builtInTemplate) {
            logger.info(`Using built-in template: ${this.template}`);
            return builtInTemplate;
        }

        // Fall back to default template
        logger.info('Using default template');
        return this.getDefaultTemplate();
    }

    async getBuiltInTemplate(name) {
        const templatePath = path.join(__dirname, '../../templates', `${name}.md`);
        
        if (await fs.pathExists(templatePath)) {
            return await fs.readFile(templatePath, 'utf8');
        }
        
        return null;
    }

    getDefaultTemplate() {
        return `# {{projectName}} - User Manual

> 📅 **Generated**: {{timestamp}}  
> 🤖 **Generator**: MCP Manual Generator v{{version}}  
> 📂 **Screenshots**: {{screenshotCount}} images

## Table of Contents

{{toc}}

---

## Overview

This manual provides comprehensive guidance for using {{projectName}}.

{{sections}}

---

## Additional Information

### Technical Support

For technical support, please contact the support team.

### Version History

- **{{version}}**: Current version

---

*This manual was automatically generated. For the most up-to-date information, please refer to the system itself.*
`;
    }

    async processTemplate(template) {
        let processed = template;

        // Replace metadata placeholders
        processed = this.replacePlaceholders(processed, {
            projectName: this.metadata.projectName || 'System',
            version: this.metadata.version || '1.0.0',
            author: this.metadata.author || 'Unknown',
            timestamp: new Date().toLocaleString('zh-TW'),
            screenshotCount: this.countScreenshots()
        });

        // Generate table of contents
        const toc = this.generateTOC();
        processed = processed.replace('{{toc}}', toc);

        // Generate sections
        const sections = this.generateSections();
        processed = processed.replace('{{sections}}', sections);

        // Process screenshot placeholders
        processed = this.processScreenshotPlaceholders(processed);

        return processed;
    }

    replacePlaceholders(text, data) {
        let result = text;
        
        for (const [key, value] of Object.entries(data)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, value);
        }
        
        return result;
    }

    generateTOC() {
        const toc = [];
        const folders = Object.keys(this.screenshots).sort();

        for (const folder of folders) {
            const sectionName = this.formatSectionName(folder);
            const anchor = this.toAnchor(sectionName);
            toc.push(`- [${sectionName}](#${anchor})`);
        }

        return toc.join('\n');
    }

    generateSections() {
        const sections = [];
        const folders = Object.keys(this.screenshots).sort();

        for (const folder of folders) {
            const sectionName = this.formatSectionName(folder);
            const screenshots = this.screenshots[folder];
            
            let section = `## ${sectionName}\n\n`;
            
            // Add section description if available
            const description = this.getSectionDescription(folder);
            if (description) {
                section += `${description}\n\n`;
            }

            // Add screenshots
            for (const [name, path] of Object.entries(screenshots)) {
                const screenshotTitle = this.formatScreenshotTitle(name);
                section += `### ${screenshotTitle}\n\n`;
                section += `![${screenshotTitle}](${path})\n\n`;
                
                // Add screenshot description if available
                const screenshotDesc = this.getScreenshotDescription(folder, name);
                if (screenshotDesc) {
                    section += `${screenshotDesc}\n\n`;
                }
            }

            sections.push(section);
        }

        return sections.join('\n---\n\n');
    }

    processScreenshotPlaceholders(text) {
        // Process folder-level placeholders like {{01_login}}
        for (const [folder, screenshots] of Object.entries(this.screenshots)) {
            const placeholder = `{{${folder}}}`;
            if (text.includes(placeholder)) {
                const content = this.generateFolderContent(folder, screenshots);
                text = text.replace(new RegExp(placeholder, 'g'), content);
            }
        }

        // Process individual screenshot placeholders like {{screenshot:login_page}}
        const screenshotRegex = /{{screenshot:(\w+)}}/g;
        text = text.replace(screenshotRegex, (match, name) => {
            for (const [folder, screenshots] of Object.entries(this.screenshots)) {
                if (screenshots[name]) {
                    return `![${this.formatScreenshotTitle(name)}](${screenshots[name]})`;
                }
            }
            return match; // Keep placeholder if screenshot not found
        });

        return text;
    }

    generateFolderContent(folder, screenshots) {
        const content = [];
        
        for (const [name, path] of Object.entries(screenshots)) {
            const title = this.formatScreenshotTitle(name);
            content.push(`### ${title}\n\n![${title}](${path})`);
        }

        return content.join('\n\n');
    }

    formatSectionName(folder) {
        // Remove number prefix and format name
        const name = folder.replace(/^\d+_/, '');
        return name
            .split(/[_-]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    formatScreenshotTitle(name) {
        return name
            .split(/[_-]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    toAnchor(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-');
    }

    getSectionDescription(folder) {
        // Override this method to provide custom section descriptions
        const descriptions = {
            '01_login': 'The login section covers authentication and access to the system.',
            '02_main': 'The main dashboard provides an overview of system status and key metrics.',
            '03_platform': 'Platform management includes configuration of system-wide settings.',
            '04_game': 'Game management allows configuration and control of game-related features.',
            '05_user': 'User management provides tools for managing users, roles, and permissions.',
            '06_campaign': 'Campaign management enables creation and management of marketing campaigns.',
            '07_other': 'Additional features and system utilities.'
        };

        return descriptions[folder] || '';
    }

    getScreenshotDescription(folder, name) {
        // Override this method to provide custom screenshot descriptions
        return '';
    }
}

module.exports = ManualGenerator;