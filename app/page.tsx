import { redirect } from "next/navigation";

// ルートアクセスは給与明細画面へリダイレクト
export default function Home() {
  redirect("/payslip");
}
