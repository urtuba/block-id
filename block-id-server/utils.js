const axios = require('axios');

const { getAuthorizedSources, getProofs, validateDataConsistency, validateProofs, getGrantCodeFromSource, getClient } = require("./helpers");

const orchestrateIdentitySync = async (walletAddress, demandingClientId) => {
  // TODO: this orchestration should be triggered when a syncRequest event is emitted. see BLOCKCHAIN CONNECTION REQUIREMENTS 2.
  try {
    const sources = await getAuthorizedSources(walletAddress)
    console.log('DATA SOURCES FOUND:' + sources.length)

    const proofs = await getProofs(walletAddress, sources)
    console.log('PROOFS FOUND:' + proofs.length)
    
    let proofsVerified
    try {
      proofsVerified = await validateProofs(proofs)
    } catch (e) {
      console.log('PROOFS VERIFICATION FAILED:' + e)
      return
    }
    console.log('PROOFS VERIFIED:' + proofsVerified)

    const isDataConsistent = validateDataConsistency(proofs)
    console.log('DATA CONSISTENCY VERIFIED:' + isDataConsistent)

    const result = proofsVerified && isDataConsistent
    console.log('RESULT:' + result)

    const sourceIndex = Math.floor(Math.random() * sources.length)
    const sourceClient = sources[sourceIndex]
    console.log('SOURCE CLIENT:' + JSON.stringify(sourceClient))
    const grantCode = await getGrantCodeFromSource(walletAddress, sourceClient)

    const demandingClient = await getClient(demandingClientId)
    const { data, status } = await axios.post(demandingClient.url + '/block-id/callback', { code: grantCode, wallet: walletAddress, source: sourceClient.url }, { params: { 'block-id-api-key': process.env.API_KEY } })
    const success = status === 200
    if(success) {
      console.log('Identity data synced channel opened with ' + demandingClient.name)
    } else {
      console.log('Identity data sync failed with ' + demandingClient.name)
    }
  } catch (e) {
    console.log('Identity data sync failed with client with id ' + demandingClientId)
    console.error(e)
  }
}

module.exports = {
  orchestrateIdentitySync
}