// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Run with Remix Solidity Unit Testing. This is not the deployed app contract.
import "remix_tests.sol";
import "../AMLAuditTrail.sol";

contract UnauthorizedActor {
    function register(AMLAuditTrail c, bytes32 a, bytes32 h) external {
        c.registerAlert(a, h, 1);
    }
    function grant(AMLAuditTrail c, address reviewer) external {
        c.grantReviewerRole(reviewer);
    }
}

contract AMLAuditTrailTest {
    AMLAuditTrail private audit;
    UnauthorizedActor private actor;
    bytes32 constant A = keccak256("AL-demo");
    bytes32 constant H1 = sha256("evidence-v1");
    bytes32 constant H2 = sha256("evidence-v2");
    function beforeEach() public { audit = new AMLAuditTrail(); actor = new UnauthorizedActor(); }

    function authorizedRegistrationAndVerification() public {
        audit.registerAlert(A, H1, 1);
        Assert.ok(audit.getAlert(A).exists, "registered");
        Assert.ok(audit.verifyEvidence(A, 1, H1), "hash matches");
        Assert.ok(!audit.verifyEvidence(A, 1, H2), "tampered hash rejected");
        Assert.ok(!audit.verifyEvidence(A, 2, H1), "uncommitted version rejected");
    }
    function unauthorizedRegistration() public {
        try actor.register(audit, A, H1) { Assert.ok(false, "must revert"); }
        catch Error(string memory reason) {
            Assert.equal(reason, "Only authorized reviewers can register alerts", "reviewer permission checked");
        }
        try actor.grant(audit, address(actor)) { Assert.ok(false, "admin required"); }
        catch Error(string memory reason) {
            Assert.equal(reason, "Only admin can grant reviewer role", "admin permission checked");
        }
    }
    function duplicateRegistration() public {
        audit.registerAlert(A, H1, 1);
        try audit.registerAlert(A, H2, 2) { Assert.ok(false, "must reject duplicate"); }
        catch Error(string memory reason) {
            Assert.equal(reason, "Alert already registered", "duplicate rejected");
            Assert.equal(audit.getEvidenceHash(A, 1), H1, "original immutable");
        }
    }
    function reviewAndHistoricalEvidence() public {
        audit.registerAlert(A, H1, 1);
        audit.updateReviewStatus(A, AMLAuditTrail.ReviewStatus.UnderReview, H2, 2);
        Assert.equal(uint(audit.getAlert(A).status), uint(1), "under review");
        Assert.ok(audit.verifyEvidence(A, 1, H1), "old version still verifies");
        Assert.ok(audit.verifyEvidence(A, 2, H2), "new version verifies");
        try audit.updateReviewStatus(A, AMLAuditTrail.ReviewStatus.Closed, H1, 2) { Assert.ok(false, "version reuse forbidden"); }
        catch Error(string memory reason) {
            Assert.equal(reason, "Evidence version must increase", "non increasing version rejected");
        }
    }
    function invalidTransition() public {
        audit.registerAlert(A, H1, 1);
        try audit.updateReviewStatus(A, AMLAuditTrail.ReviewStatus.Closed, H2, 2) { Assert.ok(false, "New cannot close"); }
        catch Error(string memory reason) {
            Assert.equal(reason, "Invalid review status transition", "transition rejected");
            Assert.equal(uint(audit.getAlert(A).status), uint(0), "state preserved");
        }
    }
    function reviewerGrantRevoke() public {
        audit.grantReviewerRole(address(actor));
        actor.register(audit, A, H1);
        Assert.ok(audit.reviewers(address(actor)), "granted");
        audit.revokeReviewerRole(address(actor));
        Assert.ok(!audit.reviewers(address(actor)), "revoked");
        try actor.register(audit, keccak256("other"), H2) { Assert.ok(false, "revoked actor cannot register"); }
        catch { Assert.ok(true, "revocation enforced"); }
    }
    function invalidInput() public {
        try audit.registerAlert(bytes32(0), H1, 1) { Assert.ok(false, "zero alert invalid"); }
        catch { Assert.ok(true, "zero alert rejected"); }
        try audit.registerAlert(A, bytes32(0), 1) { Assert.ok(false, "zero evidence invalid"); }
        catch { Assert.ok(true, "zero evidence rejected"); }
    }
}
