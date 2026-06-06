"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppContext } from "@/context/AppContext";
import { createStudent, getStudents } from "@/lib/api";
import type { Student } from "@/lib/types";

function normalizeStudent(student: Partial<Student> | null): Student | null {
  if (!student) return null;
  return {
    id: (student.id || student._id) as string,
    name: student.name as string,
    class: student.class,
    school: student.school,
    ...student,
  };
}

export function useStudentWorkspace() {
  const { currentStudent, setCurrentStudent } = useAppContext();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const normalizedCurrentStudent = useMemo(
    () => normalizeStudent(currentStudent),
    [currentStudent],
  );

  const refreshStudents = useCallback(async () => {
    try {
      setLoading(true);
      const list = await getStudents();
      setStudents(list.map((s) => normalizeStudent(s)).filter(Boolean) as Student[]);
      setError(null);
    } catch (err) {
      setStudents([]);
      setError(err instanceof Error ? err.message : "Failed to load students");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refreshStudents();
    })();
  }, [refreshStudents]);

  // Reconcile the active student against the loaded roster.
  useEffect(() => {
    void (async () => {
      if (loading) return;
      const currentId = normalizedCurrentStudent?.id;
      if (!currentId) return;
      const match = students.find((s) => s.id === currentId);
      if (!match) setCurrentStudent(null);
    })();
  }, [normalizedCurrentStudent?.id, setCurrentStudent, students, loading]);

  const selectStudent = useCallback(
    (studentId: string | null) => {
      if (!studentId) {
        setCurrentStudent(null);
        return;
      }
      const selected = students.find((s) => s.id === studentId);
      if (selected) setCurrentStudent(selected);
    },
    [students, setCurrentStudent],
  );

  const createStudentProfile = useCallback(
    async (studentData: Partial<Student>) => {
      try {
        setCreating(true);
        const response = await createStudent(studentData);
        const newStudent = normalizeStudent(response.data ?? (response as Student));
        if (newStudent) {
          setStudents((prev) => [newStudent, ...prev]);
          setCurrentStudent(newStudent);
        }
        setError(null);
        return newStudent;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create student");
        throw err;
      } finally {
        setCreating(false);
      }
    },
    [setCurrentStudent],
  );

  return {
    students,
    loading,
    error,
    creating,
    currentStudent: normalizedCurrentStudent,
    selectStudent,
    createStudentProfile,
    refreshStudents,
  };
}

export default useStudentWorkspace;
