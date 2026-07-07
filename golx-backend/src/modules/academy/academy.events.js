const ACADEMY_EVENTS = {
    CREATED: 'academy.created',            // { academyId, name, ownerUserId }
    UPDATED: 'academy.updated',            // { academyId }
    BRANCH_CREATED: 'academy.branch.created',     // { branchId, academyId, name }
    BRANCH_UPDATED: 'academy.branch.updated',     // { branchId, academyId }
    BRANCH_DELETED: 'academy.branch.deleted',     // { branchId, academyId }
    GROUP_CREATED: 'academy.group.created',      // { groupId, branchId, labels }
    GROUP_UPDATED: 'academy.group.updated',      // { groupId }
    GROUP_DELETED: 'academy.group.deleted',      // { groupId }
    BIRTH_YEAR_CREATED: 'academy.birth_year.created', // { birthYearId, branchId, label }
};

module.exports = ACADEMY_EVENTS;
