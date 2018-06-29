//
// Run worker 
//

const wait = require( "async-wait-until" )
const logger = require( "./logger.js" )


const waitTimeout = 300000


module.exports = async ( executors, tasks, worker ) => {

  const _executors = executors.slice( 0 )

  for ( let i = 0; i < tasks.length; i++ ) {

    const taskNum = i + 1
    logger.info( `Task ${ taskNum }: starting` )

    if ( _executors.length == 0 ) {

      logger.info( `Task ${ taskNum }: no executors, waiting ...` )
      await wait( () => { return _executors.length > 0 }, waitTimeout )
      logger.info( `Task ${ taskNum }: executors available, continue` )
    }

    const executor = _executors.pop()

    worker( executor, tasks[ i ] ).then( () => {

      logger.info( `Task ${ taskNum }: processed` )
      _executors.push( executor )
    })
  }

  await wait( () => { return _executors.length == executors.length }, waitTimeout )
}
