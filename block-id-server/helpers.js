const axios = require('axios');

export const getAuthorizedSources = async () => {
  // TODO: contract call, get client list [{ id, name, url }]

  return [{id: 'Exchange1', name: 'Exchange 1', url: 'http://localhost:3001'}, {id: 'Exchange2', name: 'Exchange 2', url: 'http://localhost:3002'}]
}

export const getProofs = async (sources) => {
  const promises = authorizedSources.map(async (source) => {
    const { data } = await axios.get(source.clientUrl + '/proof', { params: { 'block-id-api-key': process.env.API_KEY } });
    return data;
  })

  const proofs = await Promise.all(promises);
  return proofs;
}

export const getClient = async (clientId) => {
  // TODO: contract call, get client { clientId, clientName, clientUrl }

  return {clientId: 'Exchange3', name: 'Exchange 3', clientUrl: 'http://localhost:3003'};
}

export const validateProofs = async (zkProofs) => {
  // TODO: verifyProofs(zkProofs)
  // [{clientId, verified}]
  return [{clientId: 'Exchange1', verified: true}, {clientId: 'Exchange2', verified: true}];
}

export const validateDataConsistency = (zkProofs) => {
  const identitySignals = zkProofs.map((zkProof) => zkProof.publicSignals[1])
  return identitySignals.every(is => is === arr[0]);
}

export const getGrantCodeFromSource = async (sourceClient) => {
  const { data } = await axios.post(sourceClient.clientUrl + '/block-id/grant-code', { walletAddress }, { params: { 'block-id-api-key': process.env.API_KEY } });
  return data.code;
}