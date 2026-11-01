import AsyncStorage from "@react-native-async-storage/async-storage";
import { createPersistence, type KeyValueStore } from "./persistence";

const store: KeyValueStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
  getAllKeys: () => AsyncStorage.getAllKeys(),
};

/** App-wide persistence on top of AsyncStorage (not encrypted storage). */
export const persistence = createPersistence(store);
