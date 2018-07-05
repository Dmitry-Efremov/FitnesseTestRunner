//
// Logger
//

const winston = require( "winston" )
const format = winston.format

module.exports = winston.createLogger({

//  format: format.combine( format.timestamp(), format.colorize(), format.printf( info => `${info.timestamp} ${info.level}: ${info.message}` ) ),
  format: format.combine( format.colorize(), format.printf( info => `${info.level}: ${info.message}` ) ),
  transports: [ new winston.transports.Console() ]
})
