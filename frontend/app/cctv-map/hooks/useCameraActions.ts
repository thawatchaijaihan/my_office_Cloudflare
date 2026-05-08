"use client";

import { useState } from "react";
import { Camera, CameraWithCheck } from "../data/types";
import { typeOptions } from "../components/FilterPanel";
import { compressImage } from "../utils/compressImage";
import { useDashboardAuth } from "../../dashboard/DashboardAuthContext";

const defaultType = typeOptions[0];

const mapCenter = {
    lat: 14.867212037496559,
    lng: 100.63490078774039,
};

type UseCameraActionsOptions = {
    mapRef: React.RefObject<google.maps.Map | null>;
    updateCamera: (id: string, updates: Partial<CameraWithCheck>) => Promise<void>;
    setSelectedCameraId: (id: string | null) => void;
    setActiveTypes: (types: React.SetStateAction<import("../data/types").CameraType[]>) => void;
    schedulePdfRegeneration: () => void;
};

export function useCameraActions({
    mapRef,
    updateCamera,
    setSelectedCameraId,
    setActiveTypes,
    schedulePdfRegeneration,
}: UseCameraActionsOptions) {
    const { getAuthHeaders } = useDashboardAuth();
    const [editingCamera, setEditingCamera] = useState<CameraWithCheck | null>(null);
    const [isAddingCamera, setIsAddingCamera] = useState(false);
    const [movingCameraId, setMovingCameraId] = useState<string | null>(null);
    const [openImages, setOpenImages] = useState<Record<string, boolean>>({});

    const handleStartAddCamera = () => {
        setIsAddingCamera(true);
        setEditingCamera(null);
        setMovingCameraId(null);
    };

    const handleAddCameraAtCenter = () => {
        if (!mapRef.current) return;
        const center = mapRef.current.getCenter();
        if (!center) return;
        setEditingCamera({
            id: "",
            name: "",
            description: "",
            type: defaultType,
            status: "online",
            lat: center.lat(),
            lng: center.lng(),
        });
    };

    const closeEditForm = () => {
        setEditingCamera(null);
    };

    const handleEditCamera = (camera: CameraWithCheck) => {
        setEditingCamera(camera);
        setIsAddingCamera(false);
        setMovingCameraId(null);
    };

    const handleSubmitEdit = async (camera: CameraWithCheck) => {
        if (editingCamera && camera.id) {
            // Edit mode (already handled by updateCamera which is passed in)
            updateCamera(camera.id, {
                name: camera.name.trim(),
                description: camera.description.trim(),
                type: camera.type,
                lat: Number.isFinite(camera.lat) ? camera.lat : editingCamera.lat,
                lng: Number.isFinite(camera.lng) ? camera.lng : editingCamera.lng,
            });
            closeEditForm();
        } else {
            // Add mode
            const newCamera: Omit<Camera, "id"> = {
                name: camera.name.trim(),
                description: camera.description.trim(),
                type: camera.type,
                status: camera.status,
                lat: Number.isFinite(camera.lat) ? camera.lat : mapCenter.lat,
                lng: Number.isFinite(camera.lng) ? camera.lng : mapCenter.lng,
            };

            try {
                const res = await fetch("https://api.capt-th.work/api/dashboard/cameras", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(newCamera),
                });
                if (!res.ok) throw new Error("Failed to add camera");
                const { id } = await res.json();
                
                setActiveTypes([newCamera.type]);
                setSelectedCameraId(String(id));
                if (mapRef.current) {
                    mapRef.current.panTo({ lat: newCamera.lat, lng: newCamera.lng });
                    mapRef.current.setZoom(21);
                }
                setIsAddingCamera(false);
            } catch (error) {
                console.error("Add camera failed", error);
                window.alert("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
            }
        }
    };

    const handleMoveCamera = (cameraId: string) => {
        setMovingCameraId(cameraId);
        setIsAddingCamera(false);
        setEditingCamera(null);
    };

    const confirmMoveCamera = () => {
        if (!mapRef.current || !movingCameraId) return;
        const center = mapRef.current.getCenter();
        if (!center) return;
        updateCamera(movingCameraId, {
            lat: center.lat(),
            lng: center.lng(),
        });
        setSelectedCameraId(movingCameraId);
        setMovingCameraId(null);
    };

    const cancelMoveCamera = () => {
        setMovingCameraId(null);
    };

    const handleDeleteCamera = async (camera: CameraWithCheck) => {
        const confirmDelete = window.confirm(
            `ลบกล้อง "${camera.name}" หรือไม่?`,
        );
        if (!confirmDelete) return;
        
        try {
            const res = await fetch(`https://api.capt-th.work/api/dashboard/cameras?id=${camera.id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Delete failed");
            setSelectedCameraId(null);
            // The polling/refresh logic in useCameraData will handle removing it from state
        } catch (error) {
            console.warn("[CCTV] delete camera failed:", error);
            window.alert("ลบกล้องไม่สำเร็จ (Permission denied หรือเครือข่ายผิดพลาด)");
        }
    };

    const handleUploadImage = async (camera: CameraWithCheck, file: File) => {
        try {
            // 1. Compress image as before
            const result = await compressImage(file);
            
            // 2. Convert Data URL back to Blob for uploading
            const response = await fetch(result);
            const blob = await response.blob();

            // 3. Prepare Form Data
            const formData = new FormData();
            formData.append("file", blob, "camera-check.jpg");
            formData.append("cameraId", camera.id);

            const authHeaders = await getAuthHeaders();
            const uploadRes = await fetch("https://api.capt-th.work/api/upload", {
                method: "POST",
                headers: { ...authHeaders },
                body: formData,
            });

            if (!uploadRes.ok) {
                throw new Error("Local upload failed");
            }

            const { url } = await uploadRes.json();

            // 5. Update local DB with the local URL
            await updateCamera(camera.id, {
                lastCheckedImage: url,
                lastCheckedImagePath: "", 
                lastCheckedAt: new Date().toISOString(),
            });

            schedulePdfRegeneration();
            setOpenImages((prev) => ({
                ...prev,
                [camera.id]: false,
            }));
        } catch (error) {
            console.error("Image upload failed", error);
            window.alert("บันทึกรูปไม่สำเร็จ กรุณาลองใหม่");
        }
    };

    const handleToggleImage = (id: string) => {
        setOpenImages((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    };

    return {
        editingCamera,
        setEditingCamera,
        isAddingCamera,
        setIsAddingCamera,
        movingCameraId,
        openImages,
        handleStartAddCamera,
        handleAddCameraAtCenter,
        closeEditForm,
        handleEditCamera,
        handleSubmitEdit,
        handleMoveCamera,
        confirmMoveCamera,
        cancelMoveCamera,
        handleDeleteCamera,
        handleUploadImage,
        handleToggleImage,
    };
}
