/**
 * Auth Module — Event names & payload contracts.
 * When extracted to microservice: same events go via Kafka — zero code change.
 */
const AUTH_EVENTS = {
    USER_REGISTERED: 'auth.user.registered',     // { userId, role, academyId, email }
    USER_LOGGED_IN: 'auth.user.logged_in',      // { userId, role, ip }
    USER_LOGGED_OUT: 'auth.user.logged_out',     // { userId, sessionId }
    PASSWORD_RESET_REQ: 'auth.password.reset_req',  // { userId, email }
    PASSWORD_CHANGED: 'auth.password.changed',    // { userId }
    TOKEN_REFRESHED: 'auth.token.refreshed',     // { userId }
};

module.exports = AUTH_EVENTS;
