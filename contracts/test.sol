// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AMLAuditTrail {
    // STEP 1. Store reviewer roles, alert metadata and versioned evidence hashes

    enum ReviewStatus {
        New,
        UnderReview,
        Escalated,
        Dismissed,
        Closed
    }

    struct Alert {
        bool exists;
        ReviewStatus status;
        uint32 version;
        address reviewer;
        uint64 updatedAt;
    }

    address public immutable admin;

    mapping(address => bool) public reviewers;
    mapping(bytes32 => Alert) private alerts;
    mapping(bytes32 => mapping(uint32 => bytes32)) private evidence;

    // STEP 2. Audit events contain hashes and metadata, never customer records

    event AlertRegistered(
        bytes32 indexed alertId,
        bytes32 evidenceHash,
        uint32 version,
        address indexed reviewer
    );

    event ReviewStatusUpdated(
        bytes32 indexed alertId,
        ReviewStatus status,
        bytes32 evidenceHash,
        uint32 version,
        address indexed reviewer
    );

    event ReviewerGranted(address indexed reviewer);
    event ReviewerRevoked(address indexed reviewer);

    // STEP 3. The deployer becomes the administrator and first reviewer

    constructor() {
        admin = msg.sender;
        reviewers[msg.sender] = true;

        emit ReviewerGranted(msg.sender);
    }

    // STEP 4. Grant reviewer access

    function grantReviewerRole(address reviewer) external {
        require(
            msg.sender == admin,
            "Only admin can grant reviewer role"
        );

        require(
            reviewer != address(0),
            "Invalid reviewer address"
        );

        reviewers[reviewer] = true;

        emit ReviewerGranted(reviewer);
    }

    // STEP 5. Revoke reviewer access

    function revokeReviewerRole(address reviewer) external {
        require(
            msg.sender == admin,
            "Only admin can revoke reviewer role"
        );

        require(
            reviewer != address(0),
            "Invalid reviewer address"
        );

        reviewers[reviewer] = false;

        emit ReviewerRevoked(reviewer);
    }

    // STEP 6. Register a new alert and its first committed evidence version

    function registerAlert(
        bytes32 alertId,
        bytes32 evidenceHash,
        uint32 version
    ) external {
        require(
            reviewers[msg.sender],
            "Only authorized reviewers can register alerts"
        );

        require(
            alertId != bytes32(0),
            "Invalid alert ID"
        );

        require(
            evidenceHash != bytes32(0),
            "Evidence hash cannot be zero"
        );

        require(
            version > 0,
            "Evidence version must be greater than zero"
        );

        require(
            !alerts[alertId].exists,
            "Alert already registered"
        );

        alerts[alertId] = Alert({
            exists: true,
            status: ReviewStatus.New,
            version: version,
            reviewer: msg.sender,
            updatedAt: uint64(block.timestamp)
        });

        evidence[alertId][version] = evidenceHash;

        emit AlertRegistered(
            alertId,
            evidenceHash,
            version,
            msg.sender
        );
    }

    // STEP 7. Validate a review decision before appending its evidence hash

    function updateReviewStatus(
        bytes32 alertId,
        ReviewStatus next,
        bytes32 evidenceHash,
        uint32 version
    ) external {
        require(
            reviewers[msg.sender],
            "Only authorized reviewers can update reviews"
        );

        require(
            alerts[alertId].exists,
            "Alert is not registered"
        );

        require(
            evidenceHash != bytes32(0),
            "Evidence hash cannot be zero"
        );

        Alert storage alert = alerts[alertId];

        require(
            version > alert.version,
            "Evidence version must increase"
        );

        bool validTransition = false;

        if (alert.status == ReviewStatus.New) {
            validTransition = (
                next == ReviewStatus.UnderReview ||
                next == ReviewStatus.Dismissed
            );
        } else if (alert.status == ReviewStatus.UnderReview) {
            validTransition = (
                next == ReviewStatus.Escalated ||
                next == ReviewStatus.Dismissed ||
                next == ReviewStatus.Closed
            );
        } else if (alert.status == ReviewStatus.Escalated) {
            validTransition = (
                next == ReviewStatus.UnderReview ||
                next == ReviewStatus.Closed
            );
        }

        require(
            validTransition,
            "Invalid review status transition"
        );

        // Update current metadata; older evidence versions remain unchanged

        alert.status = next;
        alert.version = version;
        alert.reviewer = msg.sender;
        alert.updatedAt = uint64(block.timestamp);

        evidence[alertId][version] = evidenceHash;

        emit ReviewStatusUpdated(
            alertId,
            next,
            evidenceHash,
            version,
            msg.sender
        );
    }

    // STEP 8. Get the latest alert metadata

    function getAlert(bytes32 alertId)
        external
        view
        returns (Alert memory)
    {
        require(
            alerts[alertId].exists,
            "Alert is not registered"
        );

        return alerts[alertId];
    }

    // STEP 9. Get the evidence hash for a specific version

    function getEvidenceHash(bytes32 alertId, uint32 version)
        external
        view
        returns (bytes32)
    {
        return evidence[alertId][version];
    }

    // STEP 10. Compare an off-chain hash with its committed evidence version

    function verifyEvidence(
        bytes32 alertId,
        uint32 version,
        bytes32 supplied
    ) external view returns (bool) {
        return (
            supplied != bytes32(0) &&
            evidence[alertId][version] == supplied
        );
    }
}
