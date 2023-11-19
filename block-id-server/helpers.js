const axios = require('axios');
const { CLIENT_ID_MAP } = require( './config' );

const apiKey = process.env.API_KEY || 'block-id-api-key';

const getAuthorizedSources = async () => {
  // TODO: contract call, get client list [{ id, name, url }]
  // const contractResult = [0, 1]

  // const promises = contractResult.map((clientId) => ({id: clientId, data: getClient(clientId)}))
  // const clients = await Promise.all(promises);

  // const getAuthorizedClients = clients.map((client) => ({ ...client.data, id: CLIENT_ID_MAP[client.id]}))

  return [{id: 'client1', name: 'Exchange 1', url: 'http://localhost:3001'}, {id: 'client2', name: 'Exchange 2', url: 'http://localhost:3002'}]
}

const getProofs = async (wallet, authorizedSources) => {
  const promises = authorizedSources.map(async (source) => {
    const { data } = await axios.get(source.url + '/block-id/proof', {
      headers: { 'block-id-api-key': apiKey },
      params: { wallet }
    });
    return data;
  })

  const proofs = await Promise.all(promises);
  return proofs;
}

const getClient = async (clientId) => {
  const contractResult = {name: }
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
  return identitySignals.every(is => is === identitySignals[0]);
}

const getGrantCodeFromSource = async (walletAddress, sourceClient) => {
  const { data } = await axios.post(sourceClient.url + '/block-id/grant-code', { walletAddress }, { headers: { 'block-id-api-key': apiKey } });
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