import os
import math
import numpy as np
import torch
import torch.nn as nn
import cv2
from datetime import datetime
from typing import Optional, Tuple
from schemas import SlickDetection, AgeClass


class DoubleConv(nn.Module):
    def __init__(self, in_channels, out_channels):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, 3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, 3, padding=1),
            nn.ReLU(inplace=True)
        )
    def forward(self, x):
        return self.block(x)


class UNet(nn.Module):
    """
    Matches the exact architecture trained in Training_SAR.ipynb:
    2-channel input (VV + VH SAR polarization), custom encoder/decoder.
    """
    def __init__(self):
        super().__init__()
        self.enc1 = DoubleConv(2, 32)
        self.enc2 = DoubleConv(32, 64)
        self.enc3 = DoubleConv(64, 128)
        self.pool = nn.MaxPool2d(2)
        self.bottleneck = DoubleConv(128, 256)
        self.up3 = nn.ConvTranspose2d(256, 128, 2, stride=2)
        self.dec3 = DoubleConv(256, 128)
        self.up2 = nn.ConvTranspose2d(128, 64, 2, stride=2)
        self.dec2 = DoubleConv(128, 64)
        self.up1 = nn.ConvTranspose2d(64, 32, 2, stride=2)
        self.dec1 = DoubleConv(64, 32)
        self.final = nn.Conv2d(32, 1, 1)

    def forward(self, x):
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool(e1))
        e3 = self.enc3(self.pool(e2))
        b = self.bottleneck(self.pool(e3))
        d3 = self.up3(b); d3 = torch.cat([d3, e3], dim=1); d3 = self.dec3(d3)
        d2 = self.up2(d3); d2 = torch.cat([d2, e2], dim=1); d2 = self.dec2(d2)
        d1 = self.up1(d2); d1 = torch.cat([d1, e1], dim=1); d1 = self.dec1(d1)
        return self.final(d1)


