export const LOADING_STRATEGY = {
  pageOrTab: 'skeleton_only',
  componentData: 'skeleton_only',
  actionSubmit: 'spinner_only'
} as const

export const LOADING_RULES = {
  useSpinnerForPage: false,
  useSpinnerForTabs: false,
  useSpinnerForMutationsOnly: true
} as const

export type LoadingStrategyType = typeof LOADING_STRATEGY
