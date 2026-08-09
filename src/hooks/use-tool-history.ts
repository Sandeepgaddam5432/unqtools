"use client";

/**
 * React bindings for site-wide tool history (Favorites + Recently viewed).
 * Thin wrappers over src/lib/tool-history.ts — state loads on mount
 * (hydration-safe), writes go straight to localStorage, and the browser
 * `storage` event keeps multiple tabs in sync.
 */

import { useCallback, useEffect, useState } from "react";
import {
  clearFavorites,
  clearRecent,
  loadFavorites,
  loadRecent,
  recordRecent,
  toggleFavorite,
} from "@/lib/tool-history";

export interface UseFavoritesResult {
  /** Ordered favorite tool ids (most recently favorited first). */
  favorites: string[];
  /** Toggle a tool id; returns nothing — state updates automatically. */
  toggle: (id: string) => void;
  /** Remove all favorites. */
  clear: () => void;
  /** Whether a tool id is currently favorited. */
  isFavorite: (id: string) => boolean;
}

export function useFavorites(): UseFavoritesResult {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    setFavorites(loadFavorites());
    const sync = (e: StorageEvent) => {
      if (!e.key || e.key === "unqtools:favorites") setFavorites(loadFavorites());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const toggle = useCallback((id: string) => {
    setFavorites(toggleFavorite(id));
  }, []);

  const clear = useCallback(() => {
    clearFavorites();
    setFavorites([]);
  }, []);

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);

  return { favorites, toggle, clear, isFavorite };
}

export interface UseRecentToolsResult {
  /** Ordered recent tool ids (most recently visited first). */
  recent: string[];
  /** Record a tool visit (dedupe + move to front + cap). */
  record: (id: string) => void;
  /** Clear the recently-viewed list. */
  clear: () => void;
}

export function useRecentTools(): UseRecentToolsResult {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(loadRecent());
    const sync = (e: StorageEvent) => {
      if (!e.key || e.key === "unqtools:recent") setRecent(loadRecent());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const record = useCallback((id: string) => {
    setRecent(recordRecent(id));
  }, []);

  const clear = useCallback(() => {
    clearRecent();
    setRecent([]);
  }, []);

  return { recent, record, clear };
}
