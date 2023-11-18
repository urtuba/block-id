const axios = require('axios');

export const getAuthorizedSources = async () => {
  // TODO: contract call, get client list [{ clientId, clientName, clientUrl }]

  return [{clientId: 'Exchange1', clientName: 'Exchange 1', clientUrl: 'http://localhost:3001'}, {clientId: 'Exchange2', clientName: 'Exchange 2', clientUrl: 'http://localhost:3002'}]
}

export const getProofs = async (zkProofs) => {
  const authorizedSources = await getAuthorizedSources();

  const promises = authorizedSources.map(async (source) => {
    const { data } = await axios.get(source.clientUrl + '/proof', { params: { 'block-id-api-key': process.env.API_KEY } });
    return data;
  })

  const proofs = await Promise.all(promises);
  return proofs;
}

export const validateDataConsistency = (zkProofs) => {
  const identitySignals = zkProofs.map((zkProof) => zkProof.publicSignals[1])
  return identitySignals => identitySignals.every(is => is === arr[0]);
}