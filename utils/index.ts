import { Dispatch, SetStateAction, useEffect, useState } from 'react';

export const useLocalStorageState = <T>(
  key: string,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] => {
  const [state, setState] = useState<T>(() => {
    if (typeof window !== 'undefined') {
      const storageValue = localStorage.getItem(key);
      if (storageValue !== null) {
        try {
          return JSON.parse(storageValue);
        } catch {}
      }
    }
    return defaultValue;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(state));
    }
  }, [key, state]);

  return [state, setState];
};
