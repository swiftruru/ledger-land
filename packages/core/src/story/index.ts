// 故事重播、自由實驗覆寫、可輸入範圍（04 第 9 節）
export { createCoreContext } from './context.ts';
export type { CreateCoreContextOptions } from './context.ts';
export { allowedRange, applyOverrides, orderedSteps, replayStory, stateAfterStep } from './replay.ts';
export type { AllowedRange, ParamAddress, ParamOverride, Story, StoryEvent, StoryRun, StoryStep } from './types.ts';
