import { config } from "./config";

export type PersonnelDoc = {
  rank: string;
  firstName: string;
  lastName: string;
  phone: string;
  bank: string;
  accountNumber: string;
  citizenId: string;
  militaryId: string;
  duty: string;
  position: string;
  unit: string;
  birthplace: string;
  birthDate: string;
  registeredDate: string;
  enlistmentDate: string;
  rankDate: string;
  salary: string;
  age: string;
  retireYear: string;
  updatedAt: string;
};

export function personnelKeyByNameOnly(firstName: string, lastName: string): string {
  return `${firstName}_${lastName}`.trim().toLowerCase();
}

/**
 * Fetch personnel from Go backend instead of Firestore
 */
export async function getPersonnelRagContext(query: string, options?: { maxDocs?: number }) {
  const maxDocs = options?.maxDocs || 20;
  try {
    const url = `http://server:8080/api/admin/personnel/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "X-Admin-Key": config.admin.apiKey || "",
      },
    });

    if (!res.ok) {
      console.warn("[personnelDb] Go search failed:", res.statusText);
      return "";
    }

    const data = await res.json();
    const results: PersonnelDoc[] = data.results || [];
    
    if (results.length === 0) return "";

    const context = results.slice(0, maxDocs).map((p) => {
      return `กำลังพล: ${p.rank}${p.firstName} ${p.lastName}, เบอร์: ${p.phone}, ตำแหน่ง: ${p.position}, สังกัด: ${p.unit}, ธนาคาร: ${p.bank}, เลขบัญชี: ${p.accountNumber}, เลขประจำตัว: ${p.militaryId}`;
    }).join("\n");

    return context;
  } catch (error) {
    console.error("[personnelDb] search error:", error);
    return "";
  }
}

/**
 * Sync function now calls Go server sync instead of Firestore directly
 */
export async function setPersonnelBatch(docs: PersonnelDoc[]) {
  // This is now handled by the Go backend's SyncPersonnel
  return { written: 0, message: "Use /api/admin/sync-personnel instead" };
}
