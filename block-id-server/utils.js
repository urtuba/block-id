// ZK requiremets:
// 1. I will have multiple proofs from multiple clients
// 2. An util function 'validateIdentityProofs(...zkProofs)' will take an array of proofs:
//    - Validate if all proofs are created based on same identity
//    - Returns the result [true/false] and the identity [walletAddress]

// BLOCKCHAIN CONNECTION REQUIREMENTS
// 1. Create a ethereum listener for contract 'ETHEREUM_CONTRACT_ADDRESS'
// 2. Listener should listen event 'syncRequest(walletAddress, demandingClientId)' then an async function 'orchestrateIdentityVerification(walletAddress, demandingClientId)' should be called
// 3. An utility to read the wallet's authorized identity sources [clients]
// 3. An utility to get client information [clientId, clientName, clientUrl] from our contract
// 4. A contract call to 'pingIdentityVerification(walletAddress, [proofs], demandingClient, result)' to only publish an event.

import { getAuthorizedSources, getProofs, validateDataConsistency, validateProofs, validateDataConsistency, getGrantCodeFromSource, getClient } from "./helpers";


orchestrateIdentitySync = async (walletAddress, demandingClientId) => {
  // TODO: this orchestration should be triggered when a syncRequest event is emitted. see BLOCKCHAIN CONNECTION REQUIREMENTS 2.
  try {
    const sources = await getAuthorizedSources(walletAddress)
    console.log('DATA SOURCES FOUND:' + sources.length)

    const proofs = await getProofs(sources)
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
    const grantCode = await getGrantCodeFromSource(sourceClient)

    const demandingClient = await getClient(demandingClientId)
    const { data, status } = await axios.post(demandingClientId + '/block-id/callback', { code: grantCode, wallet: walletAddress, source: sourceClient.clientUrl }, { params: { 'block-id-api-key': process.env.API_KEY } })
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


