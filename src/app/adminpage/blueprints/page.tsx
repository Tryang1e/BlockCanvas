import BlueprintReportsClient from "./BlueprintReportsClient";

export const dynamic = "force-dynamic";

// 접근 권한은 상위 adminpage/layout.tsx 에서 staff(admin|manager) 로 게이트됨.
export default function AdminBlueprintsPage() {
  return <BlueprintReportsClient />;
}
