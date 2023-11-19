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

import { getAuthorizedSources, getProofs, validateDataConsistency, validateProofs, validateDataConsistency } from "./helpers";


orchestrateIdentitySync = async (walletAddress, demandingClientId) => {
  // TODO: this orchestration should be triggered when a syncRequest event is emitted. see BLOCKCHAIN CONNECTION REQUIREMENTS 2.

  const sources = await getAuthorizedSources(walletAddress)
  console.log('DATA SOURCES FOUND:' + sources.length)

  const proofs = await getProofs(sources)
  console.log('PROOFS FOUND:' + proofs.length)

  const proofsVerified = await validateProofs(proofs)
  console.log('PROOFS VERIFIED:' + proofsVerified)

  const isDataConsistent = validateDataConsistency(proofs)
  console.log('DATA CONSISTENCY VERIFIED:' + isDataConsistent)

  const result = proofsVerified && isDataConsistent
  console.log('RESULT:' + result)

  // RANDOMLY SELECT ONE OF CLIENTS AS DATA SOURCE
  // 1. GET GRANT CODE FROM SOURCE CLIENT'S block-id/grant-code
  // 2. POST GRANT CODE TO DEMANDING CLIENT'S block-id/callback
  // 3. DEMANDING CLIENT WILL CALL SOURCE WITH GRANT CODE TO GET IDENTITY INFORMATION
}


