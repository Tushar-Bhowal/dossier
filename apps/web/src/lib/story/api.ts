import type { ExtractStoriesResult, Story, StoryInput } from "@dossier/core/resume";
import { mockApi } from "./demo/mockApi";

// Stage 1: demo data under Resume Studio's demo switcher. S6 adds the real routes.
export const STORY_SAMPLE = true;

export const listStories = (): Promise<Story[]> => mockApi.listStories();
export const extractStories = (): Promise<ExtractStoriesResult> => mockApi.extractStories();
export const saveStory = (id: string, input: StoryInput): Promise<Story> => mockApi.saveStory(id, input);
export const createStory = (input: StoryInput): Promise<Story> => mockApi.createStory(input);
export const deleteStory = (id: string): Promise<void> => mockApi.deleteStory(id);
export const restoreStory = (story: Story): Promise<void> => mockApi.restoreStory(story);

// Under Resume Studio's key so its demo switcher refreshes stories too.
export const storyKeys = { list: ["resume-studio", "stories"] as const };
