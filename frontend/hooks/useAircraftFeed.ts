"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { fetchAircraft, type AircraftQueryOptions, ApiError } from "@/lib/api";
import type { AircraftResponse } from "@/lib/schemas";
import { LIMITS } from "@/lib/constants";

export type FeedStatus = "loading" | "success" | "error";

interface UseAircraftFeedResult {
  data: AircraftResponse | null;
  status: FeedStatus;
  error: string | null;
  lastUpdated: Date | null;
  isStale: boolean;
  refresh: () => void;
}

export function useAircraftFeed(
  icao: string,
  options: AircraftQueryOptions
): UseAircraftFeedResult {
  const [data, setData] = useState<AircraftResponse | null>(null);
  const [status, setStatus] = useState<FeedStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);

  const radius = options.radius;
  const all = options.all;
  const categoriesJoined = options.categories ? options.categories.join(",") : "";

  // References to handle polling, cancellation, and concurrency
  const abortControllerRef = useRef<AbortController | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const backoffDelayRef = useRef<number>(LIMITS.POLL_INTERVAL_MS);

  // Stale checker effect
  useEffect(() => {
    const staleInterval = setInterval(() => {
      if (lastUpdated) {
        const ageMs = Date.now() - lastUpdated.getTime();
        setIsStale(ageMs > LIMITS.STALE_THRESHOLD_MS);
      }
    }, 5000);

    return () => clearInterval(staleInterval);
  }, [lastUpdated]);

  const executeFetch = useCallback(
    async (signal?: AbortSignal) => {
      if (isFetchingRef.current) {
        return;
      }

      isFetchingRef.current = true;
      try {
        const parsedCategories = categoriesJoined
          ? (categoriesJoined.split(",") as AircraftQueryOptions["categories"])
          : undefined;

        const result = await fetchAircraft(
          icao,
          { radius, all, categories: parsedCategories },
          signal
        );

        setData(result);
        setStatus("success");
        setError(null);
        setLastUpdated(new Date());
        setIsStale(false);
        backoffDelayRef.current = LIMITS.POLL_INTERVAL_MS;
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        setStatus("error");
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Unable to update live aircraft data.");
        }

        backoffDelayRef.current = Math.min(
          backoffDelayRef.current * 2,
          LIMITS.MAX_BACKOFF_MS
        );
      } finally {
        isFetchingRef.current = false;
      }
    },
    [icao, radius, all, categoriesJoined]
  );

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const runPollCycle = async () => {
      if (document.hidden || !isMounted) {
        return;
      }

      await executeFetch(controller.signal);

      if (isMounted && !document.hidden) {
        timerRef.current = setTimeout(() => {
          runPollCycle();
        }, backoffDelayRef.current);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      } else {
        runPollCycle();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    runPollCycle();

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      controller.abort();
    };
  }, [executeFetch]);

  const refresh = useCallback(() => {
    backoffDelayRef.current = LIMITS.POLL_INTERVAL_MS;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    executeFetch(controller.signal);
  }, [executeFetch]);

  return {
    data,
    status,
    error,
    lastUpdated,
    isStale,
    refresh,
  };
}
