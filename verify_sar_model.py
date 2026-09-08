import sys
sys.path.insert(0, r"d:\sih26143")
import numpy as np
import rasterio
from app.sar.detector import SARSpillDetector

detector = SARSpillDetector(weights_path=r"d:\sih26143\sar_unet_oilspill.pth")

# Use a REAL image + REAL ground truth mask from your teammate's dataset
IMAGE_PATH = "D:/SIH_OilSpill/training_data/raw/images/Oil/00001.tif"
MASK_PATH = "D:/SIH_OilSpill/training_data/raw/masks_extracted/Oil/Mask_oil/00001.tif"

with rasterio.open(IMAGE_PATH) as src:
    real_sar = src.read().astype(np.float32)

with rasterio.open(MASK_PATH) as src:
    ground_truth = src.read(1).astype(np.float32)

mask, method, confidence = detector.detect_mask(real_sar)

# Compare against real ground truth
gt_binary = (ground_truth > 0.5).astype(np.uint8)
pred_binary = (mask > 0).astype(np.uint8)

# Resize if needed to match
if gt_binary.shape != pred_binary.shape:
    import cv2
    pred_binary = cv2.resize(pred_binary, (gt_binary.shape[1], gt_binary.shape[0]), interpolation=cv2.INTER_NEAREST)

intersection = np.logical_and(gt_binary, pred_binary).sum()
union = np.logical_or(gt_binary, pred_binary).sum()
iou = intersection / union if union > 0 else 0.0

print(f"\nMethod used: {method}")
print(f"Model confidence: {confidence:.4f}")
print(f"Real IoU vs ground truth: {iou:.4f}")