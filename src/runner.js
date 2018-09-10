//
// Run Fitnesse tests
//

const http = require( "http" )
const xml2js = require( "xml2js" )
const retry = require( "async-retry" )
const _ = require( "underscore" )
const wait = require( "async-wait-until" )

const executor = require( "./executor.js" )
const logger = require( "./logger.js" )

const namesQuery = "names&Recursive&LeafOnly"
const propertiesQuery = "properties&format=json"
const testQuery = "suite&format=junit"

const httpRetryOptions = {

  retries: parseInt( process.env.HTTP_RETRIES || 5 ),
  minTimeout: parseInt( process.env.HTTP_RETRIES_MIN_TIMEOUT || 5000 ),
  maxTimeout: parseInt( process.env.HTTP_RETRIES_MAX_TIMEOUT || 10000 )
}

const testRetryOptions = {

  retries: parseInt( process.env.TEST_RETRIES || 5 ),
  minTimeout: parseInt( process.env.TEST_RETRIES_MIN_TIMEOUT || 10000 ),
  maxTimeout: parseInt( process.env.TEST_RETRIES_MAX_TIMEOUT || 30000 )
}

const failedTestRetries = parseInt( process.env.FAILED_TEST_RETRIES || 3 )
const failedTestRetryTimeout = parseInt( process.env.FAILED_TEST_RETRY_TIMEOUT || 5000 )

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


const httpFetch = ( url ) => {

  return new Promise( ( resolve, reject ) => {

    const req = http.request( url, ( res ) => {

      res.setEncoding('utf8')

      let data = ""

      if ( res.statusCode >= 400 ) {

        reject( `HTTP error, ${ res.statusCode }, ${ res.statusMessage }` )
        return
      }

      res.on( `data`, ( chunk ) => {

        data += chunk
      })

      res.on( `end`, () => {

        resolve( data )
      })
    })

    req.on( `error`, ( e ) => {} )

    req.end()
  })
}

const parseXml = ( xml ) => {

  return new Promise( ( resolve, reject ) => {

    xml2js.parseString( xml, ( err, result ) => { if ( !err ) { resolve( result ) } else { reject( err ) } } )
  })
}

const doRetry = async ( logPrefix, options, func ) => {

  return await retry(

    async () => { return await func() },

    _.extend( {}, options, { onRetry: ( err ) => {

      logger.warn( `${ logPrefix }: attempt failed - ${ err }` )
    }})
  )
}

const appendTestCase = ( testSuite, testCase ) => {

  testcase = testCase.testcase.find( ( item ) => { return item.$.name == testCase.$.name } )

  if ( testcase ) {

    testSuite.testcase.push( testcase )
  }
  else {

    throw new Error( `Error 002, cannot match test case, data: ${ JSON.stringify( testCase ) }` )
  }

  testSuite.$.tests += 1
  testSuite.$.failures += parseInt( testCase.$.failures )
  testSuite.$.disabled += parseInt( testCase.$.disabled )
  testSuite.$.errors += parseInt( testCase.$.errors )
  testSuite.$.time += parseFloat( testCase.$.time )
}

const appendTestCaseFail = ( testSuite, name, message ) => {

  testSuite.testcase.push({

    $: { name: name },
    failure: [ { $: { message: message }, _: message } ]
  })

  testSuite.$.tests += 1
  testSuite.$.errors += 1
}

const runTest = async ( pageUrl ) => {

  const res = await httpFetch( `${ pageUrl }?${ testQuery }` )
  const resJson = await parseXml( res )

  if ( !resJson.testsuite.testcase || !Array.isArray( resJson.testsuite.testcase ) ) {

    throw new Error( `Error 001, no "testcase" in test results, data: ${ JSON.stringify( resJson ) }` )
  }

  return resJson
}

const runPage = async ( executor, page, num ) => {

  const logPrefix = `Page ${ num }, ${ page.name }`

  try {

    const pageUrl = `http://${ executor.name }/${ page.name }`

    const testProperties = await doRetry( logPrefix, httpRetryOptions, async () => {

      logger.info( `${ logPrefix }: querying properties ...` )
      return JSON.parse( await httpFetch( `${ pageUrl }?${ propertiesQuery }` ) )
    })

    if ( testProperties.Test ) {

      if ( testProperties.Prune ) {

        logger.info( `${ logPrefix } is a test, but should be skipped, skipping it` )
      }
      else {

        let numRetries = 0

        while( true ) {

          const testResult = await doRetry( logPrefix, testRetryOptions, async () => {

            logger.info( `${ logPrefix }: executing test ...` )
            const res = await runTest( pageUrl )

            return res
          })

          numRetries++

          const counters = testResult.testsuite.$
          logger.info( `${ logPrefix }: results - tests: ${ counters.tests }, failures: ${ counters.failures }, disabled: ${ counters.disabled }, errors: ${ counters.errors }, time: ${ counters.time }` )

          if ( ( counters.failures > 0 || counters.errors > 0 ) && ( numRetries < failedTestRetries ) ) {

            logger.warn( `${ logPrefix }: failed, will retry in ${ failedTestRetryTimeout / 1000 } seconds` )

            const startTime = Date.now()
            await wait( () => { return Date.now() - startTime > failedTestRetryTimeout }, failedTestRetryTimeout + 1000 )
          }
          else {

            appendTestCase( results.testsuite, testResult.testsuite )
            break
          }
        }
      }
    }
    else {

      logger.info( `${ logPrefix } is not a test, skipping it` )
    }
  }
  catch( err ) {

    logger.error( `${ logPrefix }: ${ err }` )
    appendTestCaseFail( results.testsuite, page.name, `${ err }` )

    return false
  }

  return true
}

module.exports = async ( executors, suite ) => {

  const pages = await doRetry( `Runner`, httpRetryOptions, async () => {

    logger.info( `Runner: querying pages on "${ executors[ 0 ].name }" ...` )
    const pagesList = await httpFetch( `http://${ executors[ 0 ].name }/${ suite }?${ namesQuery }` )

    return pagesList.split( "\n" ).map( ( value ) => { return { name: `${ suite }.${ value }` } } )
  })

  logger.info( `Runner: pages found - ${ pages.length }` )

  results.testsuite.$.name = suite

  await executor( executors, pages, runPage, `Page` )

  const builder = new xml2js.Builder()
  const xmlResults = builder.buildObject( results )

  logger.info( `Runner: xml results created` )

  return xmlResults
}
