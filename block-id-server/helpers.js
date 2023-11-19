const axios = require('axios');

const getAuthorizedSources = async () => {
  // TODO: contract call, get client list [{ id, name, url }]

  return [{id: 'client1', name: 'Exchange 1', url: 'http://localhost:3001'}, {id: 'client2', name: 'Exchange 2', url: 'http://localhost:3002'}]
}

const getProofs = async (sources) => {
  const promises = authorizedSources.map(async (source) => {
    const { data } = await axios.get(source.clientUrl + '/proof', { params: { 'block-id-api-key': process.env.API_KEY } });
    return data;
  })

  const proofs = await Promise.all(promises);
  return proofs;
}

const getClient = async (clientId) => {
  // TODO: contract call, get client { clientId, clientName, clientUrl }

  return {id: 'client3', name: 'Exchange 3', url: 'http://localhost:3003'};
}

const validateProofs = async (zkProofs) => {
  // TODO: If proofs are not valid, throw an error
  // TODO: verifyProofs(zkProofs)
  // [{clientId, verified}]
  return [{clientId: 'client1', verified: true}, {clientId: 'client2', verified: true}];
}

const validateDataConsistency = (zkProofs) => {
  const identitySignals = zkProofs.map((zkProof) => zkProof.publicSignals[1])
  return identitySignals.every(is => is === arr[0]);
}

const getGrantCodeFromSource = async (sourceClient) => {
  const { data } = await axios.post(sourceClient.clientUrl + '/block-id/grant-code', { walletAddress }, { params: { 'block-id-api-key': process.env.API_KEY } });
  return data.code;
}

module.exports = {
  getAuthorizedSources,
  getProofs,
  validateDataConsistency,
  validateProofs,
  getGrantCodeFromSource,
  getClient
}