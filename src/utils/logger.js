const winston = require('winston');
const path = require('path');

const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};

const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue'
};

winston.addColors(logColors);

const logger = winston.createLogger({
    levels: logLevels,
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'mcp-manual-generator' },
    transports: []
});

// Console transport for development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(({ level, message, timestamp, ...metadata }) => {
                let msg = `${timestamp} [${level}]: ${message}`;
                if (Object.keys(metadata).length > 0) {
                    msg += ` ${JSON.stringify(metadata)}`;
                }
                return msg;
            })
        )
    }));
}

// File transport for production
if (process.env.NODE_ENV === 'production') {
    logger.add(new winston.transports.File({
        filename: path.join('logs', 'error.log'),
        level: 'error'
    }));
    
    logger.add(new winston.transports.File({
        filename: path.join('logs', 'combined.log')
    }));
}

module.exports = logger;