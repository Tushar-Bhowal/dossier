import { z } from 'zod';
import { Origin } from './kit.js';

// A STAR story mined from the resume: something the user can retell in a behavioural answer.
export const Story = z.object({
  id: z.string(),
  title: z.string().trim().min(1, 'Give the story a short title').max(120),
  situation: z.string().max(600),
  task: z.string().max(600),
  action: z.string().max(1200),
  result: z.string().max(600),
  skills: z.array(z.string().max(40)).max(8),
  // The resume line it came from; null when the user wrote it from scratch.
  fromBullet: z.string().nullable(),
  origin: Origin,
  updatedAt: z.iso.datetime(),
});
export type Story = z.infer<typeof Story>;

export const StoryInput = Story.pick({ title: true, situation: true, task: true, action: true, result: true, skills: true });
export type StoryInput = z.infer<typeof StoryInput>;

// Lines too thin to make a story (no action or outcome) are skipped, never padded with made-up detail.
export const ExtractStoriesResult = z.object({
  added: z.array(Story),
  skipped: z.array(z.string()),
});
export type ExtractStoriesResult = z.infer<typeof ExtractStoriesResult>;
