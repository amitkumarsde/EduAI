"use client";

import { useEffect, useState } from "react";
import { getStudentOverview } from "@/lib/api";
import type { StudentOverview } from "@/lib/types";

export function useStudentOverview(studentId?: string | null) {
  const [overview, setOverview] = useState<StudentOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      if (!studentId) {
        if (!ignore) {
          setOverview(null);
          setLoading(false);
          setError(null);
        }
        return;
      }
      try {
        setLoading(true);
        const data = await getStudentOverview(studentId);
        if (!ignore) {
          setOverview(data);
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          setOverview(null);
          setError(err instanceof Error ? err.message : "Failed to load overview");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [studentId]);

  return { overview, loading, error };
}

export default useStudentOverview;
