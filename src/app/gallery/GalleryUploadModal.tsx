"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Upload, X, FileBox, Boxes, HardDrive, Image as ImageIcon, CheckCircle2, ShieldAlert, Cloud } from "lucide-react";
import { listMyCloudBlueprints } from "@/app/actions/gallery";
import { formatBytes } from "@/lib/worldQuota";
import { useFileDrop } from "@/lib/useFileDrop";
import { BLUEPRINT_MIN_PAID_PRICE } from "@/lib/blueprintPricing";

type Tab = "upload" | "cloud";
type CloudFile = { path: string; name: string; bytes: number; ext: string };

function extOf(name: string): ".bp" | ".schem" | null {
  const l = name.toLowerCase();
  if (l.endsWith(".bp")) return ".bp";
  if (l.endsWith(".schem")) return ".schem";
  return null;
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IEND = [0x49, 0x45, 0x4e, 0x44];
function indexOfSeq(hay: Uint8Array, needle: number[], from: number): number {
  outer: for (let i = from; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}
/** .bp 버퍼에서 Axiom 내장 PNG 표지를 잘라 Blob URL 로 (모달 미리보기용). 없으면 null. 서버 lib/blueprintThumb 와 동일 로직. */
function carveBpThumbUrl(buf: ArrayBuffer): string | null {
  const u8 = new Uint8Array(buf);
  const start = indexOfSeq(u8, PNG_SIG, 0);
  if (start < 0) return null;
  const iend = indexOfSeq(u8, IEND, start);
  if (iend < 0) return null;
  const end = iend + 8; // IEND(4) + CRC(4)
  if (end > u8.length) return null;
  return URL.createObjectURL(new Blob([u8.slice(start, end)], { type: "image/png" }));
}

export default function GalleryUploadModal({ onClose, onPublished }: { onClose: () => void; onPublished: (id: string) => void }) {
  const [tab, setTab] = useState<Tab>("upload");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [price, setPrice] = useState(""); // 판매가(코인). 빈값/0 = 무료.

  const [file, setFile] = useState<File | null>(null); // upload 탭
  const [cloudFiles, setCloudFiles] = useState<CloudFile[]>([]);
  const [cloudErr, setCloudErr] = useState<string | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudSel, setCloudSel] = useState<string>(""); // 선택한 클라우드 파일 path

  const [cover, setCover] = useState<File | null>(null); // .schem 표지 업로드 전용
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [bpThumbUrl, setBpThumbUrl] = useState<string | null>(null); // .bp 내장 Axiom 표지 미리보기

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errNonce, setErrNonce] = useState(0);
  // 모든 검증/제출 오류는 이 헬퍼로 띄운다 — 도킹된 알림이 nonce 변화로 remount 되어
  // 같은 오류가 반복돼도(예: 제목 없이 재제출) 다시 흔들리고 스크린리더가 재-공지된다.
  // (오류 '해제'는 흔들면 안 되므로 setError(null) 그대로 사용.)
  const showError = (m: string) => { setError(m); setErrNonce((n) => n + 1); };
  const fileRef = useRef<HTMLInputElement | null>(null);

  // 현재 선택된 파일의 확장자(표지 요구사항 판단).
  const selectedExt: ".bp" | ".schem" | null =
    tab === "upload" ? (file ? extOf(file.name) : null) : (cloudSel ? extOf(cloudSel) : null);
  const coverRequired = selectedExt === ".schem";

  useEffect(() => {
    if (tab !== "cloud" || cloudFiles.length > 0 || cloudLoading) return;
    setCloudLoading(true);
    listMyCloudBlueprints().then((r) => {
      if (r.success) setCloudFiles(r.files as CloudFile[]);
      else setCloudErr(r.error || "클라우드 파일을 불러오지 못했습니다.");
      setCloudLoading(false);
    });
  }, [tab, cloudFiles.length, cloudLoading]);

  useEffect(() => {
    if (!cover) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(cover);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  // .bp 업로드 선택 시 내장 Axiom 표지를 클라에서 잘라 미리보기.
  useEffect(() => {
    let url: string | null = null;
    if (tab === "upload" && file && extOf(file.name) === ".bp") {
      file
        .arrayBuffer()
        .then((ab) => {
          url = carveBpThumbUrl(ab);
          setBpThumbUrl(url);
        })
        .catch(() => setBpThumbUrl(null));
    } else {
      setBpThumbUrl(null);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [tab, file]);

  // 파일 선택(클릭/드롭 공용) — .bp/.schem 만 허용.
  const pickFile = (f: File | null) => {
    if (f && !extOf(f.name)) {
      showError(".bp / .schem 파일만 올릴 수 있습니다.");
      return;
    }
    setError(null);
    setFile(f);
  };
  const { dragging, dropProps } = useFileDrop((files) => pickFile(files[0]));

  const submit = async () => {
    setError(null);
    if (!title.trim()) return showError("제목을 입력해주세요.");
    if (tab === "upload" && !file) return showError("공유할 .bp / .schem 파일을 선택해주세요.");
    if (tab === "cloud" && !cloudSel) return showError("내 클라우드에서 파일을 선택해주세요.");
    if (!selectedExt) return showError("갤러리는 .bp / .schem 파일만 공유할 수 있습니다.");
    if (coverRequired && !cover) return showError(".schem 은 내장 미리보기가 없어 표지 이미지를 직접 올려야 합니다.");
    // 판매가 검증(서버와 동일 임계값) — 유료(>0)는 최소 BLUEPRINT_MIN_PAID_PRICE 코인. 서버 왕복 없이 즉시 안내.
    const priceNum = Math.max(0, Math.floor(Number(price) || 0));
    if (priceNum > 0 && priceNum < BLUEPRINT_MIN_PAID_PRICE)
      return showError(`유료로 판매하려면 판매가를 최소 ${BLUEPRINT_MIN_PAID_PRICE}코인 이상으로 설정해주세요.`);

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("description", description.trim());
      fd.append("tags", tags);
      fd.append("price", String(Math.max(0, Math.floor(Number(price) || 0))));
      fd.append("source", tab);
      if (tab === "upload" && file) fd.append("file", file);
      if (tab === "cloud") fd.append("cloudPath", cloudSel);
      if (selectedExt === ".schem" && cover) fd.append("cover", cover); // .bp 는 Axiom 내장 표지 사용
      const r = await fetch("/api/gallery/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (r.ok && j.success) {
        onPublished(j.id);
      } else {
        showError(j.error || "공유에 실패했습니다.");
        setSubmitting(false);
      }
    } catch {
      showError("업로드 중 오류가 발생했습니다.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !submitting && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[88vh]" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
            <Boxes size={16} className="text-indigo-600" /> 블루프린트 공유
          </h3>
          <button onClick={onClose} disabled={submitting} className="text-neutral-400 hover:text-neutral-700 disabled:opacity-50">
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto p-5 space-y-4">
          {/* 소스 탭 */}
          <div className="flex items-center rounded-xl border border-neutral-200 overflow-hidden text-[12px] font-bold">
            <button
              onClick={() => setTab("upload")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 ${tab === "upload" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-50"}`}
            >
              <Upload size={13} /> 파일 업로드
            </button>
            <button
              onClick={() => setTab("cloud")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 ${tab === "cloud" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-50"}`}
            >
              <Cloud size={13} /> 내 클라우드에서 선택
            </button>
          </div>

          {/* 파일 선택 */}
          {tab === "upload" ? (
            <label className="block">
              <div
                {...dropProps}
                className={`flex items-center gap-3 px-4 py-4 rounded-xl border border-dashed cursor-pointer transition-colors ${
                  dragging
                    ? "border-indigo-400 bg-indigo-50"
                    : file
                      ? "border-emerald-300 bg-emerald-50/40"
                      : "border-neutral-300 hover:border-neutral-400 bg-neutral-50"
                }`}
              >
                <FileBox size={20} className={dragging ? "text-indigo-500" : file ? "text-emerald-500" : "text-neutral-400"} />
                <div className="min-w-0 flex-1">
                  {dragging ? (
                    <div className="text-sm font-semibold text-indigo-600">여기에 놓아 업로드</div>
                  ) : file ? (
                    <>
                      <div className="text-sm font-semibold text-neutral-900 truncate">{file.name}</div>
                      <div className="text-[11px] text-neutral-400">{formatBytes(file.size)} · {extOf(file.name) || "?"}</div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-semibold text-neutral-700">.bp / .schem 파일 선택 또는 드래그</div>
                      <div className="text-[11px] text-neutral-400">클릭하거나 파일을 이 영역에 끌어다 놓으세요</div>
                    </>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".bp,.schem"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0] || null)}
                />
              </div>
            </label>
          ) : (
            <div className="rounded-xl border border-neutral-200 max-h-52 overflow-y-auto">
              {cloudLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-neutral-400 text-sm">
                  <Loader2 size={16} className="animate-spin" /> 불러오는 중...
                </div>
              ) : cloudErr ? (
                <div className="p-6 text-center text-sm text-neutral-500">{cloudErr}</div>
              ) : cloudFiles.length === 0 ? (
                <div className="p-6 text-center text-sm text-neutral-400">
                  <HardDrive size={22} className="mx-auto mb-2 text-neutral-300" />
                  클라우드에 .bp / .schem 파일이 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {cloudFiles.map((f) => (
                    <button
                      key={f.path}
                      onClick={() => { setCloudSel(f.path); setError(null); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left ${cloudSel === f.path ? "bg-indigo-50" : "hover:bg-neutral-50"}`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full border shrink-0 ${cloudSel === f.path ? "border-indigo-600 bg-indigo-600" : "border-neutral-300"}`} />
                      <FileBox size={15} className="text-neutral-400 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-neutral-900 truncate">{f.name}</span>
                        <span className="block text-[10px] text-neutral-400 truncate">{f.path.includes("/") ? `📁 ${f.path.slice(0, f.path.lastIndexOf("/"))} · ` : ""}{formatBytes(f.bytes)}</span>
                      </span>
                      <span className="text-[10px] font-bold text-neutral-400 shrink-0">{f.ext}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 제목 / 설명 / 태그 */}
          <div className="space-y-3">
            <div>
              <label className="block text-[12px] font-bold text-neutral-800 mb-1">제목 <span className="text-rose-500">*</span></label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder="예: 중세 성문, 판타지 등대"
                className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-black focus:ring-2 focus:ring-black/5 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-neutral-800 mb-1">설명 <span className="text-neutral-400 font-medium">(선택)</span></label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="크기 · 사용 블록 팔레트 · 출처 등"
                className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-black focus:ring-2 focus:ring-black/5 focus:outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-neutral-800 mb-1">태그 <span className="text-neutral-400 font-medium">(쉼표로 구분 · 선택)</span></label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="예: 중세, 성, 판타지"
                className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-black focus:ring-2 focus:ring-black/5 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-neutral-800 mb-1">판매가 <span className="text-neutral-400 font-medium">(코인 · 비워두면 무료 · 유료는 최소 {BLUEPRINT_MIN_PAID_PRICE})</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">🪙</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0 (무료)"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-300 rounded-lg text-sm text-neutral-900 tabular-nums placeholder:text-neutral-400 focus:border-black focus:ring-2 focus:ring-black/5 focus:outline-none"
                />
              </div>
              {(() => {
                const p = Math.floor(Number(price) || 0);
                if (p > 0 && p < BLUEPRINT_MIN_PAID_PRICE)
                  return (
                    <p className="text-[11px] text-rose-500 mt-1 leading-snug font-medium">
                      유료로 판매하려면 최소 {BLUEPRINT_MIN_PAID_PRICE}코인 이상이어야 해요. (수수료를 떼면 판매 수익이 남지 않는 금액이에요.)
                    </p>
                  );
                return (
                  <p className="text-[11px] text-neutral-400 mt-1 leading-snug">
                    {p > 0
                      ? "유료로 판매됩니다. 구매자는 판매가에 구매수수료가 더해진 금액을 지불하고, 판매자는 판매수수료를 뗀 금액을 받습니다. 수수료(합 20%)는 소각됩니다."
                      : "비워두거나 0이면 기존처럼 무료로 공유됩니다(다운로드 보상 지급)."}
                  </p>
                );
              })()}
            </div>
          </div>

          {/* 표지 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-bold text-neutral-700 flex items-center gap-1.5">
                <ImageIcon size={13} className="text-neutral-500" /> 표지
                {selectedExt === ".bp" ? (
                  <span className="text-indigo-500 font-medium">(Axiom 내장 표지 자동)</span>
                ) : coverRequired ? (
                  <span className="text-rose-500">(필수)</span>
                ) : (
                  <span className="text-neutral-400 font-medium">(선택)</span>
                )}
              </span>
              {selectedExt === ".schem" && cover && (
                <button onClick={() => setCover(null)} className="text-[11px] font-bold text-neutral-400 hover:text-rose-500">제거</button>
              )}
            </div>

            {selectedExt === ".bp" ? (
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-xl border border-neutral-200 overflow-hidden flex items-center justify-center bg-neutral-100 shrink-0">
                  {bpThumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={bpThumbUrl} alt="Axiom 내장 표지" className="w-full h-full object-contain" style={{ imageRendering: "pixelated" }} />
                  ) : (
                    <Boxes size={22} className="text-neutral-300" />
                  )}
                </div>
                <p className="text-[11px] text-neutral-400 leading-snug">
                  Axiom 블루프린트에 내장된 표지(인게임 Blueprint Browser 썸네일)를 자동으로 사용합니다.
                  {tab === "cloud"
                    ? " 게시하면 표지가 표시됩니다."
                    : bpThumbUrl
                      ? ""
                      : " 이 파일에는 내장 표지가 없을 수 있어요."}
                </p>
              </div>
            ) : selectedExt === ".schem" ? (
              <div className="flex items-center gap-3">
                <label className="shrink-0">
                  <div className="w-20 h-20 rounded-xl border border-dashed border-neutral-300 hover:border-neutral-400 flex items-center justify-center overflow-hidden cursor-pointer bg-neutral-50">
                    {coverPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverPreview} alt="표지 미리보기" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={20} className="text-neutral-300" />
                    )}
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { setCover(e.target.files?.[0] || null); setError(null); }} />
                </label>
                <p className="text-[11px] text-neutral-400 leading-snug">.schem 은 내장 미리보기가 없어 표지 이미지(PNG/JPG/WebP)를 직접 올려야 합니다.</p>
              </div>
            ) : (
              <p className="text-[11px] text-neutral-400">파일을 먼저 선택하면 표지 안내가 표시됩니다.</p>
            )}
          </div>

        </div>

        {/* 검증 오류 알림 — 스크롤 영역 '밖', 공유 버튼 바로 위에 도킹해 스크롤 위치와 무관하게 항상 보인다.
            role=alert + aria-live=assertive 로 스크린리더도 즉시 공지. key={errNonce} 로 같은 오류가 반복돼도 재-흔들림. */}
        {error && (
          <div
            key={errNonce}
            role="alert"
            aria-atomic="true"
            className="bc-shake shrink-0 mx-5 mb-2 px-3 py-2.5 rounded-lg text-xs font-semibold flex items-start gap-2 bg-rose-50 text-rose-700 border border-rose-200 shadow-sm"
          >
            <ShieldAlert size={14} className="mt-px shrink-0" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        <div className="shrink-0 px-5 py-3 border-t border-neutral-100 flex justify-end gap-2">
          <button onClick={onClose} disabled={submitting} className="px-3 py-1.5 text-[12px] font-bold text-neutral-600 hover:bg-neutral-100 rounded-lg disabled:opacity-50">취소</button>
          <button
            onClick={submit}
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-1.5 text-[12px] font-bold bg-black hover:bg-neutral-800 text-white rounded-lg disabled:opacity-40"
          >
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} 공유하기
          </button>
        </div>
      </div>
    </div>
  );
}
