//
// Save results
//

const fs = require( "fs" )
const util = require( "util" )


const azureCreateContainer = ( service, container ) => {

  return new Promise( ( resolve, reject ) => {

    service.createContainerIfNotExists( container, ( error, result ) => {

      if ( error ) { reject( error ) } else { resolve( result ) }
    })
  })
}

const azureCreateBlobFromText = ( service, container, blob, text ) => {

  return new Promise( ( resolve, reject ) => {

    service.createBlockBlobFromText( container, blob, text, function( error, result ) {

      if ( error ) { reject( error ) } else { resolve( result ) }
    })
  })
}

module.exports.saveToAzure = async ( account, key, container, blob, text ) => {

  const azure = require( "azure-storage" )
  const service = azure.createBlobService( account, key )

  await azureCreateContainer( service, container )
  await azureCreateBlobFromText( service, container, blob, text )
}

module.exports.saveToFile = async ( file, text ) => {

  const writeFile = util.promisify( fs.writeFile )
  await writeFile( file, text )
}
