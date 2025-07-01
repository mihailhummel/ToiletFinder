// This app uses Firebase for data storage, so we don't need traditional storage
// This file is kept for compatibility with the existing setup

export interface IStorage {
  // Placeholder - Firebase handles all data operations
}

export class MemStorage implements IStorage {
  constructor() {
    // Firebase handles all storage operations
  }
}

export const storage = new MemStorage();