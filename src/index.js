#!/usr/bin/node

//
// Main module
//

const program = require( "commander" )
const format = require( "string-format" )
const path = require( "path" )

const runner = require( "./runner.js" )
const saver = require( "./saver.js" )
const logger = require( "./logger.js" )

program._name = " "

program
  .version( require( "../package.json" ).version, "-v, --version" )
  .description( "Run Fitnesse tests in parallel on several servers." )
  .usage( "[options]" )
  .option( "-t, --servers-template <template>", "Fitnesse servers template, host name with one template parameter expanded to digit, required, example: host{0}.somewhere.net:8080." )
  .option( "-c, --servers-count <count>", "Fitnesse servers count, required.", parseInt )
  .option( "-s, --suite <name>", "Tests suite name, required." )
  .option( "-p, --results-path <path>", "File system path to save results." )
  .option( "-f, --file-name <name>", "Results file/blob name.", "tests-results.xml" )
  .option( "-a, --storage-account <account>", "Azure storage account to save results." )
  .option( "-k, --storage-key <key>", "Azure storage account key." )
  .option( "-r, --storage-container <name>", "Azure storage container name." )
  .parse( process.argv )

if ( !program.serversTemplate || !program.serversCount || !program.suite ) {

  console.error( "\n  No required argument(s)." )
  program.outputHelp()
  process.exit( 1 )
}

const getExecutors = ( template, count ) => {

  const items = []

  for ( let i = 0; i < count; i++ ) {

    items.push( format( template, i ) )
  }

  return items
}

const suite = program.suite
const executors = getExecutors( program.serversTemplate, program.serversCount )

const main = async ( executors, suite ) => {

  let xmlResults = ""

  try {

    xmlResults = await runner( executors, suite )
  }
  catch( err ) {

    logger.error( `fatal, %s`, err )
    process.exit( 1 )
  }

  let saved = false

  if ( program.resultsPath ) {

    const resultsFile = path.join( program.resultsPath, program.fileName )

    await saver.saveToFile( resultsFile, xmlResults )
    saved  = true

    logger.info( `Results saved to file: %s`, resultsFile )
  }

  if ( program.storageAccount && program.storageKey && program.storageContainer ) {

    await saver.saveToAzure( program.storageAccount, program.storageKey, program.storageContainer, program.fileName, xmlResults )
    saved  = true

    logger.info( `Results saved to azure storage: %s/%s`, program.storageContainer, program.fileName )
  }

  if ( !saved ) {

    logger.info( `Results:\n%s`, xmlResults )
  }
}

try {

  main( executors, suite )
}
catch( err ) {

  logger.error( `fatal: %s`, err )
  process.exit( 1 )
}
