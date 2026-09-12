import { describe, expect, it } from 'vitest';
import { deriveRoleTitle } from '../../packages/core/src/pipeline/assembleKit.js';

describe('deriveRoleTitle', () => {
  it('takes the first line when it is already the title', () => {
    expect(deriveRoleTitle('Senior Backend Engineer\n\nWe are looking for someone to join us.')).toBe(
      'Senior Backend Engineer',
    );
  });

  it('skips a section heading and reads the title from the posting\'s own phrasing', () => {
    const jd =
      'About The Role:\n\nWe are looking for a MERN Stack Developer who will take ownership of end-to-end web applications.\n\nKey Responsibilities:';
    expect(deriveRoleTitle(jd)).toBe('MERN Stack Developer');
  });

  it('does not promote body copy to a title', () => {
    // The heading is skipped and no "looking for X" phrasing exists, so inventing a title from the
    // first sentence would be worse than admitting there isn't one.
    expect(deriveRoleTitle('Job Description:\n\nThe team builds data tools. You will help.')).toBe(
      'Not specified',
    );
  });

  it('handles a two-line stub without inventing detail', () => {
    expect(deriveRoleTitle('Frontend dev needed.\nMust know React.')).toBe('Not specified');
  });

  it('reads a title out of "is hiring a ..." phrasing', () => {
    expect(deriveRoleTitle('Overview\n\nAcme is hiring a Staff Platform Engineer to scale our systems.')).toBe(
      'Staff Platform Engineer',
    );
  });

  it('returns Not specified for an empty description', () => {
    expect(deriveRoleTitle('')).toBe('Not specified');
  });
});
