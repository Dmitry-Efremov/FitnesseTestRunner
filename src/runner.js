//
// Run Fitnesse tests
//

const fetch = require( "node-fetch" )
const xml2js = require( "xml2js" )

const executor = require( "./executor.js" )
const logger = require( "./logger.js" )

const namesQuery = "names&Recursive&LeafOnly"
const propertiesQuery = "properties&format=json"
const testQuery = "suite&format=junit"


const httpGetText = async ( url ) => {

  return await ( await fetch( url ) ).text()
}

const httpGetJson = async ( url ) => {

  return await ( await fetch( url ) ).json()
}

const parseXml = ( xml ) => {

  return new Promise( ( resolve, reject ) => {

    xml2js.parseString( xml, ( err, result ) => { if ( !err ) { resolve( result ) } else { reject( err ) } } )
  })
}

const results = {

  testsuite: {

    $: {

      tests: 0,
      failures: 0,
      disabled: 0,
      errors: 0,
      time: 0.0
    },

    testcase: []
  }
}

const appendTestCase = ( testSuite, testCase ) => {

  testSuite.testcase.push( testCase.testcase[ 0 ] )

  testSuite.$.tests += parseInt( testCase.$.tests )
  testSuite.$.failures += parseInt( testCase.$.failures )
  testSuite.$.disabled += parseInt( testCase.$.disabled )
  testSuite.$.errors += parseInt( testCase.$.errors )
  testSuite.$.time += parseFloat( testCase.$.time )
}

const runTest = async ( executor, page ) => {

  try {

    const pageUrl = `http://${ executor }/${ page }`

    logger.info( `${ page }: querying properties ...` )
    const testProperties = await httpGetJson( `${ pageUrl }?${ propertiesQuery }` )

    if ( testProperties.Test ) {

      if ( testProperties.Prune ) {

        logger.info( `${ page } is a test, but should be skipped, skipping it` )
      }
      else {

        logger.info( `${ page }: executing test ...` )

        const testResult = await httpGetText( `${ pageUrl }?${ testQuery }` )
        const testResultJson = await parseXml( testResult )

        logger.info( `${ page }: test results - %j`, testResultJson )

        appendTestCase( results.testsuite, testResultJson.testsuite )
      }
    }
    else {

      logger.info( `${ page } is not a test, skipping it` )
    }
  }
  catch( err ) {

    logger.error( `${ page }: %s`, err )
    return false
  }

  return true
}

module.exports = async ( executors, suite ) => {

  logger.info( `Querying pages on "${ executors[ 0 ] }" ...` )
  const pages = ( await httpGetText( `http://${ executors[ 0 ] }/${ suite }?${ namesQuery }` ) ).split( "\n" ).map( ( value ) => { return `${ suite }.${ value }` } )
  logger.info( `Pages found: ${ pages.length }` )

  results.testsuite.$.name = suite

  await executor( executors, pages, runTest )

  const builder = new xml2js.Builder()
  const xmlResults = builder.buildObject( results )

  return xmlResults
}
