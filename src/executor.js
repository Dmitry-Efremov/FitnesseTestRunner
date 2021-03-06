//
// Run worker 
//

const wait = require( "async-wait-until" )
const logger = require( "./logger.js" )


const waitTimeout = parseInt( process.env.WAIT_TIMEOUT || 600000 )


module.exports = async ( executors, tasks, worker, logTaskPrefix, logExecutorPrefix ) => {

  if ( !Array.isArray( executors ) || executors.length == 0 ) throw new Error( "No executors" )

  const logTask = logTaskPrefix ? logTaskPrefix : "Task"
  const logExecutor = logExecutorPrefix ? logExecutorPrefix : "Executor"

  const _executors = executors.slice( 0 )
  const busy = {}

  logger.info( `${ logExecutor }: starting, tasks: ${ tasks.length }, executors: ${ executors.length }` )

  try {

    for ( let i = 0; i < tasks.length; i++ ) {

      const taskNum = i + 1
      const logPrefix = `${ logTask } ${ taskNum }, ${ tasks[ i ].name }`

      if ( _executors.length == 0 ) {

        await wait( () => { return _executors.length > 0 }, waitTimeout )
      }

      const executor = _executors.pop()
      busy[ executor.name ] = executor

      logger.info( `${ logPrefix }: starting on "${ executor.name }"` )

      worker( executor, tasks[ i ], taskNum ).then( () => {

        logger.info( `${ logPrefix }: finished` )

        _executors.push( executor )
        delete busy[ executor.name ]
      })
    }

    logger.info( `${ logExecutor }: no more tasks, waiting for already running ...` )

    await wait( () => { return _executors.length == executors.length }, waitTimeout )
  }
  catch( err ) {

    logger.error( `${ logExecutor }: ${ err }, remaining executors: ${ JSON.stringify( busy ) }` )
    throw err
  }

  logger.info( `${ logExecutor }: all tasks finished` )
  return true
}
