// ZK requiremets:
// 1. I will have multiple proofs from multiple clients
// 2. An util function 'validateIdentityProofs(...zkProofs)' will take an array of proofs:
//    - Validate if all proofs are created based on same identity
//    - Returns the result [true/false] and the identity [walletAddress]
