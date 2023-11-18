// BLOCKCHAIN CONNECTION REQUIREMENTS
// 1. Create a ethereum listener for contract 'ETHEREUM_CONTRACT_ADDRESS'
// 2. Listener should listen event 'verifyRequest(walletAddress, clientId)' then an async function 'proveAndShareIdentity(walletAddress, clientId)' should be called
// 3. An utility to read the wallet's authorized identity sources [clients]
// 3. An utility to get client information [clientId, clientName, clientUrl, clientPublicKey] from our contract
// 4. A contract call to 'pingIdentityVerification(walletAddress, [proofs], demandingClient, result)' to only publish an event.