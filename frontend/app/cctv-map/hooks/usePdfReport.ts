"use client";

import { useEffect, useRef, useState } from "react";
import { CameraWithCheck } from "../data/types";
import { generateCctvReport, savePdfCache } from "../utils/PdfReportGenerator";

const FUNCTIONS_URL = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL || 
  "https://asia-southeast1-jaihan-assistant.cloudfunctions.net";

export function usePdfReport(cameraItems: CameraWithCheck[]) {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [cachedPdfUrl, setCachedPdfUrl] = useState<string | null>(null);
    const [isPdfOutdated, setIsPdfOutdated] = useState(false);
    const [newPdfUrl, setNewPdfUrl] = useState<string | null>(null);
    const [pdfReady, setPdfReady] = useState(false);
    const pdfGenerationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        checkPdfStatus();
    }, []);

    const checkPdfStatus = async () => {
        try {
            const res = await fetch("/api/cctv/upload-pdf");
            if (res.ok) {
                const data = await res.json();
                setCachedPdfUrl(data.url);
                setIsPdfOutdated(false); // We'll just assume it's fresh enough for now
            }
        } catch (error) {
            console.warn("[CCTV] load cctvReport failed:", error);
        }
    };

    const regeneratePdf = async (): Promise<string | null> => {
        try {
            console.log('[CctvMap] เริ่มสร้าง PDF ใหม่ (client-side)...');
            const pdfBlob = await generateCctvReport(cameraItems);
            if (!pdfBlob) {
                console.error('[CctvMap] PDF blob is null');
                return null;
            }
            console.log('[CctvMap] PDF blob size:', pdfBlob.size);

            const formData = new FormData();
            formData.append("file", pdfBlob, "report.pdf");

            const res = await fetch("/api/cctv/upload-pdf", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) throw new Error("Failed to upload PDF");
            const data = await res.json();
            const pdfUrl = data.url;

            console.log('[CctvMap] PDF URL:', pdfUrl);
            savePdfCache(pdfUrl, cameraItems);

            setCachedPdfUrl(pdfUrl);
            setIsPdfOutdated(false);
            setNewPdfUrl(pdfUrl);
            setPdfReady(true);
            return pdfUrl;
        } catch (e) {
            console.error('[CctvMap] PDF generation failed:', e);
            return null;
        }
    };

    const openPdfUrl = (url: string) => {
        console.log('[CctvMap] openPdfUrl called with:', url);
        const telegramWebApp = (window as Window & {
            Telegram?: {
                WebApp?: {
                    openLink?: (href: string, options?: Record<string, unknown>) => void;
                };
            };
        }).Telegram?.WebApp;

        if (telegramWebApp?.openLink) {
            console.log('[CctvMap] Using Telegram WebApp openLink');
            telegramWebApp.openLink(url, { try_instant_view: false });
            return;
        }

        console.log('[CctvMap] Using regular link click');
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleOpenPdf = () => {
        if (cachedPdfUrl && !isPdfOutdated) {
            openPdfUrl(cachedPdfUrl);
        } else {
            setPdfReady(false);
            setNewPdfUrl(null);
            setIsGeneratingPdf(true);
            regeneratePdf()
                .then(() => {
                    // ไม่เปิดอัตโนมัติ ให้ผู้ใช้กดปุ่มดาวน์โหลดเอง
                })
                .catch((error) => {
                    console.error('PDF generation failed:', error);
                    alert('สร้าง PDF ไม่สำเร็จ');
                })
                .finally(() => {
                    // ไม่ปิด modal ให้แสดงปุ่มดาวน์โหลด
                });
        }
    };

    const schedulePdfRegeneration = () => {
        setIsPdfOutdated(true);
        if (pdfGenerationTimeoutRef.current) {
            clearTimeout(pdfGenerationTimeoutRef.current);
        }
        pdfGenerationTimeoutRef.current = setTimeout(() => {
            regeneratePdf();
        }, 3000);
    };

    return {
        isGeneratingPdf,
        setIsGeneratingPdf,
        cachedPdfUrl,
        isPdfOutdated,
        newPdfUrl,
        setNewPdfUrl,
        pdfReady,
        setPdfReady,
        handleOpenPdf,
        schedulePdfRegeneration,
    };
}
