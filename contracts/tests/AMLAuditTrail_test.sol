// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "remix_tests.sol";
import "../AMLAuditTrail.sol";

contract UnauthorizedActor {
    AMLAuditTrail private immutable trail;

    constructor(AMLAuditTrail target) {
        trail = target;
    }

    function register(bytes32 alertId, bytes32 evidenceHash, uint32 version) external {
        trail.registerAlert(alertId, evidenceHash, version);
    }

    function update(
        bytes32 alertId,
        AMLAuditTrail.ReviewStatus next,
        bytes32 evidenceHash,
        uint32 version
    ) external {
        trail.updateReviewStatus(alertId, next, evidenceHash, version);
    }

    function grant(address reviewer) external {
        trail.grantReviewerRole(reviewer);
    }

    function revoke(address reviewer) external {
        trail.revokeReviewerRole(reviewer);
    }
}

contract AMLAuditTrailTest {
    bytes32 private constant HASH_1 = keccak256("evidence-1");
    bytes32 private constant HASH_2 = keccak256("evidence-2");
    bytes32 private constant HASH_3 = keccak256("evidence-3");

    AMLAuditTrail private trail;
    UnauthorizedActor private actor;
    uint256 private nonce;

    function beforeEach() public {
        trail = new AMLAuditTrail();
        actor = new UnauthorizedActor(trail);
    }

    function nextAlert() private returns (bytes32) {
        nonce += 1;
        return keccak256(abi.encode("alert", nonce));
    }

    function registered() private returns (bytes32 alertId) {
        alertId = nextAlert();
        trail.registerAlert(alertId, HASH_1, 1);
    }

    function statusOf(bytes32 alertId) private view returns (uint256) {
        return uint256(trail.getAlert(alertId).status);
    }

    function expectUpdateRevert(
        bytes32 alertId,
        AMLAuditTrail.ReviewStatus next,
        bytes32 evidenceHash,
        uint32 version,
        string memory expected
    ) private {
        try trail.updateReviewStatus(alertId, next, evidenceHash, version) {
            Assert.ok(false, "update should have reverted");
        } catch Error(string memory reason) {
            Assert.equal(reason, expected, "wrong revert reason");
        }
    }

    function expectRegisterRevert(
        bytes32 alertId,
        bytes32 evidenceHash,
        uint32 version,
        string memory expected
    ) private {
        try trail.registerAlert(alertId, evidenceHash, version) {
            Assert.ok(false, "registration should have reverted");
        } catch Error(string memory reason) {
            Assert.equal(reason, expected, "wrong revert reason");
        }
    }

    function deployerIsAdminAndReviewer() public {
        Assert.equal(trail.admin(), address(this), "deployer is not admin");
        Assert.ok(trail.reviewers(address(this)), "deployer is not reviewer");
    }

    function reviewerRegistersNewAlert() public {
        bytes32 alertId = registered();
        AMLAuditTrail.Alert memory alert = trail.getAlert(alertId);
        Assert.ok(alert.exists, "alert was not stored");
        Assert.equal(uint256(alert.status), 0, "alert should start as New");
        Assert.equal(uint256(alert.version), 1, "wrong version");
        Assert.equal(alert.reviewer, address(this), "wrong reviewer");
        Assert.equal(trail.getEvidenceHash(alertId, 1), HASH_1, "wrong evidence hash");
    }

    function outsiderCannotRegister() public {
        try actor.register(nextAlert(), HASH_1, 1) {
            Assert.ok(false, "outsider registered an alert");
        } catch Error(string memory reason) {
            Assert.equal(reason, "Only authorized reviewers can register alerts", "wrong revert reason");
        }
    }

    function outsiderCannotUpdate() public {
        bytes32 alertId = registered();
        try actor.update(alertId, AMLAuditTrail.ReviewStatus.UnderReview, HASH_2, 2) {
            Assert.ok(false, "outsider updated a review");
        } catch Error(string memory reason) {
            Assert.equal(reason, "Only authorized reviewers can update reviews", "wrong revert reason");
        }
        Assert.equal(statusOf(alertId), 0, "failed update changed state");
    }

    function outsiderCannotManageRoles() public {
        try actor.grant(address(actor)) {
            Assert.ok(false, "outsider granted a role");
        } catch Error(string memory reason) {
            Assert.equal(reason, "Only admin can grant reviewer role", "wrong revert reason");
        }
        try actor.revoke(address(this)) {
            Assert.ok(false, "outsider revoked a role");
        } catch Error(string memory reason) {
            Assert.equal(reason, "Only admin can revoke reviewer role", "wrong revert reason");
        }
        Assert.ok(!trail.reviewers(address(actor)), "failed grant changed state");
        Assert.ok(trail.reviewers(address(this)), "failed revoke changed state");
    }

    function zeroAddressRolesRevert() public {
        try trail.grantReviewerRole(address(0)) {
            Assert.ok(false, "zero address granted");
        } catch Error(string memory reason) {
            Assert.equal(reason, "Invalid reviewer address", "wrong revert reason");
        }
        try trail.revokeReviewerRole(address(0)) {
            Assert.ok(false, "zero address revoked");
        } catch Error(string memory reason) {
            Assert.equal(reason, "Invalid reviewer address", "wrong revert reason");
        }
    }

    function grantedReviewerCanWriteUntilRevoked() public {
        bytes32 first = nextAlert();
        trail.grantReviewerRole(address(actor));
        actor.register(first, HASH_1, 1);
        Assert.equal(trail.getAlert(first).reviewer, address(actor), "wrong reviewer recorded");

        trail.revokeReviewerRole(address(actor));
        try actor.register(nextAlert(), HASH_1, 1) {
            Assert.ok(false, "revoked reviewer registered an alert");
        } catch Error(string memory reason) {
            Assert.equal(reason, "Only authorized reviewers can register alerts", "wrong revert reason");
        }
    }

    function invalidRegistrationInputsRevert() public {
        expectRegisterRevert(bytes32(0), HASH_1, 1, "Invalid alert ID");
        expectRegisterRevert(nextAlert(), bytes32(0), 1, "Evidence hash cannot be zero");
        expectRegisterRevert(nextAlert(), HASH_1, 0, "Evidence version must be greater than zero");
    }

    function duplicateRegistrationKeepsOriginalEvidence() public {
        bytes32 alertId = registered();
        expectRegisterRevert(alertId, HASH_2, 2, "Alert already registered");
        Assert.equal(trail.getEvidenceHash(alertId, 1), HASH_1, "original evidence changed");
        Assert.equal(trail.getEvidenceHash(alertId, 2), bytes32(0), "duplicate stored evidence");
    }

    function fullEscalationPathSucceeds() public {
        bytes32 alertId = registered();
        trail.updateReviewStatus(alertId, AMLAuditTrail.ReviewStatus.UnderReview, HASH_2, 2);
        Assert.equal(statusOf(alertId), 1, "should be UnderReview");
        trail.updateReviewStatus(alertId, AMLAuditTrail.ReviewStatus.Escalated, HASH_3, 3);
        Assert.equal(statusOf(alertId), 2, "should be Escalated");
        trail.updateReviewStatus(alertId, AMLAuditTrail.ReviewStatus.UnderReview, HASH_2, 4);
        Assert.equal(statusOf(alertId), 1, "should return to UnderReview");
        trail.updateReviewStatus(alertId, AMLAuditTrail.ReviewStatus.Closed, HASH_3, 5);
        Assert.equal(statusOf(alertId), 4, "should be Closed");
        Assert.equal(uint256(trail.getAlert(alertId).version), 5, "wrong final version");
    }

    function newAlertCanBeDismissed() public {
        bytes32 alertId = registered();
        trail.updateReviewStatus(alertId, AMLAuditTrail.ReviewStatus.Dismissed, HASH_2, 2);
        Assert.equal(statusOf(alertId), 3, "should be Dismissed");
    }

    function newAlertCannotSkipReview() public {
        bytes32 alertId = registered();
        expectUpdateRevert(alertId, AMLAuditTrail.ReviewStatus.Closed, HASH_2, 2, "Invalid review status transition");
        expectUpdateRevert(alertId, AMLAuditTrail.ReviewStatus.Escalated, HASH_2, 2, "Invalid review status transition");
        expectUpdateRevert(alertId, AMLAuditTrail.ReviewStatus.New, HASH_2, 2, "Invalid review status transition");
        Assert.equal(statusOf(alertId), 0, "invalid transition changed state");
        Assert.equal(trail.getEvidenceHash(alertId, 2), bytes32(0), "invalid transition stored evidence");
    }

    function terminalStatesCannotReopen() public {
        bytes32 dismissed = registered();
        trail.updateReviewStatus(dismissed, AMLAuditTrail.ReviewStatus.Dismissed, HASH_2, 2);
        expectUpdateRevert(dismissed, AMLAuditTrail.ReviewStatus.UnderReview, HASH_3, 3, "Invalid review status transition");

        bytes32 closed = registered();
        trail.updateReviewStatus(closed, AMLAuditTrail.ReviewStatus.UnderReview, HASH_2, 2);
        trail.updateReviewStatus(closed, AMLAuditTrail.ReviewStatus.Closed, HASH_3, 3);
        expectUpdateRevert(closed, AMLAuditTrail.ReviewStatus.UnderReview, HASH_1, 4, "Invalid review status transition");
    }

    function updateInputsAreValidated() public {
        bytes32 alertId = registered();
        expectUpdateRevert(nextAlert(), AMLAuditTrail.ReviewStatus.UnderReview, HASH_2, 2, "Alert is not registered");
        expectUpdateRevert(alertId, AMLAuditTrail.ReviewStatus.UnderReview, bytes32(0), 2, "Evidence hash cannot be zero");
        expectUpdateRevert(alertId, AMLAuditTrail.ReviewStatus.UnderReview, HASH_2, 1, "Evidence version must increase");
        Assert.equal(trail.getEvidenceHash(alertId, 1), HASH_1, "reused version changed evidence");
    }

    function historicalEvidenceStaysVerifiable() public {
        bytes32 alertId = registered();
        trail.updateReviewStatus(alertId, AMLAuditTrail.ReviewStatus.UnderReview, HASH_2, 2);
        Assert.ok(trail.verifyEvidence(alertId, 1, HASH_1), "version 1 no longer verifies");
        Assert.ok(trail.verifyEvidence(alertId, 2, HASH_2), "version 2 does not verify");
    }

    function tamperedEvidenceFailsVerification() public {
        bytes32 alertId = registered();
        Assert.ok(!trail.verifyEvidence(alertId, 1, HASH_2), "tampered hash verified");
        Assert.ok(!trail.verifyEvidence(alertId, 2, HASH_1), "missing version verified");
        Assert.ok(!trail.verifyEvidence(alertId, 1, bytes32(0)), "zero hash verified");
    }

    function readingMissingAlertReverts() public {
        try trail.getAlert(nextAlert()) {
            Assert.ok(false, "missing alert was returned");
        } catch Error(string memory reason) {
            Assert.equal(reason, "Alert is not registered", "wrong revert reason");
        }
    }
}
