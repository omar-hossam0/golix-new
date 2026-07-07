/**
 * player-code.helper.js
 *
 * Pure, side-effect-free helpers for generating PLY-style player codes.
 * Contains zero DB calls — all DB interaction lives in the repository.
 */

const { ValidationError } = require('./errors/index');

/**
 * Age categories supported by the system.
 * Ordered from youngest to oldest so the first match wins.
 */
const AGE_CATEGORIES = [
    { max: 10, label: 'U10' },
    { max: 14, label: 'U14' },
    { max: 18, label: 'U18' },
];

/**
 * Calculate completed years of age from a birth date.
 *
 * @param {string|Date} dateOfBirth  ISO date string (YYYY-MM-DD) or Date object
 * @param {Date}        [asOf]       Reference date — defaults to today (UTC)
 * @returns {number}   Completed years of age
 * @throws  {ValidationError}  If the date is invalid or in the future
 */
function calcAge(dateOfBirth, asOf = new Date()) {
    const birth = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);

    if (Number.isNaN(birth.getTime())) {
        throw new ValidationError('Invalid date of birth');
    }
    if (birth > asOf) {
        throw new ValidationError('Date of birth cannot be in the future');
    }

    let age = asOf.getFullYear() - birth.getFullYear();
    const monthDiff = asOf.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < birth.getDate())) {
        age -= 1;
    }
    return age;
}

/**
 * Determine the age category label for a given birth date.
 *
 * @param {string|Date} dateOfBirth
 * @returns {'U10'|'U14'|'U18'}
 * @throws  {ValidationError}  If age is invalid or ≥ 18
 */
function getAgeCategory(dateOfBirth) {
    const age = calcAge(dateOfBirth);

    if (age < 0) {
        throw new ValidationError('Date of birth results in a negative age — check the value');
    }

    const category = AGE_CATEGORIES.find((c) => age < c.max);
    if (!category) {
        throw new ValidationError(
            `Player age (${age}) is 18 or older and does not fall into a youth category (U10/U14/U18). ` +
            'Use a separate registration flow for adult players.',
        );
    }

    return category.label;
}

/**
 * Format the sequential number as a zero-padded 4-digit string.
 * Supports up to 9 999 sequential players per category per year.
 * If somehow the sequence exceeds 9 999 it becomes 5+ digits (still unique).
 *
 * @param {number} seq
 * @returns {string}  e.g. 1 → '0001', 125 → '0125'
 */
function formatSeq(seq) {
    return String(seq).padStart(4, '0');
}

/**
 * Build the final player code string from its parts.
 *
 * @param {'U10'|'U14'|'U18'} category
 * @param {number}             year     4-digit year
 * @param {number}             seq      Sequential number
 * @returns {string}  e.g. 'PLY-U10-2026-0001'
 */
function buildPlayerCode(category, year, seq) {
    return `PLY-${category}-${year}-${formatSeq(seq)}`;
}

module.exports = { calcAge, getAgeCategory, buildPlayerCode, AGE_CATEGORIES };
