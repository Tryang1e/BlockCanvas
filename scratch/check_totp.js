const { generateSecret, generateSync, verifySync } = require('otplib');

const secret = generateSecret();

// Generate a token for 90 seconds in the future (3 steps forward)
const futureEpoch = Math.floor(Date.now() / 1000) + 90;
const token = generateSync({ secret, epoch: futureEpoch });

// Verify with default (no epochTolerance)
console.log('Verify with default:', verifySync({ token, secret }));

// Verify with epochTolerance: 2 (2 intervals)
console.log('Verify with epochTolerance: 2:', verifySync({ token, secret, epochTolerance: 2 }));

// Verify with epochTolerance: 90 (90 seconds? or steps?)
console.log('Verify with epochTolerance: 90:', verifySync({ token, secret, epochTolerance: 90 }));

// Verify with epochTolerance: 4 (4 intervals)
console.log('Verify with epochTolerance: 4:', verifySync({ token, secret, epochTolerance: 4 }));
