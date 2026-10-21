export declare const libraryName: string

export type LibraryPlace = { siteDir: string; audience: 'personal' | 'shared'; providedDirs: Readonly<Record<string, string>> }

export type LibraryItem = { id: string; dir: string; title: string; pages: Array<{ name: string; title: string }> }

export declare function itemsDirOf(place: LibraryPlace): string | undefined
export declare function itemOf(itemsDir: string, id: string): LibraryItem | undefined
export declare function allItems(itemsDir: string | undefined): LibraryItem[]
export declare function pageFileOf(item: LibraryItem, pageName: string): string