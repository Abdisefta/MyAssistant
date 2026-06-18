import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { isFirebaseConfigured } from '@/constants/firebase';
import {
  subscribeToAuth,
  type AppUser,
} from '@/services/app-auth';

const AUTH_CACHE_KEY = '@my_assistant_auth_user';

export function useAppAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured) {
      setIsLoading(false);
      return;
    }

    let active = true;

    AsyncStorage.getItem(AUTH_CACHE_KEY).then((cached) => {
      if (!active || !cached) return;
      try {
        setUser(JSON.parse(cached) as AppUser);
      } catch {
        // ignore bad cache
      }
    });

    const unsubscribe = subscribeToAuth((nextUser) => {
      if (!active) return;
      setUser(nextUser);
      setIsLoading(false);
      if (nextUser) {
        AsyncStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(nextUser));
      } else {
        AsyncStorage.removeItem(AUTH_CACHE_KEY);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [configured]);

  return {
    user,
    isLoading,
    isConfigured: configured,
  };
}
