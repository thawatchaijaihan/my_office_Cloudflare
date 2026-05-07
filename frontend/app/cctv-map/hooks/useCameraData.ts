"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";

import initialCamerasData from "../data/cctv-cameras-backup.json";
import { Camera, CameraType, CameraWithCheck } from "../data/types";
import { typeOptions } from "../components/FilterPanel";

const defaultType = typeOptions[0];

const logDbWarning = (action: string, error: unknown) => {
    console.warn(`[CCTV] ${action} failed:`, error);
};

type UseCameraDataOptions = {
    searchTerm: string;
    activeTypes: CameraType[];
};

export function useCameraData({ searchTerm, activeTypes }: UseCameraDataOptions) {
    const [cameraItems, setCameraItems] = useState<CameraWithCheck[]>([]);
    const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

    // Load from localStorage + fetch from local API
    useEffect(() => {
        if (typeof window !== "undefined") {
            const cached = window.localStorage.getItem("cctv:cameras");
            if (cached) {
                try {
                    const parsed = JSON.parse(cached) as CameraWithCheck[];
                    if (Array.isArray(parsed)) {
                        setCameraItems(parsed);
                    }
                } catch {
                    window.localStorage.removeItem("cctv:cameras");
                }
            }
        }

        const fetchCameras = async () => {
            try {
                const res = await fetch("/api/dashboard/cameras");
                if (!res.ok) throw new Error("Failed to fetch cameras");
                const list = await res.json() as CameraWithCheck[];
                
                // Sort and clean up if needed
                list.sort((a, b) => a.name.localeCompare(b.name));
                
                setCameraItems(list);
                if (typeof window !== "undefined") {
                    window.localStorage.setItem("cctv:cameras", JSON.stringify(list));
                    window.localStorage.setItem("cctv:cameras:cachedAt", new Date().toISOString());
                }
                setSelectedCameraId((prev) =>
                    prev && list.some((item) => String(item.id) === String(prev)) ? prev : null,
                );
            } catch (error) {
                logDbWarning("load cameras", error);
            }
        };

        fetchCameras();
        
        // Polling as a substitute for Realtime (optional, every 30s)
        const interval = setInterval(fetchCameras, 30000);
        return () => clearInterval(interval);
    }, []);

    const filteredCameras = useMemo(() => {
        const normalized = searchTerm.trim().toLowerCase();
        return cameraItems.filter((camera) => {
            const matchesType = activeTypes.includes(camera.type);
            if (!matchesType) return false;
            if (!normalized) return true;
            const haystack = [
                camera.name,
                camera.description,
                camera.id,
                camera.type,
                camera.status,
            ]
                .join(" ")
                .toLowerCase();
            return haystack.includes(normalized);
        });
    }, [searchTerm, activeTypes, cameraItems]);

    const listCameras = useMemo(() => filteredCameras, [filteredCameras]);

    const selectedCamera = useMemo(() => {
        if (!selectedCameraId) return null;
        return cameraItems.find((camera) => camera.id === selectedCameraId) ?? null;
    }, [cameraItems, selectedCameraId]);

    const updateCamera = useCallback(
        async (id: string, updates: Partial<CameraWithCheck>) => {
            try {
                const res = await fetch("/api/dashboard/cameras", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: Number(id), ...updates }),
                });
                if (!res.ok) throw new Error("Failed to update camera");
                
                // Locally update state to feel fast
                setCameraItems((prev) => 
                    prev.map((c) => String(c.id) === String(id) ? { ...c, ...updates } : c)
                );
            } catch (error) {
                logDbWarning("update camera", error);
            }
        },
        [],
    );

    return {
        cameraItems,
        selectedCameraId,
        setSelectedCameraId,
        filteredCameras,
        listCameras,
        selectedCamera,
        updateCamera,
    };
}
