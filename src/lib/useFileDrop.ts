"use client";

import { useCallback, useState } from "react";
import type { DragEvent } from "react";

/**
 * 파일 드래그앤드롭 업로드 공용 훅.
 *  - 파일 드래그일 때만 반응(내부 요소 이동 DnD 등 파일이 아닌 드래그는 무시).
 *  - dragging: 드롭존 강조용 상태. dropProps: 드롭 대상 요소에 스프레드.
 * 사용: const { dragging, dropProps } = useFileDrop((files) => upload(files));
 *      <div {...dropProps} className={dragging ? "..." : "..."}>
 */
export function useFileDrop(onFiles: (files: File[]) => void, disabled = false) {
  const [dragging, setDragging] = useState(false);

  const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes("Files");

  const onDragOver = useCallback(
    (e: DragEvent) => {
      if (disabled || !isFileDrag(e)) return;
      e.preventDefault();
      setDragging(true);
    },
    [disabled]
  );

  const onDragLeave = useCallback((e: DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      if (disabled) return;
      const files = Array.from(e.dataTransfer?.files || []);
      if (!files.length) return; // 파일이 아니면(내부 이동 등) 무시
      e.preventDefault();
      setDragging(false);
      onFiles(files);
    },
    [disabled, onFiles]
  );

  return { dragging, dropProps: { onDragOver, onDragLeave, onDrop } };
}
