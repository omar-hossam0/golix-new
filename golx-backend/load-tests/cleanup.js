const {
    cleanupAllLoadUsers,
    closeInfrastructure,
    db,
    identityFingerprint,
    loadTestCounts,
} = require('./data');

async function main() {
    const confirmation = process.argv.find((argument) => argument.startsWith('--confirm='))
        ?.split('=')[1];
    if (confirmation !== 'DELETE_GOALIX_LOAD_USERS') {
        throw new Error(
            'Refusing cleanup. Re-run with --confirm=DELETE_GOALIX_LOAD_USERS',
        );
    }

    const beforeFingerprint = await identityFingerprint();
    const before = await loadTestCounts();
    const deleted = await cleanupAllLoadUsers();
    const after = await loadTestCounts();
    const afterFingerprint = await identityFingerprint();
    const originalUsersUnchanged = (
        beforeFingerprint.authUsers.count === afterFingerprint.authUsers.count
        && beforeFingerprint.authUsers.hash === afterFingerprint.authUsers.hash
        && beforeFingerprint.iamUsers.count === afterFingerprint.iamUsers.count
        && beforeFingerprint.iamUsers.hash === afterFingerprint.iamUsers.hash
    );

    console.log(JSON.stringify({
        before,
        deleted,
        after,
        originalUsersUnchanged,
    }, null, 2));

    if (after.authUsers || after.iamUsers || after.sessions) {
        throw new Error('Some load-test rows remain after cleanup');
    }
    if (!originalUsersUnchanged) {
        throw new Error('Original-user fingerprint changed during cleanup');
    }
}

main()
    .catch((error) => {
        console.error(error.stack || error.message);
        process.exitCode = 1;
    })
    .finally(() => closeInfrastructure());