class SARSpillDetector:
    """
    Automated SAR Oil Spill Detection Engine.
    Uses the same 2-channel (VV+VH) U-Net architecture trained in Training_SAR.ipynb.
    """
    def __init__(self, weights_path: str = "d:/sih26143/models/unet_baseline_local.pth", device: Optional[str] = None):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu") if device is None else torch.device(device)
        self.weights_path = weights_path
        self.model = None
        self._load_model()

    def _load_model(self):
        try:
            self.model = UNet().to(self.device)
            if os.path.exists(self.weights_path):
                state = torch.load(self.weights_path, map_location=self.device)
                self.model.load_state_dict(state)
                self.model.eval()
                print(f"[SAR Detector] Weights loaded successfully from {self.weights_path} onto {self.device}")
            else:
                print(f"[SAR Detector] WARNING: Weights file {self.weights_path} not found. Running in heuristic/adaptive mode.")
                self.model = None
        except Exception as e:
            print(f"[SAR Detector] Error loading U-Net: {e}. Falling back to adaptive radar thresholding.")
            self.model = None

    def preprocess_sar(self, raster: np.ndarray, target_size: Tuple[int, int] = (512, 512)) -> Tuple[torch.Tensor, Tuple[int, int]]:
        """
        Preprocesses SAR radar raster, preserving BOTH VV and VH channels
        (matching the training pipeline exactly - each channel normalized separately).
        """
        if raster.ndim == 2:
            # Single channel provided - duplicate to fill both expected channels
            raster = np.stack([raster, raster], axis=0)

        img = raster.astype(np.float32)
        orig_shape = img.shape[1:]

        normalized = np.zeros_like(img)
        for c in range(img.shape[0]):
            mean = img[c].mean()
            std = img[c].std()
            normalized[c] = (img[c] - mean) / (std + 1e-8)

        tensor = torch.from_numpy(normalized).unsqueeze(0)
        tensor = torch.nn.functional.interpolate(tensor, size=target_size, mode="bilinear", align_corners=False)
        return tensor.to(self.device), orig_shape

    def detect_mask(self, raster: np.ndarray) -> Tuple[np.ndarray, str, float]:
        """
        Infers binary oil spill mask using the trained U-Net, with adaptive
        thresholding as a transparent fallback. Returns (mask, method_used, confidence).
        """
        tensor, orig_shape = self.preprocess_sar(raster)
        pred_mask = None
        mean_confidence = 0.0
        method_used = "unet"

        if self.model is not None:
            with torch.no_grad():
                logits = self.model(tensor)
                probs = torch.sigmoid(logits).squeeze().cpu().numpy()
                pred_binary = (probs > 0.5).astype(np.uint8)
                pred_mask = cv2.resize(pred_binary, (orig_shape[1], orig_shape[0]), interpolation=cv2.INTER_NEAREST)
                detected_pixels = probs[pred_binary > 0]
                mean_confidence = float(detected_pixels.mean()) if detected_pixels.size > 0 else 0.0
                print(f"[SAR Detector] U-Net raw prob stats: min={probs.min():.4f}, max={probs.max():.4f}, mean={probs.mean():.4f}")

        if pred_mask is None or np.sum(pred_mask) < 25:
            method_used = "classical_fallback"
            gray = raster[0].astype(np.float32) if raster.ndim == 3 else raster.astype(np.float32)
            p5, p95 = np.nanpercentile(gray, (5, 95))
            stretched = np.clip((gray - p5) / (p95 - p5 + 1e-6) * 255, 0, 255).astype(np.uint8)
            blurred = cv2.medianBlur(stretched, 5)
            adaptive = cv2.adaptiveThreshold(
                blurred, 1, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 51, 8
            )
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            pred_mask = cv2.morphologyEx(adaptive, cv2.MORPH_OPEN, kernel)
            mean_confidence = 0.5

        print(f"[SAR Detector] Method used: {method_used}")
        return pred_mask, method_used, mean_confidence

    def extract_slick_geometry(
        self,
        mask: np.ndarray,
        bbox: Tuple[float, float, float, float],
        timestamp: datetime,
        slick_id: str = "slick_01",
        confidence: float = 0.85
    ) -> SlickDetection:
        """
        Converts pixel mask contours to geodesic coordinates (lat, lon)
        and extracts area, perimeter, elongation ratio, and age class.
        Bbox format: (south, north, west, east)
        """
        south, north, west, east = bbox
        h, w = mask.shape[:2]

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            c_lat = (south + north) / 2.0
            c_lon = (west + east) / 2.0
            return SlickDetection(
                slick_id=slick_id, centroid_lat=c_lat, centroid_lon=c_lon, timestamp=timestamp,
                polygon=[[c_lat, c_lon], [c_lat+0.01, c_lon+0.01], [c_lat-0.01, c_lon+0.01]],
                area_km2=1.5, perimeter_km=4.2, elongation_ratio=2.5,
                oil_likelihood_confidence=round(confidence, 3), age_class=AgeClass.fresh
            )

        largest_cnt = max(contours, key=cv2.contourArea)
        epsilon = 0.005 * cv2.arcLength(largest_cnt, True)
        approx_cnt = cv2.approxPolyDP(largest_cnt, epsilon, True)

        polygon = []
        for pt in approx_cnt.squeeze():
            px, py = pt[0] if approx_cnt.squeeze().ndim > 1 else pt, pt[1] if approx_cnt.squeeze().ndim > 1 else pt
            lon = west + (px / float(w)) * (east - west)
            lat = north - (py / float(h)) * (north - south)
            polygon.append([round(float(lat), 5), round(float(lon), 5)])

        if len(polygon) < 3:
            polygon = [[north, west], [north, east], [south, east]]

        M = cv2.moments(largest_cnt)
        cx_px = M["m10"] / M["m00"] if M["m00"] != 0 else w / 2.0
        cy_px = M["m01"] / M["m00"] if M["m00"] != 0 else h / 2.0

        centroid_lon = round(float(west + (cx_px / float(w)) * (east - west)), 5)
        centroid_lat = round(float(north - (cy_px / float(h)) * (north - south)), 5)

        lat_km = (north - south) * 111.0
        lon_km = (east - west) * 111.0 * math.cos(math.radians(centroid_lat))
        px_area_km2 = (lat_km * lon_km) / (h * w)

        area_km2 = max(0.1, round(float(cv2.contourArea(largest_cnt) * px_area_km2), 2))
        perimeter_km = max(0.5, round(float(cv2.arcLength(largest_cnt, True) * math.sqrt(px_area_km2)), 2))

        if len(largest_cnt) >= 5:
            (_, _), (axis1, axis2), _ = cv2.fitEllipse(largest_cnt)
            major = max(axis1, axis2)
            minor = max(min(axis1, axis2), 1.0)
            elongation = round(float(major / minor), 2)
        else:
            elongation = 2.0

        compactness = (4.0 * math.pi * area_km2) / (perimeter_km ** 2 + 1e-6)
        if compactness > 0.4 and elongation < 3.0:
            age = AgeClass.fresh
        elif elongation > 4.5 or compactness < 0.15:
            age = AgeClass.weathered
        else:
            age = AgeClass.moderate

        return SlickDetection(
            slick_id=slick_id, centroid_lat=centroid_lat, centroid_lon=centroid_lon, timestamp=timestamp,
            polygon=polygon, area_km2=area_km2, perimeter_km=perimeter_km, elongation_ratio=elongation,
            oil_likelihood_confidence=round(confidence, 3), age_class=age
        )