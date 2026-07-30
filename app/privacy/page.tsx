import type { Metadata } from "next";
import { LegalPage, LegalSection, LegalList } from "@/app/components/legal";

export const metadata: Metadata = {
  title: "隱私權政策｜PTT MacShop 雷達",
  description: "PTT MacShop 雷達如何蒐集、使用、保存你的資料。",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="隱私權政策"
      updated="2026-07-30"
      intro="本文件說明「PTT MacShop 雷達」（以下稱「本服務」）如何蒐集、使用、保存你的資料。"
    >
      <LegalSection title="1. 我們蒐集哪些資料">
        <p>透過 Discord 登入時，本服務只會取得 Discord 提供的下列公開資訊（OAuth2 identify 範圍）：</p>
        <LegalList items={["Discord 使用者 ID(一串數字,用來識別你的帳號)", "Discord 使用者名稱(顯示用)"]} />
        <p>除此之外，我們還會儲存：</p>
        <LegalList
          items={[
            "你設定的訂閱關鍵字，以及訂閱建立時間",
            "非本服務擁有者的帳號,每日收到的通知次數,僅用於每日 20 篇的額度控管,隔天自動失效重算",
            "網頁瀏覽次數的統計(依頁面路徑 + 日期彙總的數字,不會記錄是誰瀏覽、也不會記錄 IP 位址或裝置資訊)",
          ]}
        />
        <p>
          我們<strong>不會</strong>蒐集：email、真實姓名、電話、付款資訊（除非未來加入付費功能，屆時會更新本政策並另行告知）、你的
          Discord 密碼、你在 Discord 上的訊息或伺服器內容。
        </p>
      </LegalSection>

      <LegalSection title="2. Cookie 使用">
        <p>本服務只使用一個必要性 cookie：登入後的身分驗證 session（session），用來記得你已經登入。這個 cookie：</p>
        <LegalList
          items={[
            "設定為 httpOnly,網頁的 JavaScript 無法讀取",
            "內容經過簽章加密,不是明文",
            "7 天後自動過期,或登出時立即清除",
            "不是廣告或追蹤用途的 cookie,本服務不使用任何第三方廣告/追蹤 cookie",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. 資料如何使用">
        <LegalList
          items={[
            "Discord 使用者 ID:用來對應你的訂閱關鍵字、發送符合條件的 Discord 私訊通知",
            "訂閱關鍵字:用來比對新文章標題,決定要不要通知你",
            "頁面瀏覽統計:純粹用來了解網站使用狀況,協助開發者判斷要不要繼續投入這個專案",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. 資料會不會分享給第三方">
        <p>不會。你的 Discord ID、訂閱關鍵字不會被賣給、分享給、或用於本服務以外的任何第三方。會接觸到你資料的服務只有：</p>
        <LegalList
          items={[
            <>
              <strong>Discord</strong>:登入驗證、發送私訊通知,受{" "}
              <a
                href="https://discord.com/privacy"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                Discord 隱私權政策
              </a>{" "}
              規範
            </>,
            <>
              <strong>Amazon Web Services(AWS)</strong>
              :本服務的後端資料庫、伺服器都架在 AWS 上(目前在東京 ap-northeast-1 機房),資料實際存放在這裡
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="5. 資料保存多久">
        <LegalList
          items={[
            "訂閱關鍵字:會保留到你自己取消訂閱為止",
            "每日通知計數:2 天後自動刪除(用資料庫的 TTL 機制自動清除,不用手動處理)",
            "頁面瀏覽統計:目前沒有自動清除機制,會持續累積",
          ]}
        />
      </LegalSection>

      <LegalSection title="6. 你的權利">
        <p>你可以隨時：</p>
        <LegalList
          items={[
            "在「訂閱管理」頁面自行刪除任何訂閱關鍵字",
            "要求刪除你在本服務留下的所有資料(透過下方聯絡方式提出,會盡快處理)",
            "登出後,身分驗證 cookie 會立即失效",
          ]}
        />
      </LegalSection>

      <LegalSection title="7. 資料安全">
        <LegalList
          items={[
            "網頁與後端 API 之間的通訊全程使用 HTTPS 加密",
            "後端 AWS 資源(資料庫、API)都設定了最小權限存取控制,沒有對外公開的管理介面",
            "Discord 傳來的請求會驗證數位簽章,確保不是偽造的",
          ]}
        />
        <p>沒有任何系統能保證 100% 安全，若發生資料外洩事件，會依情節透過本服務或聯絡方式告知受影響的使用者。</p>
      </LegalSection>

      <LegalSection title="8. 未成年使用者">
        <p>
          本服務透過 Discord 登入，使用資格與年齡限制比照{" "}
          <a
            href="https://discord.com/terms"
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline"
          >
            Discord 服務條款
          </a>{" "}
          的規定（需年滿 13 歲，部分地區門檻更高）。本服務不會主動向未成年人蒐集額外個資。
        </p>
      </LegalSection>

      <LegalSection title="9. 政策修改">
        <p>本政策可能隨服務調整而更新，重大變更會盡量在服務內公告。持續使用本服務代表你同意最新版本的政策。</p>
      </LegalSection>

      <LegalSection title="10. 聯絡方式">
        <p>
          有任何隱私相關問題、或想要求刪除資料，請透過{" "}
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
