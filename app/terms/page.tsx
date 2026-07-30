import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection, LegalList } from "@/app/components/legal";

export const metadata: Metadata = {
  title: "使用條款｜PTT MacShop 雷達",
  description: "PTT MacShop 雷達的使用條款與免責聲明。",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="使用條款與注意事項"
      updated="2026-07-30"
      intro="本文件不是正式法律文件，是這個個人專案（以下稱「本服務」）的使用說明與免責聲明。"
    >
      <LegalSection title="1. 這是什麼服務">
        <p>
          本服務會定期擷取 PTT MacShop 看板的公開文章（標題、作者、發文時間、內文、推文數），提供搜尋功能，並讓使用者透過
          Discord 帳號登入後訂閱關鍵字，符合的新文章會以 Discord 私訊通知。
        </p>
        <p>
          本服務是個人開發、非官方的第三方工具，<strong>與 PTT（批踢踢實業坊）、國立台灣大學、Discord Inc.
          均無任何關係，未獲得上述單位授權或背書</strong>。
        </p>
      </LegalSection>

      <LegalSection title="2. 資料來源與著作權">
        <LegalList
          items={[
            "本服務顯示的文章內容擷取自 PTT MacShop 看板的公開頁面，著作權屬於原發文者與 PTT 平台所有，本服務僅提供搜尋/通知的索引功能，不會宣稱擁有這些內容的著作權",
            "搜尋結果一律附上原文連結，鼓勵使用者回到 PTT 原站閱讀完整討論與推文",
            "若原發文者或 PTT 官方要求下架特定內容，會配合處理",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. 帳號與資料蒐集">
        <p>
          登入方式為 Discord OAuth2，只會取得 Discord 提供的公開識別資訊（使用者 ID、使用者名稱），
          <strong>不會取得你的 Discord 密碼，也不會讀取你的訊息或伺服器內容</strong>。詳細的資料蒐集範圍請見
          <Link href="/privacy" className="text-blue-600 hover:underline">
            隱私權政策
          </Link>
          。
        </p>
      </LegalSection>

      <LegalSection title="4. 通知功能與使用限制">
        <p>
          符合訂閱關鍵字的新文章，會透過 Discord 私訊（DM）通知，通知內容僅包含文章標題與連結。為避免濫用與控制成本，
          <strong>非本服務擁有者的帳號，每日可收到的通知數量上限為 20 篇</strong>，超過上限會先收到一次提醒，之後靜默到隔天。
        </p>
      </LegalSection>

      <LegalSection title="5. 免責聲明">
        <LegalList
          items={[
            <>
              <strong>本服務不涉入、不擔保、不介入任何透過 PTT MacShop 版進行的交易</strong>
              ——包含但不限於商品真偽、賣家/買家身分、交易安全、付款糾紛。所有交易行為與風險由參與交易的雙方自行負責，請自行遵守
              PTT 板規並注意交易安全
            </>,
            "本服務為個人練習/興趣專案，不保證服務永久可用、資料即時或完全正確。爬蟲擷取可能因 PTT 網站改版、網路問題、維護等原因而中斷或延遲",
            "本服務依「現狀」提供，不提供任何明示或默示的保證，使用本服務的風險由使用者自行承擔",
            "因使用或無法使用本服務所產生的任何直接、間接損失，本服務開發者不負賠償責任（在法律允許的最大範圍內）",
          ]}
        />
      </LegalSection>

      <LegalSection title="6. 爬蟲行為聲明">
        <p>
          本服務擷取 PTT 公開頁面時，遵守合理的存取頻率（數分鐘一次），不進行高頻率、大量並發的請求，也不規避 PTT
          的存取限制措施。若 PTT 官方認為本服務的存取行為造成困擾，可聯繫開發者調整或停止爬蟲行為。
        </p>
      </LegalSection>

      <LegalSection title="7. 服務變更與終止">
        <p>本服務可能隨時修改功能、暫停或終止服務，不另行個別通知。帳號相關資料在使用者要求或帳號長期未使用時可能被清除。</p>
      </LegalSection>

      <LegalSection title="8. 條款修改">
        <p>本條款可能隨服務調整而更新，重大變更會盡量在服務內公告。持續使用本服務代表你同意最新版本的條款。</p>
      </LegalSection>

      <LegalSection title="9. 聯絡方式">
        <p>
          有任何問題、資料刪除需求、或內容下架要求，請透過{" "}
          <a
            href="https://github.com/tommy88520/ptt"
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline"
          >
            repo 的 GitHub Issues
          </a>{" "}
          聯繫開發者。
        </p>
      </LegalSection>
    </LegalPage>
  );
}
