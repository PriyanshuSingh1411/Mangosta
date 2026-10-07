"use client";

import { useEffect, useRef } from "react";
import {
  trackEngagement,
  type EngagementEvent,
} from "@/app/lib/trackEngagement";

interface EngagementTrackerProps {
  event: EngagementEvent;
  productId?: string;
  searchQuery?: string;
  path?: string;
  metadata?: Record<string, unknown>;
}

export default function EngagementTracker({
  event,
  productId,
  searchQuery,
  path,
  metadata,
}: EngagementTrackerProps) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;

    tracked.current = true;

    void trackEngagement({
      event,
      productId,
      searchQuery,
      path,
      metadata,
    });
  }, [event, productId, searchQuery, path, metadata]);

  return null;
}