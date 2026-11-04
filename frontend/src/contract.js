export const CONTRACT_ADDRESS = "0x7c05EDb8c949Ed93cb81E1fd44d81f27C47C3932";
export const CONTRACT_ABI = [
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "alertId",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "bytes32",
				"name": "evidenceHash",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "uint32",
				"name": "version",
				"type": "uint32"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "reviewer",
				"type": "address"
			}
		],
		"name": "AlertRegistered",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "reviewer",
				"type": "address"
			}
		],
		"name": "grantReviewerRole",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "alertId",
				"type": "bytes32"
			},
			{
				"internalType": "bytes32",
				"name": "evidenceHash",
				"type": "bytes32"
			},
			{
				"internalType": "uint32",
				"name": "version",
				"type": "uint32"
			}
		],
		"name": "registerAlert",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "alertId",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "enum AMLAuditTrail.ReviewStatus",
				"name": "status",
				"type": "uint8"
			},
			{
				"indexed": false,
				"internalType": "bytes32",
				"name": "evidenceHash",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "uint32",
				"name": "version",
				"type": "uint32"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "reviewer",
				"type": "address"
			}
		],
		"name": "ReviewStatusUpdated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "reviewer",
				"type": "address"
			}
		],
		"name": "ReviewerGranted",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "reviewer",
				"type": "address"
			}
		],
		"name": "ReviewerRevoked",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "reviewer",
				"type": "address"
			}
		],
		"name": "revokeReviewerRole",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "alertId",
				"type": "bytes32"
			},
			{
				"internalType": "enum AMLAuditTrail.ReviewStatus",
				"name": "next",
				"type": "uint8"
			},
			{
				"internalType": "bytes32",
				"name": "evidenceHash",
				"type": "bytes32"
			},
			{
				"internalType": "uint32",
				"name": "version",
				"type": "uint32"
			}
		],
		"name": "updateReviewStatus",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "admin",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "alertId",
				"type": "bytes32"
			}
		],
		"name": "getAlert",
		"outputs": [
			{
				"components": [
					{
						"internalType": "bool",
						"name": "exists",
						"type": "bool"
					},
					{
						"internalType": "enum AMLAuditTrail.ReviewStatus",
						"name": "status",
						"type": "uint8"
					},
					{
						"internalType": "uint32",
						"name": "version",
						"type": "uint32"
					},
					{
						"internalType": "address",
						"name": "reviewer",
						"type": "address"
					},
					{
						"internalType": "uint64",
						"name": "updatedAt",
						"type": "uint64"
					}
				],
				"internalType": "struct AMLAuditTrail.Alert",
				"name": "",
				"type": "tuple"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "alertId",
				"type": "bytes32"
			},
			{
				"internalType": "uint32",
				"name": "version",
				"type": "uint32"
			}
		],
		"name": "getEvidenceHash",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "reviewers",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "alertId",
				"type": "bytes32"
			},
			{
				"internalType": "uint32",
				"name": "version",
				"type": "uint32"
			},
			{
				"internalType": "bytes32",
				"name": "supplied",
				"type": "bytes32"
			}
		],
		"name": "verifyEvidence",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
]