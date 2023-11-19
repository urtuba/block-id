// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";


contract BlockID is Ownable {

  event IdentityRequested(address indexed account, uint256 indexed targetClientId);

  struct Client {
    string name;
    string url;
  }

  uint256 private _nextClientId = 0;
  mapping (uint256 => Client) public clients;

  function requestIdentity(address account, uint256 targetClientId) public {
    emit IdentityRequested(account, targetClientId);
  }

  function addClient(string memory name, string memory url) public onlyOwner returns (uint256 clientId) {
    uint256 newClientId = _nextClientId;
    _nextClientId += 1;
    clients[newClientId] = Client(name, url);
    return newClientId;
  }

  function getClient(uint256 clientId) public view returns (string memory name, string memory url) {
    Client memory client = clients[clientId];
    return (client.name, client.url);
  }

  function getAuthorizedClients(address account) public view returns (uint256[] memory clientIds) {
    // TODO call BlockIDAccount contract
    
  }
}