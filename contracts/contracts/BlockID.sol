// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @dev Interface of the verifier snarkjs generated for circuits/identity-proof.circom
/// (contracts/IdentityProofVerifier.sol). The four public signals are, in this order:
/// identityCommitment, wallet, clientId, nonce.
interface IIdentityProofVerifier {
    function verifyProof(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[4] calldata pubSignals
    ) external view returns (bool);
}

/// @title BlockID
/// @notice On-chain registry for the BlockID identity-sharing protocol.
///
/// A user does KYC at several exchanges ("clients"). BlockID lets a new exchange get
/// that identity without BlockID ever seeing it: each source exchange proves, in zero
/// knowledge, that it holds an identity behind a commitment. This contract checks the
/// proofs on-chain, so anyone can re-check that the sources hold the same identity.
/// No personal data is stored or emitted, only the identity commitment
/// Poseidon(fullName, identityNumber, nationality, dateOfBirth, salt).
///
/// Flow:
///  1. The owner registers exchanges with addClient.
///  2. A user calls grant(clientId) for every exchange that may act as a source.
///  3. The user calls requestIdentity(targetClientId). msg.sender is the wallet, so
///     nobody can request an identity sync for someone else's wallet.
///  4. The orchestrator collects one proof per source, each with nonce = requestId, and
///     calls recordSync. The contract verifies every proof and emits IdentitySynced.
contract BlockID is Ownable {
    // Positions of the public signals in IdentityProof.pubSignals.
    uint256 private constant COMMITMENT = 0;
    uint256 private constant WALLET = 1;
    uint256 private constant CLIENT_ID = 2;
    uint256 private constant NONCE = 3;

    struct Client {
        string name;
        string url;
    }

    struct Request {
        address wallet;
        bool fulfilled;
        uint256 targetClientId;
    }

    struct Sync {
        uint256 sourceClientId;
        uint256 identityCommitment;
    }

    /// @dev A Groth16 proof and its public signals, laid out as the generated verifier expects.
    struct IdentityProof {
        uint256[2] pA;
        uint256[2][2] pB;
        uint256[2] pC;
        uint256[4] pubSignals;
    }

    /// @notice The generated Groth16 verifier. Fixed at deployment.
    IIdentityProofVerifier public immutable verifier;

    /// @notice How many distinct granted source exchanges must prove the same identity.
    uint256 public immutable minSources;

    /// @notice Who may call recordSync.
    address public orchestrator;

    /// @notice Number of registered exchanges. Client ids are 1..clientCount.
    uint256 public clientCount;

    /// @notice Number of identity requests so far. Request ids are 1..requestCount.
    uint256 public requestCount;

    mapping(uint256 clientId => Client) private _clients;
    mapping(address wallet => uint256[]) private _grants;
    // 1-based position of a client in _grants[wallet]; 0 means not granted.
    mapping(address wallet => mapping(uint256 clientId => uint256)) private _grantPosition;
    mapping(uint256 requestId => Request) private _requests;
    mapping(uint256 requestId => Sync) private _syncs;

    event ClientAdded(uint256 indexed clientId, string name, string url);
    event OrchestratorChanged(address indexed orchestrator);
    event Granted(address indexed wallet, uint256 indexed clientId);
    event Revoked(address indexed wallet, uint256 indexed clientId);
    event IdentityRequested(address indexed wallet, uint256 indexed targetClientId, uint256 indexed requestId);
    event IdentitySynced(
        address indexed wallet,
        uint256 indexed sourceClientId,
        uint256 indexed targetClientId,
        uint256 identityCommitment
    );

    error ZeroAddress();
    error InvalidMinSources();
    error EmptyName();
    error NotOrchestrator();
    error UnknownClient(uint256 clientId);
    error AlreadyGranted(uint256 clientId);
    error NotGranted(uint256 clientId);
    error NotEnoughSources(uint256 have, uint256 need);
    error UnknownRequest(uint256 requestId);
    error AlreadySynced(uint256 requestId);
    error NotSynced(uint256 requestId);
    error NotEnoughProofs(uint256 have, uint256 need);
    error WrongWallet(uint256 proofIndex);
    error WrongNonce(uint256 proofIndex);
    error SourceIsTarget(uint256 proofIndex);
    error DuplicateSource(uint256 proofIndex);
    error CommitmentMismatch(uint256 proofIndex);
    error InvalidProof(uint256 proofIndex);
    error SourceNotProven(uint256 sourceClientId);

    modifier onlyOrchestrator() {
        if (msg.sender != orchestrator) revert NotOrchestrator();
        _;
    }

    /// @param verifier_ The deployed IdentityProofVerifier.
    /// @param orchestrator_ The account allowed to call recordSync.
    /// @param minSources_ How many distinct sources a sync needs (at least 1; 2 for the
    ///        cross-check that makes BlockID worth using).
    constructor(address verifier_, address orchestrator_, uint256 minSources_) Ownable(msg.sender) {
        if (verifier_ == address(0) || orchestrator_ == address(0)) revert ZeroAddress();
        if (minSources_ == 0) revert InvalidMinSources();
        verifier = IIdentityProofVerifier(verifier_);
        orchestrator = orchestrator_;
        minSources = minSources_;
    }

    // ---------------------------------------------------------------- admin

    /// @notice Register an exchange. Returns its id (the first is 1).
    function addClient(string calldata name, string calldata url) external onlyOwner returns (uint256 clientId) {
        if (bytes(name).length == 0) revert EmptyName();
        clientId = ++clientCount;
        _clients[clientId] = Client(name, url);
        emit ClientAdded(clientId, name, url);
    }

    function setOrchestrator(address orchestrator_) external onlyOwner {
        if (orchestrator_ == address(0)) revert ZeroAddress();
        orchestrator = orchestrator_;
        emit OrchestratorChanged(orchestrator_);
    }

    function getClient(uint256 clientId) external view returns (string memory name, string memory url) {
        _requireClient(clientId);
        Client storage client = _clients[clientId];
        return (client.name, client.url);
    }

    // --------------------------------------------------------------- grants

    /// @notice Allow an exchange to act as a source for the sender's identity.
    function grant(uint256 clientId) external {
        _requireClient(clientId);
        if (_grantPosition[msg.sender][clientId] != 0) revert AlreadyGranted(clientId);
        _grants[msg.sender].push(clientId);
        _grantPosition[msg.sender][clientId] = _grants[msg.sender].length;
        emit Granted(msg.sender, clientId);
    }

    /// @notice Take the grant back. Pending requests need the grant at recordSync time.
    function revoke(uint256 clientId) external {
        uint256 position = _grantPosition[msg.sender][clientId];
        if (position == 0) revert NotGranted(clientId);

        uint256[] storage grants = _grants[msg.sender];
        uint256 last = grants[grants.length - 1];
        grants[position - 1] = last;
        _grantPosition[msg.sender][last] = position;
        grants.pop();
        delete _grantPosition[msg.sender][clientId];
        emit Revoked(msg.sender, clientId);
    }

    /// @notice Exchanges the wallet granted as sources, in no particular order.
    function getGrants(address wallet) external view returns (uint256[] memory) {
        return _grants[wallet];
    }

    function isGranted(address wallet, uint256 clientId) public view returns (bool) {
        return _grantPosition[wallet][clientId] != 0;
    }

    // ------------------------------------------------------------- requests

    /// @notice Ask BlockID to send the sender's identity to the exchange `targetClientId`.
    /// The sender's wallet is the identity owner, so nobody can ask for someone else's.
    /// Needs at least `minSources` granted sources other than the target.
    function requestIdentity(uint256 targetClientId) external returns (uint256 requestId) {
        _requireClient(targetClientId);

        uint256 sources = _grants[msg.sender].length;
        if (isGranted(msg.sender, targetClientId)) sources -= 1;
        if (sources < minSources) revert NotEnoughSources(sources, minSources);

        requestId = ++requestCount;
        _requests[requestId] = Request({wallet: msg.sender, fulfilled: false, targetClientId: targetClientId});
        emit IdentityRequested(msg.sender, targetClientId, requestId);
    }

    function getRequest(uint256 requestId)
        external
        view
        returns (address wallet, uint256 targetClientId, bool fulfilled)
    {
        Request storage request = _requireRequest(requestId);
        return (request.wallet, request.targetClientId, request.fulfilled);
    }

    // ----------------------------------------------------------------- sync

    /// @notice Record that the sources hold the same identity for this request.
    ///
    /// Every proof must (a) verify, (b) be made for the request's wallet, (c) carry the
    /// request id as its nonce, (d) come from a distinct exchange the wallet has granted
    /// and that is not the target, and (e) show the same identity commitment as the
    /// others. At least `minSources` proofs are needed, and `sourceClientId`, the exchange
    /// the data will be fetched from, must be one of them. The proofs are in calldata, so
    /// anyone can verify them again.
    function recordSync(uint256 requestId, uint256 sourceClientId, IdentityProof[] calldata proofs)
        external
        onlyOrchestrator
    {
        Request storage request = _requireRequest(requestId);
        if (request.fulfilled) revert AlreadySynced(requestId);
        if (proofs.length < minSources) revert NotEnoughProofs(proofs.length, minSources);
        request.fulfilled = true;

        address wallet = request.wallet;
        uint256 targetClientId = request.targetClientId;
        uint256 identityCommitment = proofs[0].pubSignals[COMMITMENT];
        bool sourceProven;

        for (uint256 i = 0; i < proofs.length; i++) {
            IdentityProof calldata proof = proofs[i];
            uint256 clientId = proof.pubSignals[CLIENT_ID];

            if (proof.pubSignals[WALLET] != uint256(uint160(wallet))) revert WrongWallet(i);
            if (proof.pubSignals[NONCE] != requestId) revert WrongNonce(i);
            if (clientId == targetClientId) revert SourceIsTarget(i);
            if (!isGranted(wallet, clientId)) revert NotGranted(clientId);
            for (uint256 j = 0; j < i; j++) {
                if (proofs[j].pubSignals[CLIENT_ID] == clientId) revert DuplicateSource(i);
            }
            if (proof.pubSignals[COMMITMENT] != identityCommitment) revert CommitmentMismatch(i);
            if (!verifier.verifyProof(proof.pA, proof.pB, proof.pC, proof.pubSignals)) revert InvalidProof(i);

            if (clientId == sourceClientId) sourceProven = true;
        }
        if (!sourceProven) revert SourceNotProven(sourceClientId);

        _syncs[requestId] = Sync(sourceClientId, identityCommitment);
        emit IdentitySynced(wallet, sourceClientId, targetClientId, identityCommitment);
    }

    /// @notice The recorded result of a request. Exchanges use it to check the data they
    /// receive: Poseidon of the received fields and salt must equal `identityCommitment`.
    function getSync(uint256 requestId)
        external
        view
        returns (address wallet, uint256 sourceClientId, uint256 targetClientId, uint256 identityCommitment)
    {
        Request storage request = _requireRequest(requestId);
        if (!request.fulfilled) revert NotSynced(requestId);
        Sync storage sync = _syncs[requestId];
        return (request.wallet, sync.sourceClientId, request.targetClientId, sync.identityCommitment);
    }

    // -------------------------------------------------------------- helpers

    function _requireClient(uint256 clientId) private view {
        if (clientId == 0 || clientId > clientCount) revert UnknownClient(clientId);
    }

    function _requireRequest(uint256 requestId) private view returns (Request storage request) {
        request = _requests[requestId];
        if (request.wallet == address(0)) revert UnknownRequest(requestId);
    }
}
