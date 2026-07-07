const {
  buildContinuousWeekKeys,
  gradeForScore,
  modelPosition,
  optionMidpoint,
  roleFamily,
  weightedWeeklyScore,
  weekEndKey,
} = require('../ranking-inputs.helpers');

describe('ranking input helpers', () => {
  test('builds continuous weekly keys through the current/latest week', () => {
    expect(buildContinuousWeekKeys(['2026-06-01', '2026-06-15'], null)).toEqual([
      '2026-06-01',
      '2026-06-08',
      '2026-06-15',
    ]);
    expect(buildContinuousWeekKeys(['2026-06-01'], '2026-06-15')).toEqual([
      '2026-06-01',
      '2026-06-08',
      '2026-06-15',
    ]);
  });

  test('keeps weekly input windows isolated to seven-day buckets', () => {
    expect(weekEndKey('2026-06-29')).toBe('2026-07-05');
    expect(weekEndKey('2026-07-06')).toBe('2026-07-12');
    expect(buildContinuousWeekKeys(['2026-06-29'], '2026-07-06')).toEqual([
      '2026-06-29',
      '2026-07-06',
    ]);
  });

  test('keeps existing role and model position mapping stable', () => {
    expect(roleFamily('ST')).toBe('attack');
    expect(roleFamily('CM')).toBe('midfield');
    expect(roleFamily('CB')).toBe('defense');
    expect(roleFamily('GK')).toBe('goalkeeper');
    expect(modelPosition('goalkeeper')).toBe('GOALKEEPER');
    expect(modelPosition('unknown')).toBe('UNKNOWN');
  });

  test('keeps score buckets and grades stable', () => {
    expect(optionMidpoint(8, 'rating10')).toBe(7.45);
    expect(optionMidpoint(0, 'rating10', { zeroMeansMissing: true })).toBeNull();
    expect(gradeForScore(90)).toBe('A');
    expect(gradeForScore(79.9)).toBe('C');
    expect(weightedWeeklyScore({
      matchScore: 80,
      coachScore: 70,
      attendanceScore: 100,
      weeklyAiScore: 50,
    })).toBe(77.5);
  });
});
