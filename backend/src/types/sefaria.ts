export interface SefariaText {
  ref: string
  heRef: string
  text: string[]
  he: string[]
  versions: SefariaVersion[]
  textDepth: number
  sectionNames: string[]
  addressTypes: string[]
  next?: string | null
  prev?: string | null
  book: string
  title: string
  heTitle: string
  categories: string[]
  primary_category: string
  sections: number[]
  toSections: number[]
  sectionRef: string
  heSectionRef: string
  firstAvailableSectionRef: string
  isSpanning: boolean
  spanningRefs: string[]
}

export interface SefariaVersion {
  title?: string
  versionTitle: string
  versionSource?: string
  status: string
  priority: number | string
  license?: string
  versionNotes?: string
  formatAsPoetry?: boolean | string
  digitizedBySefaria?: boolean | string
  method?: string
  heversionSource?: string
  versionUrl?: string
  versionTitleInHebrew?: string
  versionNotesInHebrew?: string
  shortVersionTitle?: string
  shortVersionTitleInHebrew?: string
  extendedNotes?: string
  extendedNotesHebrew?: string
  purchaseInformationImage?: string
  purchaseInformationURL?: string
  hasManuallyWrappedRefs?: string
  actualLanguage?: string
  languageFamilyName?: string
  isSource?: boolean
  isPrimary?: boolean
  direction?: string
  language?: string
  text?: string[] | string[][]
  firstSectionRef?: string
}

export interface SefariaIndex {
  title: string
  heTitle: string
  categories: string[]
  primary_category: string
  enDesc?: string
  heDesc?: string
  compDate?: string
  compPlace?: string
  pubDate?: string
  pubPlace?: string
  era?: string
  order?: number[]
  depth?: number
  addressTypes?: string[]
  sectionNames?: string[]
}

export interface SefariaTextStructure {
  title: string
  heTitle: string
  titleVariants: string[]
  heTitleVariants: string[]
  sectionNames: string[]
  depth: number
  addressTypes: string[]
  textDepth: number
  categories: string[]
  order: number[]
  schema: SefariaSchema
}

export interface SefariaSchema {
  nodeType: string
  depth: number
  addressTypes: string[]
  sectionNames: string[]
  titles: SefariaTitle[]
  key?: string
  children?: SefariaSchema[]
}

export interface SefariaTitle {
  text: string
  lang: string
  primary?: boolean
}

export interface SefariaSearchResult {
  ref: string
  heRef: string
  version: string
  content: string
  highlight: string[]
  type: string
}

export interface SefariaLink {
  _id: string
  refs: string[]
  anchorRef: string
  sourceRef: string
  sourceHeRef: string
  anchorVerse: number
  type: string
  auto: boolean
  generated_by?: string
}

export interface SefariaApiError {
  error: string
  message?: string
}

export interface CachedSefariaData<T> {
  data: T
  timestamp: number
  ttl: number
}