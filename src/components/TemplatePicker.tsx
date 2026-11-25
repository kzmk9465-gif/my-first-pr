"use client";

import { useState } from "react";

/** 説明文欄。テンプレートを選ぶと本文に差し込む。 */
export default function TemplatePicker({ templates }: { templates: { id: number; name: string; body: string }[] }) {
  const [body, setBody] = useState("");
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span>説明</span>
        {templates.length > 0 && (
          <select className="input !w-auto !py-1 text-xs" defaultValue="" onChange={(e) => { const t = templates.find((x) => String(x.id) === e.target.value); if (t) setBody(t.body); }}>
            <option value="">テンプレートから挿入…</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>
      <textarea name="description" rows={7} className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="サイズ、特徴、発送方法、死着保証の有無など" />
    </div>
  );
}
