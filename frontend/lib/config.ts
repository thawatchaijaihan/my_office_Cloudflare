/**
 * Environment configuration
 * ค่าจะถูก validate ตอน runtime ใน webhook
 */

function getEnv(key: string): string {
  return (process.env[key] ?? "").trim();
}

export const config = {
  telegram: {
    botToken: getEnv("TELEGRAM_BOT_TOKEN"),
    adminUserIds: (process.env.ADMIN_TELEGRAM_USER_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && s !== "NONE"),
    /** URL แดชบอร์ด Web App (สำหรับปุ่มเปิดใน Telegram) */
    dashboardUrl: getEnv("TELEGRAM_DASHBOARD_URL"),
  },
  admin: {
    apiKey: getEnv("ADMIN_API_KEY"),
    /** โฮสต์ที่เข้าแดชบอร์ดได้โดยไม่ต้องใส่ key (คั่นด้วย comma) เช่น localhost */
    allowedDashboardHosts: (process.env.ALLOWED_DASHBOARD_HOSTS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },
  google: {
    serviceAccountKeyBase64: getEnv("GOOGLE_SERVICE_ACCOUNT_KEY_BASE64"),
    sheetsId: getEnv("GOOGLE_SHEETS_ID"),
    /** ชีต "ฐานข้อมูลกำลังพล" (index + รายชื่อกำลังพล + bank). ถ้าไม่ตั้ง ใช้ GOOGLE_SHEETS_ID */
    personnelSheetsId: getEnv("GOOGLE_SHEETS_ID_PERSONNEL") || getEnv("GOOGLE_SHEETS_ID"),
    indexSheetGid: process.env.INDEX_SHEET_GID
      ? Number(process.env.INDEX_SHEET_GID.trim())
      : undefined,
    slipSheetGid: process.env.SLIP_SHEET_GID
      ? Number(process.env.SLIP_SHEET_GID.trim())
      : undefined,
    /** GID สำหรับแท็บเบอร์โทรศัพท์ (ถ้ามี) */
    phoneSheetGid: process.env.PHONE_SHEET_GID
      ? Number(process.env.PHONE_SHEET_GID.trim())
      : undefined,
    /** GID สำหรับแท็บข้อมูลกำลังพล */
    personnelSheetGid: process.env.PERSONNEL_SHEET_GID
      ? Number(process.env.PERSONNEL_SHEET_GID.trim())
      : undefined,
  },
  gemini: {
    apiKey: getEnv("GEMINI_API_KEY"),
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite",
  },
  rag: {
    /** path เทียบกับ project root เช่น content/knowledge.md ถ้าว่างหรือ "inline" ใช้เนื้อหาใน code */
    knowledgePath: getEnv("RAG_KNOWLEDGE_PATH") || "content/knowledge.md",
  },
} as const;
